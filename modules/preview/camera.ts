import { projectConfig } from "../config.js";
import type { HotspotConfig, ModelViewerElement } from "../types.js";

interface PreviewCameraOptions {
  modelViewer: ModelViewerElement;
  onTransitionComplete: () => void;
}

export function createPreviewCameraController(options: PreviewCameraOptions) {
  let transitionCleanup: (() => void) | null = null;

  function isDesktop(): boolean {
    return window.innerWidth >= projectConfig.preview.desktopBreakpoint;
  }

  function getHomeFrame() {
    return isDesktop() ? projectConfig.preview.desktop : projectConfig.preview.mobile;
  }

  function getHotspotFrame(hotspot: HotspotConfig) {
    return isDesktop() ? hotspot.camera.desktop : hotspot.camera.mobile;
  }

  function focus(
    orbit: string,
    target: string,
    animate = true,
    onComplete?: () => void,
    fieldOfView?: string
  ): void {
    if (!animate || typeof options.modelViewer.getCameraOrbit !== "function") {
      cancel(false);
      options.modelViewer.cameraOrbit = orbit;
      options.modelViewer.cameraTarget = target;
      if (fieldOfView) options.modelViewer.fieldOfView = fieldOfView;
      options.modelViewer.jumpCameraToGoal?.();
      if (onComplete) onComplete();
      else options.onTransitionComplete();
      return;
    }

    cancel(false);
    let settleTimeout = 0;
    let fallbackTimeout = 0;
    let completed = false;
    const cleanup = (): void => {
      window.clearTimeout(settleTimeout);
      window.clearTimeout(fallbackTimeout);
      options.modelViewer.removeEventListener("camera-change", onCameraChange);
      if (transitionCleanup === cleanup) transitionCleanup = null;
    };
    const complete = (): void => {
      if (completed) return;
      completed = true;
      cleanup();
      if (onComplete) onComplete();
      else options.onTransitionComplete();
    };
    const onCameraChange = (): void => {
      window.clearTimeout(settleTimeout);
      settleTimeout = window.setTimeout(complete, 100);
    };

    transitionCleanup = cleanup;
    options.modelViewer.addEventListener("camera-change", onCameraChange);
    settleTimeout = window.setTimeout(complete, 180);
    fallbackTimeout = window.setTimeout(complete, 520);
    options.modelViewer.cameraOrbit = orbit;
    options.modelViewer.cameraTarget = target;
    if (fieldOfView) options.modelViewer.fieldOfView = fieldOfView;
  }

  function focusHome(animate = true): void {
    const frame = getHomeFrame();
    focus(frame.homeOrbit, frame.homeTarget, animate, undefined, frame.fieldOfView);
  }

  function focusHotspot(hotspot: HotspotConfig, animate = true): void {
    const frame = getHotspotFrame(hotspot);
    focus(frame.orbit, frame.target, animate, undefined, frame.fieldOfView);
  }

  function cancel(revealHotspot: boolean): void {
    transitionCleanup?.();
    transitionCleanup = null;
    if (revealHotspot) options.onTransitionComplete();
  }

  return { cancel, focus, focusHome, focusHotspot, getHomeFrame, isDesktop };
}
