import "@google/model-viewer";
import type { Group, Matrix4, Mesh, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import dungklurukUrl from "./assets/dungkluruk.webp";
import arIconUrl from "./assets/ar_icon.png";
import allArLogoUrl from "./assets/logo all ar.svg";
import { THREE } from "./modules/three.js";
import { projectConfig } from "./modules/config.js";
import { getDom } from "./modules/dom.js";
import { setupArGestures } from "./modules/gestures.js";
import { getXrProjectionCamera, projectWorldToDom } from "./modules/math.js";
import type {
  ArModel,
  ArPlacementState,
  GestureControls,
  GestureIndicator,
  HotspotConfig,
  ProjectedPoint,
  SurfaceGrid,
} from "./modules/types.js";
import {
  createModelInstance,
  createReticle,
  createSurfaceGrid,
  createGestureIndicator,
  createThreeScene,
  frameObject,
  loadModel,
  resetPreviewCamera,
  setupEnvironment,
} from "./modules/scene.js";
import {
  createGestureHintController,
  createHotspotElements,
  createModelViewerHotspotElements,
  createNavDots,
  setArPlacementState as applyArPlacementState,
  setHotspotState,
  setNavDots,
  updateFocusDirection,
  updateModelViewerHotspotAnchors,
} from "./modules/ui.js";
import { setupDebugPanel } from "./modules/debug.js";

document.documentElement.style.setProperty("--img-dungkluruk", `url("${dungklurukUrl}")`);
document.documentElement.style.setProperty("--img-ar-icon", `url("${arIconUrl}")`);
document.documentElement.style.setProperty("--img-all-ar-logo", `url("${allArLogoUrl}")`);

const dom = getDom();
const { hotspots } = projectConfig;
const gestureHint = createGestureHintController(dom.gestureHint);

let renderer: WebGLRenderer;
let scene: Scene;
let camera: PerspectiveCamera;
let controls: OrbitControls;
let modelTemplate: Group;
let previewModel: ArModel | null = null;
let placedModel: ArModel | null = null;
let reticle: Mesh;
let surfaceGrid: SurfaceGrid;
let gestureIndicator: GestureIndicator;
let gestureControls: GestureControls;
let hitTestSource: XRHitTestSource | null = null;
let hitTestSourceRequested = false;
let currentHotspotIndex = -1;
let isInAR = false;
let arPlacementState: ArPlacementState = "preview";
let lastHitMatrix: Matrix4 | null = null;
let suppressPlacementUntil = 0;
let stableHitSince = 0;
let unstableHitSince = 0;
let lastHitSeenAt = 0;
let hasSmoothedHit = false;
let scanStartedAt = 0;
let scanAdviceIndex = -1;
let previewHotspotElements: HTMLElement[] = [];
let supportsWebXrAr = false;
let supportsQuickLookAr = false;
let hitTestRetryAfter = 0;
let hitSampleCursor = 0;
let hitSampleCount = 0;
let previewCameraTransitionCleanup: (() => void) | null = null;
let arFocusRotation: {
  model: ArModel;
  from: number;
  delta: number;
  startedAt: number;
  lastApplied: number;
} | null = null;
let connectionBannerTimeout = 0;
let wasOffline = !navigator.onLine;
let loaderStatusObserver: MutationObserver | null = null;

const HIT_SAMPLE_LIMIT = 8;
const HIT_SAMPLE_MINIMUM = 5;
const HIT_POSITION_TOLERANCE = 0.12;
const HIT_READY_POSITION_TOLERANCE = 0.18;
const HIT_STABLE_DURATION = 180;
const HIT_UNSTABLE_GRACE = 1200;
const HIT_LOST_GRACE = 700;
const HIT_SMOOTHING = 0.22;
const CARD_HIDE_MODEL_SCALE = 0.82;
const CARD_SHOW_MODEL_SCALE = 0.9;
const AR_FOCUS_ROTATION_DURATION = 1100;
const hitSamples = Array.from({ length: HIT_SAMPLE_LIMIT }, () => new THREE.Vector3());
const smoothedHitPosition = new THREE.Vector3();
const smoothedHitQuaternion = new THREE.Quaternion();
const smoothedHitScale = new THREE.Vector3(1, 1, 1);
const hitMatrixScratch = new THREE.Matrix4();
const hitPositionScratch = new THREE.Vector3();
const hitQuaternionScratch = new THREE.Quaternion();
const smoothedHitMatrix = new THREE.Matrix4();
const hitCenterScratch = new THREE.Vector3();
const lastHitMatrixValue = new THREE.Matrix4();
const hotspotWorldPositionScratch = new THREE.Vector3();
const modelWorldPositionScratch = new THREE.Vector3();
const cameraWorldPositionScratch = new THREE.Vector3();
const focusedProjection: ProjectedPoint = {
  x: 0,
  y: 0,
  z: 0,
  screenX: 0,
  screenY: 0,
  behindCamera: false,
};
const SETTINGS_STORAGE_KEY = "dungkluruk-ar-settings";
const ONBOARDING_STORAGE_KEY = "dungkluruk-ar-onboarding-v1";
const SCAN_ADVICE = [
  { after: 0, text: "Gerakkan kamera perlahan ke arah lantai." },
  { after: 4000, text: "Arahkan kamera ke lantai yang memiliki pola atau tekstur." },
  { after: 8000, text: "Mundur sedikit agar area lantai terlihat lebih luas." },
  { after: 12000, text: "Pastikan ruangan cukup terang, lalu gerakkan kamera kiri dan kanan." },
];
const DEBUG_HOTSPOTS = new URLSearchParams(window.location.search).has("debugHotspots");
const IS_DEBUG = new URLSearchParams(window.location.search).has("debug");
const USE_MODEL_VIEWER_WEBXR = false; // Set to true to force using model-viewer's AR mode instead of WebXR (for testing purposes)

const hotspotElements = createHotspotElements(hotspots, dom.hotspotLayer, selectHotspot, openHotspotDetail);
const navDotElements = createNavDots(hotspots.length, dom.navDots);

init();
registerServiceWorker();

async function init() {
  syncAppLoaderStatus();
  setupOverlayGuards();
  setupEvents();
  loadSettings();
  applySettings(false);

  try {
    applyProjectConfig();
    ({ scene, camera, renderer, controls } = createThreeScene(dom.canvas));
    reticle = createReticle(scene);
    surfaceGrid = createSurfaceGrid(scene);
    gestureIndicator = createGestureIndicator(scene);
    gestureControls = setupArGestures({
      renderer,
      camera,
      isInAR: () => isInAR,
      isEnabled: () => isInAR && arPlacementState === "placed",
      getPlacedModel: () => placedModel,
      indicator: gestureIndicator,
      showHint: gestureHint.show,
      hideHintSoon: gestureHint.hideSoon,
    });
    renderer.setAnimationLoop(render);

    await setupEnvironment(scene, renderer);
    modelTemplate = await loadModel(dom.statusText);

    const isDesktop = window.innerWidth >= projectConfig.preview.desktopBreakpoint;
    previewModel = createModelInstance(modelTemplate, hotspots, false, isDesktop);
    previewModel.visible = false;
    scene.add(previewModel);
    frameObject(previewModel, controls);
    preparePlacedModel();
    previewHotspotElements = createModelViewerHotspotElements(
      hotspots,
      dom.modelViewer,
      selectPreviewHotspot,
      openHotspotDetail,
      isDesktop
    );

    await waitForCustomElement("model-viewer");
    dom.statusText.textContent = "Memeriksa dukungan AR";
    await setupArSupport();
    showFirstVisitGuide();
    if (IS_DEBUG)
      setupDebugPanel(dom.modelViewer, hotspots, {
        prevButton: dom.prevButton,
        nextButton: dom.nextButton,
        buttonText: dom.buttonText,
        navDots: dom.navDots,
        previewHotspotElements,
        focusCamera: (orbit, target, fieldOfView, onComplete) => {
          setModelViewerCamera(orbit, target, true, onComplete, fieldOfView);
        },
      });
    hideAppLoader();
  } catch (error) {
    dom.enterArButton.disabled = true;
    dom.sheetStartArButton.disabled = true;
    dom.statusText.textContent = "Aplikasi gagal dimuat. Periksa koneksi lalu muat ulang.";
    hideAppLoader();
    console.error("Inisialisasi gagal", error);
  }
}

function syncAppLoaderStatus(): void {
  const update = (): void => {
    dom.appLoaderStatus.textContent = dom.statusText.textContent || "Memuat aplikasi...";
  };
  update();
  loaderStatusObserver = new MutationObserver(update);
  loaderStatusObserver.observe(dom.statusText, { childList: true, characterData: true, subtree: true });
}

function hideAppLoader(): void {
  loaderStatusObserver?.disconnect();
  loaderStatusObserver = null;
  requestAnimationFrame(() => {
    dom.appLoader.classList.add("loaded");
  });
}

function applyProjectConfig() {
  const { app, model, preview } = projectConfig;
  const previewScale = `${preview.scale} ${preview.scale} ${preview.scale}`;
  const previewFrame = getResponsivePreviewFrame();

  document.title = app.title;
  dom.appTitles.forEach((element) => {
    element.textContent = app.title;
  });
  dom.appVersions.forEach((element) => {
    element.textContent = app.version;
  });
  dom.modelName.textContent = app.modelName;
  dom.hotspotCount.textContent = String(hotspots.length);

  dom.modelViewer.setAttribute("src", model.glbUrl);
  dom.modelViewer.setAttribute("ios-src", model.usdzUrl);
  dom.modelViewer.setAttribute("alt", model.alt);
  dom.modelViewer.setAttribute("skybox-image", model.environmentUrl);
  dom.modelViewer.setAttribute("scale", previewScale);
  dom.modelViewer.setAttribute("orientation", model.orientation.map((angle) => `${angle}deg`).join(" "));
  dom.modelViewer.setAttribute("camera-orbit", previewFrame.homeOrbit);
  dom.modelViewer.setAttribute("camera-target", previewFrame.homeTarget);
  dom.modelViewer.fieldOfView = previewFrame.fieldOfView;
  dom.modelViewer.setAttribute("min-field-of-view", preview.minFieldOfView);
  dom.modelViewer.setAttribute("max-field-of-view", preview.maxFieldOfView);
  dom.modelViewer.setAttribute("exposure", preview.exposure);
  dom.modelViewer.setAttribute("shadow-intensity", preview.shadowIntensity);
  dom.modelViewer.setAttribute("interpolation-decay", String(Math.max(50, preview.cameraTransitionMs / 10)));
}

function getResponsivePreviewFrame(): {
  homeOrbit: string;
  homeTarget: string;
  fieldOfView: string;
} {
  const { preview } = projectConfig;
  return window.innerWidth >= preview.desktopBreakpoint ? preview.desktop : preview.mobile;
}

function getResponsiveHotspotCamera(hotspot: HotspotConfig) {
  const { preview } = projectConfig;
  return window.innerWidth >= preview.desktopBreakpoint ? hotspot.camera.desktop : hotspot.camera.mobile;
}

function waitForCustomElement(name: string, timeout = 10000): Promise<CustomElementConstructor> {
  return Promise.race([
    customElements.whenDefined(name),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${name} gagal dimuat`)), timeout);
    }),
  ]);
}

function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Dukungan offline gagal diaktifkan", error);
    });
  });
}

function setupEvents() {
  window.addEventListener("resize", onResize);
  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  document.addEventListener("click", closePanelsFromOutside);
  document.addEventListener("selectstart", preventTextSelection);
  document.addEventListener("dragstart", preventTextSelection);
  dom.modelViewer.addEventListener("pointerdown", () => cancelPreviewCameraAnimation(true));
  dom.menuButton.addEventListener("click", toggleSideMenu);
  dom.menuBackdrop.addEventListener("click", closeSideMenu);
  dom.menuHomeButton.addEventListener("click", openHome);
  dom.menuGuideButton.addEventListener("click", (event) => openInfoSheet(event, "guide", "Panduan Singkat"));
  dom.menuAboutButton.addEventListener("click", (event) =>
    openInfoSheet(event, "about", "Tentang Dungkluruk AR")
  );
  dom.menuSettingsButton.addEventListener("click", (event) => openInfoSheet(event, "settings", "Pengaturan"));
  dom.menuExitButton.addEventListener("click", exitAr);
  dom.closeInfoButton.addEventListener("click", closeInfoSheet);
  dom.enterArButton.addEventListener("click", startAr);
  dom.sheetStartArButton.addEventListener("click", startAr);
  dom.sheetPreviewButton.addEventListener("click", showPreviewHome);
  dom.settingLabels.addEventListener("change", () => applySettings());
  dom.settingGuide.addEventListener("change", () => applySettings());
  dom.settingModelSize.addEventListener("change", () => applySettings());
  dom.settingResetModel.addEventListener("click", resetPlacedModel);
  dom.detailCloseButton.addEventListener("click", closeInfoSheet);
  dom.replaceModelButton.addEventListener("click", searchAnotherPlace);
  dom.prevButton.addEventListener("click", () => navigateHotspot(-1));
  dom.nextButton.addEventListener("click", () => navigateHotspot(1));
  updateConnectionStatus();
}

function preventTextSelection(event: Event): void {
  event.preventDefault();
}

function toggleSideMenu(event: MouseEvent): void {
  event.stopPropagation();
  dom.infoSheet.classList.add("hidden");
  const willOpen = dom.sideMenu.classList.contains("hidden");
  dom.sideMenu.classList.toggle("hidden", !willOpen);
  dom.menuBackdrop.classList.toggle("hidden", !willOpen);
}

function closeSideMenu(): void {
  dom.sideMenu.classList.add("hidden");
  dom.menuBackdrop.classList.add("hidden");
}

function openHome(event: MouseEvent): void {
  event.stopPropagation();
  if (isInAR) {
    exitAr();
    return;
  }
  openInfoSheet(event, "home", "Beranda");
}

function openInfoSheet(event: Event | null, sheetName: string, title: string): void {
  event?.stopPropagation();
  closeSideMenu();
  dom.sheetTitle.textContent = title;
  dom.sheetContents.forEach((content) =>
    content.classList.toggle("hidden", content.dataset.sheet !== sheetName)
  );
  dom.infoSheet.classList.remove("hidden");
}

function showFirstVisitGuide(): void {
  try {
    if (localStorage.getItem(ONBOARDING_STORAGE_KEY)) return;
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "seen");
  } catch (error) {
    console.warn("Status onboarding tidak dapat disimpan", error);
  }
  openInfoSheet(null, "guide", "Panduan Singkat");
}

function updateConnectionStatus(event?: Event) {
  window.clearTimeout(connectionBannerTimeout);

  if (!navigator.onLine) {
    wasOffline = true;
    dom.connectionBanner.textContent = "Anda sedang offline. Aset yang pernah dibuka tetap dapat digunakan.";
    dom.connectionBanner.classList.remove("hidden", "online");
    dom.connectionBanner.classList.add("offline");
    return;
  }

  if (!wasOffline && event?.type !== "online") {
    dom.connectionBanner.classList.add("hidden");
    return;
  }

  wasOffline = false;
  dom.connectionBanner.textContent = "Koneksi kembali tersedia.";
  dom.connectionBanner.classList.remove("hidden", "offline");
  dom.connectionBanner.classList.add("online");
  connectionBannerTimeout = window.setTimeout(() => {
    dom.connectionBanner.classList.add("hidden");
  }, 3200);
}

function openHotspotDetail(index: number): void {
  const hotspot = hotspots[index];
  if (!hotspot) return;
  const detailImageUrl = hotspot.imageUrl || projectConfig.app.defaultImageUrl;
  dom.detailNumber.textContent = hotspot.buttonText;
  dom.detailTitle.textContent = hotspot.header;
  dom.detailDescription.textContent = hotspot.detail || hotspot.description;
  dom.detailImage.style.backgroundImage = `url("${detailImageUrl}")`;
  dom.sheetTitle.textContent = "Detail Tempat";
  dom.sheetContents.forEach((content) =>
    content.classList.toggle("hidden", content.dataset.sheet !== "detail")
  );
  dom.infoSheet.classList.remove("hidden");
}

function closeInfoSheet(event: Event): void {
  event.stopPropagation();
  dom.infoSheet.classList.add("hidden");
}

function closePanelsFromOutside(event: MouseEvent): void {
  const target = event.target instanceof Node ? event.target : null;
  const clickedMenu = target ? dom.sideMenu.contains(target) || dom.menuButton.contains(target) : false;
  const clickedSheet = target ? dom.infoSheet.contains(target) : false;

  if (!clickedMenu) closeSideMenu();
  if (!clickedSheet) dom.infoSheet.classList.add("hidden");
}

function exitAr(): void {
  closeSideMenu();
  if (!renderer) return;
  const session = renderer.xr.getSession();
  if (session) session.end();
}

function showPreviewHome(event: MouseEvent): void {
  event.stopPropagation();
  closeInfoSheet(event);
  resetPreviewScene();
}

function applySettings(shouldPersist = true): void {
  document.body.classList.toggle("hide-hotspot-labels", !dom.settingLabels.checked);
  document.body.classList.toggle("hide-ar-guide", !dom.settingGuide.checked);
  const scale = Number(dom.settingModelSize.value);
  if (placedModel && placedModel.visible) {
    placedModel.scale.setScalar(scale);
    placedModel.updateMatrixWorld(true);
  }
  if (shouldPersist) saveSettings();
}

function loadSettings(): void {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!storedSettings) return;
    const settings: unknown = JSON.parse(storedSettings);
    if (!settings || typeof settings !== "object") return;
    const saved = settings as Record<string, unknown>;
    if (typeof saved.showLabels === "boolean") dom.settingLabels.checked = saved.showLabels;
    if (typeof saved.showGuide === "boolean") dom.settingGuide.checked = saved.showGuide;
    if (["0.8", "1", "1.25"].includes(String(saved.modelSize))) {
      dom.settingModelSize.value = String(saved.modelSize);
    }
  } catch (error) {
    console.warn("Pengaturan tersimpan tidak dapat dibaca", error);
  }
}

function saveSettings(): void {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        showLabels: dom.settingLabels.checked,
        showGuide: dom.settingGuide.checked,
        modelSize: dom.settingModelSize.value,
      })
    );
  } catch (error) {
    console.warn("Pengaturan tidak dapat disimpan", error);
  }
}

function resetPlacedModel(event: MouseEvent): void {
  event.stopPropagation();
  if (!isInAR || !placedModel || !placedModel.visible) return;
  searchAnotherPlace();
  closeInfoSheet(event);
}

async function setupArSupport() {
  supportsQuickLookAr = isQuickLookSupported();

  if (!navigator.xr || !navigator.xr.isSessionSupported) {
    const canStartAr = supportsQuickLookAr;
    dom.enterArButton.disabled = !canStartAr;
    dom.sheetStartArButton.disabled = !canStartAr;
    dom.statusText.textContent = canStartAr
      ? "Siap untuk AR Quick Look"
      : "AR tidak didukung di perangkat ini";
    return;
  }

  try {
    supportsWebXrAr = await navigator.xr.isSessionSupported("immersive-ar");
    const canStartAr = supportsWebXrAr || supportsQuickLookAr;
    dom.enterArButton.disabled = !canStartAr;
    dom.sheetStartArButton.disabled = !canStartAr;
    dom.statusText.textContent = supportsWebXrAr
      ? "Siap untuk WebXR AR"
      : supportsQuickLookAr
        ? "Siap untuk AR Quick Look"
        : "AR tidak didukung di perangkat ini";
  } catch {
    const canStartAr = supportsQuickLookAr;
    dom.enterArButton.disabled = !canStartAr;
    dom.sheetStartArButton.disabled = !canStartAr;
    dom.statusText.textContent = canStartAr ? "Siap untuk AR Quick Look" : "Tidak bisa mengecek dukungan AR";
  }
}

async function startAr() {
  if (!modelTemplate) return;

  if (
    typeof dom.modelViewer.activateAR === "function" &&
    (USE_MODEL_VIEWER_WEBXR || (!supportsWebXrAr && supportsQuickLookAr))
  ) {
    closeSideMenu();
    dom.infoSheet.classList.add("hidden");
    showAllModelViewerHotspots();
    try {
      await dom.modelViewer.activateAR();
    } catch (error) {
      dom.statusText.textContent = "AR model-viewer gagal dibuka";
      console.error(error);
    }
    return;
  }

  const xr = navigator.xr;
  if (!xr) return;
  let session: XRSession | null = null;

  try {
    closeSideMenu();
    dom.infoSheet.classList.add("hidden");
    resetToHome(false);

    session = await xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test", "dom-overlay"],
      optionalFeatures: ["local-floor"],
      domOverlay: { root: document.body },
    });

    session.addEventListener("end", onArEnded);
    session.addEventListener("select", placeModel);

    isInAR = true;
    document.body.classList.add("ar-active");
    scene.background = null;
    controls.enabled = false;
    dom.enterArButton.classList.add("hidden");
    if (previewModel) previewModel.visible = false;

    preparePlacedModel();
    setArPlacementState("loading");

    await renderer.xr.setSession(session);
    gestureControls.connect();
    setArPlacementState("scanning");
  } catch (error) {
    if (session) {
      session.removeEventListener("end", onArEnded);
      session.removeEventListener("select", placeModel);
      try {
        await session.end();
      } catch (sessionEndError) {
        console.error("Sesi AR gagal ditutup", sessionEndError);
      }
    }
    isInAR = false;
    document.body.classList.remove("ar-active");
    setArPlacementState("preview");
    dom.enterArButton.classList.remove("hidden");
    if (controls) controls.enabled = true;
    if (previewModel) previewModel.visible = false;
    dom.statusText.textContent = "Gagal memulai AR";
    console.error("AR gagal dimulai", error);
  }
}

function isQuickLookSupported(): boolean {
  const isIosDevice =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari =
    /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(navigator.userAgent);

  return isIosDevice && isSafari && typeof dom.modelViewer.activateAR === "function";
}

function showAllModelViewerHotspots(): void {
  currentHotspotIndex = -1;
  previewHotspotElements.forEach((element) => {
    element.classList.remove("hidden", "active", "card-forced-open");
    element.classList.add("card-collapsed");
  });
  setNavDots(navDotElements, currentHotspotIndex);
  dom.buttonText.textContent = "Beranda";
}

function placeModel(): void {
  if (performance.now() < suppressPlacementUntil) return;
  if (arPlacementState === "placed" || !lastHitMatrix || !modelTemplate) return;

  preparePlacedModel();
  const model = placedModel;
  if (!model) return;

  const placementScale = Number(dom.settingModelSize.value);
  model.visible = true;
  model.position.setFromMatrixPosition(lastHitMatrix);
  model.quaternion.setFromRotationMatrix(lastHitMatrix);
  model.scale.setScalar(placementScale);
  model.updateMatrixWorld(true);

  setArPlacementState("placed");
  dom.statusText.textContent = "Model ditempatkan";
}

function preparePlacedModel(): void {
  if (placedModel || !modelTemplate) return;

  placedModel = createModelInstance(modelTemplate, hotspots, DEBUG_HOTSPOTS, false);
  placedModel.visible = false;
  scene.add(placedModel);
}

function searchAnotherPlace(): void {
  if (!isInAR) return;

  suppressPlacementUntil = performance.now() + 700;
  resetHitStability();
  gestureControls.clear();
  arFocusRotation = null;
  gestureHint.hide();
  dom.focusDirection.classList.add("hidden");

  if (placedModel) placedModel.visible = false;
  currentHotspotIndex = -1;
  updateHotspotState();
  setArPlacementState("scanning");
}

function onArEnded(): void {
  isInAR = false;
  document.body.classList.remove("ar-active");
  setArPlacementState("preview");
  dom.sideMenu.classList.add("hidden");
  dom.menuBackdrop.classList.add("hidden");
  dom.infoSheet.classList.add("hidden");
  clearHitTestSource();
  resetHitStability();
  gestureControls.disconnect();
  arFocusRotation = null;
  reticle.visible = false;
  dom.enterArButton.classList.remove("hidden");
  controls.enabled = true;

  if (previewModel) previewModel.visible = false;
  if (placedModel) {
    placedModel.visible = false;
  }

  resetPreviewScene();
  requestAnimationFrame(resetPreviewScene);
  setupArSupport();
}

function clearHitTestSource(): void {
  if (hitTestSource && typeof hitTestSource.cancel === "function") hitTestSource.cancel();
  hitTestSourceRequested = false;
  hitTestSource = null;
  hitTestRetryAfter = 0;
}

function setArPlacementState(state: ArPlacementState): void {
  const previousState = arPlacementState;
  arPlacementState = state;

  if (state === "scanning" && previousState !== "scanning") {
    scanStartedAt = performance.now();
    scanAdviceIndex = -1;
  } else if (state !== "scanning") {
    scanStartedAt = 0;
    scanAdviceIndex = -1;
  }

  applyArPlacementState(state, {
    reticle,
    surfaceGrid,
    arStatus: dom.arStatus,
    arInstructions: dom.arInstructions,
    arScanReticle: dom.arScanReticle,
    arMenu: dom.arMenu,
    statusText: dom.statusText,
    hideGestureHint: gestureHint.hide,
    hideFocusDirection: () => dom.focusDirection.classList.add("hidden"),
    interactionToolbar: dom.interactionToolbar,
  });
}

function render(timestamp: number, frame?: XRFrame): void {
  if (!isInAR) return;

  const session = renderer.xr.getSession();
  if (session && frame && arPlacementState !== "placed") updateHitTest(frame);
  updateScanGuidance();
  updateArFocusRotation(timestamp);

  renderer.render(scene, camera);
  updateHotspotPositions();
}

function updateScanGuidance(): void {
  if (!isInAR || arPlacementState !== "scanning" || !scanStartedAt) return;

  const elapsed = performance.now() - scanStartedAt;
  let nextIndex = 0;
  SCAN_ADVICE.forEach((advice, index) => {
    if (elapsed >= advice.after) nextIndex = index;
  });

  if (nextIndex === scanAdviceIndex) return;
  scanAdviceIndex = nextIndex;
  dom.arInstructions.textContent = SCAN_ADVICE[nextIndex]?.text ?? SCAN_ADVICE[0]?.text ?? "";
}

function updateHitTest(frame: XRFrame): void {
  const session = renderer.xr.getSession();
  const referenceSpace = renderer.xr.getReferenceSpace();

  if (!session || !referenceSpace) return;

  if (!hitTestSourceRequested && performance.now() >= hitTestRetryAfter) {
    requestHitTestSource(session);
  }

  if (!hitTestSource) {
    if (arPlacementState !== "placed" && arPlacementState !== "scanning") setArPlacementState("scanning");
    return;
  }

  const hitTestResults = frame.getHitTestResults(hitTestSource);
  if (hitTestResults.length) {
    lastHitSeenAt = performance.now();
    const hit = hitTestResults[0];
    if (!hit) return;
    const pose = hit.getPose(referenceSpace);
    if (!pose) return;

    hitMatrixScratch.fromArray(pose.transform.matrix);
    updateStableHit(hitMatrixScratch);
  } else {
    if (
      (!placedModel || !placedModel.visible) &&
      hasSmoothedHit &&
      performance.now() - lastHitSeenAt <= HIT_LOST_GRACE
    ) {
      return;
    }

    resetHitStability();
    if ((!placedModel || !placedModel.visible) && arPlacementState !== "scanning")
      setArPlacementState("scanning");
  }
}

async function requestHitTestSource(session: XRSession): Promise<void> {
  hitTestSourceRequested = true;

  try {
    const viewerSpace = await session.requestReferenceSpace("viewer");
    if (!session.requestHitTestSource) throw new Error("Hit-test tidak didukung sesi WebXR");
    const source = await session.requestHitTestSource({ space: viewerSpace });
    if (!source) throw new Error("Sumber hit-test tidak tersedia");
    if (renderer.xr.getSession() !== session) {
      if (typeof source.cancel === "function") source.cancel();
      return;
    }
    hitTestSource = source;
  } catch (error) {
    if (renderer.xr.getSession() !== session) return;
    hitTestSource = null;
    hitTestSourceRequested = false;
    hitTestRetryAfter = performance.now() + 1500;
    dom.statusText.textContent = "Mencoba mendeteksi permukaan kembali";
    console.error("Sumber hit-test gagal dibuat", error);
  }
}

function updateStableHit(hitMatrix: Matrix4): void {
  hitPositionScratch.setFromMatrixPosition(hitMatrix);
  hitQuaternionScratch.setFromRotationMatrix(hitMatrix);

  hitSamples[hitSampleCursor]?.copy(hitPositionScratch);
  hitSampleCursor = (hitSampleCursor + 1) % HIT_SAMPLE_LIMIT;
  hitSampleCount = Math.min(hitSampleCount + 1, HIT_SAMPLE_LIMIT);

  if (!hasSmoothedHit) {
    smoothedHitPosition.copy(hitPositionScratch);
    smoothedHitQuaternion.copy(hitQuaternionScratch);
    hasSmoothedHit = true;
  } else {
    smoothedHitPosition.lerp(hitPositionScratch, HIT_SMOOTHING);
    smoothedHitQuaternion.slerp(hitQuaternionScratch, HIT_SMOOTHING);
  }

  smoothedHitMatrix.compose(smoothedHitPosition, smoothedHitQuaternion, smoothedHitScale);
  reticle.matrix.copy(smoothedHitMatrix);
  reticle.matrixWorldNeedsUpdate = true;
  surfaceGrid.matrix.copy(smoothedHitMatrix);
  surfaceGrid.matrixWorldNeedsUpdate = true;

  if (placedModel && placedModel.visible) return;

  const positionTolerance =
    arPlacementState === "ready" ? HIT_READY_POSITION_TOLERANCE : HIT_POSITION_TOLERANCE;
  if (!isHitStable(positionTolerance)) {
    if (arPlacementState === "ready") {
      if (!unstableHitSince) unstableHitSince = performance.now();
      if (performance.now() - unstableHitSince <= HIT_UNSTABLE_GRACE) return;
    }

    stableHitSince = 0;
    unstableHitSince = 0;
    lastHitMatrix = null;
    if (arPlacementState !== "stabilizing") setArPlacementState("stabilizing");
    return;
  }

  unstableHitSince = 0;
  if (!stableHitSince) stableHitSince = performance.now();
  if (performance.now() - stableHitSince < HIT_STABLE_DURATION) {
    if (arPlacementState !== "stabilizing") setArPlacementState("stabilizing");
    return;
  }

  lastHitMatrixValue.copy(smoothedHitMatrix);
  lastHitMatrix = lastHitMatrixValue;
  if (arPlacementState !== "ready") setArPlacementState("ready");
}

function isHitStable(positionTolerance = HIT_POSITION_TOLERANCE): boolean {
  if (hitSampleCount < HIT_SAMPLE_MINIMUM) return false;

  hitCenterScratch.set(0, 0, 0);
  for (let index = 0; index < hitSampleCount; index += 1) {
    const sample = hitSamples[index];
    if (sample) hitCenterScratch.add(sample);
  }
  hitCenterScratch.multiplyScalar(1 / hitSampleCount);

  for (let index = 0; index < hitSampleCount; index += 1) {
    const sample = hitSamples[index];
    if (!sample || sample.distanceTo(hitCenterScratch) > positionTolerance) return false;
  }
  return true;
}

function resetHitStability(): void {
  hitSampleCursor = 0;
  hitSampleCount = 0;
  stableHitSince = 0;
  unstableHitSince = 0;
  lastHitSeenAt = 0;
  hasSmoothedHit = false;
  lastHitMatrix = null;
}

function updateHotspotPositions(): void {
  if (!isInAR) {
    hotspotElements.forEach((element) => element.classList.add("hidden"));
    dom.focusDirection.classList.add("hidden");
    return;
  }

  const activeModel = placedModel && placedModel.visible ? placedModel : null;
  if (!activeModel || !activeModel.visible || currentHotspotIndex === -1) {
    hotspotElements.forEach((element) => element.classList.add("hidden"));
    dom.focusDirection.classList.add("hidden");
    return;
  }

  activeModel.updateMatrixWorld(true);
  const hotspotAnchor = activeModel.userData.hotspotAnchors?.[currentHotspotIndex];
  const element = hotspotElements[currentHotspotIndex];
  if (!hotspotAnchor || !element) return;

  hotspotAnchor.getWorldPosition(hotspotWorldPositionScratch);
  projectWorldToDom(renderer, camera, hotspotWorldPositionScratch, focusedProjection);

  const hotspotMargin = 36;
  const isHotspotOnScreen =
    !focusedProjection.behindCamera &&
    focusedProjection.screenX >= hotspotMargin &&
    focusedProjection.screenX <= window.innerWidth - hotspotMargin &&
    focusedProjection.screenY >= hotspotMargin &&
    focusedProjection.screenY <= window.innerHeight - hotspotMargin;

  if (!isHotspotOnScreen) {
    element.classList.add("hidden");
  } else {
    element.style.left = focusedProjection.screenX + "px";
    element.style.top = focusedProjection.screenY + "px";
    const isCardHidden = element.classList.contains("card-hidden");
    if (!isCardHidden && activeModel.scale.x < CARD_HIDE_MODEL_SCALE) {
      element.classList.add("card-hidden");
    } else if (isCardHidden && activeModel.scale.x > CARD_SHOW_MODEL_SCALE) {
      element.classList.remove("card-hidden");
    }
    element.classList.remove("hidden");
  }

  updateFocusDirection(
    dom.focusDirection,
    focusedProjection,
    isInAR && arPlacementState === "placed" && currentHotspotIndex !== -1
  );
}

function navigateHotspot(direction: number): void {
  if (currentHotspotIndex === -1) {
    currentHotspotIndex = direction > 0 ? 0 : hotspots.length - 1;
  } else {
    currentHotspotIndex += direction;
    if (currentHotspotIndex >= hotspots.length || currentHotspotIndex < 0) {
      currentHotspotIndex = -1;
    }
  }

  updateHotspotState();
}

function selectHotspot(index: number): void {
  const selectionChanged = currentHotspotIndex !== index;
  currentHotspotIndex = index;
  updateHotspotState(selectionChanged);
}

function selectPreviewHotspot(index: number): void {
  const selectionChanged = currentHotspotIndex !== index;
  currentHotspotIndex = index;
  updateHotspotState(selectionChanged);
}

function updateHotspotState(focusSelection = true): void {
  setHotspotState(hotspotElements, currentHotspotIndex, dom.buttonText, hotspots);
  if (isInAR) {
    hotspotElements.forEach((element) => element.classList.add("hidden"));
  }
  setHotspotState(previewHotspotElements, currentHotspotIndex, dom.buttonText, hotspots);
  setNavDots(navDotElements, currentHotspotIndex);
  if (focusSelection) {
    if (!isInAR) hidePreviewHotspots();
    focusSelectedHotspot();
  }
  if (!focusSelection) requestAnimationFrame(updatePreviewCardWidth);
}

function hidePreviewHotspots(): void {
  previewHotspotElements.forEach((element) => element.classList.add("hidden"));
}

function revealSelectedPreviewHotspot(): void {
  if (isInAR) return;
  setHotspotState(previewHotspotElements, currentHotspotIndex, dom.buttonText, hotspots);
  requestAnimationFrame(updatePreviewCardWidth);
}

function updatePreviewCardWidth(): void {
  if (isInAR || currentHotspotIndex === -1) return;

  const hotspot = previewHotspotElements[currentHotspotIndex];
  if (!hotspot || hotspot.classList.contains("hidden")) return;

  const point = hotspot.querySelector<HTMLElement>(".preview-hotspot-point");
  const card = hotspot.querySelector<HTMLElement>(".preview-native-card");
  if (!point || !card) return;
  const availableWidth = Math.floor(point.getBoundingClientRect().left - 20);
  const maxWidth = window.innerWidth <= 380 ? 168 : window.innerWidth <= 640 ? 196 : 260;
  const width = Math.max(96, Math.min(maxWidth, availableWidth));

  card.style.width = width + "px";
  card.classList.toggle("compact", width < 190);
  card.classList.toggle("narrow", width < 132);
}

function resetToHome(animate: boolean): void {
  currentHotspotIndex = -1;
  setHotspotState(hotspotElements, currentHotspotIndex, dom.buttonText, hotspots);
  setHotspotState(previewHotspotElements, currentHotspotIndex, dom.buttonText, hotspots);
  setNavDots(navDotElements, currentHotspotIndex);
  if (animate) focusSelectedHotspot();
}

function resetPreviewScene(): void {
  currentHotspotIndex = -1;
  setHotspotState(hotspotElements, currentHotspotIndex, dom.buttonText, hotspots);
  setHotspotState(previewHotspotElements, currentHotspotIndex, dom.buttonText, hotspots);
  setNavDots(navDotElements, currentHotspotIndex);

  if (previewModel) {
    previewModel.visible = false;
    previewModel.position.set(0, 0, 0);
    previewModel.rotation.set(0, 0, 0);
    previewModel.updateMatrixWorld(true);
  }

  const previewFrame = getResponsivePreviewFrame();
  dom.modelViewer.fieldOfView = previewFrame.fieldOfView;
  setModelViewerCamera(previewFrame.homeOrbit, previewFrame.homeTarget, false);
  if (!camera || !controls) return;

  resetPreviewCamera(camera, controls, previewModel);
  updateHotspotPositions();
}

function focusSelectedHotspot(animate = true): void {
  if (isInAR) {
    focusSelectedArHotspot();
    return;
  }

  if (currentHotspotIndex === -1) {
    const previewFrame = getResponsivePreviewFrame();
    setModelViewerCamera(
      previewFrame.homeOrbit,
      previewFrame.homeTarget,
      animate,
      undefined,
      previewFrame.fieldOfView
    );
    return;
  }

  const hotspot = hotspots[currentHotspotIndex];
  if (!hotspot) return;
  const recordedCamera = getResponsiveHotspotCamera(hotspot);
  setModelViewerCamera(
    recordedCamera.orbit,
    recordedCamera.target,
    animate,
    undefined,
    recordedCamera.fieldOfView
  );
}

function focusSelectedArHotspot(): void {
  if (currentHotspotIndex === -1 || arPlacementState !== "placed" || !placedModel || !placedModel.visible) {
    arFocusRotation = null;
    return;
  }

  const hotspotAnchor = placedModel.userData.hotspotAnchors[currentHotspotIndex];
  if (!hotspotAnchor) return;

  placedModel.updateMatrixWorld(true);
  hotspotAnchor.getWorldPosition(hotspotWorldPositionScratch);
  placedModel.getWorldPosition(modelWorldPositionScratch);
  const projectionCamera = getXrProjectionCamera(renderer, camera);
  projectionCamera.getWorldPosition(cameraWorldPositionScratch);

  const hotspotX = hotspotWorldPositionScratch.x - modelWorldPositionScratch.x;
  const hotspotZ = hotspotWorldPositionScratch.z - modelWorldPositionScratch.z;
  if (Math.hypot(hotspotX, hotspotZ) < 0.001) return;

  const cameraAngle = Math.atan2(
    cameraWorldPositionScratch.x - modelWorldPositionScratch.x,
    cameraWorldPositionScratch.z - modelWorldPositionScratch.z
  );
  const hotspotAngle = Math.atan2(hotspotX, hotspotZ);
  const delta = shortestAngle(cameraAngle - hotspotAngle);

  gestureControls.clear();
  arFocusRotation = {
    model: placedModel,
    from: placedModel.rotation.y,
    delta,
    startedAt: performance.now(),
    lastApplied: placedModel.rotation.y,
  };
}

function updateArFocusRotation(timestamp: number): void {
  const animation = arFocusRotation;
  if (!animation) return;

  if (
    !isInAR ||
    arPlacementState !== "placed" ||
    placedModel !== animation.model ||
    Math.abs(shortestAngle(animation.model.rotation.y - animation.lastApplied)) > 0.001
  ) {
    arFocusRotation = null;
    return;
  }

  const progress = Math.min((timestamp - animation.startedAt) / AR_FOCUS_ROTATION_DURATION, 1);
  animation.lastApplied = animation.from + animation.delta * smootherStep(progress);
  animation.model.rotation.y = animation.lastApplied;
  animation.model.updateMatrixWorld(true);

  if (progress >= 1) arFocusRotation = null;
}

function setModelViewerCamera(
  orbit: string,
  target: string,
  animate = true,
  onComplete?: () => void,
  fieldOfView?: string
): void {
  if (!dom.modelViewer) return;
  if (!animate || typeof dom.modelViewer.getCameraOrbit !== "function") {
    cancelPreviewCameraAnimation(false);
    dom.modelViewer.cameraOrbit = orbit;
    dom.modelViewer.cameraTarget = target;
    if (fieldOfView) dom.modelViewer.fieldOfView = fieldOfView;
    dom.modelViewer.jumpCameraToGoal?.();
    if (onComplete) onComplete();
    else revealSelectedPreviewHotspot();
    return;
  }

  animateModelViewerCamera(orbit, target, onComplete, fieldOfView);
}

function animateModelViewerCamera(
  orbit: string,
  target: string,
  onComplete?: () => void,
  fieldOfView?: string
): void {
  cancelPreviewCameraAnimation(false);

  let settleTimeout = 0;
  let fallbackTimeout = 0;
  let completed = false;

  const cleanup = (): void => {
    window.clearTimeout(settleTimeout);
    window.clearTimeout(fallbackTimeout);
    dom.modelViewer.removeEventListener("camera-change", onCameraChange);
    if (previewCameraTransitionCleanup === cleanup) previewCameraTransitionCleanup = null;
  };
  const complete = (): void => {
    if (completed) return;
    completed = true;
    cleanup();
    if (onComplete) onComplete();
    else revealSelectedPreviewHotspot();
  };
  const onCameraChange = (): void => {
    window.clearTimeout(settleTimeout);
    settleTimeout = window.setTimeout(complete, 100);
  };

  previewCameraTransitionCleanup = cleanup;
  dom.modelViewer.addEventListener("camera-change", onCameraChange);
  settleTimeout = window.setTimeout(complete, 180);
  fallbackTimeout = window.setTimeout(
    complete,
    Math.max(500, projectConfig.preview.cameraTransitionMs * 0.65)
  );

  dom.modelViewer.cameraOrbit = orbit;
  dom.modelViewer.cameraTarget = target;
  if (fieldOfView) dom.modelViewer.fieldOfView = fieldOfView;
}

function cancelPreviewCameraAnimation(revealHotspot: boolean): void {
  previewCameraTransitionCleanup?.();
  previewCameraTransitionCleanup = null;
  if (revealHotspot) revealSelectedPreviewHotspot();
}

function shortestAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function smootherStep(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function setupOverlayGuards(): void {
  [
    dom.topbar,
    dom.menuBackdrop,
    dom.sideMenu,
    dom.infoSheet,
    dom.arStatus,
    dom.arInstructions,
    dom.arMenu,
    dom.hotspotLayer,
    dom.navContainer,
  ]
    .filter(Boolean)
    .forEach((element) => {
      element.addEventListener("beforexrselect", (event) => {
        event.preventDefault();
      });
    });
}

function onResize(): void {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateModelViewerHotspotAnchors(
    previewHotspotElements,
    hotspots,
    window.innerWidth >= projectConfig.preview.desktopBreakpoint
  );

  // Mobile browser chrome frequently changes the viewport height while scrolling.
  // Preserve the manually recorded camera in debug mode instead of resetting it.
  if (IS_DEBUG && !isInAR) {
    requestAnimationFrame(updatePreviewCardWidth);
    return;
  }

  if (!isInAR && currentHotspotIndex === -1) {
    const previewFrame = getResponsivePreviewFrame();
    dom.modelViewer.fieldOfView = previewFrame.fieldOfView;
    setModelViewerCamera(previewFrame.homeOrbit, previewFrame.homeTarget, false);
  } else if (!isInAR) {
    focusSelectedHotspot(false);
  }
  requestAnimationFrame(updatePreviewCardWidth);
}
