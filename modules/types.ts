export interface Vector3Config {
  x: number;
  y: number;
  z: number;
}

export interface OrbitConfig {
  theta: number;
  phi: number;
  radius: number;
}

export interface HotspotConfig {
  header: string;
  description: string;
  detail?: string;
  buttonText: string;
  imageUrl?: string;
  position: Vector3Config;
  normal: Vector3Config;
  orbit: OrbitConfig;
}

export type ArPlacementState = "preview" | "loading" | "scanning" | "stabilizing" | "ready" | "placed";

export interface ProjectedPoint extends Vector3Config {
  screenX: number;
  screenY: number;
  behindCamera: boolean;
}

export interface ProjectConfig {
  app: {
    title: string;
    modelName: string;
    version: string;
    defaultImageUrl: string;
  };
  model: {
    glbUrl: string;
    usdzUrl: string;
    environmentUrl: string;
    dracoDecoderUrl: string;
    alt: string;
    scale: number;
    orientation: [number, number, number];
    interactionPlaneY: number;
  };
  preview: {
    homeOrbit: string;
    homeTarget: string;
    fieldOfView: string;
    minFieldOfView: string;
    maxFieldOfView: string;
    exposure: string;
    shadowIntensity: string;
    cameraTransitionMs: number;
  };
  hotspots: HotspotConfig[];
}

export interface ModelViewerElement extends HTMLElement {
  activateAR?: () => Promise<void>;
  cameraOrbit?: string;
  cameraTarget?: string;
  getCameraOrbit?: () => { theta: number; phi: number; radius: number };
  getCameraTarget?: () => { x: number; y: number; z: number };
  jumpCameraToGoal?: () => void;
}

export interface ArModel extends Group {
  userData: {
    coordinateAnchor: Group;
    hotspotAnchors: Object3D[];
    baseScale: number;
    interactionPlaneY: number;
    localBounds: Box3;
  };
}

export interface SurfaceGrid extends Group {
  userData: {
    surface: Mesh<PlaneGeometry, MeshBasicMaterial>;
    grid: GridHelper;
  };
}

export type GestureType = "pending-model" | "rotate" | "drag" | "pinch";

export interface GestureIndicator {
  show: (type: Exclude<GestureType, "pending-model">, model: ArModel) => void;
  update: (model: ArModel) => void;
  hide: () => void;
}

export interface GestureControls {
  clear: () => void;
}

export interface ArGestureOptions {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  isInAR: () => boolean;
  isEnabled: () => boolean;
  getPlacedModel: () => ArModel | null;
  indicator: GestureIndicator;
  showHint: (message: string) => void;
  hideHintSoon: () => void;
}

export interface ArPlacementDependencies {
  reticle: Object3D;
  surfaceGrid: SurfaceGrid;
  arStatus: HTMLElement;
  arInstructions: HTMLElement;
  arScanReticle: HTMLElement;
  arMenu: HTMLElement;
  statusText: HTMLElement;
  hideGestureHint: () => void;
  hideFocusDirection: () => void;
  interactionToolbar: HTMLElement;
}

export interface CameraOrbit {
  theta: number;
  phi: number;
  radius: number;
}

export interface CameraTarget {
  x: number;
  y: number;
  z: number;
}

export interface DragGesture {
  type: "drag";
  floorY: number;
  lastIntersection: Vector3;
  targetPosition: Vector3;
}

export interface PendingModelGesture {
  type: "pending-model" | "rotate";
  startX: number;
  startY: number;
  startRotation: number;
}

export interface PinchGesture {
  type: "pinch";
  startDistance: number;
  startScale: number;
}

export type GestureState = DragGesture | PendingModelGesture | PinchGesture;
import type {
  Box3,
  GridHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
