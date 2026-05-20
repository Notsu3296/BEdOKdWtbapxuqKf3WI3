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

const info = document.querySelector("#info");

// =========================
// モデル設定
// =========================

// モデルサイズ
const MODEL_SCALE = 1;

// モデル回転
const MODEL_ROTATION_X = 0;
const MODEL_ROTATION_Y = 0;
const MODEL_ROTATION_Z = 0;

// 高さ補正
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

  // ライト
  const hemiLight = new THREE.HemisphereLight(
    0xffffff,
    0xbbbbff,
    3
  );

  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(
    0xffffff,
    2
  );

  dirLight.position.set(1, 2, 1);

  scene.add(dirLight);

  // レンダラー
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });

  renderer.setPixelRatio(
    window.devicePixelRatio
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.xr.enabled = true;

  document.body.appendChild(
    renderer.domElement
  );

  // iOSではARButtonを出さない
  if (!isIOS()) {

    checkWebXRSupport();

    createARButton();

    loadModel();

    createReticle();

    createController();

  }

  window.addEventListener(
    "resize",
    onWindowResize
  );
}

// =========================
// iOS判定
// =========================

function isIOS() {

  return (
    /iPad|iPhone|iPod/.test(
      navigator.userAgent
    ) ||
    (
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    )
  );

}

// =========================
// WebXR確認
// =========================

function checkWebXRSupport() {

  if (!navigator.xr) {

    info.innerHTML =
      "<p>このブラウザはWebXRに対応していません。</p>";

    return;

  }

  navigator.xr
    .isSessionSupported("immersive-ar")
    .then((supported) => {

      if (supported) {

        info.innerHTML =
          "<p>Android：画面下のARボタンから起動してください。</p>";

      } else {

        info.innerHTML =
          "<p>この端末ではARを起動できません。</p>";

      }

    });

}

// =========================
// ARボタン
// =========================

function createARButton() {

  const button = ARButton.createButton(
    renderer,
    {
      requiredFeatures: ["hit-test"]
    }
  );

  button.style.position = "fixed";

  button.style.bottom = "24px";

  button.style.left = "50%";

  button.style.transform =
    "translateX(-50%)";

  button.style.zIndex = "9999";

  document.body.appendChild(button);

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

      info.innerHTML =
        "<p>モデル読込完了!</p>";

    },

    undefined,

    (error) => {

      info.innerHTML =
        "<p>モデル読込失敗。</p>";

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
      color: 0xffffff
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

  controller =
    renderer.xr.getController(0);

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

  if (!reticle.visible) {

    info.innerHTML =
      "<p>白い輪が出てからタップしてください。</p>";

    return;

  }

  if (!loadedModel) {

    info.innerHTML =
      "<p>モデル未読込です。</p>";

    return;

  }

  // 既存削除
  if (placedModel) {

    scene.remove(placedModel);

    placedModel = null;

  }

  placedModel =
    loadedModel.clone(true);

  const position =
    new THREE.Vector3();

  const quaternion =
    new THREE.Quaternion();

  const scale =
    new THREE.Vector3();

  reticle.matrix.decompose(
    position,
    quaternion,
    scale
  );

  // 位置
  placedModel.position.copy(
    position
  );

  // 少し浮かせる
  placedModel.position.y +=
    MODEL_OFFSET_Y;

  // 床向きに合わせる
  placedModel.quaternion.copy(
    quaternion
  );

  // モデル回転補正
  placedModel.rotateX(
    MODEL_ROTATION_X
  );

  placedModel.rotateY(
    MODEL_ROTATION_Y
  );

  placedModel.rotateZ(
    MODEL_ROTATION_Z
  );

  // サイズ
  placedModel.scale.set(
    MODEL_SCALE,
    MODEL_SCALE,
    MODEL_SCALE
  );

  placedModel.visible = true;

  scene.add(placedModel);

  info.innerHTML =
    "<p>モデル配置完了。</p>";

}

// =========================
// ループ
// =========================

function animate() {

  renderer.setAnimationLoop(
    render
  );

}

// =========================
// 描画
// =========================

function render(timestamp, frame) {

  if (frame) {

    const referenceSpace =
      renderer.xr.getReferenceSpace();

    const session =
      renderer.xr.getSession();

    if (!hitTestSourceRequested) {

      session
        .requestReferenceSpace(
          "viewer"
        )
        .then((viewerSpace) => {

          session
            .requestHitTestSource({
              space: viewerSpace
            })
            .then((source) => {

              hitTestSource = source;

            });

        });

      session.addEventListener(
        "end",
        () => {

          hitTestSourceRequested =
            false;

          hitTestSource = null;

          if (reticle) {

            reticle.visible = false;

          }

          if (placedModel) {

            scene.remove(
              placedModel
            );

            placedModel = null;

          }

          info.innerHTML =
            "<p>AR終了。</p>";

        }
      );

      hitTestSourceRequested =
        true;

    }

    if (hitTestSource) {

      const hitTestResults =
        frame.getHitTestResults(
          hitTestSource
        );

      if (
        hitTestResults.length > 0
      ) {

        const hit =
          hitTestResults[0];

        const pose =
          hit.getPose(
            referenceSpace
          );

        reticle.visible = true;

        reticle.matrix.fromArray(
          pose.transform.matrix
        );

      } else {

        reticle.visible = false;

      }

    }

  }

  renderer.render(
    scene,
    camera
  );

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