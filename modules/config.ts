import type { HotspotConfig, ProjectConfig } from "./types";

// Edit this file when replacing the model, hotspot coordinates, or card content.
// Add imageUrl to a hotspot to use a location-specific card and detail image.
export const hotspots: HotspotConfig[] = [
  {
    header: "Gunung Merbabu",
    description: "Tempat selfie di awan, tapi hati-hati sama anginnya!",
    detail:
      "Gunung Merbabu menjadi latar utama kawasan Dungkluruk. Titik ini cocok untuk menikmati bentuk pegunungan, mengenali arah kawasan, dan mengambil foto dari sudut pandang yang lebih luas.",
    buttonText: "1",
    position: { x: 4.001204083929885, y: 26.29044782318403, z: -7.576518356271297 },
    normal: { x: 0.9583949229154289, y: 0.28518029974809406, z: -0.012303185177678339 },
    orbit: { theta: -587.2, phi: 53.35, radius: 0.4508 },
  },
  {
    header: "Pendopo",
    description: "Debat seru sambil ngopi, siapa takut?",
    detail:
      "Pendopo merupakan area berkumpul dan beristirahat. Pengunjung dapat duduk santai, berbincang, serta menikmati suasana kawasan sebelum melanjutkan perjalanan ke titik wisata lainnya.",
    buttonText: "2",
    position: { x: 0.8204172344029178, y: 21.66520283278558, z: 1.4877552197933657 },
    normal: { x: -0.002881495514782262, y: 0.9975028976090841, z: -0.07056675027999836 },
    orbit: { theta: -762.7, phi: 78.36, radius: 0.0745 },
  },
  {
    header: "Parkir",
    description: "Spot parkir luas dan aman. Mobil kamu juga butuh tempat istirahat yang nyaman!",
    detail:
      "Area parkir menjadi titik awal kunjungan ke Dungkluruk. Lokasinya dirancang agar kendaraan dapat ditempatkan dengan rapi sebelum pengunjung menjelajahi kawasan wisata.",
    buttonText: "3",
    position: { x: 1.7028595141628546, y: 19.722714012765074, z: 10.249387170551268 },
    normal: { x: -0.000016043532115207673, y: 0.9999933039653356, z: 0.0036594763419203927 },
    orbit: { theta: -768.9, phi: 83.69, radius: 0.0854 },
  },
  {
    header: "Toko-Toko",
    description: "Belanja sampe dompet nyerah!",
    detail:
      "Area toko menyediakan tempat bagi pengunjung untuk melihat dan membeli produk yang tersedia di kawasan Dungkluruk. Titik ini dapat dikunjungi sebelum pulang atau setelah selesai berkeliling.",
    buttonText: "4",
    position: { x: -0.47837003604934036, y: 20.120113955508256, z: 9.011082740234205 },
    normal: { x: 0, y: 1, z: 0 },
    orbit: { theta: -724.2, phi: 92.3, radius: 0.014 },
  },
  {
    header: "Gardu Pandang",
    description: "Hijau-hijau santai, selfie yuk!",
    detail:
      "Gardu Pandang menawarkan tempat untuk melihat kawasan dari sudut yang lebih terbuka. Area ini cocok untuk bersantai, menikmati pemandangan hijau, dan mengambil foto.",
    buttonText: "5",
    position: { x: 0.35245450788302257, y: 21.937760624065508, z: -1.9036189419698744 },
    normal: { x: 0, y: 1, z: 0 },
    orbit: { theta: -677.5, phi: 79.59, radius: 0.0385 },
  },
  {
    header: "Camping Ground",
    description: "Nikmati suasana alam dan bermalam di area terbuka.",
    detail:
      "Camping Ground merupakan area untuk berkemah dan menikmati suasana alam Dungkluruk. Titik ini cocok untuk kegiatan kelompok, bersantai, dan menikmati kawasan lebih lama.",
    buttonText: "6",
    position: { x: -8.310236632004266, y: 19.780554063059526, z: 0.21750764694348934 },
    normal: { x: 0, y: 1, z: 0 },
    orbit: { theta: -680, phi: 78, radius: 0.12 },
  },
  {
    header: "Kalipasang",
    description: "Ini hutan pohon pinus!",
    detail:
      "Kalipasang merupakan area yang dikelilingi pepohonan pinus. Suasananya teduh dan cocok untuk menikmati udara segar serta mengenali karakter alam kawasan Dungkluruk.",
    buttonText: "7",
    position: { x: 8.48367964000954, y: 23.155931226558277, z: 5.245181469693904 },
    normal: { x: 0.4262558765740387, y: 0.8356732041033118, z: 0.3463469700023412 },
    orbit: { theta: -590.1, phi: 94.35, radius: 0.23589 },
  },
  {
    header: "Kolam Renang",
    description: "Ayooooo!!!!",
    detail:
      "Kolam renang menjadi salah satu fasilitas rekreasi di kawasan Dungkluruk. Titik ini dapat digunakan pengunjung untuk bermain air dan beristirahat bersama keluarga.",
    buttonText: "8",
    position: { x: -1.8912076473628905, y: 20.94813294683695, z: 4.1676967998225525 },
    normal: { x: 0, y: 1, z: 0 },
    orbit: { theta: -745.5, phi: 66.06, radius: 0.0399 },
  },
  {
    header: "Musholla",
    description: "Ada tempat ibadah juga lo",
    detail:
      "Musholla menyediakan tempat ibadah bagi pengunjung selama berada di kawasan wisata. Lokasinya dapat dikenali melalui model agar lebih mudah ditemukan saat berkunjung.",
    buttonText: "9",
    position: { x: 2.3831798957405517, y: 21.915633428341508, z: -1.2808847476189316 },
    normal: { x: -0.005493310260679063, y: 0, z: 0.9999849116573609 },
    orbit: { theta: -766.7, phi: 70.47, radius: 0.05839 },
  },
  {
    header: "Burung",
    description: "Disini dingin dan sejukk",
    detail:
      "Titik burung menghadirkan suasana sejuk dan elemen alam yang menjadi bagian dari pengalaman kawasan Dungkluruk. Area ini dapat diamati sambil menikmati lingkungan sekitar.",
    buttonText: "10",
    position: { x: -0.9261015353557247, y: 26.526461075157442, z: 6.111009934763576 },
    normal: { x: -0.5027406667757237, y: -0.7785388538152094, z: 0.37567149887900825 },
    orbit: { theta: -654.8, phi: 67.19, radius: 0.356 },
  },
];

