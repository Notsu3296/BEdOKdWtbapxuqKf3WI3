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

let placedGroup = null;

let canPlace = false;
let currentMessage = "";

let arButton = null;
let layerButtonsContainer = null;

let uiTouched = false;

const info = document.querySelector("#info");

const MODEL_SCALE = 1;

const MODEL_ROTATION_X = 0;
const MODEL_ROTATION_Y = 0;
const MODEL_ROTATION_Z = 0;

const MODEL_OFFSET_Y = 0.05;

const MODEL_FILES = [
  "889_4",
  "889_3",
  "889_2",
  "889_1"
];

const loadedModels = {};

init();
animate();

function setInfo(message) {
  if (currentMessage === message) {
    return;
  }

  currentMessage = message;
  info.innerHTML = `<p>${message}</p>`;
}

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
    loadAllModels();
    createReticle();
    createController();
    createLayerButtons();
    hideLayerButtons();
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
    setInfo("このブラウザはWebXRに対応していません。");
    return;
  }

  navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
    if (supported) {
      setInfo("3Dモデルを読み込み中...");
    } else {
      setInfo("この端末ではARを起動できません。");
    }
  });
}

function createARButton() {
  arButton = ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: {
      root: document.body
    }
  });

  arButton.classList.add(
    "ar-start-button",
    "ar-loading"
  );

  arButton.textContent = "LOADING...";

  arButton.addEventListener("click", () => {
    arButton.classList.remove("ar-start-button");
    arButton.classList.add("ar-stop-button");

    showLayerButtons();
  });

  document.body.appendChild(arButton);
}

function loadAllModels() {
  const loader = new GLTFLoader();

  let loadedCount = 0;

  MODEL_FILES.forEach((name) => {
    loader.load(
      `./model/${name}.glb?v=1`,

      (gltf) => {
        loadedModels[name] = gltf.scene;

        loadedCount++;

        setInfo(
          `3Dモデル読込中...<br>${loadedCount} / ${MODEL_FILES.length}`
        );

        if (loadedCount === MODEL_FILES.length) {
          if (arButton) {
            arButton.classList.remove("ar-loading");
            arButton.textContent = "START AR";
          }

          setInfo(
            "3Dモデル読み込み完了。<br>ARを開始してください。"
          );
        }
      },

      undefined,

      (error) => {
        setInfo(`モデル読込失敗：${name}`);
        console.error(error);
      }
    );
  });
}

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

function createController() {
  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);
}

function onSelect() {
  if (uiTouched) {
    return;
  }

  // すでに配置済みなら、以降のタップでは再配置しない
  if (placedGroup) {
    return;
  }

  if (Object.keys(loadedModels).length !== MODEL_FILES.length) {
    setInfo("モデルを読み込み中です。");
    return;
  }

  if (!canPlace || !reticle.visible) {
    setInfo("端末をゆっくり動かして、白い輪を探してください。");
    return;
  }

  placedGroup = new THREE.Group();

  MODEL_FILES.forEach((name) => {
    const clone = loadedModels[name].clone(true);
    clone.visible = true;
    placedGroup.add(clone);
  });

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  reticle.matrix.decompose(
    position,
    quaternion,
    scale
  );

  placedGroup.position.copy(position);
  placedGroup.position.y += MODEL_OFFSET_Y;

  placedGroup.quaternion.copy(quaternion);

  placedGroup.rotateX(MODEL_ROTATION_X);
  placedGroup.rotateY(MODEL_ROTATION_Y);
  placedGroup.rotateZ(MODEL_ROTATION_Z);

  placedGroup.scale.set(
    MODEL_SCALE,
    MODEL_SCALE,
    MODEL_SCALE
  );

  scene.add(placedGroup);

  resetLayerButtonStates();

  setInfo(
    "配置完了。<br>右側ボタンで表示切替できます。"
  );
}

function createLayerButtons() {

  layerButtonsContainer =
    document.createElement("div");

  layerButtonsContainer.id =
    "layer-buttons";

  MODEL_FILES.forEach((name, index) => {

    const button =
      document.createElement("button");

    button.className =
      "layer-button";

    button.textContent =
      name;

    button.dataset.layer =
      index;

    // 初期状態は表示中
    button.classList.remove(
      "inactive"
    );

    button.addEventListener(
      "pointerdown",
      (event) => {

        event.preventDefault();
        event.stopPropagation();

        uiTouched = true;

        setTimeout(() => {

          uiTouched = false;

        }, 300);

      }
    );

    button.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();

        if (!placedGroup) {
          return;
        }

        const model =
          placedGroup.children[index];

        model.visible =
          !model.visible;

        // 非表示時だけ半透明
        button.classList.toggle(
          "inactive",
          !model.visible
        );

      }
    );

    layerButtonsContainer.appendChild(
      button
    );

  });

  document.body.appendChild(
    layerButtonsContainer
  );

}

function showLayerButtons() {
  if (layerButtonsContainer) {
    layerButtonsContainer.style.display = "flex";
  }
}

function hideLayerButtons() {
  if (layerButtonsContainer) {
    layerButtonsContainer.style.display = "none";
  }
}

function resetLayerButtonStates() {

  if (!layerButtonsContainer) {
    return;
  }

  const buttons =
    layerButtonsContainer.querySelectorAll(
      ".layer-button"
    );

  buttons.forEach((button) => {

    button.classList.remove(
      "inactive"
    );

  });

}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
      setInfo(
        "端末をゆっくり動かして<br>床や机を認識してください"
      );

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
      const hitTestResults =
        frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);

        reticle.visible = !placedGroup;
        reticle.matrix.fromArray(pose.transform.matrix);

        canPlace = true;

        if (!placedGroup) {
          setInfo(
            "白い輪の位置をタップして<br>配置します"
          );
        }
      } else {
        reticle.visible = false;
        canPlace = false;
      }
    }
  }

  renderer.render(scene, camera);
}

function resetARState() {
  hitTestSourceRequested = false;
  hitTestSource = null;
  canPlace = false;

  if (reticle) {
    reticle.visible = false;
  }

  if (placedGroup) {
    scene.remove(placedGroup);
    placedGroup = null;
  }

  hideLayerButtons();

  setTimeout(() => {
    window.location.reload();
  }, 150);
}

function onWindowResize() {
  camera.aspect =
    window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}