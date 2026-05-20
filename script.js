import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { ARButton } from "https://unpkg.com/three@0.165.0/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "https://unpkg.com/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";

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

  checkWebXRSupport();
  createARButton();

  loadModel();
  createReticle();
  createController();

  window.addEventListener("resize", onWindowResize);
}

function checkWebXRSupport() {
  if (!navigator.xr) {
    info.innerHTML = "<p>このブラウザはWebXRに対応していません。</p>";
    return;
  }

  navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
    if (supported) {
      info.innerHTML = "<p>AR対応しています。画面下のARボタンを押してください。</p>";
    } else {
      info.innerHTML = "<p>この端末・ブラウザではARを起動できません。</p>";
    }
  });
}

function createARButton() {
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"]
  });

  button.style.position = "fixed";
  button.style.bottom = "24px";
  button.style.left = "50%";
  button.style.transform = "translateX(-50%)";
  button.style.zIndex = "9999";

  document.body.appendChild(button);
}

function loadModel() {
  const loader = new GLTFLoader();

  loader.load(
    "./model/Statue01.glb",
    (gltf) => {
      loadedModel = gltf.scene;
      loadedModel.scale.set(0.3, 0.3, 0.3);
      loadedModel.rotation.set(Math.PI / 2, 0, 0);

      info.innerHTML = "<p>モデル読込完了。ARボタンを押してください。</p>";
    },
    undefined,
    (error) => {
      info.innerHTML = "<p>モデル読込に失敗しました。model/Statue01.glb を確認してください。</p>";
      console.error(error);
    }
  );
}

function createReticle() {
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
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
  if (!reticle.visible) {
    info.innerHTML = "<p>床や机に白い輪が出てからタップしてください。</p>";
    return;
  }

  if (!loadedModel) {
    info.innerHTML = "<p>モデルをまだ読み込めていません。</p>";
    return;
  }

  if (!placedModel) {
    placedModel = loadedModel.clone(true);
    scene.add(placedModel);
  }

  placedModel.position.setFromMatrixPosition(reticle.matrix);
  placedModel.quaternion.setFromRotationMatrix(reticle.matrix);
  placedModel.visible = true;

  info.innerHTML = "<p>モデルを配置しました。端末を動かして観察できます。</p>";
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace("viewer").then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
        });
      });

      session.addEventListener("end", () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
        reticle.visible = false;
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
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}