export const projectConfig: ProjectConfig = {
  app: {
    title: "Dungkluruk AR",
    modelName: "Dungkluruk",
    version: "2.0.0",
    defaultImageUrl: "./assets/dungkluruk.webp",
  },
  model: {
    glbUrl: "./assets/dungkluruk.glb",
    usdzUrl: "./assets/dungkluruk.usdz",
    environmentUrl: "./assets/whipple_creek_regional_park_04_1k.hdr",
    dracoDecoderUrl: "./assets/draco/",
    alt: "Dungkluruk",
    scale: 0.025,
    orientation: [0, 0, 0],
    interactionPlaneY: 0,
  },
  preview: {
    scale: 1,
    desktopBreakpoint: 760,
    mobile: {
      homeOrbit: "-321.9deg 78.69deg 59.08m",
      homeTarget: "0m 20m 0m",
      fieldOfView: "17.6deg",
      hotspotOrbitRadiusScale: 59.08,
    },
    desktop: {
      homeOrbit: "-321.9deg 78.69deg 72m",
      homeTarget: "0m 20m 0m",
      fieldOfView: "20deg",
      hotspotOrbitRadiusScale: 68,
    },
    minFieldOfView: "10deg",
    maxFieldOfView: "45deg",
    exposure: "1",
    shadowIntensity: "2",
    cameraTransitionMs: 1800,
  },
  hotspots,
};
