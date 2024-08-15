// Start eventHandlers enter AR --------------------------------------------------------------------------------

document.getElementById("enter-ar").addEventListener("click", async () => {
  const isArSessionSupported = navigator.xr && navigator.xr.isSessionSupported && await navigator.xr.isSessionSupported("immersive-ar");

  if (isArSessionSupported) {
    try {
      await window.app.activateXR();
      document.getElementById("enter-ar").style.display = "none";
    } catch (error) {
      alert('Failed to start AR session: ' + error.message);
    }
  } else {
    alert('Your browser does not support AR features with WebXR.');
  }
});

// End eventHandlers enter AR --------------------------------------------------------------------------------

//-----------------------------------------------Start Class app ---------------------------------------------------------------------------------------------------

class App {

  constructor() {
    this.currentHotspotIndex = 0;
    this.hotspots = [];
    this.hotspotElements = {};
    this.buttonText = null;
    this.cardVisible = false;  // Tambahkan status tampilan kartu 
  }

// Start XR Management ---------------------------------------------------------------------------------------------------

  activateXR = async () => {
    try {
      this.xrSession = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ['hit-test', 'dom-overlay'],
        domOverlay: { root: document.body }
      });

      this.createXRCanvas();
      await this.onSessionStarted();
    } catch (e) {
      console.log(e);
      alert('Failed to start AR session: ' + e.message);
    }
  }

  createXRCanvas() {
    this.canvas = document.createElement("canvas");
    document.body.appendChild(this.canvas);
    this.gl = this.canvas.getContext("webgl", {xrCompatible: true});

    this.xrSession.updateRenderState({
      baseLayer: new XRWebGLLayer(this.xrSession, this.gl)
    });
  }

  onSessionStarted = async () => {
    document.body.classList.add('ar');

    const enterArInfo = document.getElementById('enter-ar-info');
    if (enterArInfo) {
      enterArInfo.style.display = 'none';
    }

    this.setupThreeJs();
    this.localReferenceSpace = await this.xrSession.requestReferenceSpace('local');
    this.viewerSpace = await this.xrSession.requestReferenceSpace('viewer');
    this.hitTestSource = await this.xrSession.requestHitTestSource({ space: this.viewerSpace });

    this.xrSession.requestAnimationFrame(this.onXRFrame);
    this.xrSession.addEventListener("select", this.onSelect);


    this.createHotspots();
    this.addGestureControls();
  }

  
  onXRFrame = (time, frame) => {
    this.xrSession.requestAnimationFrame(this.onXRFrame);

    const framebuffer = this.xrSession.renderState.baseLayer.framebuffer;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.renderer.setFramebuffer(framebuffer);

    const pose = frame.getViewerPose(this.localReferenceSpace);
    if (pose) {
      const view = pose.views[0];
      const viewport = this.xrSession.renderState.baseLayer.getViewport(view);
      this.renderer.setSize(viewport.width, viewport.height);

      this.camera.matrix.fromArray(view.transform.matrix);
      this.camera.projectionMatrix.fromArray(view.projectionMatrix);
      this.camera.updateMatrixWorld(true);

      const hitTestResults = frame.getHitTestResults(this.hitTestSource);

      if (!this.stabilized && hitTestResults.length > 0) {
        this.stabilized = true;
        document.body.classList.add('stabilized');
      }
      if (hitTestResults.length > 0) {
        const hitPose = hitTestResults[0].getPose(this.localReferenceSpace);

        this.reticle.visible = true;
        this.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
        this.reticle.updateMatrixWorld(true);
      }

      this.renderer.render(this.scene, this.camera);
      if (this.modelPlaced) {
        this.updateHotspotPositions();
      }
    }
  }


// End XR Management ---------------------------------------------------------------------------------------------------

// Start Three.js Setup ---------------------------------------------------------------------------------------------------

  setupThreeJs() {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
      canvas: this.canvas,
      context: this.gl
    });
    this.renderer.autoClear = true;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;    

    this.scene = DemoUtils.createLitScene();
    this.reticle = new Reticle();
    this.scene.add(this.reticle);

    this.camera = new THREE.PerspectiveCamera();
    this.camera.matrixAutoUpdate = false;
  }

// End Three.js Setup ---------------------------------------------------------------------------------------------------

