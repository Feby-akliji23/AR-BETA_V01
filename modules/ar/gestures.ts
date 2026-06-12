import { THREE } from "../three.js";
import { clamp, getTouchDistance, getXrProjectionCamera } from "../math.js";
import type { Vector3 } from "three";
import type { ArGestureOptions, ArModel, GestureState, GestureType } from "../types.js";

const HOLD_DURATION = 400;
const MOVE_THRESHOLD = 18;
const ROTATE_SENSITIVITY = 0.009;
const DRAG_SENSITIVITY = 0.72;
const DRAG_LERP = 0.58;
const MIN_DRAG_STEP = 0.008;
const MAX_DRAG_STEP = 0.045;
const MIN_SCALE = 0.65;
const MAX_SCALE = 1.8;

export function setupArGestures(options: ArGestureOptions) {
  const state: {
    gesture: GestureState | null;
    holdTimer: number | null;
  } = {
    gesture: null,
    holdTimer: null,
  };
  const raycaster = new THREE.Raycaster();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointer = new THREE.Vector2();
  const planePoint = new THREE.Vector3();
  const dragDelta = new THREE.Vector3();
  const interactionWorldPosition = new THREE.Vector3();
  const nextInteractionWorldPosition = new THREE.Vector3();

  function isUiTarget(event: Event): boolean {
    const selector =
      "button, a, input, select, textarea, #topbar, #ar-menu, #side-menu, #menu-backdrop, " +
      "#hotspot-layer, .button-container, #info-sheet, #detail-sheet";
    return event.composedPath().some((target) => target instanceof Element && target.matches(selector));
  }

  function canManipulate(event: Event): boolean {
    const placedModel = options.getPlacedModel();
    if (!options.isEnabled() || !placedModel || !placedModel.visible) return false;
    return !isUiTarget(event);
  }

  function setGestureUi(mode: GestureType | null): void {
    document.body.classList.toggle("ar-gesture-pending", mode === "pending-model");
    document.body.classList.toggle("ar-gesture-active", Boolean(mode && mode !== "pending-model"));
  }

  function clearHoldTimer(): void {
    if (!state.holdTimer) return;
    clearTimeout(state.holdTimer);
    state.holdTimer = null;
  }

  function setPointerFromTouch(touch: Touch): void {
    pointer.x = (touch.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(touch.clientY / window.innerHeight) * 2 + 1;
  }

  function setRayFromTouch(touch: Touch): void {
    setPointerFromTouch(touch);
    raycaster.setFromCamera(pointer, getXrProjectionCamera(options.renderer, options.camera));
  }

  function touchesModel(touch: Touch, placedModel: ArModel): boolean {
    setRayFromTouch(touch);
    return raycaster.intersectObject(placedModel, true).length > 0;
  }

  function getFloorIntersection(touch: Touch, floorY: number, target: Vector3): Vector3 | null {
    setRayFromTouch(touch);
    floorPlane.constant = -floorY;
    return raycaster.ray.intersectPlane(floorPlane, target);
  }

  function beginDrag(touch: Touch, placedModel: ArModel): boolean {
    clearHoldTimer();
    const interactionRoot = placedModel.userData.interactionRoot;
    interactionRoot.getWorldPosition(interactionWorldPosition);
    const startIntersection = new THREE.Vector3();
    if (!getFloorIntersection(touch, interactionWorldPosition.y, startIntersection)) return false;

    state.gesture = {
      type: "drag",
      floorY: interactionWorldPosition.y,
      lastIntersection: startIntersection,
      targetPosition: interactionWorldPosition.clone(),
    };
    setGestureUi("drag");
    options.indicator.show("drag", placedModel);
    options.showHint("Model siap dipindahkan");
    return true;
  }

  function beginPendingModelGesture(touch: Touch, placedModel: ArModel): void {
    const interactionRoot = placedModel.userData.interactionRoot;
    state.gesture = {
      type: "pending-model",
      startX: touch.clientX,
      startY: touch.clientY,
      startRotation: interactionRoot.rotation.y,
    };
    setGestureUi("pending-model");
    options.showHint("Geser horizontal untuk rotasi · tahan untuk pindah");

    state.holdTimer = setTimeout(() => {
      if (!state.gesture || state.gesture.type !== "pending-model") return;
      beginDrag(touch, placedModel);
    }, HOLD_DURATION);
  }

  function beginPinch(touches: TouchList, placedModel: ArModel): void {
    clearHoldTimer();
    const interactionRoot = placedModel.userData.interactionRoot;
    state.gesture = {
      type: "pinch",
      startDistance: Math.max(1, getTouchDistance(touches)),
      startScale: interactionRoot.scale.x,
    };
    setGestureUi("pinch");
    options.indicator.show("pinch", placedModel);
    options.showHint("Pinch untuk mengubah ukuran");
  }

  function onTouchStart(event: TouchEvent): void {
    const placedModel = options.getPlacedModel();
    if (!placedModel || !canManipulate(event)) {
      if (isUiTarget(event)) clearGesture(true);
      return;
    }
    event.preventDefault();

    if (event.touches.length === 2) {
      beginPinch(event.touches, placedModel);
      return;
    }

    if (event.touches.length !== 1) return;
    const touch = event.touches.item(0);
    if (!touch) return;

    if (touchesModel(touch, placedModel)) {
      beginPendingModelGesture(touch, placedModel);
    } else {
      clearGesture(true);
    }
  }

  function updatePendingModelGesture(touch: Touch, placedModel: ArModel): void {
    const gesture = state.gesture;
    if (!gesture || (gesture.type !== "pending-model" && gesture.type !== "rotate")) return;
    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < MOVE_THRESHOLD) return;

    clearHoldTimer();
    if (Math.abs(deltaX) >= MOVE_THRESHOLD * 0.5) {
      gesture.type = "rotate";
      setGestureUi("rotate");
      options.indicator.show("rotate", placedModel);
      options.showHint("Geser horizontal untuk memutar");
      updateRotation(touch, placedModel);
      return;
    }

    clearGesture(false);
    options.showHint("Tahan model terlebih dahulu untuk memindahkan");
    options.hideHintSoon();
  }

  function updateRotation(touch: Touch, placedModel: ArModel): void {
    const gesture = state.gesture;
    if (!gesture || (gesture.type !== "pending-model" && gesture.type !== "rotate")) return;
    const deltaX = touch.clientX - gesture.startX;
    placedModel.userData.interactionRoot.rotation.y = gesture.startRotation + deltaX * ROTATE_SENSITIVITY;
    placedModel.updateMatrixWorld(true);
    options.indicator.update(placedModel);
    options.showHint("Rotasi " + Math.round(THREE.MathUtils.radToDeg(deltaX * ROTATE_SENSITIVITY)) + "°");
  }

  function updateDrag(touch: Touch, placedModel: ArModel): void {
    const gesture = state.gesture;
    if (!gesture || gesture.type !== "drag") return;
    if (!getFloorIntersection(touch, gesture.floorY, planePoint)) return;
    const interactionRoot = placedModel.userData.interactionRoot;
    interactionRoot.getWorldPosition(interactionWorldPosition);
    dragDelta.copy(planePoint).sub(gesture.lastIntersection).multiplyScalar(DRAG_SENSITIVITY);
    const maxStep = THREE.MathUtils.clamp(
      raycaster.ray.origin.distanceTo(interactionWorldPosition) * 0.018,
      MIN_DRAG_STEP,
      MAX_DRAG_STEP
    );
    if (dragDelta.length() > maxStep) dragDelta.setLength(maxStep);
    gesture.targetPosition.add(dragDelta);
    nextInteractionWorldPosition.copy(interactionWorldPosition).lerp(gesture.targetPosition, DRAG_LERP);
    nextInteractionWorldPosition.y = gesture.floorY;
    interactionRoot.position.copy(nextInteractionWorldPosition);
    placedModel.worldToLocal(interactionRoot.position);
    gesture.lastIntersection.copy(planePoint);
    placedModel.updateMatrixWorld(true);
    options.indicator.update(placedModel);
    options.showHint("Geser untuk memindahkan");
  }

  function updatePinch(touches: TouchList, placedModel: ArModel): void {
    const gesture = state.gesture;
    if (!gesture || gesture.type !== "pinch") return;
    const distance = getTouchDistance(touches);
    const scale = clamp(gesture.startScale * (distance / gesture.startDistance), MIN_SCALE, MAX_SCALE);
    placedModel.userData.interactionRoot.scale.setScalar(scale);
    placedModel.updateMatrixWorld(true);
    options.indicator.update(placedModel);
    options.showHint("Ukuran " + Math.round(scale * 100) + "%");
  }

  function onTouchMove(event: TouchEvent): void {
    const placedModel = options.getPlacedModel();
    if (!placedModel || !canManipulate(event) || !state.gesture) return;
    event.preventDefault();

    if (event.touches.length === 2) {
      if (state.gesture.type !== "pinch") beginPinch(event.touches, placedModel);
      updatePinch(event.touches, placedModel);
      return;
    }

    if (event.touches.length !== 1) return;
    const touch = event.touches.item(0);
    if (!touch) return;

    if (state.gesture.type === "pending-model") updatePendingModelGesture(touch, placedModel);
    else if (state.gesture.type === "rotate") updateRotation(touch, placedModel);
    else if (state.gesture.type === "drag") updateDrag(touch, placedModel);
  }

  function restartSingleTouch(touch: Touch): void {
    const placedModel = options.getPlacedModel();
    clearGesture(false);
    if (!placedModel || !placedModel.visible) return;

    if (touchesModel(touch, placedModel)) beginPendingModelGesture(touch, placedModel);
  }

  function onTouchEnd(event: TouchEvent): void {
    if (isUiTarget(event)) {
      clearGesture(true);
      return;
    }
    if (!options.isInAR() || !state.gesture) return;
    event.preventDefault();

    if (event.touches.length === 1) {
      const touch = event.touches.item(0);
      if (touch) restartSingleTouch(touch);
      return;
    }

    if (event.touches.length === 0) clearGesture(true);
  }

  function clearGesture(hideHint: boolean): void {
    clearHoldTimer();
    state.gesture = null;
    setGestureUi(null);
    options.indicator.hide();
    if (hideHint) options.hideHintSoon();
  }

  function connect(): void {
    document.body.addEventListener("touchstart", onTouchStart, { passive: false });
    document.body.addEventListener("touchmove", onTouchMove, { passive: false });
    document.body.addEventListener("touchend", onTouchEnd, { passive: false });
    document.body.addEventListener("touchcancel", onTouchEnd, { passive: false });
  }

  function disconnect(): void {
    clearGesture(false);
    document.body.removeEventListener("touchstart", onTouchStart);
    document.body.removeEventListener("touchmove", onTouchMove);
    document.body.removeEventListener("touchend", onTouchEnd);
    document.body.removeEventListener("touchcancel", onTouchEnd);
  }

  return {
    connect,
    disconnect,
    clear() {
      clearGesture(false);
    },
  };
}
