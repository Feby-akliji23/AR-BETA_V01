import { clamp } from "./math.js";

export function createHotspotElements(hotspots, hotspotLayer, onSelect, onDetail) {
  return hotspots.map((hotspot, index) => {
    const item = document.createElement("div");
    item.className = "hotspot hidden";
    item.innerHTML =
      '<button class="hotspot-dot" type="button" aria-label="Buka titik ' +
      hotspot.buttonText +
      '"><span>' +
      hotspot.buttonText +
      '</span></button><article class="hotspot-card"><span class="hotspot-thumb"></span><span class="hotspot-copy"><strong>' +
      hotspot.header +
      '</strong><small>' +
      hotspot.description +
      '</small><button class="hotspot-detail" type="button">Lihat Detail →</button></span><button class="hotspot-close" type="button" aria-label="Tutup card">×</button></article>';
    item.querySelector(".hotspot-dot").addEventListener("click", () => {
      item.classList.remove("card-collapsed");
      item.classList.add("card-forced-open");
      onSelect(index);
    });
    item.querySelector(".hotspot-close").addEventListener("click", (event) => {
      event.stopPropagation();
      item.classList.add("card-collapsed");
      item.classList.remove("card-forced-open");
    });
    item.querySelector(".hotspot-detail").addEventListener("click", (event) => {
      event.stopPropagation();
      onDetail(index);
    });
    hotspotLayer.appendChild(item);
    return item;
  });
}

export function createModelViewerHotspotElements(hotspots, modelViewer, onSelect, onDetail) {
  return hotspots.map((hotspot, index) => {
    const item = document.createElement("div");
    item.className = "preview-hotspot hidden";
    item.slot = "hotspot-" + index;
    item.dataset.position =
      hotspot.position.x + "m " + hotspot.position.y + "m " + hotspot.position.z + "m";
    item.dataset.normal =
      hotspot.normal.x + "m " + hotspot.normal.y + "m " + hotspot.normal.z + "m";
    item.innerHTML =
      '<button class="preview-hotspot-point" type="button" aria-label="Buka titik ' +
      hotspot.buttonText +
      '"><span>' +
      hotspot.buttonText +
      '</span></button><article class="hotspot-card preview-native-card"><span class="hotspot-thumb"></span>' +
      '<span class="hotspot-copy"><strong>' +
      hotspot.header +
      '</strong><small>' +
      hotspot.description +
      '</small><button class="hotspot-detail" type="button">Lihat Detail →</button></span>' +
      '<button class="hotspot-close" type="button" aria-label="Tutup card">×</button></article>';
    item.querySelector(".preview-hotspot-point").addEventListener("click", (event) => {
      event.stopPropagation();
      item.classList.remove("card-collapsed");
      item.classList.add("card-forced-open");
      onSelect(index);
    });
    item.querySelector(".hotspot-close").addEventListener("click", (event) => {
      event.stopPropagation();
      item.classList.add("card-collapsed");
      item.classList.remove("card-forced-open");
    });
    item.querySelector(".hotspot-detail").addEventListener("click", (event) => {
      event.stopPropagation();
      onDetail(index);
    });
    modelViewer.appendChild(item);
    return item;
  });
}

export function createNavDots(count, navDots) {
  if (!navDots) return [];

  navDots.innerHTML = "";
  return Array.from({ length: count }, (_, index) => {
    const dot = document.createElement("span");
    dot.dataset.index = String(index);
    navDots.appendChild(dot);
    return dot;
  });
}

export function setNavDots(dots, activeIndex) {
  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === activeIndex);
  });
}

export function setHotspotState(elements, activeIndex, buttonText, hotspots) {
  elements.forEach((element, index) => {
    const wasActive = element.classList.contains("active");
    element.classList.toggle("hidden", index !== activeIndex);
    element.classList.toggle("active", index === activeIndex);
    if (index !== activeIndex) element.classList.remove("card-forced-open");
    if (index === activeIndex && !wasActive) element.classList.remove("card-collapsed");
  });
  buttonText.textContent = activeIndex === -1 ? "Home" : hotspots[activeIndex].buttonText;
}

