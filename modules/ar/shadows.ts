import type { DirectionalLight, Vector3, WebGLRenderer } from "three";
import { THREE } from "../three.js";
import type { ArModel } from "../types.js";

const RECEIVER_PADDING = 1.25;
const RECEIVER_OPACITY = 0.44;
const BLOB_OPACITY = 0.4;
const FLOOR_OFFSET = -0.002;

interface ArShadowOptions {
  renderer: WebGLRenderer;
  directionalLight: DirectionalLight;
  model: ArModel;
  hasLightEstimate: () => boolean;
  setLightTarget: (target: Vector3 | null) => void;
}

export function createArShadowController(options: ArShadowOptions) {
  const receiverMaterial = new THREE.ShadowMaterial({
    color: 0x000000,
    opacity: RECEIVER_OPACITY,
    transparent: true,
    depthWrite: false,
  });
  const receiver = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), receiverMaterial);
  receiver.rotation.x = -Math.PI / 2;
  receiver.position.y = FLOOR_OFFSET;
  receiver.receiveShadow = true;
  receiver.visible = false;
  receiver.renderOrder = 1;
  options.model.add(receiver);

  const blobMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    alphaMap: createBlobTexture(),
    transparent: true,
    opacity: BLOB_OPACITY,
    depthWrite: false,
  });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMaterial);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = FLOOR_OFFSET * 0.5;
  blob.visible = false;
  blob.renderOrder = 2;
  options.model.add(blob);

  const boundsSize = options.model.userData.localBounds.getSize(new THREE.Vector3());
  const targetPosition = new THREE.Vector3();

  options.renderer.shadowMap.enabled = true;
  options.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  options.directionalLight.castShadow = true;
  options.directionalLight.shadow.mapSize.set(1024, 1024);
  options.directionalLight.shadow.bias = -0.0005;
  options.directionalLight.shadow.normalBias = 0.02;
  options.directionalLight.shadow.camera.near = 0.01;
  options.directionalLight.shadow.camera.far = 20;

  options.model.userData.interactionRoot.traverse((child) => {
    if ("isMesh" in child && child.isMesh) child.castShadow = true;
  });

  function update(): void {
    if (!options.model.visible) {
      hide();
      return;
    }

    const interactionRoot = options.model.userData.interactionRoot;
    const interactionScale = interactionRoot.scale;
    const width = Math.max(0.3, boundsSize.x * interactionScale.x * RECEIVER_PADDING);
    const depth = Math.max(0.3, boundsSize.z * interactionScale.z * RECEIVER_PADDING);
    receiver.position.set(
      interactionRoot.position.x,
      interactionRoot.position.y + FLOOR_OFFSET,
      interactionRoot.position.z
    );
    blob.position.set(
      interactionRoot.position.x,
      interactionRoot.position.y + FLOOR_OFFSET * 0.5,
      interactionRoot.position.z
    );
    receiver.scale.set(width, depth, 1);
    blob.scale.set(width * 0.72, depth * 0.72, 1);

    interactionRoot.getWorldPosition(targetPosition);
    options.setLightTarget(targetPosition);
    updateShadowCamera(Math.max(width, depth));

    const useRealtimeShadow = options.hasLightEstimate();
    receiver.visible = useRealtimeShadow;
    blob.visible = !useRealtimeShadow;
  }

  function updateShadowCamera(size: number): void {
    const extent = Math.max(0.6, size * 0.7);
    const camera = options.directionalLight.shadow.camera;
    camera.left = -extent;
    camera.right = extent;
    camera.top = extent;
    camera.bottom = -extent;
    camera.updateProjectionMatrix();
  }

  function hide(): void {
    receiver.visible = false;
    blob.visible = false;
    options.setLightTarget(null);
  }

  function reset(): void {
    hide();
  }

  return { reset, update };
}

function createBlobTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 62);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.45, "rgba(255,255,255,0.45)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
