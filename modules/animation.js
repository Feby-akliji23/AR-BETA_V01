import { normalizeAngle } from "./math.js";

export function createCameraTween() {
  let tween = null;

  return {
    animate(camera, controls, position, target, duration) {
      tween = {
        startedAt: performance.now(),
        duration,
        fromPosition: camera.position.clone(),
        toPosition: position.clone(),
        fromTarget: controls.target.clone(),
        toTarget: target.clone(),
      };
    },
    update(camera, controls) {
      if (!tween) return;

      const elapsed = performance.now() - tween.startedAt;
      const t = Math.min(elapsed / tween.duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);

      if (t >= 1) tween = null;
    },
    clear() {
      tween = null;
    },
  };
}

export function createModelRotationTween() {
  let tween = null;

  return {
    animate(model, targetRotation, duration) {
      if (!model) return;

      const fromRotation = model.rotation.y;
      tween = {
        startedAt: performance.now(),
        duration,
        fromRotation,
        toRotation: fromRotation + normalizeAngle(targetRotation - fromRotation),
      };
    },
    update(model) {
      if (!tween || !model) return;

      const elapsed = performance.now() - tween.startedAt;
      const t = Math.min(elapsed / tween.duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      model.rotation.y = THREE.MathUtils.lerp(tween.fromRotation, tween.toRotation, eased);
      model.updateMatrixWorld(true);

      if (t >= 1) tween = null;
    },
    clear() {
      tween = null;
    },
  };
}
