import type { HotspotConfig, ProjectConfig } from "./types";

// Edit this file when replacing the model, hotspot coordinates, or card content.
// Add imageUrl to a hotspot to use a location-specific card and detail image.
// Keep anchor and camera mobile/desktop complete so each viewport uses its own recorded composition.
const hotspotDefinitions: Omit<HotspotConfig, "buttonText">[] = [
  {
    header: "Gunung Merbabu",
    description: "Tempat selfie di awan, tapi hati-hati sama anginnya!",
    detail:
      "Gunung Merbabu menjadi latar utama kawasan Dungkluruk. Titik ini cocok untuk menikmati bentuk pegunungan, mengenali arah kawasan, dan mengambil foto dari sudut pandang yang lebih luas.",
    anchor: {
      mobile: {
        position: { x: 3.858768, y: 26.354936, z: -7.223618 },
        normal: { x: 0.692945, y: 0.667933, z: 0.271466 },
      },
      desktop: {
        position: { x: 3.953391, y: 26.35552, z: -7.466591 },
        normal: { x: 0.692945, y: 0.667933, z: 0.271466 },
      },
    },
    camera: {
      mobile: {
        orbit: "-248.4614deg 62.3834deg 125.4799m",
        target: "-7.0734m 19.7626m -0.5718m",
        fieldOfView: "6.27deg",
      },
      desktop: {
        orbit: "-246.4235deg 69.2596deg 61.5407m",
        target: "0.4473m 21.7673m -0.8085m",
        fieldOfView: "11.73deg",
      },
    },
  },
  {
    header: "Pendopo",
    description: "Debat seru sambil ngopi, siapa takut?",
    detail:
      "Pendopo merupakan area berkumpul dan beristirahat. Pengunjung dapat duduk santai, berbincang, serta menikmati suasana kawasan sebelum melanjutkan perjalanan ke titik wisata lainnya.",
    anchor: {
      mobile: {
        position: { x: 1.663837, y: 22.463406, z: 0.771796 },
        normal: { x: -0.794457, y: 0.607311, z: -0.00341 },
      },
      desktop: {
        position: { x: 1.547442, y: 22.309502, z: 0.479575 },
        normal: { x: -0.794457, y: 0.607311, z: -0.00341 },
      },
    },
    camera: {
      mobile: {
        orbit: "-388.2488deg 85.3661deg 124.5759m",
        target: "1.4882m 22.1636m 0.3378m",
        fieldOfView: "0.90deg",
      },
      desktop: {
        orbit: "-36.4900deg 79.5103deg 80.5908m",
        target: "1.2141m 22.1996m 0.7530m",
        fieldOfView: "1.06deg",
      },
    },
  },
  {
    header: "Parkir",
    description: "Spot parkir luas dan aman. Mobil kamu juga butuh tempat istirahat yang nyaman!",
    detail:
      "Area parkir menjadi titik awal kunjungan ke Dungkluruk. Lokasinya dirancang agar kendaraan dapat ditempatkan dengan rapi sebelum pengunjung menjelajahi kawasan wisata.",
    anchor: {
      mobile: {
        position: { x: 0.688341, y: 20.306925, z: 11.158812 },
        normal: { x: -0.854443, y: 0.513779, z: 0.077186 },
      },
      desktop: {
        position: { x: 1.123256, y: 20.233448, z: 10.605749 },
        normal: { x: 0.961089, y: 0.276232, z: -0.001861 },
      },
    },
    camera: {
      mobile: {
        orbit: "-415.7612deg 71.8955deg 125.0147m",
        target: "0.9564m 20.3481m 10.7398m",
        fieldOfView: "1.65deg",
      },
      desktop: {
        orbit: "51.6657deg 72.1298deg 42.6316m",
        target: "1.7261m 20.2837m 9.6610m",
        fieldOfView: "4.04deg",
      },
    },
  },
  {
    header: "Toko-Toko",
    description: "Belanja sampe dompet nyerah!",
    detail:
      "Area toko menyediakan tempat bagi pengunjung untuk melihat dan membeli produk yang tersedia di kawasan Dungkluruk. Titik ini dapat dikunjungi sebelum pulang atau setelah selesai berkeliling.",
    anchor: {
      mobile: {
        position: { x: 1.702419, y: 20.559653, z: 8.569369 },
        normal: { x: -0.83761, y: 0.0, z: 0.546269 },
      },
      desktop: {
        position: { x: 1.54325, y: 20.510018, z: 8.567543 },
        normal: { x: -0.83761, y: 0.0, z: 0.546269 },
      },
    },
    camera: {
      mobile: {
        orbit: "-437.9957deg 92.1606deg 126.7714m",
        target: "1.3259m 20.8756m 8.5629m",
        fieldOfView: "0.65deg",
      },
      desktop: {
        orbit: "-64.3717deg 84.4306deg 53.0102m",
        target: "-0.4807m 20.9265m 9.3984m",
        fieldOfView: "2.07deg",
      },
    },
  },
  {
    header: "Gardu Pandang",
    description: "Hijau-hijau santai, selfie yuk!",
    detail:
      "Gardu Pandang menawarkan tempat untuk melihat kawasan dari sudut yang lebih terbuka. Area ini cocok untuk bersantai, menikmati pemandangan hijau, dan mengambil foto.",
    anchor: {
      mobile: {
        position: { x: -0.084654, y: 21.950637, z: -2.575135 },
        normal: { x: 0.28815, y: 0.0, z: 0.957585 },
      },
      desktop: {
        position: { x: -0.229379, y: 21.984686, z: -2.531585 },
        normal: { x: 0.28815, y: 0.0, z: 0.957585 },
      },
    },
    camera: {
      mobile: {
        orbit: "-316.9765deg 68.1340deg 122.6848m",
        target: "0.6138m 21.9310m -1.9474m",
        fieldOfView: "1.17deg",
      },
      desktop: {
        orbit: "56.9960deg 78.6902deg 79.5809m",
        target: "-5.2094m 20.9343m -5.8023m",
        fieldOfView: "1.06deg",
      },
    },
  },
  {
    header: "Camping Ground",
    description: "Nikmati suasana alam dan bermalam di area terbuka.",
    detail:
      "Camping Ground merupakan area untuk berkemah dan menikmati suasana alam Dungkluruk. Titik ini cocok untuk kegiatan kelompok, bersantai, dan menikmati kawasan lebih lama.",
    anchor: {
      mobile: {
        position: { x: -6.341875, y: 19.780554, z: 0.054555 },
        normal: { x: 0.0, y: 1.0, z: 0.0 },
      },
      desktop: {
        position: { x: -6.179244, y: 19.780554, z: -0.379421 },
        normal: { x: 0, y: 1, z: 0 },
      },
    },
    camera: {
      mobile: {
        orbit: "-391.8134deg 71.6591deg 125.3512m",
        target: "-5.1511m 19.7790m -0.3813m",
        fieldOfView: "1.78deg",
      },
      desktop: {
        orbit: "-755.2630deg 79.5103deg 97.9416m",
        target: "-5.5006m 19.7806m -0.8659m",
        fieldOfView: "1.81deg",
      },
    },
  },
  {
    header: "Kalipasang",
    description: "Ini hutan pohon pinus!",
    detail:
      "Kalipasang merupakan area yang dikelilingi pepohonan pinus. Suasananya teduh dan cocok untuk menikmati udara segar serta mengenali karakter alam kawasan Dungkluruk.",
    anchor: {
      mobile: {
        position: { x: 6.48737, y: 23.28489, z: 7.446827 },
        normal: { x: 0.507746, y: 0.383248, z: 0.771566 },
      },
      desktop: {
        position: { x: 8.659131, y: 22.476558, z: 5.398724 },
        normal: { x: 0.306633, y: 0.726197, z: 0.615316 },
      },
    },
    camera: {
      mobile: {
        orbit: "-348.0141deg 92.2787deg 128.7710m",
        target: "3.5511m 24.0298m -5.3175m",
        fieldOfView: "2.96deg",
      },
      desktop: {
        orbit: "55.7659deg 93.8446deg 52.0852m",
        target: "6.4806m 22.8265m 2.8836m",
        fieldOfView: "7.86deg",
      },
    },
  },
  {
    header: "Kolam Renang",
    description: "Ayooooo!!!!",
    detail:
      "Kolam renang menjadi salah satu fasilitas rekreasi di kawasan Dungkluruk. Titik ini dapat digunakan pengunjung untuk bermain air dan beristirahat bersama keluarga.",
    anchor: {
      mobile: {
        position: { x: -1.826464, y: 21.013066, z: 2.719041 },
        normal: { x: 0.244396, y: 0.483645, z: 0.840451 },
      },
      desktop: {
        position: { x: -2.127492, y: 21.000791, z: 1.888558 },
        normal: { x: 0.0, y: 1.0, z: 0.0 },
      },
    },
    camera: {
      mobile: {
        orbit: "-329.4034deg 75.9722deg 116.7016m",
        target: "-2.0567m 20.9554m 2.8750m",
        fieldOfView: "1.25deg",
      },
      desktop: {
        orbit: "33.2146deg 80.7403deg 61.6549m",
        target: "-3.0064m 21.0423m 1.4772m",
        fieldOfView: "1.59deg",
      },
    },
  },
  {
    header: "Musholla",
    description: "Ada tempat ibadah juga lo",
    detail:
      "Musholla menyediakan tempat ibadah bagi pengunjung selama berada di kawasan wisata. Lokasinya dapat dikenali melalui model agar lebih mudah ditemukan saat berkunjung.",
    anchor: {
      mobile: {
        position: { x: 2.171349, y: 22.238032, z: -1.3259 },
        normal: { x: -0.707307, y: 0.0, z: 0.706907 },
      },
      desktop: {
        position: { x: 2.150201, y: 22.225674, z: -1.341543 },
        normal: { x: -0.707307, y: 0.0, z: 0.706907 },
      },
    },
    camera: {
      mobile: {
        orbit: "-425.0174deg 81.8409deg 126.6832m",
        target: "3.4573m 21.9108m -1.9712m",
        fieldOfView: "0.55deg",
      },
      desktop: {
        orbit: "-64.7818deg 80.7403deg 60.6149m",
        target: "2.0445m 22.1409m -1.3067m",
        fieldOfView: "1.06deg",
      },
    },
  },
  {
    header: "Burung",
    description: "Disini dingin dan sejukk",
    detail:
      "Titik burung menghadirkan suasana sejuk dan elemen alam yang menjadi bagian dari pengalaman kawasan Dungkluruk. Area ini dapat diamati sambil menikmati lingkungan sekitar.",
    anchor: {
      mobile: {
        position: { x: 1.042696, y: 26.249599, z: 4.763269 },
        normal: { x: -0.319226, y: 0.931551, z: 0.174089 },
      },
      desktop: {
        position: { x: -0.936731, y: 26.569499, z: 6.121687 },
        normal: { x: 0.411589, y: 0.853291, z: -0.320138 },
      },
    },
    camera: {
      mobile: {
        orbit: "-120.7659deg 88.3596deg 128.7710m",
        target: "5.9542m 23.6800m 8.2810m",
        fieldOfView: "2.74deg",
      },
      desktop: {
        orbit: "-656.4466deg 78.2636deg 123.6043m",
        target: "1.2483m 25.4218m 6.3380m",
        fieldOfView: "3.53deg",
      },
    },
  },
];

const hotspotOrder = [
  "Gunung Merbabu",
  "Kalipasang",
  "Parkir",
  "Toko-Toko",
  "Kolam Renang",
  "Pendopo",
  "Musholla",
  "Gardu Pandang",
  "Camping Ground",
  "Burung",
];

export const hotspots: HotspotConfig[] = hotspotOrder.map((header, index) => {
  const hotspot = hotspotDefinitions.find((item) => item.header === header);

  if (!hotspot) {
    throw new Error(`Konfigurasi hotspot "${header}" tidak ditemukan.`);
  }

  return {
    ...hotspot,
    buttonText: String(index + 1),
  };
});

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
    desktopBreakpoint: 800,
    mobile: {
      homeOrbit: "-439.5deg 53.60deg 117.12m",
      homeTarget: "-11.11m 20.55m 1.58m",
      fieldOfView: "12.6deg",
    },
    desktop: {
      homeOrbit: "-36.9deg 75.41deg 51.74m",
      homeTarget: "-1.12m 21.72m 1.19m",
      fieldOfView: "20deg",
    },
    minFieldOfView: "0deg",
    maxFieldOfView: "45deg",
    exposure: "1",
    shadowIntensity: "2",
    cameraTransitionMs: 1800,
  },
  hotspots,
};
