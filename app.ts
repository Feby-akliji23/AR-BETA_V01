import "@google/model-viewer";
import type { PerspectiveCamera, WebGLRenderer } from "three";
import { createArController } from "./modules/ar/controller.js";
import { projectConfig } from "./modules/config.js";
import { setupDebugPanel } from "./modules/debug.js";
import { getDom } from "./modules/dom.js";
import { createHotspotController } from "./modules/hotspots/controller.js";
import { createPreviewController } from "./modules/preview/controller.js";
import {
  createModelInstance,
  createThreeScene,
  frameObject,
  loadModel,
  setupEnvironment,
} from "./modules/scene.js";
import { createSettingsController } from "./modules/settings.js";
import type { ArModel } from "./modules/types.js";
import { createGestureHintController } from "./modules/ui.js";

const dungklurukUrl = "./assets/dungkluruk.webp";
const arIconUrl = "./assets/ar_icon.png";
const allArLogoUrl = "./assets/logo%20all%20ar.svg";
const ONBOARDING_STORAGE_KEY = "dungkluruk-ar-onboarding-v1";
const DEBUG_HOTSPOTS = new URLSearchParams(window.location.search).has("debugHotspots");
const IS_DEBUG = new URLSearchParams(window.location.search).has("debug");
const USE_MODEL_VIEWER_WEBXR = false;

document.documentElement.style.setProperty("--img-dungkluruk", `url("${dungklurukUrl}")`);
document.documentElement.style.setProperty("--img-ar-icon", `url("${arIconUrl}")`);
document.documentElement.style.setProperty("--img-all-ar-logo", `url("${allArLogoUrl}")`);

const dom = getDom();
const { hotspots } = projectConfig;
const gestureHint = createGestureHintController(dom.gestureHint);

let renderer: WebGLRenderer;
let camera: PerspectiveCamera;
let previewModel: ArModel | null = null;
let arController: ReturnType<typeof createArController> | null = null;
let hotspotController: ReturnType<typeof createHotspotController> | null = null;
let previewController: ReturnType<typeof createPreviewController> | null = null;
let connectionBannerTimeout = 0;
let wasOffline = !navigator.onLine;
let loaderStatusObserver: MutationObserver | null = null;

const settings = createSettingsController({
  labels: dom.settingLabels,
  guide: dom.settingGuide,
  modelSize: dom.settingModelSize,
  getPlacedModel: () => arController?.getPlacedModel() ?? null,
});

void init();
registerServiceWorker();