export function setArPlacementState(state, deps) {
  const {
    reticle,
    surfaceGrid,
    arStatus,
    arInstructions,
    arScanReticle,
    arMenu,
    statusText,
    hideGestureHint,
    hideFocusDirection,
    stopModelRotation,
    interactionToolbar,
  } = deps;

  if (state === "preview") {
    document.body.classList.remove("ar-placed");
    reticle.visible = false;
    surfaceGrid.visible = false;
    arStatus.classList.add("hidden");
    arInstructions.classList.add("hidden");
    arScanReticle.classList.add("hidden");
    arScanReticle.classList.remove("ready", "loading", "scanning");
    arMenu.classList.add("hidden");
    interactionToolbar.classList.add("hidden");
    hideGestureHint();
    hideFocusDirection();
    stopModelRotation();
    return;
  }

  if (state === "loading") {
    document.body.classList.remove("ar-placed");
    reticle.visible = false;
    surfaceGrid.visible = false;
    arStatus.textContent = "Menyiapkan model 3D";
    arInstructions.textContent = "Tunggu sebentar hingga sesi AR siap.";
    statusText.textContent = "Menyiapkan model 3D";
    arStatus.classList.remove("hidden");
    arInstructions.classList.remove("hidden");
    arScanReticle.classList.remove("hidden", "ready", "scanning");
    arScanReticle.classList.add("loading");
    arMenu.classList.add("hidden");
    interactionToolbar.classList.add("hidden");
    hideGestureHint();
    hideFocusDirection();
    stopModelRotation();
    return;
  }

  if (state === "scanning") {
    document.body.classList.remove("ar-placed");
    reticle.visible = false;
    surfaceGrid.visible = false;
    arStatus.textContent = "Scan permukaan datar";
    arInstructions.textContent = "Gerakkan kamera perlahan ke arah lantai.";
    statusText.textContent = "Scan permukaan datar";
    arStatus.classList.remove("hidden");
    arInstructions.classList.remove("hidden");
    arScanReticle.classList.remove("hidden", "ready", "loading");
    arScanReticle.classList.add("scanning");
    arMenu.classList.add("hidden");
    interactionToolbar.classList.add("hidden");
    hideGestureHint();
    hideFocusDirection();
    stopModelRotation();
    return;
  }

  if (state === "stabilizing") {
    document.body.classList.remove("ar-placed");
    reticle.visible = true;
    surfaceGrid.visible = true;
    surfaceGrid.userData.surface.material.opacity = 0.04;
    surfaceGrid.userData.grid.material.opacity = 0.32;
    arStatus.textContent = "Menstabilkan permukaan";
    arInstructions.textContent = "Tahan posisi kamera beberapa saat.";
    statusText.textContent = "Menstabilkan permukaan";
    arStatus.classList.remove("hidden");
    arInstructions.classList.remove("hidden");
    arScanReticle.classList.remove("hidden");
    arScanReticle.classList.remove("ready", "loading", "scanning");
    arMenu.classList.add("hidden");
    interactionToolbar.classList.add("hidden");
    hideGestureHint();
    hideFocusDirection();
    stopModelRotation();
    return;
  }

  if (state === "ready") {
    document.body.classList.remove("ar-placed");
    reticle.visible = true;
    surfaceGrid.visible = true;
    surfaceGrid.userData.surface.material.opacity = 0.09;
    surfaceGrid.userData.grid.material.opacity = 0.62;
    arStatus.textContent = "Permukaan siap";
    arInstructions.textContent = "Tap pada permukaan untuk menaruh model.";
    statusText.textContent = "Permukaan ditemukan, tap layar";
    arStatus.classList.remove("hidden");
    arInstructions.classList.remove("hidden");
    arScanReticle.classList.remove("hidden");
    arScanReticle.classList.remove("loading", "scanning");
    arScanReticle.classList.add("ready");
    arMenu.classList.add("hidden");
    interactionToolbar.classList.add("hidden");
    hideGestureHint();
    hideFocusDirection();
    stopModelRotation();
    return;
  }

  if (state === "placed") {
    document.body.classList.add("ar-placed");
    reticle.visible = false;
    surfaceGrid.visible = false;
    statusText.textContent = "Model ditempatkan";
    arStatus.classList.add("hidden");
    arInstructions.classList.add("hidden");
    arScanReticle.classList.add("hidden");
    arScanReticle.classList.remove("ready", "loading", "scanning");
    interactionToolbar.classList.remove("hidden");
    arMenu.classList.remove("hidden");
  }
}

export function createGestureHintController(gestureHint) {
  let timer = null;

  function show(message) {
    if (!gestureHint) return;
    window.clearTimeout(timer);
    gestureHint.textContent = message;
    gestureHint.classList.remove("hidden");
  }

  function hideSoon() {
    window.clearTimeout(timer);
    timer = window.setTimeout(hide, 800);
  }

  function hide() {
    if (!gestureHint) return;
    window.clearTimeout(timer);
    gestureHint.classList.add("hidden");
    gestureHint.textContent = "";
  }

  return { show, hideSoon, hide };
}

export function updateFocusDirection(focusDirection, projected, isActive) {
  if (!isActive || !projected) {
    focusDirection.classList.add("hidden");
    return;
  }

  const margin = 54;
  const onScreen =
    !projected.behindCamera &&
    projected.screenX >= margin &&
    projected.screenX <= window.innerWidth - margin &&
    projected.screenY >= margin &&
    projected.screenY <= window.innerHeight - margin;

  if (onScreen) {
    focusDirection.classList.add("hidden");
    return;
  }

  const centerX = window.innerWidth * 0.5;
  const centerY = window.innerHeight * 0.5;
  const targetX = projected.behindCamera ? -projected.x : projected.x;
  const targetY = projected.behindCamera ? -projected.y : projected.y;
  const angle = Math.atan2(targetY, targetX);
  const edgeX = centerX + Math.cos(angle) * (window.innerWidth * 0.5 - margin);
  const edgeY = centerY - Math.sin(angle) * (window.innerHeight * 0.5 - margin);

  focusDirection.style.left = clamp(edgeX, margin, window.innerWidth - margin) + "px";
  focusDirection.style.top = clamp(edgeY, margin, window.innerHeight - margin) + "px";
  focusDirection.style.transform = "translate(-50%, -50%) rotate(" + (Math.PI / 2 - angle) + "rad)";
  focusDirection.classList.remove("hidden");
}
