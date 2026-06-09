import { createCameraTween, createModelRotationTween } from "./modules/animation.js";
import { getDom } from "./modules/dom.js";
import { setupArGestures } from "./modules/gestures.js";
import { hotspots } from "./modules/hotspots.js";
import {
  getXrProjectionCamera,
  normalizeAngle,
} from "./modules/math.js";
import {
  createModelInstance,
  createReticle,
  createSurfaceGrid,
  createGestureIndicator,
  createThreeScene,
  frameObject,
  getPreviewHomeTarget,
  loadModel,
  MODEL_BASE_SCALE,
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

const dom = getDom();
const cameraTween = createCameraTween();
const modelRotationTween = createModelRotationTween();
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
let hitSamples = [];
let stableHitSince = 0;
let unstableHitSince = 0;
let lastHitSeenAt = 0;
let hasSmoothedHit = false;
let scanStartedAt = 0;
let scanAdviceIndex = -1;
let previewHotspotElements = [];
let supportsWebXrAr = false;

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
const smoothedHitPosition = new THREE.Vector3();
const smoothedHitQuaternion = new THREE.Quaternion();
const smoothedHitScale = new THREE.Vector3(1, 1, 1);
const SCAN_ADVICE = [
  { after: 0, text: "Gerakkan kamera perlahan ke arah lantai." },
  { after: 4000, text: "Arahkan kamera ke lantai yang memiliki pola atau tekstur." },
  { after: 8000, text: "Mundur sedikit agar area lantai terlihat lebih luas." },
  { after: 12000, text: "Pastikan ruangan cukup terang, lalu gerakkan kamera kiri dan kanan." },
];
const PREVIEW_HOME_ORBIT = "-408.8deg 61.96deg 0.99999m";
const PREVIEW_HOME_TARGET = "-0.003m 0.5722m 0.0391m";

const hotspotElements = createHotspotElements(hotspots, dom.hotspotLayer, selectHotspot, openHotspotDetail);
const navDotElements = createNavDots(hotspots.length, dom.navDots);

init();

async function init() {
  dom.modelViewer.setAttribute("scale", `${MODEL_BASE_SCALE} ${MODEL_BASE_SCALE} ${MODEL_BASE_SCALE}`);
  ({ scene, camera, renderer, controls } = createThreeScene(dom.canvas));
  reticle = createReticle(scene);
  surfaceGrid = createSurfaceGrid(scene);
  gestureIndicator = createGestureIndicator(scene);

  await setupEnvironment(scene, renderer);
  modelTemplate = await loadModel(dom.statusText);

  previewModel = createModelInstance(modelTemplate);
  previewModel.visible = false;
  scene.add(previewModel);
  frameObject(previewModel, controls);
  previewHotspotElements = createModelViewerHotspotElements(
    hotspots,
    dom.modelViewer,
    selectPreviewHotspot,
    openHotspotDetail
  );

  await customElements.whenDefined("model-viewer");
  await setupArSupport();
  setupOverlayGuards();
  setupEvents();

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
}

function setupEvents() {
  window.addEventListener("resize", onResize);
  document.addEventListener("click", closePanelsFromOutside);
  dom.modelViewer.addEventListener("camera-change", updatePreviewCardWidth);
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
  const session = renderer.xr.getSession();
  if (session) session.end();
}

function showPreviewHome(event) {
  event.stopPropagation();
  closeInfoSheet(event);
  resetPreviewScene();
}

function applySettings() {
  document.body.classList.toggle("hide-hotspot-labels", !dom.settingLabels.checked);
  document.body.classList.toggle("hide-ar-guide", !dom.settingGuide.checked);
  const scale = Number(dom.settingModelSize.value);
  if (placedModel && placedModel.visible) {
    placedModel.scale.setScalar(scale);
    placedModel.updateMatrixWorld(true);
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
      ? "Ready for AR Quick Look"
      : "WebXR AR tidak tersedia di browser ini";
    return;
  }

  try {
    supportsWebXrAr = await navigator.xr.isSessionSupported("immersive-ar");
    const canStartAr = supportsWebXrAr || supportsQuickLook;
    dom.enterArButton.disabled = !canStartAr;
    dom.sheetStartArButton.disabled = !canStartAr;
    dom.statusText.textContent = supportsWebXrAr
      ? "Ready for WebXR AR"
      : supportsQuickLook
        ? "Ready for AR Quick Look"
        : "Perangkat belum mendukung immersive AR";
  } catch (error) {
    dom.enterArButton.disabled = !supportsQuickLook;
    dom.sheetStartArButton.disabled = !supportsQuickLook;
    dom.statusText.textContent = supportsQuickLook
      ? "Ready for AR Quick Look"
      : "Tidak bisa mengecek dukungan WebXR AR";
  }
}

async function startAr() {
  if (!modelTemplate) return;

  if (!supportsWebXrAr && isIosDevice() && typeof dom.modelViewer.activateAR === "function") {
    closeSideMenu();
    dom.infoSheet.classList.add("hidden");
    resetToHome(false);
    try {
      await dom.modelViewer.activateAR();
    } catch (error) {
      dom.statusText.textContent = "Quick Look gagal dibuka";
      console.error(error);
    }
    return;
  }

  try {
    closeSideMenu();
    dom.infoSheet.classList.add("hidden");
    resetToHome(false);

    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay", "local-floor"],
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
    isInAR = false;
    document.body.classList.remove("ar-active");
    controls.enabled = true;
    if (previewModel) previewModel.visible = false;
    dom.statusText.textContent = "Gagal memulai AR";
    console.error(error);
  }
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
  placedModel.rotateY(Math.PI);
  placedModel.updateMatrixWorld(true);

  setArPlacementState("placed");
  dom.statusText.textContent = "Model ditempatkan";
}

function preparePlacedModel() {
  if (placedModel || !modelTemplate) return;

  placedModel = createModelInstance(modelTemplate);
  placedModel.visible = false;
  scene.add(placedModel);
}

function searchAnotherPlace() {
  if (!isInAR) return;

  suppressPlacementUntil = performance.now() + 700;
  resetHitStability();
  gestureControls.clear();
  gestureHint.hide();
  modelRotationTween.clear();
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
  hitTestSourceRequested = false;
  hitTestSource = null;
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
  dom.statusText.textContent = "Ready for WebXR AR";
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
    stopModelRotation: modelRotationTween.clear,
    interactionToolbar: dom.interactionToolbar,
  });
}

