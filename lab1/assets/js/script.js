function scaleImageMaps() {
  document.querySelectorAll("img[usemap]").forEach((img) => {
    const mapName = img.getAttribute("usemap");
    if (!mapName) return;
    const map = document.querySelector(mapName.startsWith("#") ? mapName : `#${mapName}`);
    if (!map) return;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    if (!naturalWidth || !naturalHeight) return;
    const currentWidth = img.clientWidth;
    const currentHeight = img.clientHeight || (currentWidth * naturalHeight) / naturalWidth;
    const ratioX = currentWidth / naturalWidth;
    const ratioY = currentHeight / naturalHeight;

    map.querySelectorAll("area").forEach((area) => {
      if (!area.dataset.originalCoords) {
        area.dataset.originalCoords = area.coords;
      }
      const rawCoords = (area.dataset.originalCoords || "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => !Number.isNaN(value));
      if (rawCoords.length === 0) return;
      const scaled = rawCoords.map((value, index) =>
        index % 2 === 0 ? Math.round(value * ratioX) : Math.round(value * ratioY)
      );
      area.coords = scaled.join(",");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const resizeHandler = () => scaleImageMaps();
  scaleImageMaps();
  window.addEventListener("resize", resizeHandler);
});