// Start Display setting ---------------------------------------------------------------------------------------------------

onSelect = () => {
  if (window.customModel && this.reticle.visible && !this.modelPlaced) {
    this.scene.remove(this.reticle);

    const clone = window.customModel.clone();
    clone.scale.set(1, 1, 1); // Set scale again after cloning

    clone.position.copy(this.reticle.position);
    this.scene.add(clone);

    const shadowMesh = this.scene.children.find(c => c.name === 'shadowMesh');
    shadowMesh.position.y = clone.position.y;

    this.modelPlaced = true;
    this.currentModel = clone;
    // Start the rotation animation
    this.startRotationAnimation(clone);


    this.createArOverlay();
  }
};

startRotationAnimation = (model) => {
  const duration = 5000; // 3 seconds
  const startTime = performance.now();

  const easeOutCubic = (t) => (--t) * t * t + 1;

  const rotate = (currentTime) => {
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1); // Clamp progress to 1

    // Apply easing function
    const easedProgress = easeOutCubic(progress);

    // Calculate rotation with easing applied
    const rotation = easedProgress * Math.PI * 2; // Full 360 degrees rotation

    model.rotation.y = rotation;

    if (elapsedTime < duration) {
      requestAnimationFrame(rotate); // Continue the animation
    } else {
      model.rotation.y = Math.PI * 2; // Ensure final rotation is exactly 360 degrees
    }
  };

  requestAnimationFrame(rotate);
};


  createArOverlay() {
    const arOverlay = document.createElement('div');
    arOverlay.id = 'ar-overlay';
    arOverlay.style.position = 'absolute';
    arOverlay.style.top = '50px';
    arOverlay.style.left = '20px';
    arOverlay.style.color = 'white';
    arOverlay.style.fontSize = '24px';
    arOverlay.innerText = 'DUNGKLURUK AUGMENTED REALITY';
  
    // Navigation Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
  
    const prevButton = document.createElement('button');
    prevButton.className = 'nav-button';
    prevButton.id = 'prev-button';
    prevButton.innerHTML = '&#9664;';
    prevButton.addEventListener('click', () => this.navigateHotspot(-1)); // Tambahkan event listener untuk tombol Prev
    buttonContainer.appendChild(prevButton);
  
    // Menyimpan referensi ke buttonText
    this.buttonText = document.createElement('span');
    this.buttonText.className = 'button-text';
    this.buttonText.id = 'button-text';
    this.buttonText.textContent = 'Home';
    buttonContainer.appendChild(this.buttonText);
  
    const nextButton = document.createElement('button');
    nextButton.className = 'nav-button';
    nextButton.id = 'next-button';
    nextButton.innerHTML = '&#9654;';
    nextButton.addEventListener('click', () => this.navigateHotspot(1)); // Tambahkan event listener untuk tombol Next
    buttonContainer.appendChild(nextButton);
  
    arOverlay.appendChild(buttonContainer);
    document.body.appendChild(arOverlay);

    // Tampilkan kartu untuk hotspot awal
    this.updateHotspotDisplay();
  }

// End Display setting ---------------------------------------------------------------------------------------------------

