const target = document.querySelector("#target");
const model = document.querySelector("#model");

let hasFound = false;

target.addEventListener("targetFound", () => {
    console.log("Marker Found");

    hasFound = true;

    model.setAttribute("visible", true);
});

target.addEventListener("targetLost", () => {
    console.log("Marker Lost");

    if (hasFound) {
        model.setAttribute("visible", true);
    }
});
