import type {
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createModelInstance, createGestureIndicator, createReticle, createSurfaceGrid } from "../scene.js";
import type {
  ArModel,
  ArPlacementState,
  GestureControls,
  HotspotConfig,
  ModelViewerElement,
} from "../types.js";
import { setArPlacementState as applyArPlacementState } from "../ui.js";
import { createArAnchorController } from "./anchors.js";
import { setupArGestures } from "./gestures.js";
import { createArPlacementController } from "./placement.js";
import { createArLightingController } from "./lighting.js";
import { endArSession, isQuickLookSupported, requestArSession } from "./session.js";
import { createArShadowController } from "./shadows.js";

const SCAN_ADVICE = [
  { after: 0, text: "Gerakkan kamera perlahan ke arah lantai." },
  { after: 4000, text: "Arahkan kamera ke lantai yang memiliki pola atau tekstur." },
  { after: 8000, text: "Mundur sedikit agar area lantai terlihat lebih luas." },
  { after: 12000, text: "Pastikan ruangan cukup terang, lalu gerakkan kamera kiri dan kanan." },
];

interface ArControllerDom {
  modelViewer: ModelViewerElement;
  enterArButton: HTMLButtonElement;
  sheetStartArButton: HTMLButtonElement;
  statusText: HTMLElement;
  arStatus: HTMLElement;
  arInstructions: HTMLElement;
  arScanReticle: HTMLElement;
  arMenu: HTMLElement;
  interactionToolbar: HTMLElement;
  focusDirection: HTMLElement;
  infoSheet: HTMLElement;
  sideMenu: HTMLElement;
  menuBackdrop: HTMLElement;
}

interface GestureHintController {
  show: (message: string) => void;
  hideSoon: () => void;
  hide: () => void;
}

interface ArControllerOptions {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  modelTemplate: Group;
  hemisphereLight: HemisphereLight;
  directionalLight: DirectionalLight;
  hotspots: HotspotConfig[];
  dom: ArControllerDom;
  gestureHint: GestureHintController;
  usdzUrl: string;
  debugHotspots: boolean;
  useModelViewerWebXr: boolean;
  getPreviewModel: () => ArModel | null;
  getModelSize: () => number;
  closeSideMenu: () => void;
  resetToHome: (animate: boolean) => void;
  resetPreviewScene: () => void;
  showAllModelViewerHotspots: () => void;
  resetHotspotsForScanning: () => void;
  clearHotspotFocus: () => void;
  updateHotspotFocus: (timestamp: number) => void;
  updateHotspotPositions: () => void;
}

