import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import "./style.scss";

let audioAnalyser;
let audioVolume = 0;

async function setupAudioInput() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 512;

        const bufferLength = audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        source.connect(audioAnalyser);

        const updateAudio = () => {
            audioAnalyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            audioVolume = sum / dataArray.length / 255;
            requestAnimationFrame(updateAudio);
        };

        updateAudio();
    } catch (err) {
        console.error('Microphone access denied or error:', err);
    }
}

setupAudioInput();

const canvas = document.querySelector("#experience-canvas");
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color("#BFD4DB");

const camera = new THREE.PerspectiveCamera(
    10,
    sizes.width / sizes.height,
    0.1,
    200
);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
});

renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 5;
controls.maxDistance = 45;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI / 2;
controls.minAzimuthAngle = 0;
controls.maxAzimuthAngle = Math.PI / 2;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

let cakeModel = new THREE.Group();
scene.add(cakeModel);

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10000, 10000),
    new THREE.ShadowMaterial({ opacity: 0.2 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 1.55;
floor.receiveShadow = true;
scene.add(floor);

const flameParticlesArray = [];

let initialCameraPosition = { x: 17.5, y: 9.1, z: 17.85 };
let initialControlsTarget = { x: 0.46, y: 1.97, z: -0.83 };

if (window.innerWidth < 768) {
    initialCameraPosition = { x: 29.57, y: 14.02, z: 31.37 };
    initialControlsTarget = { x: -0.08, y: 3.31, z: -0.74 };
}

camera.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
controls.target.set(initialControlsTarget.x, initialControlsTarget.y, initialControlsTarget.z);

window.addEventListener("resize", () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const gltfLoader = new GLTFLoader();

gltfLoader.load(
    '/static/models/BirthdayCake/BirthdayCake.glb',
    (gltf) => {
        cakeModel = gltf.scene;
        scene.add(cakeModel);

        cakeModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const boundingBox = new THREE.Box3().setFromObject(cakeModel);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);

        controls.target.set(center.x, center.y, center.z);
        const cameraOffset = new THREE.Vector3(3, 8, 12);
        camera.position.set(center.x + cameraOffset.x, center.y + cameraOffset.y, center.z + cameraOffset.z);
        camera.lookAt(center);
        controls.update();

        const candleMesh = gltf.scene.getObjectByName("Candle");
        const candlePositions = [];

        if (candleMesh && candleMesh.geometry) {
            const geometry = candleMesh.geometry.clone();
            geometry.applyMatrix4(candleMesh.matrixWorld);

            const posAttr = geometry.getAttribute("position");
            const pointsMap = new Map();

            for (let i = 0; i < posAttr.count; i++) {
                const x = posAttr.getX(i);
                const y = posAttr.getY(i) + 0.1;
                const z = posAttr.getZ(i);

                const key = `${x.toFixed(2)}|${z.toFixed(2)}`;
                if (!pointsMap.has(key) || pointsMap.get(key).y < y) {
                    pointsMap.set(key, new THREE.Vector3(x, y, z));
                }
            }

            candlePositions.push(...pointsMap.values());
        } else {
            console.warn("No mesh named 'Candle' with geometry found.");
        }

        for (const pos of candlePositions) {
            const flame = createChunkyFlameParticles(pos);
            flameParticlesArray.push(...flame);
            flame.forEach(p => scene.add(p));
        }
    },
    undefined,
    (error) => {
        console.error('An error happened', error);
    }
);

function createChunkyFlameParticles(position) {
    const flames = [];

    for (let i = 0; i < 3; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array([position.x, position.y, position.z]);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const color = new THREE.Color();
        const hue = 0.08 + Math.random() * 0.08;
        const saturation = 0.5;
        const lightness = 0.5 + Math.random() * 0.2;
        color.setHSL(hue, saturation, lightness);

        const material = new THREE.PointsMaterial({
            size: 0.08,
            sizeAttenuation: true,
            transparent: true,
            opacity: 1,
            color: color,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const flame = new THREE.Points(geometry, material);
        const randomDir = new THREE.Vector3(
            (Math.random() - 0.5),
            (Math.random() - 0.2),
            (Math.random() - 0.5)
        ).normalize(); // direction to spread

        flame.userData = {
            basePosition: position.clone(),
            direction: randomDir,
            phase: Math.random() * Math.PI * 2,
            wiggleAmplitude: 0.01 + Math.random() * 0.02,
            wiggleSpeed: 2 + Math.random() * 2,
            currentSpread: 0
        };


        flames.push(flame);
    }

    return flames;
}

const ambientLight = new THREE.AmbientLight(0xffcd74, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xFFF3DA, 4);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(2048, 2048);
directionalLight.shadow.camera.far = 30;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.bottom = -10;
directionalLight.position.set(-5, 10, 5);
scene.add(directionalLight);


const clock = new THREE.Clock();
let previousTime = 0;

const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - previousTime;
    previousTime = elapsedTime;

    controls.update();
    renderer.render(scene, camera);
    window.requestAnimationFrame(tick);

    for (const flame of flameParticlesArray) {
        const base = flame.userData.basePosition;
        const dir = flame.userData.direction;

        const targetSpread = audioVolume * 20;

        if (flame.userData.currentSpread < targetSpread) {
            flame.userData.currentSpread += (targetSpread - flame.userData.currentSpread) * 0.2;
        } else {
            flame.userData.currentSpread += (targetSpread - flame.userData.currentSpread) * 0.008;
        }

        const spread = flame.userData.currentSpread;
        const wiggle = flame.userData.wiggleAmplitude * Math.sin(elapsedTime * flame.userData.wiggleSpeed + flame.userData.phase);

        const newX = base.x + dir.x * spread + Math.sin(elapsedTime + flame.userData.phase) * 0.01;
        const newY = base.y + dir.y * spread + wiggle;
        const newZ = base.z + dir.z * spread + Math.cos(elapsedTime + flame.userData.phase) * 0.01;

        const position = flame.geometry.attributes.position;
        position.setXYZ(0, newX, newY, newZ);
        position.needsUpdate = true;
    }
};

tick();
