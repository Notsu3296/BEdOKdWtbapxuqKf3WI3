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

let arButton = null;

const info = document.querySelector("#info");

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

// =========================
// メッセージ管理
// =========================

function setInfo(message) {
  if (currentMessage === message) {
    return;
  }

  currentMessage = message;
  info.innerHTML = `<p>${message}</p>`;
}

// =========================
// 初期化
// =========================

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

// =========================
// iOS判定
// =========================

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// =========================
// WebXR対応確認
// =========================

function checkWebXRSupport() {
  if (!navigator.xr) {
    setInfo("このブラウザはWebXRに対応していません。");
    return;
  }

  navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
    if (supported) {
      setInfo("画面中央のARボタンから起動してください。");
    } else {
      setInfo("この端末ではARを起動できません。");
    }
  });
}

// =========================
// ARボタン
// =========================

function createARButton() {
  arButton = ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: {
      root: document.body
    }
  });

  arButton.classList.add("ar-start-button");

  arButton.addEventListener("click", () => {
    arButton.classList.remove("ar-start-button");
    arButton.classList.add("ar-stop-button");
  });

  document.body.appendChild(arButton);
}

// =========================
// モデル読込
// =========================

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

      setInfo("ARを開始してください。");
    },

    undefined,

    (error) => {
      setInfo("モデル読込失敗。");
      console.error(error);
    }
  );
}

// =========================
// 白い輪
// =========================

function createReticle() {
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(
      0.08,
      0.1,
      32
    ).rotateX(-Math.PI / 2),

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

// =========================
// タップ検知
// =========================

function createController() {
  controller = renderer.xr.getController(0);

  controller.addEventListener(
    "select",
    onSelect
  );

  scene.add(controller);
}

// =========================
// モデル配置
// =========================

function onSelect() {
  if (!loadedModel) {
    setInfo("モデルを読み込み中です。");
    return;
  }

  if (!canPlace || !reticle.visible) {
    setInfo("端末をゆっくり動かして、白い輪を探してください。");
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

  reticle.matrix.decompose(
    position,
    quaternion,
    scale
  );

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

  setInfo("配置完了。端末を動かして観察できます。");
}

// =========================
// ループ
// =========================

function animate() {
  renderer.setAnimationLoop(render);
}

// =========================
// 描画
// =========================

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
      setInfo("端末をゆっくり動かして、床や机を認識してください。");

      session
        .requestReferenceSpace("viewer")
        .then((viewerSpace) => {
          session
            .requestHitTestSource({
              space: viewerSpace
            })
            .then((source) => {
              hitTestSource = source;
            });
        });

      session.addEventListener("end", () => {
        resetARState();
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
          setInfo("白い輪の位置をタップして配置します。");
        }
      } else {
        reticle.visible = false;
        canPlace = false;

        if (!placedModel) {
          setInfo("端末をゆっくり動かして、床や机を認識してください。");
        }
      }
    }
  }

  renderer.render(scene, camera);
}

// =========================
// AR終了時リセット
// =========================

function resetARState() {
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

  // Android WebXRの白画面対策
  // AR終了後、開始ページを再読み込みする
  setTimeout(() => {
    window.location.reload();
  }, 150);
}

// =========================
// リサイズ
// =========================

function onWindowResize() {
  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}