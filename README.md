# Dungkluruk AR

Aplikasi WebXR dan Quick Look untuk menampilkan model wisata Dungkluruk.

## Menjalankan Proyek

Prasyarat: Node.js 18 atau lebih baru.

```bash
npm install
npm run dev
```

WebXR memerlukan secure context. Gunakan HTTPS ketika menguji dari perangkat lain.

## Build Production

```bash
npm run build
npm run preview
```

Hasil build tersedia di direktori `dist/`.

Build production mendaftarkan service worker dan menyimpan aset AR aktif agar dapat digunakan kembali ketika koneksi lemah atau terputus setelah kunjungan online pertama.

## Mengganti Model dan Hotspot

Semua konfigurasi model, kamera preview, hotspot, dan isi card berada di:

```text
modules/config.js
```

Untuk mengganti model, ubah `projectConfig.model`. Untuk mengganti posisi atau isi card hotspot, ubah array `hotspots` pada file yang sama. Preview `<model-viewer>` dan mode AR Three.js menggunakan konfigurasi tersebut bersama-sama.

Pastikan koordinat hotspot dibuat untuk model, skala, dan orientasi yang tercantum pada konfigurasi. File aset harus ditempatkan di dalam `public/assets/`.

## Debug Hotspot AR

Tambahkan `?debugHotspots` pada URL untuk menampilkan marker merah pada seluruh anchor hotspot Three.js:

```text
https://alamat-aplikasi.example/?debugHotspots
```

Jika marker merah menempel pada model tetapi label HTML tidak, masalah berada pada proyeksi layar. Jika marker merah juga salah, koordinat hotspot perlu dikalibrasi.