async function init(): Promise<void> {
  syncAppLoaderStatus();
  setupOverlayGuards();
  setupEvents();
  settings.load();
  settings.apply(false);

  try {
    applyProjectConfig();
    const threeScene = createThreeScene(dom.canvas);
    ({ renderer, camera } = threeScene);
    await setupEnvironment(threeScene.scene, renderer);
    const modelTemplate = await loadModel(dom.statusText);

    previewModel = createModelInstance(modelTemplate, hotspots, false, isDesktop());
    previewModel.visible = false;
    threeScene.scene.add(previewModel);
    frameObject(previewModel, threeScene.controls);

    hotspotController = createHotspotController({
      renderer,
      camera,
      hotspots,
      modelViewer: dom.modelViewer,
      hotspotLayer: dom.hotspotLayer,
      navDots: dom.navDots,
      buttonText: dom.buttonText,
      focusDirection: dom.focusDirection,
      isDesktop,
      getIsInAr: () => arController?.getIsInAr() ?? false,
      getPlacementState: () => arController?.getPlacementState() ?? "preview",
      getPlacedModel: () => arController?.getPlacedModel() ?? null,
      clearGestures: () => arController?.clearGestures(),
      focusPreview: (index, animate) => previewController?.focusSelection(index, animate),
      openDetail: openHotspotDetail,
    });
    previewController = createPreviewController({
      camera,
      controls: threeScene.controls,
      previewModel,
      modelViewer: dom.modelViewer,
      hotspots,
      isDebug: IS_DEBUG,
      getIsInAr: () => arController?.getIsInAr() ?? false,
      getCurrentHotspotIndex: hotspotController.getCurrentIndex,
      resetHotspots: hotspotController.resetToHome,
      revealSelectedHotspot: hotspotController.revealSelectedPreviewHotspot,
      updateArHotspotPositions: hotspotController.updateArPositions,
      resizeHotspots: hotspotController.onResize,
    });

    arController = createArController({
      scene: threeScene.scene,
      camera,
      renderer,
      controls: threeScene.controls,
      modelTemplate,
      hemisphereLight: threeScene.hemisphereLight,
      directionalLight: threeScene.directionalLight,
      hotspots,
      dom,
      gestureHint,
      usdzUrl: projectConfig.model.usdzUrl,
      debugHotspots: DEBUG_HOTSPOTS,
      useModelViewerWebXr: USE_MODEL_VIEWER_WEBXR,
      getPreviewModel: () => previewModel,
      getModelSize: settings.getModelSize,
      closeSideMenu,
      resetToHome: hotspotController.resetToHome,
      resetPreviewScene: previewController.resetScene,
      showAllModelViewerHotspots: hotspotController.showAllModelViewerHotspots,
      resetHotspotsForScanning: () => hotspotController?.resetToHome(false),
      clearHotspotFocus: hotspotController.clearArFocus,
      updateHotspotFocus: hotspotController.updateArFocus,
      updateHotspotPositions: hotspotController.updateArPositions,
    });
    renderer.setAnimationLoop(arController.render);

    await waitForCustomElement("model-viewer");
    dom.statusText.textContent = "Memeriksa dukungan AR";
    await arController.setupSupport();
    showFirstVisitGuide();
    setupDebug();
    hideAppLoader();
  } catch (error) {
    dom.enterArButton.disabled = true;
    dom.sheetStartArButton.disabled = true;
    dom.statusText.textContent = "Aplikasi gagal dimuat. Periksa koneksi lalu muat ulang.";
    hideAppLoader();
    console.error("Inisialisasi gagal", error);
  }
}

function applyProjectConfig(): void {
  const { app, model, preview } = projectConfig;
  const frame = getPreviewFrame();
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
  if (model.usdzUrl) dom.modelViewer.setAttribute("ios-src", model.usdzUrl);
  else dom.modelViewer.removeAttribute("ios-src");
  dom.modelViewer.setAttribute("alt", model.alt);
  dom.modelViewer.setAttribute("skybox-image", model.environmentUrl);
  dom.modelViewer.setAttribute("scale", `${preview.scale} ${preview.scale} ${preview.scale}`);
  dom.modelViewer.setAttribute("orientation", model.orientation.map((angle) => `${angle}deg`).join(" "));
  dom.modelViewer.setAttribute("camera-orbit", frame.homeOrbit);
  dom.modelViewer.setAttribute("camera-target", frame.homeTarget);
  dom.modelViewer.fieldOfView = frame.fieldOfView;
  dom.modelViewer.setAttribute("min-field-of-view", preview.minFieldOfView);
  dom.modelViewer.setAttribute("max-field-of-view", preview.maxFieldOfView);
  dom.modelViewer.setAttribute("exposure", preview.exposure);
  dom.modelViewer.setAttribute("shadow-intensity", preview.shadowIntensity);
  dom.modelViewer.setAttribute("interpolation-decay", "100");
}

function setupEvents(): void {
  window.addEventListener("resize", onResize);
  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  document.addEventListener("click", closePanelsFromOutside);
  document.addEventListener("selectstart", preventDefault);
  document.addEventListener("dragstart", preventDefault);
  dom.modelViewer.addEventListener("pointerdown", () => previewController?.cancelCameraAnimation(true));
  dom.menuButton.addEventListener("click", toggleSideMenu);
  dom.menuBackdrop.addEventListener("click", closeSideMenu);
  dom.menuHomeButton.addEventListener("click", openHome);
  dom.menuGuideButton.addEventListener("click", (event) => openInfoSheet(event, "guide", "Panduan Singkat"));
  dom.menuAboutButton.addEventListener("click", (event) =>
    openInfoSheet(event, "about", "Tentang Dungkluruk AR")
  );
  dom.menuSettingsButton.addEventListener("click", (event) => openInfoSheet(event, "settings", "Pengaturan"));
  dom.menuExitButton.addEventListener("click", () => arController?.exit());
  dom.closeInfoButton.addEventListener("click", closeInfoSheet);
  dom.enterArButton.addEventListener("click", () => void arController?.start());
  dom.sheetStartArButton.addEventListener("click", () => void arController?.start());
  dom.sheetPreviewButton.addEventListener("click", showPreviewHome);
  dom.settingLabels.addEventListener("change", () => settings.apply());
  dom.settingGuide.addEventListener("change", () => settings.apply());
  dom.settingModelSize.addEventListener("change", () => settings.apply());
  dom.settingResetModel.addEventListener("click", resetPlacedModel);
  dom.detailCloseButton.addEventListener("click", closeInfoSheet);
  dom.replaceModelButton.addEventListener("click", () => arController?.searchAnotherPlace());
  dom.prevButton.addEventListener("click", () => hotspotController?.navigate(-1));
  dom.nextButton.addEventListener("click", () => hotspotController?.navigate(1));
  updateConnectionStatus();
}

