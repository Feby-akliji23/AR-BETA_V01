import { clamp } from "./math.js";
import type {
  ArPlacementDependencies,
  ArPlacementState,
  HotspotConfig,
  ModelViewerElement,
  ProjectedPoint,
} from "./types.js";

type HotspotCallback = (index: number) => void;

function applyModelViewerHotspotAnchor(
  element: HTMLElement,
  hotspot: HotspotConfig,
  isDesktop: boolean
): void {
  const anchor = isDesktop ? hotspot.anchor.desktop : hotspot.anchor.mobile;
  element.dataset.position = anchor.position.x + "m " + anchor.position.y + "m " + anchor.position.z + "m";
  element.dataset.normal = anchor.normal.x + "m " + anchor.normal.y + "m " + anchor.normal.z + "m";
}

export function updateModelViewerHotspotAnchors(
  elements: HTMLElement[],
  hotspots: HotspotConfig[],
  isDesktop: boolean
): void {
  elements.forEach((element, index) => {
    const hotspot = hotspots[index];
    if (hotspot) applyModelViewerHotspotAnchor(element, hotspot, isDesktop);
  });
}

export function createHotspotElements(
  hotspots: HotspotConfig[],
  hotspotLayer: HTMLElement,
  onSelect: HotspotCallback,
  onDetail: HotspotCallback
): HTMLElement[] {
  return hotspots.map((hotspot, index) => {
    const item = document.createElement("div");
    item.className = "hotspot hidden";

    const dot = document.createElement("button");
    dot.className = "hotspot-dot";
    dot.type = "button";
    dot.setAttribute("aria-label", "Buka titik " + hotspot.buttonText);
    const dotLabel = document.createElement("span");
    dotLabel.textContent = hotspot.buttonText;
    dot.appendChild(dotLabel);

    const card = document.createElement("article");
    card.className = "hotspot-card";

    const thumb = document.createElement("span");
    thumb.className = "hotspot-thumb";
    applyHotspotImage(thumb, hotspot);

    const copy = document.createElement("span");
    copy.className = "hotspot-copy";

    const header = document.createElement("strong");
    header.textContent = hotspot.header;

    const desc = document.createElement("small");
    desc.textContent = hotspot.description;

    const detailBtn = document.createElement("button");
    detailBtn.className = "hotspot-detail";
    detailBtn.type = "button";
    detailBtn.textContent = "Lihat Detail →";

    copy.append(header, desc, detailBtn);

    const closeBtn = document.createElement("button");
    closeBtn.className = "hotspot-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Tutup card");
    closeBtn.textContent = "×";

    card.append(thumb, copy, closeBtn);
    item.append(dot, card);

    dot.addEventListener("click", () => {
      item.classList.remove("card-collapsed");
      item.classList.add("card-forced-open");
      onSelect(index);
    });
    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      item.classList.add("card-collapsed");
      item.classList.remove("card-forced-open");
    });
    detailBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      onDetail(index);
    });

    hotspotLayer.appendChild(item);
    return item;
  });
}

export function createModelViewerHotspotElements(
  hotspots: HotspotConfig[],
  modelViewer: ModelViewerElement,
  onSelect: HotspotCallback,
  onDetail: HotspotCallback,
  isDesktop: boolean
): HTMLElement[] {
  return hotspots.map((hotspot, index) => {
    const item = document.createElement("div");
    item.className = "preview-hotspot hidden";
    item.slot = "hotspot-" + index;
    applyModelViewerHotspotAnchor(item, hotspot, isDesktop);

    const point = document.createElement("button");
    point.className = "preview-hotspot-point";
    point.type = "button";
    point.setAttribute("aria-label", "Buka titik " + hotspot.buttonText);
    const pointLabel = document.createElement("span");
    pointLabel.textContent = hotspot.buttonText;
    point.appendChild(pointLabel);

    const card = document.createElement("article");
    card.className = "hotspot-card preview-native-card";

    const thumb = document.createElement("span");
    thumb.className = "hotspot-thumb";
    applyHotspotImage(thumb, hotspot);

    const copy = document.createElement("span");
    copy.className = "hotspot-copy";

    const header = document.createElement("strong");
    header.textContent = hotspot.header;

    const desc = document.createElement("small");
    desc.textContent = hotspot.description;

    const detailBtn = document.createElement("button");
    detailBtn.className = "hotspot-detail";
    detailBtn.type = "button";
    detailBtn.textContent = "Lihat Detail →";

    copy.append(header, desc, detailBtn);

    const closeBtn = document.createElement("button");
    closeBtn.className = "hotspot-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Tutup card");
    closeBtn.textContent = "×";

    card.append(thumb, copy, closeBtn);
    item.append(point, card);

    point.addEventListener("click", (event) => {
      event.stopPropagation();
      item.classList.remove("card-collapsed");
      item.classList.add("card-forced-open");
      onSelect(index);
    });
    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      item.classList.add("card-collapsed");
      item.classList.remove("card-forced-open");
    });
    detailBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      onDetail(index);
    });

    modelViewer.appendChild(item);
    return item;
  });
}

