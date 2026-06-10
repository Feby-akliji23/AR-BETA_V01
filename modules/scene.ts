import { THREE } from "./three.js";
import { projectConfig } from "./config.js";
import type { Group, Object3D, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ArModel, GestureIndicator, GestureType, HotspotConfig, SurfaceGrid } from "./types.js";

const { model: modelConfig } = projectConfig;

export function createThreeScene(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0.7, 0.9, 1.7);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.target.set(0, 0.45, 0);
  controls.enableDamping = true;
  controls.minDistance = 0.5;
  controls.maxDistance = 4;

  addLights(scene);

  return { scene, camera, renderer, controls };
}

export function addLights(scene: Scene): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8c97a3, 1.1));

  const directional = new THREE.DirectionalLight(0xffffff, 3.2);
  directional.position.set(3, 5, 2);
  scene.add(directional);
}

export function createReticle(scene: Scene) {
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.15, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
  return reticle;
}

export function createSurfaceGrid(scene: Scene): SurfaceGrid {
  const group = new THREE.Group() as SurfaceGrid;
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  const grid = new THREE.GridHelper(1.6, 16, 0x86efac, 0x22c55e);

  grid.material.transparent = true;
  grid.material.opacity = 0.42;
  grid.material.depthWrite = false;
  grid.position.y = 0.002;
  group.add(surface, grid);
  group.matrixAutoUpdate = false;
  group.visible = false;
  group.renderOrder = 2;
  group.userData.surface = surface;
  group.userData.grid = grid;
  scene.add(group);
  return group;
}

export function createGestureIndicator(scene: Scene): GestureIndicator {
  const group = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xdff8ff,
    transparent: true,
    opacity: 0.88,
    depthTest: true,
    depthWrite: false,
  });
  const markerMaterial = ringMaterial.clone();
  markerMaterial.opacity = 0.98;
  const headingMaterial = ringMaterial.clone();
  headingMaterial.color.setHex(0xffffff);
  headingMaterial.opacity = 1;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2), ringMaterial);
  const markers: Object3D[] = [];
  const headingMarker = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 24).rotateX(-Math.PI / 2),
    headingMaterial
  );
  headingMarker.position.set(0, 0.002, -1.18);

  group.add(ring);
  for (let index = 0; index < 4; index += 1) {
    const marker = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20).rotateX(-Math.PI / 2), markerMaterial);
    const angle = (index * Math.PI) / 2;
    marker.position.set(Math.cos(angle) * 1.16, 0, Math.sin(angle) * 1.16);
    group.add(marker);
    markers.push(marker);
  }
  group.add(headingMarker);

  group.visible = false;
  group.renderOrder = 20;
  scene.add(group);

  function sync(model: ArModel, type: Exclude<GestureType, "pending-model">): void {
    model.updateMatrixWorld(true);
    const bounds = model.userData.localBounds;
    const localCenter = bounds ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    const center = localCenter.clone().applyMatrix4(model.matrixWorld);
    const size = bounds
      ? bounds.getSize(new THREE.Vector3()).multiply(model.scale)
      : new THREE.Vector3(0.6, 0.6, 0.6);
    const radius = Math.max(size.x, size.z) * 0.58;
    const interactionPlane = new THREE.Vector3(
      localCenter.x,
      model.userData.interactionPlaneY ?? localCenter.y,
      localCenter.z
    ).applyMatrix4(model.matrixWorld);

    group.position.set(center.x, interactionPlane.y - 0.008 * model.scale.y, center.z);
    group.rotation.y = type === "rotate" ? model.rotation.y : 0;
    group.scale.setScalar(Math.max(0.16, radius));
  }

  return {
    show(type, model) {
      ringMaterial.color.setHex(type === "rotate" ? 0xfff1b8 : type === "pinch" ? 0x9eeaff : 0xdff8ff);
      markerMaterial.color.copy(ringMaterial.color);
      headingMarker.visible = type === "rotate";
      markers.forEach((marker) => {
        marker.visible = type !== "rotate";
      });
      group.userData.type = type;
      sync(model, type);
      group.visible = true;
    },
    update(model) {
      sync(model, group.userData.type);
    },
    hide() {
      group.visible = false;
    },
  };
}

