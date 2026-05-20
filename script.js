import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let camera;
let scene;
let renderer;
let controller;
let reticle;

let hitTestSource = null;
let hitTestSourceRequested = false;

let loadedModel = null;
let placedModel = null;

let canPlace = false;
let currentMessage = "";

const info = document.querySelector("#info");

function setInfo(message) {

  if (currentMessage === message) {
    return;
  }

  currentMessage = message;

  info.innerHTML = `<p>${message}</p>`;
}

// =========================
// モデル設定
// =========================

const MODEL_SCALE = 1;

const MODEL_ROTATION_X = 0;
const MODEL_ROTATION_Y = 0;
const MODEL_ROTATION_Z = 0;

const MODEL_OFFSET_Y = 0.05;

// =========================

init();
animate();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(1, 2, 1);
  scene.add(dirLight);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;

  document.body.appendChild(renderer.domElement);

  if (!isIOS()) {
    checkWebXRSupport();
    createARButton();
    loadModel();
    createReticle();
    createController();
  }

  window.addEventListener("resize", onWindowResize);
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function checkWebXRSupport() {
  if (!navigator.xr) {
    info.innerHTML = "<p>このブラウザはWebXRに対応していません。</p>";
    return;
  }

  navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
    if (supported) {
      info.innerHTML = "<p>Android：画面中央のARボタンから起動してください。</p>";
    } else {
      info.innerHTML = "<p>この端末ではARを起動できません。</p>";
    }
  });
}

function createARButton() {
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"]
  });

  button.classList.add("ar-button-center");

  document.body.appendChild(button);
}

function loadModel() {
  const loader = new GLTFLoader();

  loader.load(
    "./model/Statue01.glb?v=3",

    (gltf) => {
      loadedModel = gltf.scene;

      loadedModel.scale.set(
        MODEL_SCALE,
        MODEL_SCALE,
        MODEL_SCALE
      );

      info.innerHTML = "<p>ARを開始してください。</p>";
    },

    undefined,

    (error) => {
      info.innerHTML = "<p>モデル読込失敗。</p>";
      console.error(error);
    }
  );
}

function createReticle() {
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65
    })
  );

  reticle.matrixAutoUpdate = false;
  reticle.visible = false;

  scene.add(reticle);
}

function createController() {
  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);
}

function onSelect() {
  if (!loadedModel) {
    info.innerHTML = "<p>モデルを読み込み中です。</p>";
    return;
  }

  if (!canPlace || !reticle.visible) {
    info.innerHTML = "<p>端末をゆっくり動かして、白い輪を探してください。</p>";
    return;
  }

  if (placedModel) {
    scene.remove(placedModel);
    placedModel = null;
  }

  placedModel = loadedModel.clone(true);

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  reticle.matrix.decompose(position, quaternion, scale);

  placedModel.position.copy(position);
  placedModel.position.y += MODEL_OFFSET_Y;

  placedModel.quaternion.copy(quaternion);

  placedModel.rotateX(MODEL_ROTATION_X);
  placedModel.rotateY(MODEL_ROTATION_Y);
  placedModel.rotateZ(MODEL_ROTATION_Z);

  placedModel.scale.set(
    MODEL_SCALE,
    MODEL_SCALE,
    MODEL_SCALE
  );

  placedModel.visible = true;
  scene.add(placedModel);

  info.innerHTML = "<p>配置完了。端末を動かして観察できます。</p>";
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
      info.innerHTML = "<p>端末をゆっくり動かして、床や机を認識してください。</p>";

      session.requestReferenceSpace("viewer").then((viewerSpace) => {
        session.requestHitTestSource({
          space: viewerSpace
        }).then((source) => {
          hitTestSource = source;
        });
      });

      session.addEventListener("end", () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
        canPlace = false;

        if (reticle) {
          reticle.visible = false;
        }

        if (placedModel) {
          scene.remove(placedModel);
          placedModel = null;
        }

        info.innerHTML = "<p>AR終了。</p>";
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);

        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);

        canPlace = true;

        if (!placedModel) {
          info.innerHTML = "<p>白い輪の位置をタップして配置します。</p>";
        }
      } else {
        reticle.visible = false;
        canPlace = false;

        if (!placedModel) {
          info.innerHTML = "<p>端末をゆっくり動かして、床や机を認識してください。</p>";
        }
      }
    }
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}