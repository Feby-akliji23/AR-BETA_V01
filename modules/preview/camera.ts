import { projectConfig } from "../config.js";
import type { HotspotConfig, ModelViewerElement } from "../types.js";

interface PreviewCameraOptions {
  modelViewer: ModelViewerElement;
  onTransitionComplete: () => void;
}

interface Orbit {
  theta: number;
  phi: number;
  radius: number;
}

interface Target {
  x: number;
  y: number;
  z: number;
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

  function parseOrbit(value: string): Orbit | null {
    const parts = value.trim().split(/\s+/);
    if (parts.length !== 3) return null;
    const theta = parseAngle(parts[0]);
    const phi = parseAngle(parts[1]);
    const radius = parseFloat(parts[2] ?? "");
    if (![theta, phi, radius].every(Number.isFinite)) return null;
    return { theta, phi, radius };
  }

  function parseTarget(value: string): Target | null {
    const parts = value.trim().split(/\s+/);
    if (parts.length !== 3) return null;
    const [x, y, z] = parts.map((part) => parseFloat(part));
    if (![x, y, z].every(Number.isFinite)) return null;
    return { x: x!, y: y!, z: z! };
  }

  function parseAngle(value: string | undefined): number {
    const angle = parseFloat(value ?? "");
    return value?.endsWith("rad") ? angle : (angle * Math.PI) / 180;
  }

  function shortestAngleDelta(from: number, to: number): number {
    const fullTurn = Math.PI * 2;
    return ((((to - from + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;
  }

  function easeInOutCubic(value: number): number {
    return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
  }

  function lerp(from: number, to: number, progress: number): number {
    return from + (to - from) * progress;
  }

  function fieldOfViewToZoom(fieldOfView: number): number {
    return 1 / Math.tan((fieldOfView * Math.PI) / 360);
  }

  function zoomToFieldOfView(zoom: number): number {
    return (Math.atan(1 / zoom) * 360) / Math.PI;
  }

  function getConfiguredFieldOfView(actualFieldOfView: number): number {
    const idealAspect = options.modelViewer.getIdealAspect?.();
    const rect = options.modelViewer.getBoundingClientRect();
    const aspect = rect.height > 0 ? rect.width / rect.height : Number.NaN;

    if (
      typeof idealAspect !== "number" ||
      !Number.isFinite(idealAspect) ||
      !Number.isFinite(aspect)
    ) {
      return actualFieldOfView;
    }

    const adjustment = Math.max(1, idealAspect / aspect);
    return (
      (Math.atan(Math.tan((actualFieldOfView * Math.PI) / 360) / adjustment) * 360) /
      Math.PI
    );
  }

  function applyFrame(orbit: Orbit, target: Target, fieldOfView: number): void {
    options.modelViewer.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad ${orbit.radius}m`;
    options.modelViewer.cameraTarget = `${target.x}m ${target.y}m ${target.z}m`;
    options.modelViewer.fieldOfView = `${fieldOfView}deg`;
    options.modelViewer.jumpCameraToGoal?.();
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

    const fromOrbit = options.modelViewer.getCameraOrbit();
    const fromTarget = options.modelViewer.getCameraTarget?.();
    const actualFieldOfView = options.modelViewer.getFieldOfView?.();
    const fromFieldOfView =
      typeof actualFieldOfView === "number" && Number.isFinite(actualFieldOfView)
        ? getConfiguredFieldOfView(actualFieldOfView)
        : actualFieldOfView;
    const toOrbit = parseOrbit(orbit);
    const toTarget = parseTarget(target);
    const toFieldOfView = parseFloat(fieldOfView ?? "");
    if (
      !fromOrbit ||
      !fromTarget ||
      !Number.isFinite(fromFieldOfView) ||
      !toOrbit ||
      !toTarget ||
      !Number.isFinite(toFieldOfView)
    ) {
      focus(orbit, target, false, onComplete, fieldOfView);
      return;
    }

    cancel(false);
    let animationFrame = 0;
    let completed = false;
    const duration = Math.max(0, projectConfig.preview.cameraTransitionMs);
    const startedAt = performance.now();
    const thetaDelta = shortestAngleDelta(fromOrbit.theta, toOrbit.theta);
    const fromZoom = fieldOfViewToZoom(fromFieldOfView!);
    const toZoom = fieldOfViewToZoom(toFieldOfView);
    const cleanup = (): void => {
      window.cancelAnimationFrame(animationFrame);
      if (transitionCleanup === cleanup) transitionCleanup = null;
    };
    const complete = (): void => {
      if (completed) return;
      completed = true;
      cleanup();
      options.modelViewer.cameraOrbit = orbit;
      options.modelViewer.cameraTarget = target;
      if (fieldOfView) options.modelViewer.fieldOfView = fieldOfView;
      options.modelViewer.jumpCameraToGoal?.();
      if (onComplete) onComplete();
      else options.onTransitionComplete();
    };
    const animateFrame = (now: number): void => {
      const linearProgress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const progress = easeInOutCubic(linearProgress);
      applyFrame(
        {
          theta: fromOrbit.theta + thetaDelta * progress,
          phi: lerp(fromOrbit.phi, toOrbit.phi, progress),
          radius: lerp(fromOrbit.radius, toOrbit.radius, progress),
        },
        {
          x: lerp(fromTarget.x, toTarget.x, progress),
          y: lerp(fromTarget.y, toTarget.y, progress),
          z: lerp(fromTarget.z, toTarget.z, progress),
        },
        zoomToFieldOfView(lerp(fromZoom, toZoom, progress))
      );
      if (linearProgress >= 1) {
        complete();
        return;
      }
      animationFrame = window.requestAnimationFrame(animateFrame);
    };

    transitionCleanup = cleanup;
    animationFrame = window.requestAnimationFrame(animateFrame);
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
