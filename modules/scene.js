const HDR_URL = "./assets/spruit_sunrise_1k_HDR.hdr";
const MODEL_URL = "./assets/final ar.glb";
const DRACO_DECODER_URL = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
export const MODEL_BASE_SCALE = 0.8;
export const MODEL_INTERACTION_PLANE_Y = 0.59;

export function createThreeScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0.7, 0.9, 1.7);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.physicallyCorrectLights = true;
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

export function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8c97a3, 1.1));

  const directional = new THREE.DirectionalLight(0xffffff, 3.2);
  directional.position.set(3, 5, 2);
  scene.add(directional);
}

export function createReticle(scene) {
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.15, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
  return reticle;
}

export function createSurfaceGrid(scene) {
  const group = new THREE.Group();
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

export function createGestureIndicator(scene) {
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
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2),
    ringMaterial
  );
  const markers = [];
  const headingMarker = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 24).rotateX(-Math.PI / 2),
    headingMaterial
  );
  headingMarker.position.set(0, 0.002, -1.18);

  group.add(ring);
  for (let index = 0; index < 4; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.CircleGeometry(0.075, 20).rotateX(-Math.PI / 2),
      markerMaterial
    );
    const angle = index * Math.PI / 2;
    marker.position.set(Math.cos(angle) * 1.16, 0, Math.sin(angle) * 1.16);
    group.add(marker);
    markers.push(marker);
  }
  group.add(headingMarker);

  group.visible = false;
  group.renderOrder = 20;
  scene.add(group);

  function sync(model, type) {
    if (!model) return;
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

export async function setupEnvironment(scene, renderer) {
  return new Promise((resolve) => {
    const rgbeLoader = new THREE.RGBELoader();
    rgbeLoader.load(
      HDR_URL,
      (texture) => {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = pmremGenerator.fromEquirectangular(texture).texture;
        scene.userData.previewBackground = null;
        texture.dispose();
        pmremGenerator.dispose();
        resolve();
      },
      undefined,
      () => resolve()
    );
  });
}

export async function loadModel(statusText) {
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_URL);

  const gltfLoader = new THREE.GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      MODEL_URL,
      (gltf) => {
        const modelTemplate = gltf.scene;
        modelTemplate.traverse((child) => {
          if (child.isMesh) child.frustumCulled = false;
        });
        statusText.textContent = "Model ready";
        resolve(modelTemplate);
      },
      undefined,
      (error) => {
        statusText.textContent = "Model gagal dimuat";
        reject(error);
      }
    );
  });
}

export function createModelInstance(modelTemplate) {
  const root = new THREE.Group();
  const coordinateAnchor = modelTemplate.clone(true);
  coordinateAnchor.scale.setScalar(MODEL_BASE_SCALE);
  root.add(coordinateAnchor);

  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  coordinateAnchor.position.set(-center.x, -box.min.y, -center.z);
  root.updateMatrixWorld(true);

  root.userData.coordinateAnchor = coordinateAnchor;
  root.userData.baseScale = MODEL_BASE_SCALE;
  root.userData.interactionPlaneY =
    coordinateAnchor.position.y + MODEL_INTERACTION_PLANE_Y * MODEL_BASE_SCALE;
  root.userData.localBounds = new THREE.Box3().setFromObject(root);
  return root;
}

export function frameObject(object, controls) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  controls.target.set(0, size.y * 0.45, 0);
  controls.update();
}

export function getPreviewHomeTarget(previewModel) {
  if (!previewModel) return new THREE.Vector3(0, 0.45, 0);

  const box = new THREE.Box3().setFromObject(previewModel);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return new THREE.Vector3(center.x, size.y * 0.45, center.z);
}

export function resetPreviewCamera(camera, controls, previewModel) {
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
