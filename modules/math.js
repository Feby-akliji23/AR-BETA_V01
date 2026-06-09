export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getTouchAngle(touches) {
  return Math.atan2(
    touches[1].clientY - touches[0].clientY,
    touches[1].clientX - touches[0].clientX
  );
}

export function getXrProjectionCamera(renderer, fallbackCamera) {
  const xrCamera = renderer.xr.getSession() ? renderer.xr.getCamera(fallbackCamera) : fallbackCamera;
  return xrCamera && xrCamera.isArrayCamera && xrCamera.cameras.length ? xrCamera.cameras[0] : xrCamera;
}

export function getCameraPositionFromModelViewerOrbit(target, orbit) {
  const theta = THREE.MathUtils.degToRad(orbit.theta);
  const phi = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(orbit.phi, 12, 168));
  const radius = Math.max(orbit.radius, 0.22);
  const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, theta));
  return target.clone().add(offset);
}
