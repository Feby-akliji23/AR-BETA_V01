import type { Camera, Vector3, WebGLRenderer } from "three";
import type { ProjectedPoint } from "./types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getTouchDistance(touches: TouchList) {
  const first = touches.item(0);
  const second = touches.item(1);
  if (!first || !second) return 0;
  const dx = first.clientX - second.clientX;
  const dy = first.clientY - second.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getXrProjectionCamera(renderer: WebGLRenderer, fallbackCamera: Camera): Camera {
  if (!renderer.xr.getSession()) return fallbackCamera;
  return renderer.xr.getCamera().cameras[0] ?? fallbackCamera;
}

export function projectWorldToDom(
  renderer: WebGLRenderer,
  fallbackCamera: Camera,
  worldPosition: Vector3,
  target: ProjectedPoint
) {
  const camera = getXrProjectionCamera(renderer, fallbackCamera);
  worldPosition.project(camera);

  target.x = worldPosition.x;
  target.y = worldPosition.y;
  target.z = worldPosition.z;
  target.behindCamera = worldPosition.z < -1 || worldPosition.z > 1;
  target.screenX = (worldPosition.x * 0.5 + 0.5) * window.innerWidth;
  target.screenY = (-worldPosition.y * 0.5 + 0.5) * window.innerHeight;
  return target;
}