// Start Hotspots setting ---------------------------------------------------------------------------------------------------

  createHotspots() {
    this.hotspots = [
      {
        id: 'hotspot-1',
        header: 'Gunung Merbabu',
        description: 'Tempat selfie di awan, tapi hati-hati sama anginnya!',
        buttonText: '1',
        position: new THREE.Vector3(0.09546247159573645, 0.9310569885123317, -0.231406624188249)
      },
      {
        id: 'hotspot-2',
        header: 'Kolam Renang',
        description: 'Mau berenang gaya bebas atau gaya bebek?',
        buttonText: '2',
        position: new THREE.Vector3(-0.078248, 0.726219, 0.211533)
      },
      {
        id: 'hotspot-3',
        header: 'Pendopo Musyawarah',
        description: 'Debat seru sambil ngopi, siapa takut?',
        buttonText: '3',
        position: new THREE.Vector3(0.044428, 0.757730, 0.115406)
      },
      {
        id: 'hotspot-4',
        header: 'Gardupandang',
        description: 'Cantik banget looo, selfie yuk!',
        buttonText: '4',
        position: new THREE.Vector3(0.035713, 0.783458, -0.024299)
      },
      {
        id: 'hotspot-5',
        header: 'Lapangan',
        description: 'Hijau-hijau santai, main bola yuk!',
        buttonText: '5',
        position: new THREE.Vector3(-0.290048, 0.680778, 0.092284)
      },
      {
        id: 'hotspot-6',
        header: 'Toko-Toko',
        description: 'Belanja sampe dompet nyerah!',
        buttonText: '6',
        position: new THREE.Vector3(0.077897, 0.700875, 0.398748)
      },
      {
        id: 'hotspot-7',
        header: 'Tempat Nongkrong',
        description: 'Ngopi dulu, gosip nanti!',
        buttonText: '7',
        position: new THREE.Vector3(0.022113, 0.729798, 0.385995)
      },
      {
        id: 'hotspot-8',
        header: 'Parkir',
        description: 'Spot parkir luas dan aman. Mobil kamu juga butuh tempat istirahat yang nyaman!',
        buttonText: '8',
        position: new THREE.Vector3(0.404832, 0.803591, 0.000424)
      },
      {
        id: 'hotspot-9',
        header: 'Burung',
        description: 'Manusia kecil sekali dari sini',
        buttonText: '9',
        position: new THREE.Vector3(-0.000291, 0.937399, 0.303736)
      }
    ];

    this.hotspotElements = {};

    this.hotspots.forEach((hotspot, index) => {
      const container = document.createElement('div');
      container.className = 'container';
      container.id = hotspot.id;
      container.setAttribute('data-header', hotspot.header);
      container.setAttribute('data-description', hotspot.description || ''); // Default kosong jika tidak ada deskripsi

      // Hanya buat tombol view untuk hotspot dengan buttonText
      if (hotspot.buttonText) {
          const button = document.createElement('button');
          button.className = 'view-button';
          button.textContent = hotspot.buttonText;
          button.addEventListener('click', () => this.showHotspot(hotspot.id)); // Event listener untuk tombol view
          container.appendChild(button);
      }

      const card = document.createElement('div');
      card.className = 'card';
      card.style.display = 'none'; // Sembunyikan kartu secara default

      const cardHeader = document.createElement('div');
      cardHeader.className = 'card-header';
      cardHeader.textContent = hotspot.header;
      card.appendChild(cardHeader);

      const cardBody = document.createElement('div');
      cardBody.className = 'card-body';
      cardBody.textContent = hotspot.description || ''; // Default kosong jika tidak ada deskripsi
      card.appendChild(cardBody);

      container.appendChild(card);
      document.body.appendChild(container);

      this.hotspotElements[hotspot.id] = container;
    });
  }

  showHotspot(hotspotId) {
      Object.values(this.hotspotElements).forEach(element => {
          const card = element.querySelector('.card');
          if (card) {
              card.style.display = 'none';
          }
      });
      const selectedHotspot = this.hotspotElements[hotspotId];
      if (selectedHotspot) {
          const card = selectedHotspot.querySelector('.card');
          if (card) {
              card.style.display = 'block';
          }
      }
  }

  updateHotspotPositions() {
    if (this.currentModel) {
      this.hotspots.forEach(hotspot => {
        const div = this.hotspotElements[hotspot.id];
        if (div) {
          const position = this.currentModel.localToWorld(hotspot.position.clone());
          const vector = position.clone().project(this.camera);

          const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
          const y = -(vector.y * 0.5 - 0.5) * window.innerHeight;

          div.style.left = `${x}px`;
          div.style.top = `${y}px`;
        }
      });
    }
  }

  navigateHotspot(direction) {
    const totalHotspots = this.hotspots.length;
    if (totalHotspots === 0) return;

    this.currentHotspotIndex += direction;

    // Tangani batas indeks
    if (this.currentHotspotIndex < 0) {
        this.currentHotspotIndex = totalHotspots - 1; // Kembali ke hotspot terakhir
    } else if (this.currentHotspotIndex >= totalHotspots) {
        this.currentHotspotIndex = 0; // Kembali ke "Home"
    }

    // Tampilkan kartu setelah perubahan indeks
    this.updateHotspotDisplay();
  }

  updateHotspotDisplay() {
      // Sembunyikan semua hotspot dan kartu
      Object.values(this.hotspotElements).forEach(element => {
          element.style.display = 'none'; // Sembunyikan elemen utama

          // Sembunyikan kartu di setiap elemen
          const card = element.querySelector('.card');
          if (card) {
              card.style.display = 'none';
          }
      });

      // Tampilkan hotspot saat ini
      if (this.currentHotspotIndex === 0) {
          // Home: tidak menampilkan kartu dan tombol
          this.buttonText.textContent = 'Home';
      } else {
          const currentHotspot = this.hotspots[this.currentHotspotIndex - 1];
          if (currentHotspot) {
              const selectedHotspot = this.hotspotElements[currentHotspot.id];
              if (selectedHotspot) {
                  selectedHotspot.style.display = 'block'; // Tampilkan elemen utama

                  // Update teks pada button text dengan header hotspot yang aktif
                  if (this.buttonText) {
                      this.buttonText.textContent = currentHotspot.buttonText;
                  }

                  // Tampilkan kartu hotspot saat ini jika ada
                  if (currentHotspot.description) {
                      this.showHotspot(currentHotspot.id);
                  }
              }
          }
      }
  }

