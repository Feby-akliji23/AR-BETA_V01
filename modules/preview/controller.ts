import type { PerspectiveCamera } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { resetPreviewCamera } from "../scene.js";
import type { ArModel, HotspotConfig, ModelViewerElement } from "../types.js";
import { createPreviewCameraController } from "./camera.js";

interface PreviewControllerOptions {
  camera: PerspectiveCamera;
  controls: OrbitControls;
  previewModel: ArModel;
  modelViewer: ModelViewerElement;
  hotspots: HotspotConfig[];
  isDebug: boolean;
  getIsInAr: () => boolean;
  getCurrentHotspotIndex: () => number;
  resetHotspots: (animate: boolean) => void;
  revealSelectedHotspot: () => void;
  updateArHotspotPositions: () => void;
  resizeHotspots: () => void;
}

export function createPreviewController(options: PreviewControllerOptions) {
  const camera = createPreviewCameraController({
    modelViewer: options.modelViewer,
    onTransitionComplete: options.revealSelectedHotspot,
  });

  function focusSelection(index: number, animate = true): void {
    if (index === -1) {
      camera.focusHome(animate);
      return;
    }
    const hotspot = options.hotspots[index];
    if (hotspot) camera.focusHotspot(hotspot, animate);
  }

  function resetScene(): void {
    options.resetHotspots(false);
    options.previewModel.visible = false;
    options.previewModel.position.set(0, 0, 0);
    options.previewModel.rotation.set(0, 0, 0);
    options.previewModel.updateMatrixWorld(true);
    camera.focusHome(false);
    resetPreviewCamera(options.camera, options.controls, options.previewModel);
    options.updateArHotspotPositions();
  }

  function onResize(): void {
    options.resizeHotspots();
    if (options.isDebug && !options.getIsInAr()) return;
    if (!options.getIsInAr()) focusSelection(options.getCurrentHotspotIndex(), false);
  }

  return {
    cancelCameraAnimation: camera.cancel,
    focusCamera: camera.focus,
    focusSelection,
    isDesktop: camera.isDesktop,
    onResize,
    resetScene,
  };
}
