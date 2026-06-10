import "@google/model-viewer";
import dungklurukUrl from "./assets/dungkluruk.webp";
import arIconUrl from "./assets/ar_icon.png";
import { THREE } from "./modules/three.js";
import { projectConfig } from "./modules/config.js";
import { getDom } from "./modules/dom.js";
import { setupArGestures } from "./modules/gestures.js";
import { projectWorldToDom } from "./modules/math.js";
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
} from "./modules/ui.js";

document.documentElement.style.setProperty("--img-dungkluruk", `url("${dungklurukUrl}")`);
document.documentElement.style.setProperty("--img-ar-icon", `url("${arIconUrl}")`);

const dom = getDom();
const { hotspots } = projectConfig;
const gestureHint = createGestureHintController(dom.gestureHint);

let renderer;
let scene;
let camera;
let controls;
let modelTemplate;
let previewModel;
let placedModel;
let reticle;
let surfaceGrid;
let gestureIndicator;
let gestureControls;
let hitTestSource = null;
let hitTestSourceRequested = false;
let currentHotspotIndex = -1;
let isInAR = false;
let arPlacementState = "preview";
let lastHitMatrix = null;
let suppressPlacementUntil = 0;
let stableHitSince = 0;
let unstableHitSince = 0;
let lastHitSeenAt = 0;
let hasSmoothedHit = false;
let scanStartedAt = 0;
let scanAdviceIndex = -1;
let previewHotspotElements = [];
let supportsWebXrAr = false;
let hitTestRetryAfter = 0;
let hitSampleCursor = 0;
let hitSampleCount = 0;
let previewCameraAnimationFrame = 0;

const HIT_SAMPLE_LIMIT = 18;
const HIT_SAMPLE_MINIMUM = 10;
const HIT_POSITION_TOLERANCE = 0.025;
const HIT_READY_POSITION_TOLERANCE = 0.045;
const HIT_STABLE_DURATION = 350;
const HIT_UNSTABLE_GRACE = 1200;
const HIT_LOST_GRACE = 700;
const HIT_SMOOTHING = 0.22;
const CARD_HIDE_MODEL_SCALE = 0.82;
const CARD_SHOW_MODEL_SCALE = 0.9;
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
const focusedProjection = {
  x: 0,
  y: 0,
  z: 0,
  screenX: 0,
  screenY: 0,
  behindCamera: false,
};
const SETTINGS_STORAGE_KEY = "dungkluruk-ar-settings";
const SCAN_ADVICE = [
  { after: 0, text: "Gerakkan kamera perlahan ke arah lantai." },
  { after: 4000, text: "Arahkan kamera ke lantai yang memiliki pola atau tekstur." },
  { after: 8000, text: "Mundur sedikit agar area lantai terlihat lebih luas." },
  { after: 12000, text: "Pastikan ruangan cukup terang, lalu gerakkan kamera kiri dan kanan." },
];
const DEBUG_HOTSPOTS = new URLSearchParams(window.location.search).has("debugHotspots");
const USE_MODEL_VIEWER_WEBXR = false; // Set to true to force using model-viewer's AR mode instead of WebXR (for testing purposes)

const hotspotElements = createHotspotElements(hotspots, dom.hotspotLayer, selectHotspot, openHotspotDetail);
const navDotElements = createNavDots(hotspots.length, dom.navDots);

init();
registerServiceWorker();

async function init() {
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

    previewModel = createModelInstance(modelTemplate, hotspots, false);
    previewModel.visible = false;
    scene.add(previewModel);
    frameObject(previewModel, controls);
    previewHotspotElements = createModelViewerHotspotElements(
      hotspots,
      dom.modelViewer,
      selectPreviewHotspot,
      openHotspotDetail
    );

    await waitForCustomElement("model-viewer");
    await setupArSupport();
  } catch (error) {
    dom.enterArButton.disabled = true;
    dom.sheetStartArButton.disabled = true;
    dom.statusText.textContent = "Aplikasi gagal dimuat. Periksa koneksi lalu muat ulang.";
    console.error("Inisialisasi gagal", error);
  }
}

