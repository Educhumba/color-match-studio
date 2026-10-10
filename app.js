const imageInput = document.querySelector("#imageInput");
const imageStage = document.querySelector("#imageStage");
const imageCanvas = document.querySelector("#imageCanvas");
const imageCtx = imageCanvas.getContext("2d", { willReadFrequently: true });
const emptyState = document.querySelector("#emptyState");
const loupe = document.querySelector("#loupe");
const loupeCanvas = document.querySelector("#loupeCanvas");
const loupeCtx = loupeCanvas.getContext("2d", { willReadFrequently: true });
const loupeValue = document.querySelector("#loupeValue");
const zoomRange = document.querySelector("#zoomRange");
const fitButton = document.querySelector("#fitButton");
const oneToOneButton = document.querySelector("#oneToOneButton");
const sampleButton = document.querySelector("#sampleButton");
const sampleReadout = document.querySelector("#sampleReadout");
const sampleChip = document.querySelector("#sampleChip");
const sampleHex = document.querySelector("#sampleHex");
const imageCompareButton = document.querySelector("#imageCompareButton");
const imageCompare = document.querySelector("#imageCompare");
const compareCanvas = document.querySelector("#compareCanvas");
const compareCtx = compareCanvas.getContext("2d", { willReadFrequently: true });
const compareColor = document.querySelector("#compareColor");

const colorField = document.querySelector("#colorField");
const fieldCursor = document.querySelector("#fieldCursor");
const hueRange = document.querySelector("#hueRange");
const satRange = document.querySelector("#satRange");
const valRange = document.querySelector("#valRange");
const hueValue = document.querySelector("#hueValue");
const satValue = document.querySelector("#satValue");
const valValue = document.querySelector("#valValue");
const matchChip = document.querySelector("#matchChip");
const matchHex = document.querySelector("#matchHex");
const hexInput = document.querySelector("#hexInput");
const rgbInput = document.querySelector("#rgbInput");
const hslInput = document.querySelector("#hslInput");
const copyHexButton = document.querySelector("#copyHexButton");
const copyHexSmall = document.querySelector("#copyHexSmall");
const copyRgbButton = document.querySelector("#copyRgbButton");
const copyHslButton = document.querySelector("#copyHslButton");
const toast = document.querySelector("#toast");

let sourceImage = null;
let imageBitmap = null;
let imageScale = 1;
let imageOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = null;
let sampleMode = false;
let showImageCompare = true;
let lastPointerImagePoint = null;
let toastTimer = null;
const hsv = { h: 16, s: 75, v: 85 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resizeCanvasToStage() {
  const rect = imageStage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  imageCanvas.width = Math.max(1, Math.round(rect.width * dpr));
  imageCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  imageCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawImageCanvas();
  drawCompareCanvas();
}

function fitImage() {
  if (!imageBitmap) return;
  const rect = imageStage.getBoundingClientRect();
  const scale = Math.min(rect.width / imageBitmap.width, rect.height / imageBitmap.height);
  imageScale = clamp(scale, 0.1, 4);
  imageOffset = {
    x: (rect.width - imageBitmap.width * imageScale) / 2,
    y: (rect.height - imageBitmap.height * imageScale) / 2,
  };
  zoomRange.value = Math.round(imageScale * 100);
  drawImageCanvas();
}

function drawImageCanvas() {
  const rect = imageStage.getBoundingClientRect();
  imageCtx.clearRect(0, 0, rect.width, rect.height);
  if (!imageBitmap) return;
  imageCtx.imageSmoothingEnabled = imageScale < 3;
  imageCtx.drawImage(
    imageBitmap,
    imageOffset.x,
    imageOffset.y,
    imageBitmap.width * imageScale,
    imageBitmap.height * imageScale,
  );
}

function drawCompareCanvas() {
  const rect = imageCompare.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  compareCanvas.width = Math.max(1, Math.round(rect.width / 2 * dpr));
  compareCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  compareCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  compareCtx.clearRect(0, 0, rect.width / 2, rect.height);
  if (!sourceImage) return;

  compareCtx.imageSmoothingEnabled = true;
  const width = rect.width / 2;
  const height = rect.height;
  let sx = 0;
  let sy = 0;
  let sw = sourceImage.naturalWidth;
  let sh = sourceImage.naturalHeight;

  if (lastPointerImagePoint) {
    const cropSize = Math.min(sourceImage.naturalWidth, sourceImage.naturalHeight, 220);
    sw = cropSize;
    sh = cropSize;
    sx = clamp(lastPointerImagePoint.x - cropSize / 2, 0, sourceImage.naturalWidth - cropSize);
    sy = clamp(lastPointerImagePoint.y - cropSize / 2, 0, sourceImage.naturalHeight - cropSize);
  } else {
    const sourceRatio = sourceImage.naturalWidth / sourceImage.naturalHeight;
    const targetRatio = width / height;
    if (sourceRatio > targetRatio) {
      sw = sourceImage.naturalHeight * targetRatio;
      sx = (sourceImage.naturalWidth - sw) / 2;
    } else {
      sh = sourceImage.naturalWidth / targetRatio;
      sy = (sourceImage.naturalHeight - sh) / 2;
    }
  }

  compareCtx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, width, height);
}

