export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getXrProjectionCamera(renderer, fallbackCamera) {
  const xrCamera = renderer.xr.getSession() ? renderer.xr.getCamera(fallbackCamera) : fallbackCamera;
  return xrCamera && xrCamera.isArrayCamera && xrCamera.cameras.length ? xrCamera.cameras[0] : xrCamera;
}

export function projectWorldToDom(renderer, fallbackCamera, worldPosition, target) {
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
