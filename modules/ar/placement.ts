import type { Matrix4, Object3D, WebGLRenderer } from "three";
import { THREE } from "../three.js";
import type { ArModel, ArPlacementState, SurfaceGrid } from "../types.js";

const SAMPLE_LIMIT = 8;
const SAMPLE_MINIMUM = 5;
const POSITION_TOLERANCE = 0.12;
const READY_POSITION_TOLERANCE = 0.18;
const VERTICAL_TOLERANCE = 0.025;
const READY_VERTICAL_TOLERANCE = 0.025;
const STABLE_DURATION = 180;
const UNSTABLE_GRACE = 1200;
const LOST_GRACE = 700;
const SMOOTHING = 0.22;

interface ArPlacementOptions {
  renderer: WebGLRenderer;
  reticle: Object3D;
  surfaceGrid: SurfaceGrid;
  getModel: () => ArModel | null;
  getPlacementState: () => ArPlacementState;
  setPlacementState: (state: ArPlacementState) => void;
  setStatus: (message: string) => void;
}

export function createArPlacementController(options: ArPlacementOptions) {
  let source: XRHitTestSource | null = null;
  let sourceRequested = false;
  let retryAfter = 0;
  let sampleCursor = 0;
  let sampleCount = 0;
  let stableSince = 0;
  let unstableSince = 0;
  let lastSeenAt = 0;
  let hasSmoothedHit = false;
  let readyHeight: number | null = null;
  let placementMatrix: Matrix4 | null = null;

  const samples = Array.from({ length: SAMPLE_LIMIT }, () => new THREE.Vector3());
  const hitMatrix = new THREE.Matrix4();
  const hitPosition = new THREE.Vector3();
  const hitQuaternion = new THREE.Quaternion();
  const smoothedPosition = new THREE.Vector3();
  const smoothedQuaternion = new THREE.Quaternion();
  const smoothedScale = new THREE.Vector3(1, 1, 1);
  const smoothedMatrix = new THREE.Matrix4();
  const hitCenter = new THREE.Vector3();
  const sampleHeights = new Array<number>(SAMPLE_LIMIT).fill(0);
  const placementMatrixValue = new THREE.Matrix4();

  function getPlacementMatrix(): Matrix4 | null {
    return placementMatrix;
  }

  function reset(): void {
    sampleCursor = 0;
    sampleCount = 0;
    stableSince = 0;
    unstableSince = 0;
    lastSeenAt = 0;
    hasSmoothedHit = false;
    readyHeight = null;
    placementMatrix = null;
  }

  function clearSource(): void {
    if (source && typeof source.cancel === "function") {
      try {
        source.cancel();
      } catch (error) {
        console.warn("Sumber hit-test tidak dapat ditutup", error);
      }
    }
    sourceRequested = false;
    source = null;
    retryAfter = 0;
  }

  function isStable(positionTolerance = POSITION_TOLERANCE, verticalTolerance = VERTICAL_TOLERANCE): boolean {
    if (sampleCount < SAMPLE_MINIMUM) return false;
    hitCenter.set(0, 0, 0);
    for (let index = 0; index < sampleCount; index += 1) hitCenter.add(samples[index]!);
    hitCenter.multiplyScalar(1 / sampleCount);
    for (let index = 0; index < sampleCount; index += 1) {
      const sample = samples[index]!;
      const horizontalDistance = Math.hypot(sample.x - hitCenter.x, sample.z - hitCenter.z);
      if (horizontalDistance > positionTolerance || Math.abs(sample.y - hitCenter.y) > verticalTolerance) {
        return false;
      }
    }
    return true;
  }

  function updateStableHit(matrix: Matrix4): void {
    hitPosition.setFromMatrixPosition(matrix);
    hitQuaternion.setFromRotationMatrix(matrix);
    samples[sampleCursor]?.copy(hitPosition);
    sampleHeights[sampleCursor] = hitPosition.y;
    sampleCursor = (sampleCursor + 1) % SAMPLE_LIMIT;
    sampleCount = Math.min(sampleCount + 1, SAMPLE_LIMIT);

    if (!hasSmoothedHit) {
      smoothedPosition.copy(hitPosition);
      smoothedQuaternion.copy(hitQuaternion);
      hasSmoothedHit = true;
    } else {
      smoothedPosition.lerp(hitPosition, SMOOTHING);
      smoothedQuaternion.slerp(hitQuaternion, SMOOTHING);
    }

    const medianHeight = sampleHeights.slice(0, sampleCount).sort((a, b) => a - b)[
      Math.floor(sampleCount / 2)
    ];
    if (medianHeight !== undefined) smoothedPosition.y = medianHeight;

    const state = options.getPlacementState();
    if (state === "ready" && readyHeight !== null) smoothedPosition.y = readyHeight;

    smoothedMatrix.compose(smoothedPosition, smoothedQuaternion, smoothedScale);
    options.reticle.matrix.copy(smoothedMatrix);
    options.reticle.matrixWorldNeedsUpdate = true;
    options.surfaceGrid.matrix.copy(smoothedMatrix);
    options.surfaceGrid.matrixWorldNeedsUpdate = true;
    if (options.getModel()?.visible) return;

    const tolerance = state === "ready" ? READY_POSITION_TOLERANCE : POSITION_TOLERANCE;
    const verticalTolerance = state === "ready" ? READY_VERTICAL_TOLERANCE : VERTICAL_TOLERANCE;
    if (!isStable(tolerance, verticalTolerance)) {
      if (state === "ready") {
        if (!unstableSince) unstableSince = performance.now();
        if (performance.now() - unstableSince <= UNSTABLE_GRACE) return;
      }
      stableSince = 0;
      unstableSince = 0;
      readyHeight = null;
      placementMatrix = null;
      if (state !== "stabilizing") options.setPlacementState("stabilizing");
      return;
    }

    unstableSince = 0;
    if (!stableSince) stableSince = performance.now();
    if (performance.now() - stableSince < STABLE_DURATION) {
      if (state !== "stabilizing") options.setPlacementState("stabilizing");
      return;
    }

    if (readyHeight === null) readyHeight = smoothedPosition.y;
    smoothedPosition.y = readyHeight;
    smoothedMatrix.compose(smoothedPosition, smoothedQuaternion, smoothedScale);
    options.reticle.matrix.copy(smoothedMatrix);
    options.reticle.matrixWorldNeedsUpdate = true;
    options.surfaceGrid.matrix.copy(smoothedMatrix);
    options.surfaceGrid.matrixWorldNeedsUpdate = true;
    placementMatrixValue.copy(smoothedMatrix);
    placementMatrix = placementMatrixValue;
    if (state !== "ready") options.setPlacementState("ready");
  }

  async function requestSource(session: XRSession): Promise<void> {
    sourceRequested = true;
    try {
      const viewerSpace = await session.requestReferenceSpace("viewer");
      if (!session.requestHitTestSource) throw new Error("Hit-test tidak didukung sesi WebXR");
      const nextSource = await session.requestHitTestSource({ space: viewerSpace });
      if (!nextSource) throw new Error("Sumber hit-test tidak tersedia");
      if (options.renderer.xr.getSession() !== session) {
        nextSource.cancel?.();
        return;
      }
      source = nextSource;
    } catch (error) {
      if (options.renderer.xr.getSession() !== session) return;
      source = null;
      sourceRequested = false;
      retryAfter = performance.now() + 1500;
      options.setStatus("Mencoba mendeteksi permukaan kembali");
      console.error("Sumber hit-test gagal dibuat", error);
    }
  }

  function update(frame: XRFrame): void {
    const session = options.renderer.xr.getSession();
    const referenceSpace = options.renderer.xr.getReferenceSpace();
    if (!session || !referenceSpace) return;
    if (!sourceRequested && performance.now() >= retryAfter) void requestSource(session);
    if (!source) {
      const state = options.getPlacementState();
      if (state !== "placed" && state !== "scanning") options.setPlacementState("scanning");
      return;
    }

    const results = frame.getHitTestResults(source);
    if (results.length) {
      lastSeenAt = performance.now();
      const pose = results[0]?.getPose(referenceSpace);
      if (!pose) return;
      hitMatrix.fromArray(pose.transform.matrix);
      updateStableHit(hitMatrix);
      return;
    }

    if (!options.getModel()?.visible && hasSmoothedHit && performance.now() - lastSeenAt <= LOST_GRACE)
      return;
    reset();
    if (!options.getModel()?.visible && options.getPlacementState() !== "scanning") {
      options.setPlacementState("scanning");
    }
  }

  return { clearSource, getPlacementMatrix, reset, update };
}
