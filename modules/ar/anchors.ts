import type { Matrix4, Quaternion, WebGLRenderer } from "three";
import { THREE } from "../three.js";
import type { ArModel, ArPlacementState } from "../types.js";

const TRACKING_LOST_GRACE = 500;

interface ArAnchorOptions {
  renderer: WebGLRenderer;
  getModel: () => ArModel | null;
  getPlacementState: () => ArPlacementState;
  isInAR: () => boolean;
  setStatus: (message: string) => void;
  onTrackingLost: () => void;
}

export function createArAnchorController(options: ArAnchorOptions) {
  let anchor: XRAnchor | null = null;
  let shouldCreate = false;
  let isCreating = false;
  let requestVersion = 0;
  let trackingLostSince = 0;
  let lockedHeight: number | null = null;
  let lockedQuaternion: Quaternion | null = null;
  let hasAnchorOffset = false;
  const anchorMatrix: Matrix4 = new THREE.Matrix4();
  const anchorOffsetMatrix: Matrix4 = new THREE.Matrix4();
  const anchoredModelMatrix: Matrix4 = new THREE.Matrix4();
  const anchorPosition = new THREE.Vector3();
  const anchorQuaternion = new THREE.Quaternion();
  const anchorScale = new THREE.Vector3();

  function requestCreation(): void {
    const model = options.getModel();
    lockedHeight = model?.position.y ?? null;
    lockedQuaternion = model?.quaternion.clone() ?? null;
    shouldCreate = true;
  }

  function clear(deleteAnchor = true): void {
    if (deleteAnchor && anchor) {
      try {
        anchor.delete();
      } catch (error) {
        console.warn("Anchor AR tidak dapat dihapus", error);
      }
    }
    anchor = null;
    shouldCreate = false;
    isCreating = false;
    requestVersion += 1;
    trackingLostSince = 0;
    lockedHeight = null;
    lockedQuaternion = null;
    hasAnchorOffset = false;
  }

  function create(frame: XRFrame): void {
    const model = options.getModel();
    if (!shouldCreate || isCreating || anchor || !model?.visible || !frame.createAnchor) return;
    const referenceSpace = options.renderer.xr.getReferenceSpace();
    if (!referenceSpace) return;

    const pose = new XRRigidTransform(
      { x: model.position.x, y: model.position.y, z: model.position.z },
      {
        x: model.quaternion.x,
        y: model.quaternion.y,
        z: model.quaternion.z,
        w: model.quaternion.w,
      }
    );

    shouldCreate = false;
    isCreating = true;
    const currentVersion = requestVersion;
    frame
      .createAnchor(pose, referenceSpace)
      .then((createdAnchor) => {
        if (currentVersion !== requestVersion) {
          createdAnchor.delete();
          return;
        }
        isCreating = false;
        if (!options.isInAR() || options.getPlacementState() !== "placed" || anchor) {
          createdAnchor.delete();
          return;
        }
        anchor = createdAnchor;
        options.setStatus("Model ditempatkan dengan anchor");
      })
      .catch((error) => {
        if (currentVersion !== requestVersion) return;
        isCreating = false;
        console.warn("Anchor AR tidak tersedia; menggunakan posisi lokal", error);
      });
  }

  function update(frame: XRFrame): void {
    const model = options.getModel();
    if (!anchor || !model) return;
    const referenceSpace = options.renderer.xr.getReferenceSpace();
    if (!referenceSpace) return;

    const pose = frame.getPose(anchor.anchorSpace, referenceSpace);
    if (!pose || pose.emulatedPosition) {
      if (!trackingLostSince) trackingLostSince = performance.now();
      if (performance.now() - trackingLostSince >= TRACKING_LOST_GRACE) {
        options.onTrackingLost();
      }
      return;
    }

    trackingLostSince = 0;
    anchorMatrix.fromArray(pose.transform.matrix);
    if (!hasAnchorOffset) {
      model.updateMatrix();
      anchorOffsetMatrix.copy(anchorMatrix).invert().multiply(model.matrix);
      hasAnchorOffset = true;
    }
    anchoredModelMatrix.multiplyMatrices(anchorMatrix, anchorOffsetMatrix);
    anchoredModelMatrix.decompose(anchorPosition, anchorQuaternion, anchorScale);
    model.position.set(anchorPosition.x, lockedHeight ?? anchorPosition.y, anchorPosition.z);
    model.quaternion.copy(lockedQuaternion ?? anchorQuaternion);
    model.updateMatrixWorld(true);
  }

  function updateFrame(frame: XRFrame): void {
    create(frame);
    update(frame);
  }

  return { clear, requestCreation, updateFrame };
}
