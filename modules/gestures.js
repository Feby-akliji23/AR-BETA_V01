import { THREE } from "./three.js";
import { clamp, getTouchDistance, getXrProjectionCamera } from "./math.js";

const HOLD_DURATION = 500;
const MOVE_THRESHOLD = 18;
const ROTATE_DIRECTION_RATIO = 1.5;
const ROTATE_SENSITIVITY = 0.009;
const DRAG_SENSITIVITY = 0.42;
const DRAG_LERP = 0.38;
const MIN_DRAG_STEP = 0.008;
const MAX_DRAG_STEP = 0.035;
const MIN_SCALE = 0.65;
const MAX_SCALE = 1.8;

export function setupArGestures(options) {
  const state = {
    gesture: null,
    holdTimer: null,
  };
  const raycaster = new THREE.Raycaster();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointer = new THREE.Vector2();
  const planePoint = new THREE.Vector3();
  const dragDelta = new THREE.Vector3();

  function isUiTarget(event) {
    const selector =
      "button, a, input, select, textarea, #topbar, #ar-menu, #side-menu, #menu-backdrop, " +
      "#hotspot-layer, .button-container, #info-sheet, #detail-sheet";
    return event.composedPath().some((target) => target instanceof Element && target.matches(selector));
  }

  function canManipulate(event) {
    const placedModel = options.getPlacedModel();
    if (!options.isEnabled() || !placedModel || !placedModel.visible) return false;
    return !isUiTarget(event);
  }

  function setGestureUi(mode) {
    document.body.classList.toggle("ar-gesture-pending", mode === "pending-model");
    document.body.classList.toggle("ar-gesture-active", Boolean(mode && mode !== "pending-model"));
  }

  function clearHoldTimer() {
    if (!state.holdTimer) return;
    clearTimeout(state.holdTimer);
    state.holdTimer = null;
  }

  function setPointerFromTouch(touch) {
    pointer.x = (touch.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(touch.clientY / window.innerHeight) * 2 + 1;
  }

  function setRayFromTouch(touch) {
    setPointerFromTouch(touch);
    raycaster.setFromCamera(pointer, getXrProjectionCamera(options.renderer, options.camera));
  }

  function touchesModel(touch, placedModel) {
    setRayFromTouch(touch);
    return raycaster.intersectObject(placedModel, true).length > 0;
  }

  function getFloorIntersection(touch, floorY, target) {
    setRayFromTouch(touch);
    floorPlane.constant = -floorY;
    return raycaster.ray.intersectPlane(floorPlane, target);
  }

  function beginDrag(touch, placedModel, source) {
    clearHoldTimer();
    const startIntersection = new THREE.Vector3();
    if (!getFloorIntersection(touch, placedModel.position.y, startIntersection)) return false;

    state.gesture = {
      type: "drag",
      source,
      floorY: placedModel.position.y,
      lastIntersection: startIntersection,
      targetPosition: placedModel.position.clone(),
    };
    setGestureUi("drag");
    options.indicator.show("drag", placedModel);
    options.showHint(source === "hold" ? "Model siap dipindahkan" : "Geser untuk memindahkan");
    return true;
  }

  function beginPendingModelGesture(touch, placedModel) {
    state.gesture = {
      type: "pending-model",
      startX: touch.clientX,
      startY: touch.clientY,
      startRotation: placedModel.rotation.y,
    };
    setGestureUi("pending-model");
    options.showHint("Geser horizontal untuk rotasi · tahan untuk pindah");

    state.holdTimer = setTimeout(() => {
      if (!state.gesture || state.gesture.type !== "pending-model") return;
      beginDrag(touch, placedModel, "hold");
    }, HOLD_DURATION);
  }

  function beginPinch(touches, placedModel) {
    clearHoldTimer();
    state.gesture = {
      type: "pinch",
      startDistance: Math.max(1, getTouchDistance(touches)),
      startScale: placedModel.scale.x,
    };
    setGestureUi("pinch");
    options.indicator.show("pinch", placedModel);
    options.showHint("Pinch untuk mengubah ukuran");
  }

  function onTouchStart(event) {
    const placedModel = options.getPlacedModel();
    if (!canManipulate(event)) {
      if (isUiTarget(event)) clearGesture(true);
      return;
    }
    event.preventDefault();

    if (event.touches.length === 2) {
      beginPinch(event.touches, placedModel);
      return;
    }

    if (event.touches.length !== 1) return;
    const touch = event.touches[0];

    if (touchesModel(touch, placedModel)) {
      beginPendingModelGesture(touch, placedModel);
    } else {
      beginDrag(touch, placedModel, "floor");
    }
  }

  function updatePendingModelGesture(touch, placedModel) {
    const deltaX = touch.clientX - state.gesture.startX;
    const deltaY = touch.clientY - state.gesture.startY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < MOVE_THRESHOLD) return;

    clearHoldTimer();
    if (Math.abs(deltaX) >= Math.abs(deltaY) * ROTATE_DIRECTION_RATIO) {
      state.gesture.type = "rotate";
      setGestureUi("rotate");
      options.indicator.show("rotate", placedModel);
      options.showHint("Geser horizontal untuk memutar");
      updateRotation(touch, placedModel);
      return;
    }

    beginDrag(touch, placedModel, "model");
  }

  function updateRotation(touch, placedModel) {
    const deltaX = touch.clientX - state.gesture.startX;
    placedModel.rotation.y = state.gesture.startRotation + deltaX * ROTATE_SENSITIVITY;
    placedModel.updateMatrixWorld(true);
    options.indicator.update(placedModel);
    options.showHint("Rotasi " + Math.round(THREE.MathUtils.radToDeg(deltaX * ROTATE_SENSITIVITY)) + "°");
  }

  function updateDrag(touch, placedModel) {
    if (!getFloorIntersection(touch, state.gesture.floorY, planePoint)) return;
    dragDelta.copy(planePoint).sub(state.gesture.lastIntersection).multiplyScalar(DRAG_SENSITIVITY);
    const maxStep = THREE.MathUtils.clamp(
      raycaster.ray.origin.distanceTo(placedModel.position) * 0.018,
      MIN_DRAG_STEP,
      MAX_DRAG_STEP
    );
    if (dragDelta.length() > maxStep) dragDelta.setLength(maxStep);
    state.gesture.targetPosition.add(dragDelta);
    placedModel.position.lerp(state.gesture.targetPosition, DRAG_LERP);
    placedModel.position.y = state.gesture.floorY;
    state.gesture.lastIntersection.copy(planePoint);
    placedModel.updateMatrixWorld(true);
    options.indicator.update(placedModel);
    options.showHint("Geser untuk memindahkan");
  }

  function updatePinch(touches, placedModel) {
    const distance = getTouchDistance(touches);
    const scale = clamp(
      state.gesture.startScale * (distance / state.gesture.startDistance),
      MIN_SCALE,
      MAX_SCALE
    );
    placedModel.scale.setScalar(scale);
    placedModel.updateMatrixWorld(true);
    options.indicator.update(placedModel);
    options.showHint("Ukuran " + Math.round(scale * 100) + "%");
  }

  function onTouchMove(event) {
    const placedModel = options.getPlacedModel();
    if (!canManipulate(event) || !state.gesture) return;
    event.preventDefault();

    if (event.touches.length === 2) {
      if (state.gesture.type !== "pinch") beginPinch(event.touches, placedModel);
      updatePinch(event.touches, placedModel);
      return;
    }

    if (event.touches.length !== 1) return;
    const touch = event.touches[0];

    if (state.gesture.type === "pending-model") updatePendingModelGesture(touch, placedModel);
    else if (state.gesture.type === "rotate") updateRotation(touch, placedModel);
    else if (state.gesture.type === "drag") updateDrag(touch, placedModel);
  }

  function restartSingleTouch(touch) {
    const placedModel = options.getPlacedModel();
    clearGesture(false);
    if (!placedModel || !placedModel.visible) return;

    if (touchesModel(touch, placedModel)) beginPendingModelGesture(touch, placedModel);
    else beginDrag(touch, placedModel, "floor");
  }

  function onTouchEnd(event) {
    if (isUiTarget(event)) {
      clearGesture(true);
      return;
    }
    if (!options.isInAR() || !state.gesture) return;
    event.preventDefault();

    if (event.touches.length === 1) {
      restartSingleTouch(event.touches[0]);
      return;
    }

    if (event.touches.length === 0) clearGesture(true);
  }

  function clearGesture(hideHint) {
    clearHoldTimer();
    state.gesture = null;
    setGestureUi(null);
    options.indicator.hide();
    if (hideHint) options.hideHintSoon();
  }

  document.body.addEventListener("touchstart", onTouchStart, { passive: false });
  document.body.addEventListener("touchmove", onTouchMove, { passive: false });
  document.body.addEventListener("touchend", onTouchEnd, { passive: false });
  document.body.addEventListener("touchcancel", onTouchEnd, { passive: false });

  return {
    clear() {
      clearGesture(false);
    },
  };
}
