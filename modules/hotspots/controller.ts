import type { PerspectiveCamera, WebGLRenderer } from "three";
import type { ArModel, ArPlacementState, HotspotConfig, ModelViewerElement } from "../types.js";
import { createNavDots, setNavDots } from "../ui.js";
import { createArHotspots } from "./ar.js";
import { createPreviewHotspots } from "./preview.js";

interface HotspotControllerOptions {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  hotspots: HotspotConfig[];
  modelViewer: ModelViewerElement;
  hotspotLayer: HTMLElement;
  navDots: HTMLElement;
  buttonText: HTMLElement;
  focusDirection: HTMLElement;
  isDesktop: () => boolean;
  getIsInAr: () => boolean;
  getPlacementState: () => ArPlacementState;
  getPlacedModel: () => ArModel | null;
  clearGestures: () => void;
  focusPreview: (index: number, animate: boolean) => void;
  openDetail: (index: number) => void;
}

export function createHotspotController(options: HotspotControllerOptions) {
  let currentIndex = -1;
  const navDots = createNavDots(options.hotspots.length, options.navDots);
  const ar = createArHotspots({
    renderer: options.renderer,
    camera: options.camera,
    hotspots: options.hotspots,
    hotspotLayer: options.hotspotLayer,
    buttonText: options.buttonText,
    focusDirection: options.focusDirection,
    getIsInAr: options.getIsInAr,
    getPlacementState: options.getPlacementState,
    getPlacedModel: options.getPlacedModel,
    clearGestures: options.clearGestures,
    onSelect: select,
    onDetail: options.openDetail,
  });
  const preview = createPreviewHotspots({
    hotspots: options.hotspots,
    modelViewer: options.modelViewer,
    buttonText: options.buttonText,
    isDesktop: options.isDesktop,
    getIsInAr: options.getIsInAr,
    getCurrentIndex: () => currentIndex,
    onSelect: select,
    onDetail: options.openDetail,
  });

  function navigate(direction: number): void {
    if (currentIndex === -1) currentIndex = direction > 0 ? 0 : options.hotspots.length - 1;
    else {
      currentIndex += direction;
      if (currentIndex >= options.hotspots.length || currentIndex < 0) currentIndex = -1;
    }
    updateState();
  }

  function select(index: number): void {
    const selectionChanged = currentIndex !== index;
    currentIndex = index;
    updateState(selectionChanged);
  }

  function updateState(focusSelection = true): void {
    ar.updateState(currentIndex);
    preview.updateState(currentIndex);
    setNavDots(navDots, currentIndex);
    if (focusSelection) {
      if (options.getIsInAr()) ar.focus(currentIndex);
      else {
        preview.hide();
        options.focusPreview(currentIndex, true);
      }
    } else requestAnimationFrame(preview.updateCardWidth);
  }

  function resetToHome(animate: boolean): void {
    currentIndex = -1;
    updateState(false);
    if (animate) options.focusPreview(currentIndex, true);
  }

  function showAllModelViewerHotspots(): void {
    currentIndex = -1;
    preview.showAll();
    setNavDots(navDots, currentIndex);
    options.buttonText.textContent = "Beranda";
  }

  function onResize(): void {
    preview.onResize();
  }

  return {
    clearArFocus: ar.clearFocus,
    getCurrentIndex: () => currentIndex,
    navigate,
    onResize,
    previewElements: preview.elements,
    resetToHome,
    revealSelectedPreviewHotspot: preview.revealSelected,
    showAllModelViewerHotspots,
    updateArFocus: ar.updateFocus,
    updateArPositions: () => ar.updatePositions(currentIndex),
  };
}
