const target = document.querySelector("#target");
const trackedModel = document.querySelector("#trackedModel");
const fixedModel = document.querySelector("#fixedModel");

let isFixed = false;

target.addEventListener("targetFound", () => {
  console.log("Marker Found");

  if (isFixed) return;

  trackedModel.setAttribute("visible", true);

  const trackedObject = trackedModel.object3D;
  const fixedObject = fixedModel.object3D;

  trackedObject.updateMatrixWorld(true);

  trackedObject.getWorldPosition(fixedObject.position);
  trackedObject.getWorldQuaternion(fixedObject.quaternion);
  trackedObject.getWorldScale(fixedObject.scale);

  fixedModel.setAttribute("visible", true);
  trackedModel.setAttribute("visible", false);

  isFixed = true;

  console.log("Model Fixed");
});