export async function setupEnvironment(scene: Scene, renderer: WebGLRenderer): Promise<void> {
  try {
    const rgbeLoader = new THREE.RGBELoader();
    const texture = await rgbeLoader.loadAsync(modelConfig.environmentUrl);
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmremGenerator.fromEquirectangular(texture).texture;
    scene.userData.previewBackground = null;
    texture.dispose();
    pmremGenerator.dispose();
  } catch {
    // environment map is optional — silently ignore
  }
}

export async function loadModel(statusText: HTMLElement): Promise<Group> {
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath(modelConfig.dracoDecoderUrl);

  const gltfLoader = new THREE.GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  try {
    const gltf = await gltfLoader.loadAsync(modelConfig.glbUrl, (event) => {
      if (event.total > 0) {
        const percentage = Math.min(100, Math.round((event.loaded / event.total) * 100));
        statusText.textContent = `Memuat model ${percentage}%`;
        return;
      }
      const loadedMb = (event.loaded / 1024 / 1024).toFixed(1);
      statusText.textContent = `Memuat model ${loadedMb} MB`;
    });
    const modelTemplate = gltf.scene;
    modelTemplate.traverse((child) => {
      if ("isMesh" in child && child.isMesh) child.frustumCulled = false;
    });
    statusText.textContent = "Model siap";
    return modelTemplate;
  } catch (error) {
    statusText.textContent = "Model gagal dimuat";
    throw error;
  }
}

export function createModelInstance(
  modelTemplate: Group,
  hotspotDefinitions: HotspotConfig[] = [],
  showHotspotMarkers = false
): ArModel {
  const root = new THREE.Group() as ArModel;
  const coordinateSpace = new THREE.Group();
  const model = modelTemplate.clone(true);
  model.scale.setScalar(modelConfig.scale);
  const [roll, pitch, yaw] = modelConfig.orientation.map(THREE.MathUtils.degToRad);
  model.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, roll, "YXZ"));
  coordinateSpace.add(model);
  root.add(coordinateSpace);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  coordinateSpace.position.set(-center.x, -box.min.y, -center.z);
  root.updateMatrixWorld(true);

  root.userData.coordinateAnchor = coordinateSpace;
  root.userData.hotspotAnchors = createHotspotAnchors(
    coordinateSpace,
    hotspotDefinitions,
    showHotspotMarkers
  );
  root.userData.baseScale = modelConfig.scale;
  root.userData.interactionPlaneY =
    coordinateSpace.position.y + modelConfig.interactionPlaneY * modelConfig.scale;
  root.userData.localBounds = new THREE.Box3().setFromObject(root);
  return root;
}

function createHotspotAnchors(
  coordinateSpace: Group,
  hotspotDefinitions: HotspotConfig[],
  showMarkers: boolean
): Object3D[] {
  const markerGeometry = showMarkers ? new THREE.SphereGeometry(0.012, 12, 12) : null;
  const markerMaterial = showMarkers
    ? new THREE.MeshBasicMaterial({
        color: 0xff1744,
        depthTest: false,
        depthWrite: false,
      })
    : null;

  return hotspotDefinitions.map((hotspot, index) => {
    const anchor = new THREE.Object3D();
    anchor.name = `hotspot-anchor-${index + 1}`;
    anchor.position.set(hotspot.position.x, hotspot.position.y, hotspot.position.z);
    coordinateSpace.add(anchor);

    if (markerGeometry && markerMaterial) {
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.renderOrder = 1000;
      anchor.add(marker);
    }

    return anchor;
  });
}

export function frameObject(object: Object3D, controls: OrbitControls): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  controls.target.set(0, size.y * 0.45, 0);
  controls.update();
}

export function getPreviewHomeTarget(previewModel: Object3D | null): Vector3 {
  if (!previewModel) return new THREE.Vector3(0, 0.45, 0);

  const box = new THREE.Box3().setFromObject(previewModel);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return new THREE.Vector3(center.x, size.y * 0.45, center.z);
}

export function resetPreviewCamera(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  previewModel: Object3D | null
): void {
  const target = getPreviewHomeTarget(previewModel);
  camera.position.set(0.7, 0.9, 1.7);
  camera.rotation.set(0, 0, 0);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  controls.enabled = true;
  controls.target.copy(target);
  controls.update();
}
