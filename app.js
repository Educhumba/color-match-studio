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
const zoomValue = document.querySelector("#zoomValue");
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
const liveOrb = document.querySelector("#liveOrb");
const deltaReadout = document.querySelector("#deltaReadout");
const harmonyRow = document.querySelector("#harmonyRow");
const historyRow = document.querySelector("#historyRow");
const saveColorButton = document.querySelector("#saveColorButton");
const sampleChipButton = document.querySelector("#sampleChipButton");
const matchChipButton = document.querySelector("#matchChipButton");

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
const copyAllButton = document.querySelector("#copyAllButton");
const toast = document.querySelector("#toast");
const toastMessage = document.querySelector("#toastMessage");

let sourceImage = null;
let imageBitmap = null;
let sampleSource = null;
let imageScale = 1;
let imageOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = null;
let sampleMode = false;
let showImageCompare = true;
let lastPointerImagePoint = null;
let lastSampleRgb = null;
let toastTimer = null;
const hsv = { h: 16, s: 75, v: 85 };
const PALETTE_KEY = "color-match-studio-palette";
const savedColors = loadSavedColors();

function loadSavedColors() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PALETTE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value).trim())
      .filter((hex) => /^#?[0-9a-f]{3}$|^#?[0-9a-f]{6}$/i.test(hex))
      .map((hex) => (hex.startsWith("#") ? hex.toLowerCase() : `#${hex.toLowerCase()}`))
      .slice(0, 10);
  } catch {
    return [];
  }
}

