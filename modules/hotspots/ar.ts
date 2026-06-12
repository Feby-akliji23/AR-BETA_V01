import type { Group, PerspectiveCamera, WebGLRenderer } from "three";
import { getXrProjectionCamera, projectWorldToDom } from "../math.js";
import { THREE } from "../three.js";
import type { ArModel, ArPlacementState, HotspotConfig, ProjectedPoint } from "../types.js";
import { createHotspotElements, setHotspotState, updateFocusDirection } from "../ui.js";

const CARD_HIDE_MODEL_SCALE = 0.82;
const CARD_SHOW_MODEL_SCALE = 0.9;
const FOCUS_ROTATION_DURATION = 1100;

interface ArHotspotsOptions {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  hotspots: HotspotConfig[];
  hotspotLayer: HTMLElement;
  buttonText: HTMLElement;
  focusDirection: HTMLElement;
  getIsInAr: () => boolean;
  getPlacementState: () => ArPlacementState;
  getPlacedModel: () => ArModel | null;
  clearGestures: () => void;
  onSelect: (index: number) => void;
  onDetail: (index: number) => void;
}

export function createArHotspots(options: ArHotspotsOptions) {
  let focusRotation: {
    model: ArModel;
    target: Group;
    from: number;
    delta: number;
    startedAt: number;
    lastApplied: number;
  } | null = null;

  const hotspotWorldPosition = new THREE.Vector3();
  const modelWorldPosition = new THREE.Vector3();
  const cameraWorldPosition = new THREE.Vector3();
  const projection: ProjectedPoint = {
    x: 0,
    y: 0,
    z: 0,
    screenX: 0,
    screenY: 0,
    behindCamera: false,
  };
  const elements = createHotspotElements(
    options.hotspots,
    options.hotspotLayer,
    options.onSelect,
    options.onDetail
  );

  function updateState(index: number): void {
    setHotspotState(elements, index, options.buttonText, options.hotspots);
    if (options.getIsInAr()) elements.forEach((element) => element.classList.add("hidden"));
  }

  function updatePositions(index: number): void {
    const model = options.getPlacedModel();
    if (!options.getIsInAr() || !model?.visible || index === -1) {
      elements.forEach((element) => element.classList.add("hidden"));
      options.focusDirection.classList.add("hidden");
      return;
    }
    model.updateMatrixWorld(true);
    const anchor = model.userData.hotspotAnchors[index];
    const element = elements[index];
    if (!anchor || !element) return;
    anchor.getWorldPosition(hotspotWorldPosition);
    projectWorldToDom(options.renderer, options.camera, hotspotWorldPosition, projection);
    const margin = 36;
    const onScreen =
      !projection.behindCamera &&
      projection.screenX >= margin &&
      projection.screenX <= window.innerWidth - margin &&
      projection.screenY >= margin &&
      projection.screenY <= window.innerHeight - margin;
    element.classList.toggle("hidden", !onScreen);
    if (onScreen) {
      element.style.left = projection.screenX + "px";
      element.style.top = projection.screenY + "px";
      const cardHidden = element.classList.contains("card-hidden");
      const scale = model.userData.interactionRoot.scale.x;
      if (!cardHidden && scale < CARD_HIDE_MODEL_SCALE) element.classList.add("card-hidden");
      else if (cardHidden && scale > CARD_SHOW_MODEL_SCALE) element.classList.remove("card-hidden");
    }
    updateFocusDirection(
      options.focusDirection,
      projection,
      options.getPlacementState() === "placed" && index !== -1
    );
  }

  function focus(index: number): void {
    const model = options.getPlacedModel();
    if (index === -1 || options.getPlacementState() !== "placed" || !model?.visible) {
      focusRotation = null;
      return;
    }
    const anchor = model.userData.hotspotAnchors[index];
    if (!anchor) return;
    const interactionRoot = model.userData.interactionRoot;
    model.updateMatrixWorld(true);
    anchor.getWorldPosition(hotspotWorldPosition);
    interactionRoot.getWorldPosition(modelWorldPosition);
    getXrProjectionCamera(options.renderer, options.camera).getWorldPosition(cameraWorldPosition);
    const hotspotX = hotspotWorldPosition.x - modelWorldPosition.x;
    const hotspotZ = hotspotWorldPosition.z - modelWorldPosition.z;
    if (Math.hypot(hotspotX, hotspotZ) < 0.001) return;
    const cameraAngle = Math.atan2(
      cameraWorldPosition.x - modelWorldPosition.x,
      cameraWorldPosition.z - modelWorldPosition.z
    );
    const hotspotAngle = Math.atan2(hotspotX, hotspotZ);
    options.clearGestures();
    focusRotation = {
      model,
      target: interactionRoot,
      from: interactionRoot.rotation.y,
      delta: shortestAngle(cameraAngle - hotspotAngle),
      startedAt: performance.now(),
      lastApplied: interactionRoot.rotation.y,
    };
  }

  function updateFocus(timestamp: number): void {
    const animation = focusRotation;
    if (!animation) return;
    if (
      !options.getIsInAr() ||
      options.getPlacementState() !== "placed" ||
      options.getPlacedModel() !== animation.model ||
      Math.abs(shortestAngle(animation.target.rotation.y - animation.lastApplied)) > 0.001
    ) {
      focusRotation = null;
      return;
    }
    const progress = Math.min((timestamp - animation.startedAt) / FOCUS_ROTATION_DURATION, 1);
    animation.lastApplied = animation.from + animation.delta * smootherStep(progress);
    animation.target.rotation.y = animation.lastApplied;
    animation.model.updateMatrixWorld(true);
    if (progress >= 1) focusRotation = null;
  }

  function clearFocus(): void {
    focusRotation = null;
    options.focusDirection.classList.add("hidden");
  }

  return { clearFocus, focus, updateFocus, updatePositions, updateState };
}

function shortestAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function smootherStep(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}