function stagePointToImagePoint(clientX, clientY) {
  if (!imageBitmap) return null;
  const rect = imageStage.getBoundingClientRect();
  const stageX = clientX - rect.left;
  const stageY = clientY - rect.top;
  const x = Math.floor((stageX - imageOffset.x) / imageScale);
  const y = Math.floor((stageY - imageOffset.y) / imageScale);
  if (x < 0 || y < 0 || x >= imageBitmap.width || y >= imageBitmap.height) return null;
  return { x, y, stageX, stageY };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(normalized)) return null;
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return {
    h,
    s: Math.round((max === 0 ? 0 : delta / max) * 100),
    v: Math.round(max * 100),
  };
}

function hsvToRgb(h, s, v) {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgbPrime = [0, 0, 0];
  if (h < 60) rgbPrime = [c, x, 0];
  else if (h < 120) rgbPrime = [x, c, 0];
  else if (h < 180) rgbPrime = [0, c, x];
  else if (h < 240) rgbPrime = [0, x, c];
  else if (h < 300) rgbPrime = [x, 0, c];
  else rgbPrime = [c, 0, x];
  return {
    r: Math.round((rgbPrime[0] + m) * 255),
    g: Math.round((rgbPrime[1] + m) * 255),
    b: Math.round((rgbPrime[2] + m) * 255),
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
  }
  if (h < 0) h += 360;
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function setHsv(next) {
  hsv.h = clamp(Math.round(next.h ?? hsv.h), 0, 360);
  hsv.s = clamp(Math.round(next.s ?? hsv.s), 0, 100);
  hsv.v = clamp(Math.round(next.v ?? hsv.v), 0, 100);
  updateColorUi();
}

function updateColorUi() {
  const rgb = hsvToRgb(hsv.h === 360 ? 0 : hsv.h, hsv.s, hsv.v);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const cssColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

  colorField.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`;
  fieldCursor.style.left = `${hsv.s}%`;
  fieldCursor.style.top = `${100 - hsv.v}%`;
  hueRange.value = hsv.h;
  satRange.value = hsv.s;
  valRange.value = hsv.v;
  hueValue.value = hsv.h;
  satValue.value = hsv.s;
  valValue.value = hsv.v;
  matchChip.style.background = cssColor;
  compareColor.style.background = cssColor;
  matchHex.textContent = hex;
  hexInput.value = hex;
  rgbInput.value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  hslInput.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

function setSampleColor(rgb) {
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  sampleChip.classList.remove("checker");
  sampleChip.style.background = hex;
  sampleHex.textContent = hex;
  sampleReadout.textContent = `${hex} at ${lastPointerImagePoint.x}, ${lastPointerImagePoint.y}`;
  drawCompareCanvas();
}

function applySampleToMatcher(rgb) {
  setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
}

function sampleAtImagePoint(point) {
  if (!sourceImage || !point) return null;
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sourceImage.naturalWidth;
  sampleCanvas.height = sourceImage.naturalHeight;
  const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(sourceImage, 0, 0);
  const pixel = ctx.getImageData(point.x, point.y, 1, 1).data;
  return { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] };
}

function updateLoupe(point, clientX, clientY) {
  if (!imageBitmap || !point) {
    loupe.hidden = true;
    return;
  }

  const rgb = sampleAtImagePoint(point);
  if (!rgb) return;
  const size = 14;
  loupeCtx.imageSmoothingEnabled = false;
  loupeCtx.clearRect(0, 0, loupeCanvas.width, loupeCanvas.height);
  loupeCtx.drawImage(
    sourceImage,
    clamp(point.x - size / 2, 0, imageBitmap.width - size),
    clamp(point.y - size / 2, 0, imageBitmap.height - size),
    size,
    size,
    0,
    0,
    loupeCanvas.width,
    loupeCanvas.height,
  );
  loupeCtx.strokeStyle = "#ffffff";
  loupeCtx.lineWidth = 2;
  loupeCtx.strokeRect(52, 52, 8, 8);
  loupeValue.textContent = rgbToHex(rgb.r, rgb.g, rgb.b);

  const stageRect = imageStage.getBoundingClientRect();
  const x = clientX - stageRect.left + 18;
  const y = clientY - stageRect.top + 18;
  loupe.style.left = `${clamp(x, 8, stageRect.width - 138)}px`;
  loupe.style.top = `${clamp(y, 8, stageRect.height - 146)}px`;
  loupe.hidden = false;
}

async function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    sourceImage = img;
    imageBitmap = await createImageBitmap(img);
    emptyState.hidden = true;
    drawCompareCanvas();
    fitImage();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function setColorFromField(clientX, clientY) {
  const rect = colorField.getBoundingClientRect();
  const s = ((clientX - rect.left) / rect.width) * 100;
  const v = 100 - ((clientY - rect.top) / rect.height) * 100;
  setHsv({ s, v });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1500);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(`Copied ${value}`);
  } catch {
    hexInput.select();
    document.execCommand("copy");
    showToast("Copied");
  }
}

imageInput.addEventListener("change", (event) => loadFile(event.target.files[0]));

imageStage.addEventListener("dragover", (event) => {
  event.preventDefault();
});

imageStage.addEventListener("drop", (event) => {
  event.preventDefault();
  loadFile(event.dataTransfer.files[0]);
});

imageStage.addEventListener("pointerdown", (event) => {
  const point = stagePointToImagePoint(event.clientX, event.clientY);
  if (sampleMode && point) {
    lastPointerImagePoint = point;
    const rgb = sampleAtImagePoint(point);
    setSampleColor(rgb);
    applySampleToMatcher(rgb);
    return;
  }
  if (!imageBitmap) return;
  isPanning = true;
  imageStage.setPointerCapture(event.pointerId);
  panStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: imageOffset.x,
    offsetY: imageOffset.y,
  };
});

imageStage.addEventListener("pointermove", (event) => {
  const point = stagePointToImagePoint(event.clientX, event.clientY);
  lastPointerImagePoint = point;
  updateLoupe(point, event.clientX, event.clientY);
  if (!isPanning || !panStart) return;
  imageOffset.x = panStart.offsetX + event.clientX - panStart.x;
  imageOffset.y = panStart.offsetY + event.clientY - panStart.y;
  drawImageCanvas();
});

imageStage.addEventListener("pointerleave", () => {
  loupe.hidden = true;
});

imageStage.addEventListener("pointerup", (event) => {
  isPanning = false;
  panStart = null;
  if (imageStage.hasPointerCapture(event.pointerId)) {
    imageStage.releasePointerCapture(event.pointerId);
  }
});

zoomRange.addEventListener("input", () => {
  if (!imageBitmap) return;
  const rect = imageStage.getBoundingClientRect();
  const oldScale = imageScale;
  imageScale = Number(zoomRange.value) / 100;
  const center = { x: rect.width / 2, y: rect.height / 2 };
  imageOffset.x = center.x - ((center.x - imageOffset.x) / oldScale) * imageScale;
  imageOffset.y = center.y - ((center.y - imageOffset.y) / oldScale) * imageScale;
  drawImageCanvas();
});

fitButton.addEventListener("click", fitImage);

oneToOneButton.addEventListener("click", () => {
  if (!imageBitmap) return;
  const rect = imageStage.getBoundingClientRect();
  imageScale = 1;
  zoomRange.value = 100;
  imageOffset = {
    x: (rect.width - imageBitmap.width) / 2,
    y: (rect.height - imageBitmap.height) / 2,
  };
  drawImageCanvas();
});

sampleButton.addEventListener("click", () => {
  sampleMode = !sampleMode;
  sampleButton.setAttribute("aria-pressed", String(sampleMode));
  sampleButton.textContent = sampleMode ? "Sampling" : "Sample";
});

imageCompareButton.addEventListener("click", () => {
  showImageCompare = !showImageCompare;
  imageCompare.hidden = !showImageCompare;
  imageCompareButton.setAttribute("aria-pressed", String(showImageCompare));
});

colorField.addEventListener("pointerdown", (event) => {
  colorField.setPointerCapture(event.pointerId);
  setColorFromField(event.clientX, event.clientY);
});

colorField.addEventListener("pointermove", (event) => {
  if (event.buttons !== 1) return;
  setColorFromField(event.clientX, event.clientY);
});

colorField.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 10 : 1;
  if (event.key === "ArrowRight") setHsv({ s: hsv.s + step });
  else if (event.key === "ArrowLeft") setHsv({ s: hsv.s - step });
  else if (event.key === "ArrowUp") setHsv({ v: hsv.v + step });
  else if (event.key === "ArrowDown") setHsv({ v: hsv.v - step });
  else return;
  event.preventDefault();
});

hueRange.addEventListener("input", () => setHsv({ h: Number(hueRange.value) }));
satRange.addEventListener("input", () => setHsv({ s: Number(satRange.value) }));
valRange.addEventListener("input", () => setHsv({ v: Number(valRange.value) }));

hexInput.addEventListener("change", () => {
  const rgb = hexToRgb(hexInput.value);
  if (!rgb) {
    hexInput.value = matchHex.textContent;
    showToast("Invalid HEX");
    return;
  }
  setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
});

copyHexButton.addEventListener("click", () => copyText(hexInput.value));
copyHexSmall.addEventListener("click", () => copyText(hexInput.value));
copyRgbButton.addEventListener("click", () => copyText(rgbInput.value));
copyHslButton.addEventListener("click", () => copyText(hslInput.value));

window.addEventListener("resize", resizeCanvasToStage);

resizeCanvasToStage();
updateColorUi();