// End Hotspots setting ---------------------------------------------------------------------------------------------------

// Start Management Gesture Control --------------------------------------------------------------------------------
  
  addGestureControls() {
    let initialDistance = 0;
    let initialScale = 1;
    let isScaling = false;
    let isDragging = false;
    let isRotating = false;
    let lastTouchPosition = new THREE.Vector2();
    let lastTapTime = 0;
    let dragStartPosition = new THREE.Vector3();
    
    
    const onTouchStart = (event) => {
        const currentTime = new Date().getTime();
        const tapInterval = currentTime - lastTapTime;

        if (tapInterval < 300 && event.touches.length === 1) {  
            // Double tap detected
            dragStartPosition.copy(this.currentModel.position);
            lastTouchPosition.set(event.touches[0].clientX, event.touches[0].clientY);
            isDragging = true;
        } else if (event.touches.length === 2) {
            // Pinch gesture detected for scaling
            initialDistance = this.getDistance(event.touches[0], event.touches[1]);
            initialScale = this.currentModel.scale.x;
            isScaling = true;
            isDragging = false;
            isRotating = false;
        } else if (event.touches.length === 1 && !isDragging) {
            // Single tap detected for rotating
            lastTouchPosition.set(event.touches[0].clientX, event.touches[0].clientY);
            isRotating = true;
        }

        lastTapTime = currentTime;
    };

    const onTouchMove = (event) => {
        if (isScaling && event.touches.length === 2) {
            // Mengatur skala model berdasarkan pinch gesture
            const currentDistance = this.getDistance(event.touches[0], event.touches[1]);
            const scaleFactor = currentDistance / initialDistance;
            this.currentModel.scale.set(initialScale * scaleFactor, initialScale * scaleFactor, initialScale * scaleFactor);
        } else if (isDragging && event.touches.length === 1) {
            // Drag model setelah double tap
            const touchPosition = new THREE.Vector2(event.touches[0].clientX, event.touches[0].clientY);
            const deltaX = (touchPosition.x - lastTouchPosition.x) * 0.001;
            const deltaY = (touchPosition.y - lastTouchPosition.y) * 0.001;
            
            this.currentModel.position.set(
                dragStartPosition.x + deltaX,
                dragStartPosition.y - deltaY,
                dragStartPosition.z
            );
        } else if (isRotating && event.touches.length === 1) {
            // Rotasi model berdasarkan pergerakan layar
            const touchPosition = new THREE.Vector2(event.touches[0].clientX, event.touches[0].clientY);
            const deltaX = touchPosition.x - lastTouchPosition.x;

            // Rotate model on the x-axis (horizontal swipe)
            this.currentModel.rotation.y -= deltaX * 0.01;

            lastTouchPosition.set(touchPosition.x, touchPosition.y);
        }
    };

    const onTouchEnd = () => {
        isScaling = false;
        isDragging = false;
        isRotating = false;
    };

    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  }

  getDistance(touch1, touch2) {
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
  }

// End Management Gesture Control --------------------------------------------------------------------------------

}

// ------------------------------------------------End Class app --------------------------------------------------------------------------------

window.app = new App();