export function createArController(options: ArControllerOptions) {
  let isInAr = false;
  let placementState: ArPlacementState = "preview";
  let suppressPlacementUntil = 0;
  let scanStartedAt = 0;
  let scanAdviceIndex = -1;
  let supportsWebXrAr = false;
  let supportsQuickLookAr = false;

  const reticle = createReticle(options.scene);
  const surfaceGrid = createSurfaceGrid(options.scene);
  const placedModel = createModelInstance(
    options.modelTemplate,
    options.hotspots,
    options.debugHotspots,
    false
  );
  placedModel.visible = false;
  options.scene.add(placedModel);

  const lighting = createArLightingController(
    options.scene,
    options.renderer,
    options.hemisphereLight,
    options.directionalLight
  );
  const shadows = createArShadowController({
    renderer: options.renderer,
    directionalLight: options.directionalLight,
    model: placedModel,
    hasLightEstimate: lighting.hasEstimate,
    setLightTarget: lighting.setTarget,
  });
  const anchors = createArAnchorController({
    renderer: options.renderer,
    getModel: () => placedModel,
    getPlacementState: () => placementState,
    isInAR: () => isInAr,
    setStatus: (message) => {
      options.dom.statusText.textContent = message;
    },
    onTrackingLost: () => {
      searchAnotherPlace();
      options.dom.statusText.textContent = "Tracking hilang, cari permukaan lagi";
    },
  });
  const placement = createArPlacementController({
    renderer: options.renderer,
    reticle,
    surfaceGrid,
    getModel: () => placedModel,
    getPlacementState: () => placementState,
    setPlacementState,
    setStatus: (message) => {
      options.dom.statusText.textContent = message;
    },
  });
  const gestureControls: GestureControls = setupArGestures({
    renderer: options.renderer,
    camera: options.camera,
    isInAR: () => isInAr,
    isEnabled: () => isInAr && placementState === "placed",
    getPlacedModel: () => placedModel,
    indicator: createGestureIndicator(options.scene),
    showHint: options.gestureHint.show,
    hideHintSoon: options.gestureHint.hideSoon,
  });

  async function setupSupport(): Promise<void> {
    supportsQuickLookAr = isQuickLookSupported(
      options.usdzUrl,
      typeof options.dom.modelViewer.activateAR === "function"
    );
    if (!navigator.xr?.isSessionSupported) {
      applySupportState(
        supportsQuickLookAr,
        supportsQuickLookAr ? "Siap untuk AR Quick Look" : "AR tidak didukung"
      );
      return;
    }
    try {
      supportsWebXrAr = await navigator.xr.isSessionSupported("immersive-ar");
      const canStart = supportsWebXrAr || supportsQuickLookAr;
      applySupportState(
        canStart,
        supportsWebXrAr
          ? "Siap untuk WebXR AR"
          : supportsQuickLookAr
            ? "Siap untuk AR Quick Look"
            : "AR tidak didukung di perangkat ini"
      );
    } catch {
      applySupportState(
        supportsQuickLookAr,
        supportsQuickLookAr ? "Siap untuk AR Quick Look" : "Tidak bisa mengecek dukungan AR"
      );
    }
  }

  function applySupportState(canStart: boolean, status: string): void {
    options.dom.enterArButton.disabled = !canStart;
    options.dom.sheetStartArButton.disabled = !canStart;
    options.dom.statusText.textContent = status;
  }

  async function start(): Promise<void> {
    if (
      typeof options.dom.modelViewer.activateAR === "function" &&
      (options.useModelViewerWebXr || (!supportsWebXrAr && supportsQuickLookAr))
    ) {
      options.closeSideMenu();
      options.dom.infoSheet.classList.add("hidden");
      options.showAllModelViewerHotspots();
      try {
        await options.dom.modelViewer.activateAR();
      } catch (error) {
        options.dom.statusText.textContent = "AR model-viewer gagal dibuka";
        console.error(error);
      }
      return;
    }
    if (!navigator.xr) return;
    let session: XRSession | null = null;
    try {
      options.closeSideMenu();
      options.dom.infoSheet.classList.add("hidden");
      options.resetToHome(false);
      session = await requestArSession(document.body);
      session.addEventListener("end", onEnded);
      session.addEventListener("select", placeModel);
      isInAr = true;
      document.body.classList.add("ar-active");
      options.scene.background = null;
      options.controls.enabled = false;
      options.dom.enterArButton.classList.add("hidden");
      const previewModel = options.getPreviewModel();
      if (previewModel) previewModel.visible = false;
      setPlacementState("loading");
      await options.renderer.xr.setSession(session);
      lighting.request(session);
      gestureControls.connect();
      setPlacementState("scanning");
    } catch (error) {
      if (session) {
        session.removeEventListener("end", onEnded);
        session.removeEventListener("select", placeModel);
        try {
          await session.end();
        } catch (sessionEndError) {
          console.error("Sesi AR gagal ditutup", sessionEndError);
        }
      }
      isInAr = false;
      document.body.classList.remove("ar-active");
      setPlacementState("preview");
      options.dom.enterArButton.classList.remove("hidden");
      options.controls.enabled = true;
      const previewModel = options.getPreviewModel();
      if (previewModel) previewModel.visible = false;
      lighting.reset();
      shadows.reset();
      options.dom.statusText.textContent = "Gagal memulai AR";
      console.error("AR gagal dimulai", error);
    }
  }

  function exit(): void {
    options.closeSideMenu();
    const session = options.renderer.xr.getSession();
    if (!session) return;
    anchors.clear();
    endArSession(session);
  }

  function placeModel(): void {
    if (performance.now() < suppressPlacementUntil) return;
    const matrix = placement.getPlacementMatrix();
    if (placementState === "placed" || !matrix) return;
    anchors.clear();
    const interactionRoot = placedModel.userData.interactionRoot;
    placedModel.visible = true;
    placedModel.position.setFromMatrixPosition(matrix);
    placedModel.quaternion.setFromRotationMatrix(matrix);
    placedModel.scale.setScalar(1);
    interactionRoot.position.set(0, 0, 0);
    interactionRoot.rotation.set(0, 0, 0);
    interactionRoot.scale.setScalar(options.getModelSize());
    placedModel.updateMatrixWorld(true);
    setPlacementState("placed");
    options.dom.statusText.textContent = "Model ditempatkan";
    anchors.requestCreation();
  }

  function searchAnotherPlace(): void {
    if (!isInAr) return;
    anchors.clear();
    suppressPlacementUntil = performance.now() + 700;
    placement.reset();
    gestureControls.clear();
    options.clearHotspotFocus();
    options.gestureHint.hide();
    placedModel.visible = false;
    shadows.reset();
    options.resetHotspotsForScanning();
    setPlacementState("scanning");
  }

  function onEnded(): void {
    isInAr = false;
    document.body.classList.remove("ar-active");
    setPlacementState("preview");
    options.dom.sideMenu.classList.add("hidden");
    options.dom.menuBackdrop.classList.add("hidden");
    options.dom.infoSheet.classList.add("hidden");
    placement.clearSource();
    anchors.clear(false);
    lighting.reset();
    shadows.reset();
    placement.reset();
    gestureControls.disconnect();
    options.clearHotspotFocus();
    reticle.visible = false;
    options.dom.enterArButton.classList.remove("hidden");
    const previewModel = options.getPreviewModel();
    if (previewModel) previewModel.visible = false;
    placedModel.visible = false;
    queueMicrotask(() => {
      options.controls.enabled = true;
      options.resetPreviewScene();
      void setupSupport();
    });
  }

  function setPlacementState(state: ArPlacementState): void {
    const previousState = placementState;
    placementState = state;
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
      arStatus: options.dom.arStatus,
      arInstructions: options.dom.arInstructions,
      arScanReticle: options.dom.arScanReticle,
      arMenu: options.dom.arMenu,
      statusText: options.dom.statusText,
      hideGestureHint: options.gestureHint.hide,
      hideFocusDirection: () => options.dom.focusDirection.classList.add("hidden"),
      interactionToolbar: options.dom.interactionToolbar,
    });
  }

  function render(timestamp: number, frame?: XRFrame): void {
    if (!isInAr) return;
    const session = options.renderer.xr.getSession();
    if (session && frame && placementState !== "placed") placement.update(frame);
    if (frame) lighting.update(frame);
    if (frame && placementState === "placed") anchors.updateFrame(frame);
    shadows.update();
    updateScanGuidance();
    options.updateHotspotFocus(timestamp);
    options.renderer.render(options.scene, options.camera);
    options.updateHotspotPositions();
  }

  function updateScanGuidance(): void {
    if (!isInAr || placementState !== "scanning" || !scanStartedAt) return;
    const elapsed = performance.now() - scanStartedAt;
    let nextIndex = 0;
    SCAN_ADVICE.forEach((advice, index) => {
      if (elapsed >= advice.after) nextIndex = index;
    });
    if (nextIndex === scanAdviceIndex) return;
    scanAdviceIndex = nextIndex;
    options.dom.arInstructions.textContent = SCAN_ADVICE[nextIndex]?.text ?? SCAN_ADVICE[0]?.text ?? "";
  }

  return {
    clearGestures: gestureControls.clear,
    exit,
    getIsInAr: () => isInAr,
    getPlacedModel: () => placedModel,
    getPlacementState: () => placementState,
    render,
    searchAnotherPlace,
    setupSupport,
    start,
  };
}