function applyHotspotImage(element: HTMLElement, hotspot: HotspotConfig): void {
  if (!hotspot.imageUrl) return;
  element.style.backgroundImage = `url("${hotspot.imageUrl}")`;
}

export function createNavDots(count: number, navDots: HTMLElement): HTMLElement[] {
  navDots.innerHTML = "";
  return Array.from({ length: count }, (_, index) => {
    const dot = document.createElement("span");
    dot.dataset.index = String(index);
    navDots.appendChild(dot);
    return dot;
  });
}

export function setNavDots(dots: HTMLElement[], activeIndex: number): void {
  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === activeIndex);
  });
}

export function setHotspotState(
  elements: HTMLElement[],
  activeIndex: number,
  buttonText: HTMLElement,
  hotspots: HotspotConfig[]
): void {
  elements.forEach((element, index) => {
    const wasActive = element.classList.contains("active");
    element.classList.toggle("hidden", index !== activeIndex);
    element.classList.toggle("active", index === activeIndex);
    if (index !== activeIndex) element.classList.remove("card-forced-open");
    if (index === activeIndex && !wasActive) element.classList.remove("card-collapsed");
  });
  buttonText.textContent = activeIndex === -1 ? "Beranda" : (hotspots[activeIndex]?.buttonText ?? "Beranda");
}

export function setArPlacementState(state: ArPlacementState, deps: ArPlacementDependencies): void {
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
    return;
  }

  if (state === "scanning") {
    document.body.classList.remove("ar-placed");
    reticle.visible = false;
    surfaceGrid.visible = false;
    arStatus.textContent = "Pindai permukaan datar";
    arInstructions.textContent = "Gerakkan kamera perlahan ke arah lantai.";
    statusText.textContent = "Pindai permukaan datar";
    arStatus.classList.remove("hidden");
    arInstructions.classList.remove("hidden");
    arScanReticle.classList.remove("hidden", "ready", "loading");
    arScanReticle.classList.add("scanning");
    arMenu.classList.add("hidden");
    interactionToolbar.classList.add("hidden");
    hideGestureHint();
    hideFocusDirection();
    return;
  }

  if (state === "stabilizing") {
    document.body.classList.remove("ar-placed");
    reticle.visible = true;
    surfaceGrid.visible = true;
    surfaceGrid.userData.surface.material.opacity = 0.035;
    surfaceGrid.userData.grid.material.opacity = 0.26;
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
    return;
  }

  if (state === "ready") {
    document.body.classList.remove("ar-placed");
    reticle.visible = true;
    surfaceGrid.visible = true;
    surfaceGrid.userData.surface.material.opacity = 0.045;
    surfaceGrid.userData.grid.material.opacity = 0.32;
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

export function createGestureHintController(gestureHint: HTMLElement) {
  let timer = 0;

  function show(message: string): void {
    window.clearTimeout(timer);
    gestureHint.textContent = message;
    gestureHint.classList.remove("hidden");
  }

  function hideSoon(): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(hide, 800);
  }

  function hide(): void {
    window.clearTimeout(timer);
    gestureHint.classList.add("hidden");
    gestureHint.textContent = "";
  }

  return { show, hideSoon, hide };
}

export function updateFocusDirection(
  focusDirection: HTMLElement,
  projected: ProjectedPoint | null,
  isActive: boolean
): void {
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
