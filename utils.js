window.gltfLoader = new THREE.GLTFLoader();
/**
 * The Reticle class creates an object that repeatedly calls
 * `xrSession.requestHitTest()` to render a ring along a found
 * horizontal surface.
 */
class Reticle extends THREE.Object3D {
  constructor() {
    super();

    this.loader = new THREE.GLTFLoader();
    this.loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", (gltf) => {
      this.add(gltf.scene);
    })

    this.visible = false;
  }
}


const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/'); 

//instance GLTFLoader dan DRACOLoader
window.gltfLoader = new THREE.GLTFLoader();
window.gltfLoader.setDRACOLoader(dracoLoader);

// load model GLB yang dikompresi Draco
window.gltfLoader.load('./assets/DUNGKLURUK_FINAL.glb', function (gltf) {
  window.customModel = gltf.scene; // Simpan model untuk digunakan nanti
  window.customModel.scale.set(1.5, 1.5, 1.5);
}, undefined, function (error) {
  console.error('An error occurred while loading the model:', error);
});


window.DemoUtils = {
  /**
   * Creates a THREE.Scene containing lights that cast shadows,
   * and a mesh that will receive shadows.
   *
   * @return {THREE.Scene}
   */
  createLitScene() {
    const scene = new THREE.Scene();

    // Tambahkan ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    // Tambahkan directional light untuk bayangan
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Tambahkan spot light untuk menerangi model
    const spotLight = new THREE.SpotLight(0xffffff, 1);
    spotLight.position.set(0, 10, 0);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.2;
    spotLight.decay = 2;
    spotLight.distance = 100;
    spotLight.castShadow = true;
    scene.add(spotLight);

    // Buat dan tambahkan mesh untuk bayangan
    const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
    planeGeometry.rotateX(-Math.PI / 2);
    const shadowMesh = new THREE.Mesh(planeGeometry, new THREE.ShadowMaterial({
      color: 0x111111,
      opacity: 0.2,
    }));
    shadowMesh.name = 'shadowMesh';
    shadowMesh.receiveShadow = true;
    shadowMesh.position.y = 10000;
    scene.add(shadowMesh);

    return scene;
  }
};


