const target = document.querySelector("#target");
const trackedModel = document.querySelector("#trackedModel");
const fixedRoot = document.querySelector("#fixedRoot");

let fixed = false;

target.addEventListener("targetFound", () => {
  if (fixed) return;

  const targetObj = target.object3D;
  const fixedObj = fixedRoot.object3D;

  targetObj.updateMatrixWorld(true);

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  targetObj.matrixWorld.decompose(position, quaternion, scale);

  fixedObj.position.copy(position);
  fixedObj.quaternion.copy(quaternion);

  fixedRoot.setAttribute("visible", true);
  trackedModel.setAttribute("visible", false);

  fixed = true;

  console.log("Model fixed to marker position");
});