function render(timestamp, frame) {
  if (!isInAR) return;

  modelRotationTween.update(placedModel);

  const session = renderer.xr.getSession();
  if (session && frame && arPlacementState !== "placed") updateHitTest(frame);
  updateScanGuidance();

  updateHotspotPositions();
  renderer.render(scene, camera);
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

  if (!hitTestSourceRequested) {
    session.requestReferenceSpace("viewer").then((viewerSpace) => {
      session.requestHitTestSource({ space: viewerSpace }).then((source) => {
        hitTestSource = source;
      });
    });
    hitTestSourceRequested = true;
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

    const hitMatrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
    updateStableHit(hitMatrix);
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

function updateStableHit(hitMatrix) {
  const position = new THREE.Vector3().setFromMatrixPosition(hitMatrix);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(hitMatrix);

  hitSamples.push(position.clone());
  if (hitSamples.length > HIT_SAMPLE_LIMIT) hitSamples.shift();

  if (!hasSmoothedHit) {
    smoothedHitPosition.copy(position);
    smoothedHitQuaternion.copy(quaternion);
    hasSmoothedHit = true;
  } else {
    smoothedHitPosition.lerp(position, HIT_SMOOTHING);
    smoothedHitQuaternion.slerp(quaternion, HIT_SMOOTHING);
  }

  const smoothedMatrix = new THREE.Matrix4().compose(
    smoothedHitPosition,
    smoothedHitQuaternion,
    smoothedHitScale
  );
  reticle.matrix.copy(smoothedMatrix);
  reticle.matrixWorldNeedsUpdate = true;
  surfaceGrid.matrix.copy(smoothedMatrix);
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

  lastHitMatrix = smoothedMatrix.clone();
  if (arPlacementState !== "ready") setArPlacementState("ready");
}

function isHitStable(positionTolerance = HIT_POSITION_TOLERANCE) {
  if (hitSamples.length < HIT_SAMPLE_MINIMUM) return false;

  const center = new THREE.Vector3();
  hitSamples.forEach((sample) => center.add(sample));
  center.multiplyScalar(1 / hitSamples.length);

  return hitSamples.every((sample) => sample.distanceTo(center) <= positionTolerance);
}

function resetHitStability() {
  hitSamples = [];
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
  const hotspotAnchor = activeModel.userData.coordinateAnchor || activeModel;
  const projectionCamera = getXrProjectionCamera(renderer, camera);
  const hotspot = hotspots[currentHotspotIndex];
  const element = hotspotElements[currentHotspotIndex];
  const worldPosition = hotspot.position.clone().applyMatrix4(hotspotAnchor.matrixWorld);
  const projected = worldPosition.project(projectionCamera);
  const behindCamera = projected.z < -1 || projected.z > 1;
  const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const screenY = (-projected.y * 0.5 + 0.5) * window.innerHeight;
  const focusedProjected = { x: projected.x, y: projected.y, z: projected.z, screenX, screenY, behindCamera };

  if (behindCamera) {
    element.classList.add("hidden");
  } else {
    element.classList.remove("hidden");
    const isCardHidden = element.classList.contains("card-hidden");
    if (!isCardHidden && activeModel.scale.x < CARD_HIDE_MODEL_SCALE) {
      element.classList.add("card-hidden");
    } else if (isCardHidden && activeModel.scale.x > CARD_SHOW_MODEL_SCALE) {
      element.classList.remove("card-hidden");
    }
    element.style.left = screenX + "px";
    element.style.top = screenY + "px";
  }

  updateFocusDirection(
    dom.focusDirection,
    focusedProjected,
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
    focusArHotspot();
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
  if (!animate) cameraTween.clear();
  else focusSelectedHotspot();
}

function resetPreviewScene() {
  cameraTween.clear();
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

  resetPreviewCamera(camera, controls, previewModel);
  setModelViewerCamera(PREVIEW_HOME_ORBIT, PREVIEW_HOME_TARGET);
  updateHotspotPositions();
}

function focusSelectedHotspot() {
  if (isInAR) return;

  if (currentHotspotIndex === -1) {
    setModelViewerCamera(PREVIEW_HOME_ORBIT, PREVIEW_HOME_TARGET);
    return;
  }

  const hotspot = hotspots[currentHotspotIndex];
  const target =
    hotspot.position.x + "m " + hotspot.position.y + "m " + hotspot.position.z + "m";
  const orbit =
    hotspot.orbit.theta + "deg " + hotspot.orbit.phi + "deg " + hotspot.orbit.radius + "m";
  setModelViewerCamera(orbit, target);
}

function setModelViewerCamera(orbit, target) {
  if (!dom.modelViewer) return;
  dom.modelViewer.setAttribute("camera-orbit", orbit);
  dom.modelViewer.setAttribute("camera-target", target);
}

function focusArHotspot() {
  if (!isInAR || arPlacementState !== "placed" || currentHotspotIndex === -1 || !placedModel || !placedModel.visible) {
    modelRotationTween.clear();
    return;
  }

  const hotspotAnchor = placedModel.userData.coordinateAnchor || placedModel;
  placedModel.updateMatrixWorld(true);
  const hotspotWorld = hotspots[currentHotspotIndex].position.clone().applyMatrix4(hotspotAnchor.matrixWorld);
  const projectionCamera = getXrProjectionCamera(renderer, camera);
  const cameraPosition = new THREE.Vector3().setFromMatrixPosition(projectionCamera.matrixWorld);

  const toCamera = cameraPosition.clone().sub(placedModel.position);
  const toHotspot = hotspotWorld.clone().sub(placedModel.position);
  toCamera.y = 0;
  toHotspot.y = 0;

  if (toCamera.lengthSq() < 0.0001 || toHotspot.lengthSq() < 0.0001) return;

  const angleToCamera = Math.atan2(toCamera.x, toCamera.z);
  const angleToHotspot = Math.atan2(toHotspot.x, toHotspot.z);
  const targetRotation = placedModel.rotation.y + normalizeAngle(angleToCamera - angleToHotspot);
  modelRotationTween.animate(placedModel, targetRotation, 700);
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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  requestAnimationFrame(updatePreviewCardWidth);
}
