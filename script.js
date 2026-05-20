const target = document.querySelector("#target");
const model = document.querySelector("#model");

target.addEventListener("targetFound", () => {
  console.log("Marker Found");
  model.setAttribute("visible", true);
});

target.addEventListener("targetLost", () => {
  console.log("Marker Lost");
  model.setAttribute("visible", true);
});