function persistSavedColors() {
  localStorage.setItem(PALETTE_KEY, JSON.stringify(savedColors));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wrapHue(h) {
  return ((h % 360) + 360) % 360;
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

function fitImage({ quiet } = {}) {
  if (!imageBitmap) {
    if (!quiet) showToast("Upload an image before fitting the canvas.", "warn");
    return;
  }
  const rect = imageStage.getBoundingClientRect();
  const scale = Math.min(rect.width / imageBitmap.width, rect.height / imageBitmap.height);
  imageScale = clamp(scale, 0.1, 4);
  imageOffset = {
    x: (rect.width - imageBitmap.width * imageScale) / 2,
    y: (rect.height - imageBitmap.height * imageScale) / 2,
  };
  zoomRange.value = Math.round(imageScale * 100);
  zoomValue.value = `${zoomRange.value}%`;
  drawImageCanvas();
  if (!quiet) showToast("Image fitted to the canvas.", "info");
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
  compareCanvas.width = Math.max(1, Math.round((rect.width / 2) * dpr));
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

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.round(Math.sqrt(dr * dr + dg * dg + db * db));
}

function currentRgb() {
  return hsvToRgb(hsv.h === 360 ? 0 : hsv.h, hsv.s, hsv.v);
}

function currentCodes() {
  const rgb = currentRgb();
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return {
    rgb,
    hex,
    rgbText: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    hslText: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
  };
}

function renderHarmony() {
  const hues = [
    { label: "Match", h: hsv.h },
    { label: "Analog", h: wrapHue(hsv.h - 30) },
    { label: "Analog", h: wrapHue(hsv.h + 30) },
    { label: "Triad", h: wrapHue(hsv.h + 120) },
    { label: "Triad", h: wrapHue(hsv.h - 120) },
    { label: "Complement", h: wrapHue(hsv.h + 180) },
  ];
  harmonyRow.replaceChildren(
    ...hues.map((item) => {
      const rgb = hsvToRgb(item.h, Math.max(hsv.s, 35), Math.max(hsv.v, 45));
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "swatch";
      button.title = `${item.label} ${hex}`;
      button.style.background = hex;
      button.addEventListener("click", () => {
        setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
        showToast(`Applied ${item.label.toLowerCase()} ${hex}`, "info");
      });
      return button;
    }),
  );
}

function renderHistory() {
  if (!savedColors.length) {
    const empty = document.createElement("span");
    empty.className = "history-empty";
    empty.textContent = "Save a color to keep it nearby. Shift-click a swatch to remove it.";
    historyRow.replaceChildren(empty);
    return;
  }
  historyRow.replaceChildren(
    ...savedColors.map((hex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "swatch";
      button.title = `Restore ${hex}. Shift-click to remove.`;
      button.style.background = hex;
      button.addEventListener("click", (event) => {
        if (event.shiftKey) {
          const index = savedColors.indexOf(hex);
          if (index >= 0) savedColors.splice(index, 1);
          persistSavedColors();
          renderHistory();
          showToast(`Removed ${hex} from saved colors.`, "info");
          return;
        }
        const rgb = hexToRgb(hex);
        if (!rgb) return;
        setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
        showToast(`Restored ${hex}`, "info");
      });
      return button;
    }),
  );
}

function saveCurrentColor({ quiet } = {}) {
  const { hex } = currentCodes();
  if (savedColors[0] === hex) {
    if (!quiet) showToast(`${hex} is already saved.`, "info");
    return;
  }
  savedColors.unshift(hex);
  if (savedColors.length > 10) savedColors.pop();
  persistSavedColors();
  renderHistory();
  if (!quiet) showToast(`Saved ${hex} to your palette.`, "success");
}

function updateDelta() {
  if (!lastSampleRgb) {
    deltaReadout.textContent = "Sample a pixel to compare closeness with the match color.";
    deltaReadout.classList.remove("close");
    return;
  }
  const distance = colorDistance(lastSampleRgb, currentRgb());
  const picked = rgbToHex(lastSampleRgb.r, lastSampleRgb.g, lastSampleRgb.b);
  const match = currentCodes().hex;
  if (distance <= 12) {
    deltaReadout.textContent = `Very close: ${picked} and ${match} are ${distance} apart.`;
    deltaReadout.classList.add("close");
  } else if (distance <= 40) {
    deltaReadout.textContent = `Near match: ${picked} vs ${match} · distance ${distance}.`;
    deltaReadout.classList.remove("close");
  } else {
    deltaReadout.textContent = `Still tuning: ${picked} vs ${match} · distance ${distance}.`;
    deltaReadout.classList.remove("close");
  }
}

function setHsv(next) {
  hsv.h = clamp(Math.round(next.h ?? hsv.h), 0, 360);
  hsv.s = clamp(Math.round(next.s ?? hsv.s), 0, 100);
  hsv.v = clamp(Math.round(next.v ?? hsv.v), 0, 100);
  updateColorUi();
}

function updateColorUi() {
  const { rgb, hex, rgbText, hslText } = currentCodes();
  const cssColor = rgbText;

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
  liveOrb.style.background = cssColor;
  document.documentElement.style.setProperty("--live", hex);
  matchHex.textContent = hex;
  hexInput.value = hex;
  rgbInput.value = rgbText;
  hslInput.value = hslText;
  renderHarmony();
  updateDelta();
}

function setSampleColor(rgb) {
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  lastSampleRgb = rgb;
  sampleChip.classList.remove("checker");
  sampleChip.style.background = hex;
  sampleHex.textContent = hex;
  sampleReadout.textContent = `${hex} @ ${lastPointerImagePoint.x}, ${lastPointerImagePoint.y}`;
  drawCompareCanvas();
  updateDelta();
}

function applySampleToMatcher(rgb) {
  setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
}

function sampleAtImagePoint(point) {
  if (!sampleSource || !point) return null;
  const pixel = sampleSource.ctx.getImageData(point.x, point.y, 1, 1).data;
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
  if (!file) {
    showToast("No file selected.", "warn");
    return;
  }
  if (!file.type.startsWith("image/")) {
    showToast("Please drop a PNG, JPG, or WEBP image.", "warn");
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    sourceImage = img;
    imageBitmap = await createImageBitmap(img);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    sampleSource = { canvas, ctx };
    emptyState.hidden = true;
    drawCompareCanvas();
    fitImage({ quiet: true });
    URL.revokeObjectURL(url);
    showToast(`Loaded ${file.name}. Press Sample, then click a pixel.`, "success");
  };
  img.onerror = () => {
    showToast("Could not read that image.", "warn");
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

function showToast(message, tone = "info") {
  window.clearTimeout(toastTimer);
  toastMessage.textContent = message;
  toast.className = `toast show ${tone}`;
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

async function copyText(value, label = value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(`Copied ${label}`, "success");
  } catch {
    hexInput.select();
    document.execCommand("copy");
    showToast(`Copied ${label}`, "success");
  }
}

function setSampleMode(next) {
  sampleMode = next;
  sampleButton.setAttribute("aria-pressed", String(sampleMode));
  sampleButton.textContent = sampleMode ? "Sampling" : "Sample";
  imageStage.classList.toggle("sampling", sampleMode);
  if (sampleMode) {
    showToast("Sampling on — click a pixel to capture it.", "info");
  } else {
    showToast("Sampling paused.", "info");
  }
}

imageInput.addEventListener("change", (event) => loadFile(event.target.files[0]));

imageStage.addEventListener("dragover", (event) => {
  event.preventDefault();
  imageStage.classList.add("drag-over");
});

imageStage.addEventListener("dragleave", () => {
  imageStage.classList.remove("drag-over");
});

imageStage.addEventListener("drop", (event) => {
  event.preventDefault();
  imageStage.classList.remove("drag-over");
  loadFile(event.dataTransfer.files[0]);
});

imageStage.addEventListener("pointerdown", (event) => {
  const point = stagePointToImagePoint(event.clientX, event.clientY);
  if (sampleMode && point) {
    lastPointerImagePoint = point;
    const rgb = sampleAtImagePoint(point);
    setSampleColor(rgb);
    applySampleToMatcher(rgb);
    saveCurrentColor({ quiet: true });
    showToast(`Sampled ${rgbToHex(rgb.r, rgb.g, rgb.b)} from the image.`, "success");
    return;
  }
  if (sampleMode && !point) {
    showToast("Click on the image pixels, not the empty canvas.", "warn");
    return;
  }
  if (!imageBitmap) {
    showToast("Upload an image to pan or sample.", "warn");
    return;
  }
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
  zoomValue.value = `${zoomRange.value}%`;
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
  if (!imageBitmap) {
    showToast("Upload an image before using 1:1.", "warn");
    return;
  }
  const rect = imageStage.getBoundingClientRect();
  imageScale = 1;
  zoomRange.value = 100;
  zoomValue.value = "100%";
  imageOffset = {
    x: (rect.width - imageBitmap.width) / 2,
    y: (rect.height - imageBitmap.height) / 2,
  };
  drawImageCanvas();
  showToast("Zoom set to actual pixels (1:1).", "info");
});

sampleButton.addEventListener("click", () => {
  if (!imageBitmap && !sampleMode) {
    showToast("Upload an image first, then sample a pixel.", "warn");
    return;
  }
  setSampleMode(!sampleMode);
});

imageCompareButton.addEventListener("click", () => {
  showImageCompare = !showImageCompare;
  imageCompare.hidden = !showImageCompare;
  imageCompareButton.setAttribute("aria-pressed", String(showImageCompare));
  showToast(showImageCompare ? "Image compare is visible." : "Image compare is hidden.", "info");
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
  else if (event.key === "ArrowDown") setHsv({ v: hsv.v - step });
  else if (event.key === "ArrowUp") setHsv({ v: hsv.v + step });
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
    showToast("That HEX is invalid. Restored the last good value.", "warn");
    return;
  }
  setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
  showToast(`Match set to ${rgbToHex(rgb.r, rgb.g, rgb.b)}.`, "success");
});

copyHexButton.addEventListener("click", () => copyText(hexInput.value, hexInput.value));
copyHexSmall.addEventListener("click", () => copyText(hexInput.value, hexInput.value));
copyRgbButton.addEventListener("click", () => copyText(rgbInput.value, rgbInput.value));
copyHslButton.addEventListener("click", () => copyText(hslInput.value, hslInput.value));
copyAllButton.addEventListener("click", () => {
  const { hex, rgbText, hslText } = currentCodes();
  copyText(`${hex}\n${rgbText}\n${hslText}`, "HEX, RGB, and HSL");
});
saveColorButton.addEventListener("click", () => saveCurrentColor());
sampleChipButton.addEventListener("click", () => {
  if (sampleHex.textContent === "--") {
    showToast("No sampled color yet.", "warn");
    return;
  }
  copyText(sampleHex.textContent, sampleHex.textContent);
});
matchChipButton.addEventListener("click", () => copyText(matchHex.textContent, matchHex.textContent));

window.addEventListener("keydown", (event) => {
  if (event.target.matches("input")) return;
  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    sampleButton.click();
  }
  if (event.key.toLowerCase() === "c" && (event.ctrlKey || event.metaKey) === false && !event.shiftKey) {
    event.preventDefault();
    copyText(hexInput.value, hexInput.value);
  }
});

window.addEventListener("resize", resizeCanvasToStage);

resizeCanvasToStage();
updateColorUi();
renderHistory();
showToast("Studio is ready. Upload an image or tune a color.", "info");
