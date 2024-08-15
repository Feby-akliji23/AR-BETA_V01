document.addEventListener('DOMContentLoaded', () => {
    const viewButtons = document.querySelectorAll('.view-button');
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');
    const annotationTitle = document.getElementById('button-text');
    const modelViewer = document.getElementById('model-viewer');
    const buttonLoad = document.getElementById('button-load');
    const lazyLoad = document.getElementById('lazy-load');

    let currentIndex = -1;

    // Menyimpan posisi default kamera
    modelViewer.dataset.defaultOrbit = modelViewer.getAttribute('camera-orbit') || '0deg 0deg 1m';
    modelViewer.dataset.defaultTarget = modelViewer.getAttribute('camera-target') || '0deg 0deg 0m';

    const updateCameraPosition = (orbit, target) => {
        modelViewer.setAttribute('camera-orbit', orbit);
        modelViewer.setAttribute('camera-target', target);
        modelViewer.setAttribute('field-of-view', '45deg'); // Menetapkan field-of-view untuk zoom
    };

    const showAnnotation = (index) => {
        // Sembunyikan semua kartu dan tombol view
        document.querySelectorAll('.card').forEach(card => card.style.display = 'none');
        viewButtons.forEach(button => button.style.display = 'none');

        if (index !== -1) {
            const button = viewButtons[index];
            const container = button.closest('.container');
            const card = container.querySelector('.card');

            // Perbarui konten card dan posisi kamera
            if (card) {
                card.querySelector('.card-header').innerText = container.dataset.header;
                card.querySelector('.card-body').innerText = container.dataset.description;
                updateCameraPosition(container.dataset.orbit, container.dataset.target);

                card.style.display = 'block';
                button.style.display = 'block'; // Tampilkan view button hanya untuk hotspot aktif
            }
            annotationTitle.innerText = button.innerText;
        } else {
            annotationTitle.innerText = 'Home';
            // Kembalikan ke posisi kamera default
            updateCameraPosition(modelViewer.dataset.defaultOrbit, modelViewer.dataset.defaultTarget);
        }
    };

    viewButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            currentIndex = index;
            showAnnotation(index);
        });
    });

    prevButton.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex -= 1;
        } else {
            currentIndex = -1; // Kembali ke Home
        }
        showAnnotation(currentIndex);
    });

    nextButton.addEventListener('click', () => {
        if (currentIndex < viewButtons.length - 1) {
            currentIndex += 1;
        } else {
            currentIndex = -1; // Kembali ke Home
        }
        showAnnotation(currentIndex);
    });

    // Inisialisasi fungsi untuk dismiss poster saat button-load diklik
    buttonLoad.addEventListener('click', () => {
        if (modelViewer && modelViewer.dismissPoster) {
            modelViewer.dismissPoster(); // Memanggil metode dismissPoster pada model-viewer
        } else {
            console.warn('ModelViewer element or dismissPoster method not found!');
        }
    });

    // Menambahkan event listener untuk mencegah interaksi dengan button-container dari mempengaruhi scene XR
    const buttonContainer = document.querySelector('.button-container');
    buttonContainer.addEventListener('beforexrselect', (ev) => {
        // Keep button container interactions from affecting the XR scene.
        ev.preventDefault();
    });

    // Inisialisasi state awal
    showAnnotation(currentIndex);
});