function setupDebug(): void {
  if (!IS_DEBUG || !hotspotController || !previewController) return;
  setupDebugPanel(dom.modelViewer, hotspots, {
    prevButton: dom.prevButton,
    nextButton: dom.nextButton,
    buttonText: dom.buttonText,
    navDots: dom.navDots,
    previewHotspotElements: hotspotController.previewElements,
    focusCamera: (orbit, target, fieldOfView, onComplete) => {
      previewController?.focusCamera(orbit, target, true, onComplete, fieldOfView);
    },
  });
}

function openHotspotDetail(index: number): void {
  const hotspot = hotspots[index];
  if (!hotspot) return;
  dom.detailNumber.textContent = hotspot.buttonText;
  dom.detailTitle.textContent = hotspot.header;
  dom.detailDescription.textContent = hotspot.detail || hotspot.description;
  dom.detailImage.style.backgroundImage = `url("${hotspot.imageUrl || projectConfig.app.defaultImageUrl}")`;
  openInfoSheet(null, "detail", "Detail Tempat");
}

function openHome(event: MouseEvent): void {
  event.stopPropagation();
  if (arController?.getIsInAr()) arController.exit();
  else openInfoSheet(event, "home", "Beranda");
}

function showPreviewHome(event: MouseEvent): void {
  event.stopPropagation();
  closeInfoSheet(event);
  previewController?.resetScene();
}

function resetPlacedModel(event: MouseEvent): void {
  event.stopPropagation();
  if (!arController?.getIsInAr() || !arController.getPlacedModel().visible) return;
  arController.searchAnotherPlace();
  closeInfoSheet(event);
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

function openInfoSheet(event: Event | null, sheetName: string, title: string): void {
  event?.stopPropagation();
  closeSideMenu();
  dom.sheetTitle.textContent = title;
  dom.sheetContents.forEach((content) => {
    content.classList.toggle("hidden", content.dataset.sheet !== sheetName);
  });
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

function showFirstVisitGuide(): void {
  try {
    if (localStorage.getItem(ONBOARDING_STORAGE_KEY)) return;
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "seen");
  } catch (error) {
    console.warn("Status onboarding tidak dapat disimpan", error);
  }
  openInfoSheet(null, "guide", "Panduan Singkat");
}

function updateConnectionStatus(event?: Event): void {
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
  connectionBannerTimeout = window.setTimeout(() => dom.connectionBanner.classList.add("hidden"), 3200);
}

function onResize(): void {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  previewController?.onResize();
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
  ].forEach((element) => {
    element.addEventListener("beforexrselect", preventDefault);
  });
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
  requestAnimationFrame(() => dom.appLoader.classList.add("loaded"));
}

function getPreviewFrame() {
  return isDesktop() ? projectConfig.preview.desktop : projectConfig.preview.mobile;
}

function isDesktop(): boolean {
  return window.innerWidth >= projectConfig.preview.desktopBreakpoint;
}

function waitForCustomElement(name: string, timeout = 10000): Promise<CustomElementConstructor> {
  return Promise.race([
    customElements.whenDefined(name),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${name} gagal dimuat`)), timeout);
    }),
  ]);
}

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Dukungan offline gagal diaktifkan", error);
    });
  });
}

function preventDefault(event: Event): void {
  event.preventDefault();
}
