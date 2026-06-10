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
modules/config.ts
```

Untuk mengganti model, ubah `projectConfig.model`. Untuk mengganti posisi atau isi card hotspot, ubah array `hotspots` pada file yang sama. Preview `<model-viewer>` dan mode AR Three.js menggunakan konfigurasi tersebut bersama-sama.

Pastikan koordinat hotspot dibuat untuk model, skala, dan orientasi yang tercantum pada konfigurasi. File aset harus ditempatkan di dalam `public/assets/`.

Tambahkan `imageUrl` pada hotspot untuk menggunakan gambar card dan detail yang berbeda:

```js
{
  header: "Pendopo",
  imageUrl: "./assets/hotspots/pendopo.webp",
  // konfigurasi hotspot lainnya
}
```

Jika `imageUrl` tidak diberikan, aplikasi menggunakan `projectConfig.app.defaultImageUrl`.

## Struktur CSS

`style.css` adalah entry stylesheet yang hanya mengimpor modul berikut secara berurutan:

- `styles/base.css`: reset, variabel dasar, canvas, dan model viewer.
- `styles/chrome.css`: topbar, menu, backdrop, dan banner koneksi.
- `styles/panels.css`: seluruh sheet, panduan, tentang, pengaturan, dan detail.
- `styles/ar-controls.css`: status, instruksi, reticle, toolbar, dan gesture AR.
- `styles/hotspots.css`: hotspot preview, hotspot AR, dan card.
- `styles/navigation.css`: navigasi bawah dan utility tampilan.
- `styles/responsive.css`: seluruh breakpoint responsive.

Pertahankan urutan import di `style.css` karena urutan tersebut mengikuti cascade stylesheet sebelumnya.

## Pemeriksaan Kode

```bash
npm run typecheck
npm run lint
npm run format:check
```

Cache service worker menggunakan versi aplikasi dan ID unik yang dibuat otomatis pada setiap build production.

Source aplikasi menggunakan TypeScript strict. Kontrak utama untuk konfigurasi proyek, hotspot, status AR,
gesture, Three.js, WebXR, dan elemen `<model-viewer>` berada di `modules/types.ts`. Workflow deployment
menjalankan typecheck dan lint sebelum build.

## Debug Hotspot AR

Tambahkan `?debugHotspots` pada URL untuk menampilkan marker merah pada seluruh anchor hotspot Three.js:

```text
https://alamat-aplikasi.example/?debugHotspots
```

Jika marker merah menempel pada model tetapi label HTML tidak, masalah berada pada proyeksi layar. Jika marker merah juga salah, koordinat hotspot perlu dikalibrasi.