function applyProjectConfig() {
  const { app, model, preview } = projectConfig;
  const modelScale = `${model.scale} ${model.scale} ${model.scale}`;

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
  dom.modelViewer.setAttribute("scale", modelScale);
  dom.modelViewer.setAttribute("orientation", model.orientation.map((angle) => `${angle}deg`).join(" "));
  dom.modelViewer.setAttribute("camera-orbit", preview.homeOrbit);
  dom.modelViewer.setAttribute("camera-target", preview.homeTarget);
  dom.modelViewer.setAttribute("field-of-view", preview.fieldOfView);
  dom.modelViewer.setAttribute("min-field-of-view", preview.minFieldOfView);
  dom.modelViewer.setAttribute("max-field-of-view", preview.maxFieldOfView);
  dom.modelViewer.setAttribute("exposure", preview.exposure);
  dom.modelViewer.setAttribute("shadow-intensity", preview.shadowIntensity);
}

function waitForCustomElement(name, timeout = 10000) {
  return Promise.race([
    customElements.whenDefined(name),
    new Promise((_, reject) => {
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
  document.addEventListener("click", closePanelsFromOutside);
  document.addEventListener("selectstart", preventTextSelection);
  document.addEventListener("dragstart", preventTextSelection);
  dom.modelViewer.addEventListener("camera-change", updatePreviewCardWidth);
  dom.modelViewer.addEventListener("pointerdown", cancelPreviewCameraAnimation);
  dom.menuButton.addEventListener("click", toggleSideMenu);
  dom.menuBackdrop.addEventListener("click", closeSideMenu);
  dom.menuHomeButton.addEventListener("click", openHome);
  dom.menuGuideButton.addEventListener("click", (event) => openInfoSheet(event, "guide", "Panduan Singkat"));
  dom.menuAboutButton.addEventListener("click", (event) => openInfoSheet(event, "about", "Tentang Dungkluruk AR"));
  dom.menuSettingsButton.addEventListener("click", (event) => openInfoSheet(event, "settings", "Pengaturan"));
  dom.menuExitButton.addEventListener("click", exitAr);
  dom.closeInfoButton.addEventListener("click", closeInfoSheet);
  dom.enterArButton.addEventListener("click", startAr);
  dom.sheetStartArButton.addEventListener("click", startAr);
  dom.sheetPreviewButton.addEventListener("click", showPreviewHome);
  dom.settingLabels.addEventListener("change", applySettings);
  dom.settingGuide.addEventListener("change", applySettings);
  dom.settingModelSize.addEventListener("change", applySettings);
  dom.settingResetModel.addEventListener("click", resetPlacedModel);
  dom.detailCloseButton.addEventListener("click", closeInfoSheet);
  dom.replaceModelButton.addEventListener("click", searchAnotherPlace);
  dom.prevButton.addEventListener("click", () => navigateHotspot(-1));
  dom.nextButton.addEventListener("click", () => navigateHotspot(1));
}

function preventTextSelection(event) {
  event.preventDefault();
}

function toggleSideMenu(event) {
  event.stopPropagation();
  dom.infoSheet.classList.add("hidden");
  const willOpen = dom.sideMenu.classList.contains("hidden");
  dom.sideMenu.classList.toggle("hidden", !willOpen);
  dom.menuBackdrop.classList.toggle("hidden", !willOpen);
}

function closeSideMenu() {
  dom.sideMenu.classList.add("hidden");
  dom.menuBackdrop.classList.add("hidden");
}

function openHome(event) {
  event.stopPropagation();
  if (isInAR) {
    exitAr();
    return;
  }
  openInfoSheet(event, "home", "Beranda");
}

function openInfoSheet(event, sheetName, title) {
  event.stopPropagation();
  closeSideMenu();
  dom.sheetTitle.textContent = title;
  dom.sheetContents.forEach((content) => content.classList.toggle("hidden", content.dataset.sheet !== sheetName));
  dom.infoSheet.classList.remove("hidden");
}

function openHotspotDetail(index) {
  const hotspot = hotspots[index];
  dom.detailNumber.textContent = hotspot.buttonText;
  dom.detailTitle.textContent = hotspot.header;
  dom.detailDescription.textContent = hotspot.detail || hotspot.description;
  dom.sheetTitle.textContent = "Detail Tempat";
  dom.sheetContents.forEach((content) => content.classList.toggle("hidden", content.dataset.sheet !== "detail"));
  dom.infoSheet.classList.remove("hidden");
}

function closeInfoSheet(event) {
  event.stopPropagation();
  dom.infoSheet.classList.add("hidden");
}

function closePanelsFromOutside(event) {
  const clickedMenu = dom.sideMenu.contains(event.target) || dom.menuButton.contains(event.target);
  const clickedSheet = dom.infoSheet.contains(event.target);

  if (!clickedMenu) closeSideMenu();
  if (!clickedSheet) dom.infoSheet.classList.add("hidden");
}

function exitAr() {
  closeSideMenu();
  if (!renderer) return;
  const session = renderer.xr.getSession();
  if (session) session.end();
}

function showPreviewHome(event) {
  event.stopPropagation();
  closeInfoSheet(event);
  resetPreviewScene();
}

function applySettings(shouldPersist = true) {
  document.body.classList.toggle("hide-hotspot-labels", !dom.settingLabels.checked);
  document.body.classList.toggle("hide-ar-guide", !dom.settingGuide.checked);
  const scale = Number(dom.settingModelSize.value);
  if (placedModel && placedModel.visible) {
    placedModel.scale.setScalar(scale);
    placedModel.updateMatrixWorld(true);
  }
  if (shouldPersist) saveSettings();
}

function loadSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
    if (!settings || typeof settings !== "object") return;
    if (typeof settings.showLabels === "boolean") dom.settingLabels.checked = settings.showLabels;
    if (typeof settings.showGuide === "boolean") dom.settingGuide.checked = settings.showGuide;
    if (["0.8", "1", "1.25"].includes(String(settings.modelSize))) {
      dom.settingModelSize.value = String(settings.modelSize);
    }
  } catch (error) {
    console.warn("Pengaturan tersimpan tidak dapat dibaca", error);
  }
}

function saveSettings() {
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

function resetPlacedModel(event) {
  event.stopPropagation();
  if (!isInAR || !placedModel || !placedModel.visible) return;
  searchAnotherPlace();
  closeInfoSheet(event);
}

async function setupArSupport() {
  const supportsQuickLook = isIosDevice() && typeof dom.modelViewer.activateAR === "function";

  if (!navigator.xr || !navigator.xr.isSessionSupported) {
    dom.enterArButton.disabled = !supportsQuickLook;
    dom.sheetStartArButton.disabled = !supportsQuickLook;
    dom.statusText.textContent = supportsQuickLook
      ? "Siap untuk AR Quick Look"
      : "WebXR AR tidak tersedia di browser ini";
    return;
  }

  try {
    supportsWebXrAr = await navigator.xr.isSessionSupported("immersive-ar");
    const canStartAr = supportsWebXrAr || supportsQuickLook;
    dom.enterArButton.disabled = !canStartAr;
    dom.sheetStartArButton.disabled = !canStartAr;
    dom.statusText.textContent = supportsWebXrAr
      ? "Siap untuk WebXR AR"
      : supportsQuickLook
        ? "Siap untuk AR Quick Look"
        : "Perangkat belum mendukung AR imersif";
  } catch (error) {
    dom.enterArButton.disabled = !supportsQuickLook;
    dom.sheetStartArButton.disabled = !supportsQuickLook;
    dom.statusText.textContent = supportsQuickLook
      ? "Siap untuk AR Quick Look"
      : "Tidak bisa mengecek dukungan WebXR AR";
  }
}

async function startAr() {
  if (!modelTemplate) return;

  if (
    typeof dom.modelViewer.activateAR === "function" &&
    (USE_MODEL_VIEWER_WEBXR || (!supportsWebXrAr && isIosDevice()))
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

  let session = null;

  try {
    closeSideMenu();
    dom.infoSheet.classList.add("hidden");
    resetToHome(false);

    session = await navigator.xr.requestSession("immersive-ar", {
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

function showAllModelViewerHotspots() {
  currentHotspotIndex = -1;
  previewHotspotElements.forEach((element) => {
    element.classList.remove("hidden", "active", "card-forced-open");
    element.classList.add("card-collapsed");
  });
  setNavDots(navDotElements, currentHotspotIndex);
  dom.buttonText.textContent = "Beranda";
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function placeModel() {
  if (performance.now() < suppressPlacementUntil) return;
  if (arPlacementState === "placed" || !lastHitMatrix || !modelTemplate) return;

  preparePlacedModel();

  placedModel.visible = true;
  placedModel.position.setFromMatrixPosition(lastHitMatrix);
  placedModel.quaternion.setFromRotationMatrix(lastHitMatrix);
  placedModel.scale.setScalar(Number(dom.settingModelSize.value));
  placedModel.updateMatrixWorld(true);

  setArPlacementState("placed");
  dom.statusText.textContent = "Model ditempatkan";
}

function preparePlacedModel() {
  if (placedModel || !modelTemplate) return;

  placedModel = createModelInstance(modelTemplate, hotspots, DEBUG_HOTSPOTS);
  placedModel.visible = false;
  scene.add(placedModel);
}

function searchAnotherPlace() {
  if (!isInAR) return;

  suppressPlacementUntil = performance.now() + 700;
  resetHitStability();
  gestureControls.clear();
  gestureHint.hide();
  dom.focusDirection.classList.add("hidden");

  if (placedModel) placedModel.visible = false;
  currentHotspotIndex = -1;
  updateHotspotState();
  setArPlacementState("scanning");
}

function onArEnded() {
  isInAR = false;
  document.body.classList.remove("ar-active");
  setArPlacementState("preview");
  dom.sideMenu.classList.add("hidden");
  dom.menuBackdrop.classList.add("hidden");
  dom.infoSheet.classList.add("hidden");
  clearHitTestSource();
  resetHitStability();
  gestureControls.clear();
  reticle.visible = false;
  dom.enterArButton.classList.remove("hidden");
  controls.enabled = true;

  if (previewModel) previewModel.visible = false;
  if (placedModel) {
    scene.remove(placedModel);
    placedModel = null;
  }

  resetPreviewScene();
  requestAnimationFrame(resetPreviewScene);
  setupArSupport();
}

function clearHitTestSource() {
  if (hitTestSource && typeof hitTestSource.cancel === "function") hitTestSource.cancel();
  hitTestSourceRequested = false;
  hitTestSource = null;
  hitTestRetryAfter = 0;
}

function setArPlacementState(state) {
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

function render(timestamp, frame) {
  if (!isInAR) return;

  const session = renderer.xr.getSession();
  if (session && frame && arPlacementState !== "placed") updateHitTest(frame);
  updateScanGuidance();

  renderer.render(scene, camera);
  updateHotspotPositions();
}

function updateScanGuidance() {
  if (!isInAR || arPlacementState !== "scanning" || !scanStartedAt) return;

  const elapsed = performance.now() - scanStartedAt;
  let nextIndex = 0;
  SCAN_ADVICE.forEach((advice, index) => {
    if (elapsed >= advice.after) nextIndex = index;
  });

  if (nextIndex === scanAdviceIndex) return;
  scanAdviceIndex = nextIndex;
  dom.arInstructions.textContent = SCAN_ADVICE[nextIndex].text;
}

function updateHitTest(frame) {
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
    const pose = hit.getPose(referenceSpace);
    if (!pose) return;

    hitMatrixScratch.fromArray(pose.transform.matrix);
    updateStableHit(hitMatrixScratch);
  } else {
    if (
      (!placedModel || !placedModel.visible) &&
      lastHitMatrix &&
      performance.now() - lastHitSeenAt <= HIT_LOST_GRACE
    ) {
      return;
    }

    resetHitStability();
    if ((!placedModel || !placedModel.visible) && arPlacementState !== "scanning") setArPlacementState("scanning");
  }
}

async function requestHitTestSource(session) {
  hitTestSourceRequested = true;

  try {
    const viewerSpace = await session.requestReferenceSpace("viewer");
    const source = await session.requestHitTestSource({ space: viewerSpace });
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

function updateStableHit(hitMatrix) {
  hitPositionScratch.setFromMatrixPosition(hitMatrix);
  hitQuaternionScratch.setFromRotationMatrix(hitMatrix);

  hitSamples[hitSampleCursor].copy(hitPositionScratch);
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

  smoothedHitMatrix.compose(
    smoothedHitPosition,
    smoothedHitQuaternion,
    smoothedHitScale
  );
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

function isHitStable(positionTolerance = HIT_POSITION_TOLERANCE) {
  if (hitSampleCount < HIT_SAMPLE_MINIMUM) return false;

  hitCenterScratch.set(0, 0, 0);
  for (let index = 0; index < hitSampleCount; index += 1) {
    hitCenterScratch.add(hitSamples[index]);
  }
  hitCenterScratch.multiplyScalar(1 / hitSampleCount);

  for (let index = 0; index < hitSampleCount; index += 1) {
    if (hitSamples[index].distanceTo(hitCenterScratch) > positionTolerance) return false;
  }
  return true;
}

function resetHitStability() {
  hitSampleCursor = 0;
  hitSampleCount = 0;
  stableHitSince = 0;
  unstableHitSince = 0;
  lastHitSeenAt = 0;
  hasSmoothedHit = false;
  lastHitMatrix = null;
}

function updateHotspotPositions() {
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
  if (!hotspotAnchor) return;

  hotspotAnchor.getWorldPosition(hotspotWorldPositionScratch);
  projectWorldToDom(renderer, camera, hotspotWorldPositionScratch, focusedProjection);

  if (focusedProjection.behindCamera) {
    element.classList.add("hidden");
  } else {
    element.classList.remove("hidden");
    const isCardHidden = element.classList.contains("card-hidden");
    if (!isCardHidden && activeModel.scale.x < CARD_HIDE_MODEL_SCALE) {
      element.classList.add("card-hidden");
    } else if (isCardHidden && activeModel.scale.x > CARD_SHOW_MODEL_SCALE) {
      element.classList.remove("card-hidden");
    }
    element.style.left = focusedProjection.screenX + "px";
    element.style.top = focusedProjection.screenY + "px";
  }

  updateFocusDirection(
    dom.focusDirection,
    focusedProjection,
    isInAR && arPlacementState === "placed" && currentHotspotIndex !== -1
  );
}

function navigateHotspot(direction) {
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

function selectHotspot(index) {
  const selectionChanged = currentHotspotIndex !== index;
  currentHotspotIndex = index;
  updateHotspotState(selectionChanged);
}

function selectPreviewHotspot(index) {
  const selectionChanged = currentHotspotIndex !== index;
  currentHotspotIndex = index;
  updateHotspotState(selectionChanged);
}

function updateHotspotState(focusSelection = true) {
  setHotspotState(hotspotElements, currentHotspotIndex, dom.buttonText, hotspots);
  setHotspotState(previewHotspotElements, currentHotspotIndex, dom.buttonText, hotspots);
  setNavDots(navDotElements, currentHotspotIndex);
  if (focusSelection) {
    focusSelectedHotspot();
  }
  requestAnimationFrame(updatePreviewCardWidth);
}

function updatePreviewCardWidth() {
  if (isInAR || currentHotspotIndex === -1) return;

  const hotspot = previewHotspotElements[currentHotspotIndex];
  if (!hotspot || hotspot.classList.contains("hidden")) return;

  const point = hotspot.querySelector(".preview-hotspot-point");
  const card = hotspot.querySelector(".preview-native-card");
  const availableWidth = Math.floor(point.getBoundingClientRect().left - 20);
  const width = Math.max(96, Math.min(260, availableWidth));

  card.style.width = width + "px";
  card.classList.toggle("compact", width < 190);
  card.classList.toggle("narrow", width < 132);
}

function resetToHome(animate) {
  currentHotspotIndex = -1;
  setHotspotState(hotspotElements, currentHotspotIndex, dom.buttonText, hotspots);
  setHotspotState(previewHotspotElements, currentHotspotIndex, dom.buttonText, hotspots);
  setNavDots(navDotElements, currentHotspotIndex);
  if (animate) focusSelectedHotspot();
}

function resetPreviewScene() {
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

  setModelViewerCamera(projectConfig.preview.homeOrbit, projectConfig.preview.homeTarget, false);
  if (!camera || !controls) return;

  resetPreviewCamera(camera, controls, previewModel);
  updateHotspotPositions();
}

function focusSelectedHotspot() {
  if (isInAR) return;

  if (currentHotspotIndex === -1) {
    setModelViewerCamera(projectConfig.preview.homeOrbit, projectConfig.preview.homeTarget);
    return;
  }

  const hotspot = hotspots[currentHotspotIndex];
  const target =
    hotspot.position.x + "m " + hotspot.position.y + "m " + hotspot.position.z + "m";
  const orbit =
    hotspot.orbit.theta + "deg " + hotspot.orbit.phi + "deg " + hotspot.orbit.radius + "m";
  setModelViewerCamera(orbit, target);
}

function setModelViewerCamera(orbit, target, animate = true) {
  if (!dom.modelViewer) return;
  if (!animate || typeof dom.modelViewer.getCameraOrbit !== "function") {
    cancelPreviewCameraAnimation();
    dom.modelViewer.setAttribute("camera-orbit", orbit);
    dom.modelViewer.setAttribute("camera-target", target);
    return;
  }

  animateModelViewerCamera(orbit, target);
}

function animateModelViewerCamera(orbit, target) {
  cancelPreviewCameraAnimation();

  const fromOrbit = dom.modelViewer.getCameraOrbit();
  const fromTarget = dom.modelViewer.getCameraTarget();
  const toOrbit = parseOrbit(orbit);
  const toTarget = parseTarget(target);
  const thetaDelta = shortestAngle(toOrbit.theta - fromOrbit.theta);
  const startedAt = performance.now();
  const duration = projectConfig.preview.cameraTransitionMs;

  function update(time) {
    const progress = Math.min((time - startedAt) / duration, 1);
    const eased = smootherStep(progress);
    const theta = fromOrbit.theta + thetaDelta * eased;
    const phi = THREE.MathUtils.lerp(fromOrbit.phi, toOrbit.phi, eased);
    const radius = THREE.MathUtils.lerp(fromOrbit.radius, toOrbit.radius, eased);
    const x = THREE.MathUtils.lerp(fromTarget.x, toTarget.x, eased);
    const y = THREE.MathUtils.lerp(fromTarget.y, toTarget.y, eased);
    const z = THREE.MathUtils.lerp(fromTarget.z, toTarget.z, eased);

    dom.modelViewer.cameraOrbit = `${theta}rad ${phi}rad ${radius}m`;
    dom.modelViewer.cameraTarget = `${x}m ${y}m ${z}m`;
    dom.modelViewer.jumpCameraToGoal();

    if (progress < 1) {
      previewCameraAnimationFrame = requestAnimationFrame(update);
    } else {
      previewCameraAnimationFrame = 0;
    }
  }

  previewCameraAnimationFrame = requestAnimationFrame(update);
}

function cancelPreviewCameraAnimation() {
  if (!previewCameraAnimationFrame) return;
  cancelAnimationFrame(previewCameraAnimationFrame);
  previewCameraAnimationFrame = 0;
}

function parseOrbit(value) {
  const [theta, phi, radius] = value.split(/\s+/);
  return {
    theta: THREE.MathUtils.degToRad(Number.parseFloat(theta)),
    phi: THREE.MathUtils.degToRad(Number.parseFloat(phi)),
    radius: Number.parseFloat(radius),
  };
}

function parseTarget(value) {
  const [x, y, z] = value.split(/\s+/).map(Number.parseFloat);
  return { x, y, z };
}

function shortestAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function smootherStep(value) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function setupOverlayGuards() {
  [dom.topbar, dom.menuBackdrop, dom.sideMenu, dom.infoSheet, dom.arStatus, dom.arInstructions, dom.arMenu, dom.hotspotLayer, dom.navContainer]
    .filter(Boolean)
    .forEach((element) => {
      element.addEventListener("beforexrselect", (event) => {
        event.preventDefault();
      });
    });
}

function onResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  requestAnimationFrame(updatePreviewCardWidth);
}
