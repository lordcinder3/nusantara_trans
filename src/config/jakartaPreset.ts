import * as turf from '@turf/turf';
import type {
  CityId,
  DepotNode,
  FloodZone,
  StopNode,
  ZoneCategory,
} from '../types/game';

export const JAKARTA_CENTER_COORDS: [number, number] = [106.8317, -6.2088];
export const DEFAULT_ZOOM = 12.2;

// Expanded Jabodetabek Bounds: Tangerang/BSD (West) to Bekasi/Cikarang (East),
// North Jakarta/PIK (North) to Depok & Bogor Kota (South)!
export const JABODETABEK_MAX_BOUNDS: [[number, number], [number, number]] = [
  [106.48, -6.68],
  [107.22, -6.05],
];

export interface CityLandmarkHotspot {
  id: string;
  name: string;
  coords: [number, number];
  category: ZoneCategory;
  demandLabel: string;
}

export interface CityPresetConfig {
  id: CityId;
  name: string;
  subtitle: string;
  platePrefix: string;
  center: [number, number];
  defaultZoom: number;
  minZoom: number;
  maxBounds: [[number, number], [number, number]];
  specialRuleLabel: string;
  angkotSpeedBonusMult: number;
  globalSpeedBonusMult: number;
  fareToleranceThresholdRp: number;
  depots: DepotNode[];
  floodZones: FloodZone[];
  hotspots: CityLandmarkHotspot[];
  neighborhoodCentroids: { name: string; coords: [number, number] }[];
  sandboxHubs: StopNode[];
}

export const INITIAL_JAKARTA_STOPS: StopNode[] = [
  {
    id: 'hub-manggarai',
    name: 'Stasiun Manggarai',
    coords: [106.8502, -6.2098],
    category: 'perumahan',
    level: 2,
    isPrebuiltHub: true,
    catchmentRadiusM: 500,
    baseDemandWeight: 2.8,
    buildingCount: 142,
    demandTier: 'Tinggi',
    waitingBatches: [{ id: 'init-1', count: 18, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
    totalWaiting: 18,
    transitWaiting: 0,
    totalTransfersHandled: 0,
    ojolLostCount: 0,
  },
  {
    id: 'hub-cikini',
    name: 'Stasiun Cikini',
    coords: [106.8413, -6.1984],
    category: 'perumahan',
    level: 2,
    isPrebuiltHub: true,
    catchmentRadiusM: 500,
    baseDemandWeight: 2.1,
    buildingCount: 96,
    demandTier: 'Tinggi',
    waitingBatches: [{ id: 'init-2', count: 11, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
    totalWaiting: 11,
    transitWaiting: 0,
    totalTransfersHandled: 0,
    ojolLostCount: 0,
  },
  {
    id: 'hub-bundaran-hi',
    name: 'Bundaran HI / Thamrin',
    coords: [106.823, -6.195],
    category: 'kantor',
    level: 2,
    isPrebuiltHub: true,
    catchmentRadiusM: 500,
    baseDemandWeight: 3.0,
    buildingCount: 118,
    demandTier: 'Tinggi',
    waitingBatches: [{ id: 'init-3', count: 14, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
    totalWaiting: 14,
    transitWaiting: 0,
    totalTransfersHandled: 0,
    ojolLostCount: 0,
  },
  {
    id: 'hub-sudirman',
    name: 'Dukuh Atas / Sudirman',
    coords: [106.8228, -6.2046],
    category: 'kantor',
    level: 2,
    isPrebuiltHub: true,
    catchmentRadiusM: 500,
    baseDemandWeight: 2.9,
    buildingCount: 124,
    demandTier: 'Tinggi',
    waitingBatches: [{ id: 'init-4', count: 15, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
    totalWaiting: 15,
    transitWaiting: 0,
    totalTransfersHandled: 0,
    ojolLostCount: 0,
  },
  {
    id: 'hub-tanah-abang',
    name: 'Pasar & St. Tanah Abang',
    coords: [106.8108, -6.1857],
    category: 'pasar',
    level: 2,
    isPrebuiltHub: true,
    catchmentRadiusM: 500,
    baseDemandWeight: 2.9,
    buildingCount: 165,
    demandTier: 'Tinggi',
    waitingBatches: [{ id: 'init-5', count: 19, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
    totalWaiting: 19,
    transitWaiting: 0,
    totalTransfersHandled: 0,
    ojolLostCount: 0,
  },
  {
    id: 'hub-senen',
    name: 'Terminal & Pasar Senen',
    coords: [106.8441, -6.1747],
    category: 'pasar',
    level: 2,
    isPrebuiltHub: true,
    catchmentRadiusM: 500,
    baseDemandWeight: 2.6,
    buildingCount: 134,
    demandTier: 'Tinggi',
    waitingBatches: [{ id: 'init-6', count: 16, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
    totalWaiting: 16,
    transitWaiting: 0,
    totalTransfersHandled: 0,
    ojolLostCount: 0,
  },
  {
    id: 'hub-margonda-depok',
    name: 'Stasiun Depok Baru / Margonda',
    coords: [106.8225, -6.3915],
    category: 'perumahan',
    level: 2,
    isPrebuiltHub: true,
    catchmentRadiusM: 500,
    baseDemandWeight: 2.6,
    buildingCount: 128,
    demandTier: 'Tinggi',
    waitingBatches: [{ id: 'init-7', count: 15, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
    totalWaiting: 15,
    transitWaiting: 0,
    totalTransfersHandled: 0,
    ojolLostCount: 0,
  },
  {
    id: 'hub-stasiun-bogor',
    name: 'Stasiun Bogor / Alun-Alun',
    coords: [106.7905, -6.5955],
    category: 'pasar',
    level: 2,
    isPrebuiltHub: true,
    catchmentRadiusM: 500,
    baseDemandWeight: 2.7,
    buildingCount: 136,
    demandTier: 'Tinggi',
    waitingBatches: [{ id: 'init-8', count: 16, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
    totalWaiting: 16,
    transitWaiting: 0,
    totalTransfersHandled: 0,
    ojolLostCount: 0,
  },
  {
    id: 'hub-bekasi',
    name: 'Stasiun Bekasi / Summarecon',
    coords: [106.9995, -6.2362],
    category: 'perumahan',
    level: 2,
    isPrebuiltHub: true,
    catchmentRadiusM: 500,
    baseDemandWeight: 2.6,
    buildingCount: 132,
    demandTier: 'Tinggi',
    waitingBatches: [{ id: 'init-9', count: 15, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
    totalWaiting: 15,
    transitWaiting: 0,
    totalTransfersHandled: 0,
    ojolLostCount: 0,
  },
  {
    id: 'hub-bsd-tangerang',
    name: 'Intermoda BSD / Serpong',
    coords: [106.6435, -6.3195],
    category: 'kantor',
    level: 2,
    isPrebuiltHub: true,
    catchmentRadiusM: 500,
    baseDemandWeight: 2.5,
    buildingCount: 115,
    demandTier: 'Tinggi',
    waitingBatches: [{ id: 'init-10', count: 14, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
    totalWaiting: 14,
    transitWaiting: 0,
    totalTransfersHandled: 0,
    ojolLostCount: 0,
  },
];

export const INITIAL_JAKARTA_DEPOTS: DepotNode[] = [
  {
    id: 'depot-cikini',
    name: 'Pool Cikini / Manggarai Kecil',
    areaName: 'Jakarta Pusat (Garasi Awal)',
    coords: [106.8462, -6.2038],
    capacitySlots: 6,
    unlockCostRp: 0,
    unlocked: true,
  },
  {
    id: 'depot-pesing',
    name: 'Pool Pesing – Daan Mogot (Barat/Tangerang)',
    areaName: 'Koridor Jakarta Barat & Tangerang (+10 Slot)',
    coords: [106.7545, -6.1615],
    capacitySlots: 10,
    unlockCostRp: 45_000_000,
    unlocked: false,
  },
  {
    id: 'depot-cawang',
    name: 'Pool Cawang – Bekasi Raya (Timur)',
    areaName: 'Koridor Jakarta Timur & Bekasi (+15 Slot)',
    coords: [106.8905, -6.2425],
    capacitySlots: 15,
    unlockCostRp: 75_000_000,
    unlocked: false,
  },
  {
    id: 'depot-kramat-jati',
    name: 'Pool Induk Kramat Jati – Depok/Bogor',
    areaName: 'Koridor Selatan, Depok & Bogor (+30 Slot)',
    coords: [106.8555, -6.3115],
    capacitySlots: 30,
    unlockCostRp: 140_000_000,
    unlocked: false,
  },
];

// Comprehensive coordinate table of 90+ Jabodetabek locations
// (Jakarta, Bogor, Depok, Tangerang, Tangsel, Bekasi)
export const JAKARTA_NEIGHBORHOOD_CENTROIDS: {
  name: string;
  coords: [number, number];
}[] = [
  // Jakarta Barat & Utara
  { name: 'Grogol', coords: [106.7885, -6.1665] },
  { name: 'Tomang', coords: [106.7955, -6.1745] },
  { name: 'Jelambar', coords: [106.7835, -6.1585] },
  { name: 'Jelambar Baru', coords: [106.7825, -6.1505] },
  { name: 'Tanjung Duren', coords: [106.7825, -6.1745] },
  { name: 'Duri Kepa', coords: [106.7715, -6.1785] },
  { name: 'Pesing / Kedoya', coords: [106.7645, -6.1625] },
  { name: 'Cengkareng / Kalideres', coords: [106.7155, -6.1525] },
  { name: 'Puri Indah / Kembangan', coords: [106.7365, -6.1885] },
  { name: 'Palmerah', coords: [106.7965, -6.2045] },
  { name: 'Slipi', coords: [106.7985, -6.1945] },
  { name: 'Kemanggisan', coords: [106.7845, -6.1955] },
  { name: 'Kebon Jeruk', coords: [106.7675, -6.1925] },
  { name: 'Jembatan Besi', coords: [106.7955, -6.1535] },
  { name: 'Angke / Tambora', coords: [106.7975, -6.1455] },
  { name: 'Cideng', coords: [106.8115, -6.1745] },
  { name: 'Glodok / Kota Tua', coords: [106.8145, -6.1425] },
  { name: 'PIK / Muara Karang', coords: [106.7525, -6.1125] },
  { name: 'Pluit / Penjaringan', coords: [106.7925, -6.1255] },
  { name: 'Ancol / Pademangan', coords: [106.8355, -6.1285] },
  { name: 'Tanjung Priok', coords: [106.8825, -6.1185] },
  { name: 'Kelapa Gading', coords: [106.9055, -6.1585] },
  { name: 'Sunter', coords: [106.8625, -6.1455] },

  // Jakarta Pusat
  { name: 'Petojo', coords: [106.8165, -6.1685] },
  { name: 'Harmoni', coords: [106.8203, -6.166] },
  { name: 'Gambir / Monas', coords: [106.8295, -6.1765] },
  { name: 'Kebon Sirih', coords: [106.8305, -6.1845] },
  { name: 'Thamrin / Sarinah', coords: [106.8235, -6.1885] },
  { name: 'Bundaran HI', coords: [106.823, -6.195] },
  { name: 'Tanah Abang', coords: [106.8108, -6.1857] },
  { name: 'Petamburan', coords: [106.8065, -6.1965] },
  { name: 'Dukuh Atas / Sudirman', coords: [106.8228, -6.2046] },
  { name: 'Bendungan Hilir', coords: [106.8115, -6.2125] },
  { name: 'Menteng', coords: [106.8335, -6.1965] },
  { name: 'Cikini', coords: [106.8413, -6.1984] },
  { name: 'Salemba / Kenari', coords: [106.8485, -6.1915] },
  { name: 'Pasar Senen', coords: [106.8441, -6.1747] },
  { name: 'Kwitang', coords: [106.8365, -6.1823] },
  { name: 'Cempaka Putih', coords: [106.8685, -6.1765] },
  { name: 'Kemayoran', coords: [106.8505, -6.1605] },
  { name: 'Pasar Baru', coords: [106.8335, -6.1645] },

  // Jakarta Selatan & Timur
  { name: 'Manggarai', coords: [106.8502, -6.2098] },
  { name: 'Setiabudi / Guntur', coords: [106.8325, -6.2095] },
  { name: 'Menteng Atas', coords: [106.8375, -6.2165] },
  { name: 'Pasar Manggis', coords: [106.8435, -6.2115] },
  { name: 'Kuningan / Rasuna Said', coords: [106.8323, -6.2202] },
  { name: 'Senayan / GBK', coords: [106.8025, -6.2185] },
  { name: 'SCBD / Semanggi', coords: [106.8095, -6.2245] },
  { name: 'Blok M / Melawai', coords: [106.7985, -6.2442] },
  { name: 'Kebayoran Baru', coords: [106.7925, -6.2395] },
  { name: 'Kebayoran Lama', coords: [106.7765, -6.2435] },
  { name: 'Kemang / Bangka', coords: [106.8145, -6.2615] },
  { name: 'Fatmawati / Cilandak', coords: [106.7965, -6.2895] },
  { name: 'Lebak Bulus', coords: [106.7745, -6.2895] },
  { name: 'Pasar Minggu', coords: [106.8445, -6.2845] },
  { name: 'Lenteng Agung', coords: [106.8345, -6.3325] },
  { name: 'Tebet', coords: [106.8495, -6.2285] },
  { name: 'Kampung Melayu', coords: [106.8655, -6.2235] },
  { name: 'Jatinegara', coords: [106.8665, -6.2315] },
  { name: 'Matraman', coords: [106.8548, -6.1965] },
  { name: 'Rawamangun', coords: [106.8825, -6.1935] },
  { name: 'Pulo Gadung', coords: [106.9025, -6.1855] },
  { name: 'Klender / Duren Sawit', coords: [106.9155, -6.2215] },
  { name: 'Pancoran', coords: [106.8435, -6.2465] },
  { name: 'Kalibata', coords: [106.8465, -6.2565] },
  { name: 'Cawang', coords: [106.8685, -6.2445] },
  { name: 'Cililitan / PGC', coords: [106.8665, -6.2625] },
  { name: 'Kramat Jati', coords: [106.8655, -6.2715] },
  { name: 'Pasar Rebo / Ciracas', coords: [106.8665, -6.3085] },
  { name: 'Cibubur', coords: [106.8855, -6.3585] },

  // Tangerang & Tangerang Selatan (Bodetabek Barat)
  { name: 'Bandara Soekarno-Hatta', coords: [106.6555, -6.1255] },
  { name: 'Poris / Batuceper Tangerang', coords: [106.6785, -6.1725] },
  { name: 'Cikokol / Tangcity Tangerang', coords: [106.6325, -6.1925] },
  { name: 'Karawaci Tangerang', coords: [106.6085, -6.2245] },
  { name: 'Ciledug', coords: [106.7085, -6.2345] },
  { name: 'Alam Sutera', coords: [106.6545, -6.2425] },
  { name: 'Gading Serpong', coords: [106.6285, -6.2585] },
  { name: 'BSD City / Serpong', coords: [106.6435, -6.3055] },
  { name: 'Bintaro Jaya', coords: [106.7245, -6.2765] },
  { name: 'Ciputat', coords: [106.7465, -6.3125] },
  { name: 'Pamulang', coords: [106.7325, -6.3455] },

  // Depok & Bogor (Bodetabek Selatan)
  { name: 'Cinere Depok', coords: [106.7845, -6.3325] },
  { name: 'Kampus UI Depok', coords: [106.8315, -6.3645] },
  { name: 'Margonda Depok', coords: [106.8265, -6.3885] },
  { name: 'Sawangan Depok', coords: [106.7685, -6.4025] },
  { name: 'Cimanggis / Juanda Depok', coords: [106.8585, -6.3785] },
  { name: 'Citayam', coords: [106.8025, -6.4455] },
  { name: 'Bojong Gede', coords: [106.7945, -6.4925] },
  { name: 'Cibinong Bogor', coords: [106.8425, -6.4825] },
  { name: 'Sentul Bogor', coords: [106.8585, -6.5485] },
  { name: 'Stasiun Bogor / Alun-Alun', coords: [106.7905, -6.5955] },
  { name: 'Kebun Raya / Pajajaran Bogor', coords: [106.8045, -6.6015] },
  { name: 'Baranangsiang Bogor', coords: [106.8095, -6.6065] },
  { name: 'Tajur / Ciawi Bogor', coords: [106.8285, -6.6385] },

  // Bekasi (Bodetabek Timur)
  { name: 'Harapan Indah Bekasi', coords: [106.9725, -6.1825] },
  { name: 'Kranji Bekasi Barat', coords: [106.9745, -6.2245] },
  { name: 'Kalimalang / Galaxy Bekasi', coords: [106.9685, -6.2565] },
  { name: 'Summarecon / Stasiun Bekasi', coords: [106.9995, -6.2362] },
  { name: 'Bekasi Timur / Bulak Kapal', coords: [107.0285, -6.2545] },
  { name: 'Jatiasih Bekasi', coords: [106.9625, -6.2945] },
  { name: 'Tambun Bekasi', coords: [107.0585, -6.2595] },
  { name: 'Cikarang Barat', coords: [107.1185, -6.2785] },
];

export const CITY_PRESETS: Record<CityId, CityPresetConfig> = {
  jabodetabek: {
    id: 'jabodetabek',
    name: 'Jabodetabek Metropolitan',
    subtitle: 'Jakarta • Bogor • Depok • Tangerang • Bekasi',
    platePrefix: 'B',
    center: [106.8317, -6.215],
    defaultZoom: 12.1,
    minZoom: 9.8,
    maxBounds: JABODETABEK_MAX_BOUNDS,
    specialRuleLabel:
      'Megapolitan Komuter KRL & Busway (Tantangan Macet Rush Hour & Banjir Musiman)',
    angkotSpeedBonusMult: 1.0,
    globalSpeedBonusMult: 1.0,
    fareToleranceThresholdRp: 5_500,
    depots: INITIAL_JAKARTA_DEPOTS,
    floodZones: [
      {
        id: 'flood-grogol',
        name: 'Genangan Banjir Grogol – Daan Mogot',
        coords: [106.7885, -6.1665],
        radiusKm: 0.75,
      },
      {
        id: 'flood-kampung-melayu',
        name: 'Luapan Ciliwung Kampung Melayu – Tebet',
        coords: [106.8625, -6.2245],
        radiusKm: 0.85,
      },
      {
        id: 'flood-kemayoran',
        name: 'Genangan Underpass Kemayoran – Senen',
        coords: [106.8475, -6.1665],
        radiusKm: 0.65,
      },
      {
        id: 'flood-bekasi',
        name: 'Genangan Kalimalang – Bekasi Barat',
        coords: [106.9765, -6.2455],
        radiusKm: 0.85,
      },
    ],
    hotspots: [
      {
        id: 'hs-manggarai',
        name: 'KRL Manggarai Central',
        coords: [106.8502, -6.2098],
        category: 'perumahan',
        demandLabel: '🔥 Hotspot Komuter Tinggi',
      },
      {
        id: 'hs-tanah-abang',
        name: 'Pasar & St. Tanah Abang',
        coords: [106.8108, -6.1857],
        category: 'pasar',
        demandLabel: '🔥 Hotspot Pasar Grosir',
      },
      {
        id: 'hs-sudirman-hi',
        name: 'CBD Sudirman – Thamrin HI',
        coords: [106.8228, -6.2005],
        category: 'kantor',
        demandLabel: '🔥 Hotspot Perkantoran',
      },
      {
        id: 'hs-senen',
        name: 'Stasiun & Pasar Senen',
        coords: [106.8441, -6.1747],
        category: 'pasar',
        demandLabel: '🔥 Hotspot Terminal/Stasiun',
      },
      {
        id: 'hs-grogol',
        name: 'Simpang Grogol / Trisakti',
        coords: [106.7885, -6.1665],
        category: 'kantor',
        demandLabel: '⚡ Hotspot Barat',
      },
      {
        id: 'hs-blok-m',
        name: 'Terminal Blok M / Kebayoran',
        coords: [106.7985, -6.2442],
        category: 'pasar',
        demandLabel: '🔥 Hotspot Jakarta Selatan',
      },
      {
        id: 'hs-depok',
        name: 'Margonda & Kampus UI Depok',
        coords: [106.8265, -6.3885],
        category: 'perumahan',
        demandLabel: '🔥 Hotspot Komuter Depok',
      },
      {
        id: 'hs-bogor',
        name: 'Stasiun Bogor & Kebun Raya',
        coords: [106.7905, -6.5955],
        category: 'pasar',
        demandLabel: '🔥 Hotspot Kota Bogor',
      },
      {
        id: 'hs-bekasi',
        name: 'Stasiun Bekasi & Summarecon',
        coords: [106.9995, -6.2362],
        category: 'perumahan',
        demandLabel: '🔥 Hotspot Komuter Bekasi',
      },
      {
        id: 'hs-bsd-tangerang',
        name: 'BSD Serpong & Tangerang',
        coords: [106.6435, -6.3055],
        category: 'kantor',
        demandLabel: '⚡ Hotspot Tangerang Raya',
      },
    ],
    neighborhoodCentroids: JAKARTA_NEIGHBORHOOD_CENTROIDS,
    sandboxHubs: INITIAL_JAKARTA_STOPS,
  },

  bandung: {
    id: 'bandung',
    name: 'Bandung Raya (Priangan)',
    subtitle: 'Kota Bandung • Cimahi • Dago • Leuwi Panjang • Gedebage',
    platePrefix: 'D',
    center: [107.6098, -6.9175],
    defaultZoom: 12.8,
    minZoom: 10.8,
    maxBounds: [
      [107.48, -7.02],
      [107.75, -6.82],
    ],
    specialRuleLabel:
      'Kota Seribu Angkot: Laju Angkot +15% Lebih Gesit di Tanjakan & Wisata Akhir Pekan',
    angkotSpeedBonusMult: 1.15,
    globalSpeedBonusMult: 1.0,
    fareToleranceThresholdRp: 5_500,
    depots: [
      {
        id: 'depot-bdg-cicadas',
        name: 'Pool Cicadas / Cicaheum Kecil',
        areaName: 'Bandung Tengah (Garasi Awal)',
        coords: [107.6415, -6.9065],
        capacitySlots: 6,
        unlockCostRp: 0,
        unlocked: true,
      },
      {
        id: 'depot-bdg-leuwipanjang',
        name: 'Pool Terminal Leuwi Panjang',
        areaName: 'Bandung Selatan (+12 Slot Armada)',
        coords: [107.5935, -6.9465],
        capacitySlots: 12,
        unlockCostRp: 45_000_000,
        unlocked: false,
      },
      {
        id: 'depot-bdg-cimahi',
        name: 'Pool Cibabat Cimahi',
        areaName: 'Bandung Barat / Cimahi (+16 Slot Armada)',
        coords: [107.5525, -6.8825],
        capacitySlots: 16,
        unlockCostRp: 75_000_000,
        unlocked: false,
      },
      {
        id: 'depot-bdg-gedebage',
        name: 'Pool Induk Gedebage – Tegalluar',
        areaName: 'Bandung Timur (+30 Slot Armada)',
        coords: [107.6895, -6.9485],
        capacitySlots: 30,
        unlockCostRp: 140_000_000,
        unlocked: false,
      },
    ],
    floodZones: [
      {
        id: 'flood-bdg-pasteur',
        name: 'Genangan Banjir Cileuncang Pasteur',
        coords: [107.5895, -6.8935],
        radiusKm: 0.65,
      },
      {
        id: 'flood-bdg-gedebage',
        name: 'Genangan Simpang Gedebage – Soekarno Hatta',
        coords: [107.6755, -6.9425],
        radiusKm: 0.75,
      },
    ],
    hotspots: [
      {
        id: 'hs-bdg-alun',
        name: 'Alun-Alun Bandung & Asia Afrika',
        coords: [107.6048, -6.9218],
        category: 'pasar',
        demandLabel: '🔥 Pusat Kota & Wisata',
      },
      {
        id: 'hs-bdg-stasiun',
        name: 'Stasiun Bandung (Kebon Kawung) & Pasar Baru',
        coords: [107.6025, -6.9125],
        category: 'pasar',
        demandLabel: '🔥 Stasiun & Grosir',
      },
      {
        id: 'hs-bdg-gd-sate',
        name: 'Gedung Sate & Gasibu / Dipatiukur',
        coords: [107.6186, -6.9025],
        category: 'kantor',
        demandLabel: '🔥 Perkantoran & Kampus',
      },
      {
        id: 'hs-bdg-dago',
        name: 'Simpang Dago & Kampus ITB',
        coords: [107.6132, -6.8895],
        category: 'kantor',
        demandLabel: '⚡ Koridor Mahasiswa & Kafe',
      },
      {
        id: 'hs-bdg-leuwipanjang',
        name: 'Terminal Leuwi Panjang / Kopo',
        coords: [107.5935, -6.9465],
        category: 'perumahan',
        demandLabel: '🔥 Komuter Bandung Selatan',
      },
      {
        id: 'hs-bdg-cicaheum',
        name: 'Terminal Cicaheum / Antapani',
        coords: [107.6565, -6.9015],
        category: 'perumahan',
        demandLabel: '🔥 Komuter Bandung Timur',
      },
    ],
    neighborhoodCentroids: [
      { name: 'Alun-Alun Bandung', coords: [107.6048, -6.9218] },
      { name: 'Braga / Asia Afrika', coords: [107.6095, -6.9175] },
      { name: 'Pasar Baru / Stasiun Bandung', coords: [107.6025, -6.9125] },
      { name: 'Gedung Sate / Gasibu', coords: [107.6186, -6.9025] },
      { name: 'Dago / Coblong', coords: [107.6132, -6.8895] },
      { name: 'Cihampelas', coords: [107.6042, -6.8935] },
      { name: 'Pasteur / Sukajadi', coords: [107.5895, -6.8935] },
      { name: 'Setiabudi / Ledeng', coords: [107.5955, -6.8655] },
      { name: 'Cicadas / Ahmad Yani', coords: [107.6385, -6.9095] },
      { name: 'Cicaheum', coords: [107.6565, -6.9015] },
      { name: 'Antapani', coords: [107.6585, -6.9195] },
      { name: 'Buah Batu', coords: [107.6345, -6.9435] },
      { name: 'Leuwi Panjang / Kopo', coords: [107.5935, -6.9465] },
      { name: 'Cibaduyut', coords: [107.5955, -6.9585] },
      { name: 'Ujung Berung', coords: [107.7015, -6.9145] },
      { name: 'Gedebage', coords: [107.6855, -6.9455] },
      { name: 'Cimahi Tengah', coords: [107.5425, -6.8725] },
    ],
    sandboxHubs: [
      {
        id: 'hub-bdg-alun',
        name: 'Alun-Alun Bandung',
        coords: [107.6048, -6.9218],
        category: 'pasar',
        level: 2,
        isPrebuiltHub: true,
        catchmentRadiusM: 500,
        baseDemandWeight: 2.8,
        buildingCount: 140,
        demandTier: 'Tinggi',
        waitingBatches: [{ id: 'b-1', count: 16, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
        totalWaiting: 16,
        transitWaiting: 0,
        totalTransfersHandled: 0,
        ojolLostCount: 0,
      },
      {
        id: 'hub-bdg-dago',
        name: 'Simpang Dago / ITB',
        coords: [107.6132, -6.8895],
        category: 'kantor',
        level: 2,
        isPrebuiltHub: true,
        catchmentRadiusM: 500,
        baseDemandWeight: 2.6,
        buildingCount: 118,
        demandTier: 'Tinggi',
        waitingBatches: [{ id: 'b-2', count: 14, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
        totalWaiting: 14,
        transitWaiting: 0,
        totalTransfersHandled: 0,
        ojolLostCount: 0,
      },
      {
        id: 'hub-bdg-leuwipanjang',
        name: 'Terminal Leuwi Panjang',
        coords: [107.5935, -6.9465],
        category: 'perumahan',
        level: 2,
        isPrebuiltHub: true,
        catchmentRadiusM: 500,
        baseDemandWeight: 2.7,
        buildingCount: 125,
        demandTier: 'Tinggi',
        waitingBatches: [{ id: 'b-3', count: 15, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
        totalWaiting: 15,
        transitWaiting: 0,
        totalTransfersHandled: 0,
        ojolLostCount: 0,
      },
    ],
  },

  surabaya: {
    id: 'surabaya',
    name: 'Surabaya Metropolitan',
    subtitle: 'Tunjungan • Gubeng • Wonokromo • Tanjung Perak • Bungurasih',
    platePrefix: 'L',
    center: [112.7388, -7.2655],
    defaultZoom: 12.6,
    minZoom: 10.8,
    maxBounds: [
      [112.6, -7.38],
      [112.84, -7.18],
    ],
    specialRuleLabel:
      'Arteri Lebar Kota Pahlawan: Kecepatan Jelajah Semua Armada +15% Lebih Cepat',
    angkotSpeedBonusMult: 1.0,
    globalSpeedBonusMult: 1.15,
    fareToleranceThresholdRp: 5_500,
    depots: [
      {
        id: 'depot-sby-joyoboyo',
        name: 'Pool Terminal Joyoboyo / Wonokromo',
        areaName: 'Surabaya Selatan (Garasi Awal)',
        coords: [112.7365, -7.2995],
        capacitySlots: 6,
        unlockCostRp: 0,
        unlocked: true,
      },
      {
        id: 'depot-sby-perak',
        name: 'Pool Kasuari – Tanjung Perak',
        areaName: 'Surabaya Utara (+12 Slot Armada)',
        coords: [112.7325, -7.2185],
        capacitySlots: 12,
        unlockCostRp: 45_000_000,
        unlocked: false,
      },
      {
        id: 'depot-sby-bratang',
        name: 'Pool Bratang – Rungkut',
        areaName: 'Surabaya Timur (+16 Slot Armada)',
        coords: [112.7625, -7.3025],
        capacitySlots: 16,
        unlockCostRp: 75_000_000,
        unlocked: false,
      },
      {
        id: 'depot-sby-purabaya',
        name: 'Pool Induk Purabaya Bungurasih',
        areaName: 'Perbatasan Surabaya – Sidoarjo (+30 Slot)',
        coords: [112.7245, -7.3515],
        capacitySlots: 30,
        unlockCostRp: 140_000_000,
        unlocked: false,
      },
    ],
    floodZones: [
      {
        id: 'flood-sby-mayjend',
        name: 'Genangan Mayjen Sungkono – Darmo',
        coords: [112.7185, -7.2895],
        radiusKm: 0.7,
      },
    ],
    hotspots: [
      {
        id: 'hs-sby-tunjungan',
        name: 'Tunjungan Plaza & Balai Kota',
        coords: [112.7392, -7.2625],
        category: 'kantor',
        demandLabel: '🔥 CBD Tunjungan Surabaya',
      },
      {
        id: 'hs-sby-gubeng',
        name: 'Stasiun Surabaya Gubeng & RSUD Dr. Soetomo',
        coords: [112.752, -7.2655],
        category: 'pasar',
        demandLabel: '🔥 Simpul Stasiun & Kampus Unair',
      },
      {
        id: 'hs-sby-wonokromo',
        name: 'Terminal Joyoboyo & St. Wonokromo',
        coords: [112.7365, -7.3015],
        category: 'perumahan',
        demandLabel: '🔥 Gerbang Komuter Selatan',
      },
      {
        id: 'hs-sby-pasar-turi',
        name: 'Stasiun Pasar Turi & Jembatan Merah',
        coords: [112.7315, -7.2455],
        category: 'pasar',
        demandLabel: '🔥 Sentra Niaga & Grosir',
      },
      {
        id: 'hs-sby-its',
        name: 'Kampus ITS Sukolilo & Pakuwon Timur',
        coords: [112.7945, -7.2825],
        category: 'kantor',
        demandLabel: '⚡ Koridor Timur Surabaya',
      },
    ],
    neighborhoodCentroids: [
      { name: 'Tunjungan / Genteng', coords: [112.7392, -7.2625] },
      { name: 'Gubeng', coords: [112.752, -7.2655] },
      { name: 'Darmo / Diponegoro', coords: [112.7385, -7.2855] },
      { name: 'Wonokromo / Joyoboyo', coords: [112.7365, -7.3015] },
      { name: 'Pasar Turi / Bubutan', coords: [112.7315, -7.2455] },
      { name: 'Jembatan Merah / Kota Tua', coords: [112.7385, -7.2365] },
      { name: 'Tanjung Perak', coords: [112.7325, -7.2115] },
      { name: 'Kenjeran', coords: [112.7855, -7.2355] },
      { name: 'Kertajaya / Manyar', coords: [112.7685, -7.2785] },
      { name: 'Sukolilo / ITS', coords: [112.7945, -7.2825] },
      { name: 'Rungkut Industri', coords: [112.7825, -7.3255] },
      { name: 'Wiyung / Pakuwon Barat', coords: [112.6855, -7.3025] },
      { name: 'Gayungan / Ahmad Yani', coords: [112.7285, -7.3285] },
      { name: 'Bungurasih / Waru', coords: [112.7245, -7.3515] },
    ],
    sandboxHubs: [
      {
        id: 'hub-sby-tunjungan',
        name: 'Tunjungan Center',
        coords: [112.7392, -7.2625],
        category: 'kantor',
        level: 2,
        isPrebuiltHub: true,
        catchmentRadiusM: 500,
        baseDemandWeight: 2.9,
        buildingCount: 145,
        demandTier: 'Tinggi',
        waitingBatches: [{ id: 's-1', count: 16, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
        totalWaiting: 16,
        transitWaiting: 0,
        totalTransfersHandled: 0,
        ojolLostCount: 0,
      },
      {
        id: 'hub-sby-gubeng',
        name: 'Stasiun Surabaya Gubeng',
        coords: [112.752, -7.2655],
        category: 'pasar',
        level: 2,
        isPrebuiltHub: true,
        catchmentRadiusM: 500,
        baseDemandWeight: 2.8,
        buildingCount: 138,
        demandTier: 'Tinggi',
        waitingBatches: [{ id: 's-2', count: 15, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
        totalWaiting: 15,
        transitWaiting: 0,
        totalTransfersHandled: 0,
        ojolLostCount: 0,
      },
      {
        id: 'hub-sby-wonokromo',
        name: 'Terminal Intermoda Joyoboyo',
        coords: [112.7365, -7.3015],
        category: 'perumahan',
        level: 2,
        isPrebuiltHub: true,
        catchmentRadiusM: 500,
        baseDemandWeight: 2.7,
        buildingCount: 130,
        demandTier: 'Tinggi',
        waitingBatches: [{ id: 's-3', count: 15, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
        totalWaiting: 15,
        transitWaiting: 0,
        totalTransfersHandled: 0,
        ojolLostCount: 0,
      },
    ],
  },

  bali: {
    id: 'bali',
    name: 'Bali Sarbagita (Denpasar – Kuta – Sanur)',
    subtitle: 'Denpasar • Kuta • Seminyak • Sanur • Bandara Ngurah Rai',
    platePrefix: 'DK',
    center: [115.2065, -8.6955],
    defaultZoom: 12.4,
    minZoom: 10.6,
    maxBounds: [
      [115.08, -8.85],
      [115.32, -8.58],
    ],
    specialRuleLabel:
      'Koridor Wisata Turis: Toleransi Tarif Tiket 2x Lipat (Aman s/d Rp 9.500 tanpa kabur ke Ojol!)',
    angkotSpeedBonusMult: 1.05,
    globalSpeedBonusMult: 1.05,
    fareToleranceThresholdRp: 9_500,
    depots: [
      {
        id: 'depot-bali-ubung',
        name: 'Pool Sentral Denpasar / Ubung',
        areaName: 'Denpasar (Garasi Awal)',
        coords: [115.2055, -8.6425],
        capacitySlots: 6,
        unlockCostRp: 0,
        unlocked: true,
      },
      {
        id: 'depot-bali-kuta',
        name: 'Pool Sentral Parkir Kuta',
        areaName: 'Kuta / Legian (+12 Slot Armada)',
        coords: [115.1785, -8.7165],
        capacitySlots: 12,
        unlockCostRp: 45_000_000,
        unlocked: false,
      },
      {
        id: 'depot-bali-sanur',
        name: 'Pool Bypass Ngurah Rai Sanur',
        areaName: 'Sanur / Denpasar Selatan (+16 Slot)',
        coords: [115.2545, -8.6925],
        capacitySlots: 16,
        unlockCostRp: 75_000_000,
        unlocked: false,
      },
      {
        id: 'depot-bali-nusadua',
        name: 'Pool Induk ITDC Nusa Dua – Jimbaran',
        areaName: 'Badung Selatan (+30 Slot Armada)',
        coords: [115.1985, -8.7855],
        capacitySlots: 30,
        unlockCostRp: 140_000_000,
        unlocked: false,
      },
    ],
    floodZones: [
      {
        id: 'flood-bali-sunset',
        name: 'Genangan Simpang Dewa Ruci – Sunset Road',
        coords: [115.1825, -8.7225],
        radiusKm: 0.6,
      },
    ],
    hotspots: [
      {
        id: 'hs-bali-kuta',
        name: 'Pantai Kuta & Beachwalk',
        coords: [115.1695, -8.7185],
        category: 'pasar',
        demandLabel: '🔥 Hotspot Wisata Turis',
      },
      {
        id: 'hs-bali-seminyak',
        name: 'Seminyak & Canggu',
        coords: [115.1625, -8.6865],
        category: 'kantor',
        demandLabel: '🔥 Koridor Resort & Beach Club',
      },
      {
        id: 'hs-bali-denpasar',
        name: 'Lapangan Puputan & Pasar Badung Denpasar',
        coords: [115.2125, -8.6565],
        category: 'perumahan',
        demandLabel: '🔥 Pusat Kota Denpasar',
      },
      {
        id: 'hs-bali-sanur',
        name: 'Pelabuhan & Pantai Sanur',
        coords: [115.2625, -8.6785],
        category: 'pasar',
        demandLabel: '🔥 Penyeberangan Nusa Penida',
      },
      {
        id: 'hs-bali-bandara',
        name: 'Bandara I Gusti Ngurah Rai Tuban',
        coords: [115.1675, -8.7465],
        category: 'kantor',
        demandLabel: '🔥 Gerbang Turis Internasional',
      },
    ],
    neighborhoodCentroids: [
      { name: 'Pantai Kuta', coords: [115.1695, -8.7185] },
      { name: 'Legian', coords: [115.1705, -8.7035] },
      { name: 'Seminyak', coords: [115.1625, -8.6865] },
      { name: 'Sunset Road', coords: [115.1785, -8.7055] },
      { name: 'Bandara Ngurah Rai / Tuban', coords: [115.1675, -8.7465] },
      { name: 'Jimbaran', coords: [115.1745, -8.7725] },
      { name: 'Denpasar Kota / Puputan', coords: [115.2125, -8.6565] },
      { name: 'Renon Denpasar', coords: [115.2325, -8.6725] },
      { name: 'Teuku Umar Denpasar', coords: [115.2025, -8.6755] },
      { name: 'Sanur', coords: [115.2625, -8.6785] },
      { name: 'Benoa / Tol Bali Mandara', coords: [115.2125, -8.7425] },
    ],
    sandboxHubs: [
      {
        id: 'hub-bali-kuta',
        name: 'Sentral Pantai Kuta',
        coords: [115.1695, -8.7185],
        category: 'pasar',
        level: 2,
        isPrebuiltHub: true,
        catchmentRadiusM: 500,
        baseDemandWeight: 3.0,
        buildingCount: 140,
        demandTier: 'Tinggi',
        waitingBatches: [{ id: 'dk-1', count: 18, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
        totalWaiting: 18,
        transitWaiting: 0,
        totalTransfersHandled: 0,
        ojolLostCount: 0,
      },
      {
        id: 'hub-bali-denpasar',
        name: 'Simpang Puputan Denpasar',
        coords: [115.2125, -8.6565],
        category: 'perumahan',
        level: 2,
        isPrebuiltHub: true,
        catchmentRadiusM: 500,
        baseDemandWeight: 2.7,
        buildingCount: 125,
        demandTier: 'Tinggi',
        waitingBatches: [{ id: 'dk-2', count: 15, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
        totalWaiting: 15,
        transitWaiting: 0,
        totalTransfersHandled: 0,
        ojolLostCount: 0,
      },
      {
        id: 'hub-bali-sanur',
        name: 'Pelabuhan Sanur',
        coords: [115.2625, -8.6785],
        category: 'kantor',
        level: 2,
        isPrebuiltHub: true,
        catchmentRadiusM: 500,
        baseDemandWeight: 2.8,
        buildingCount: 118,
        demandTier: 'Tinggi',
        waitingBatches: [{ id: 'dk-3', count: 16, spawnedAtMinute: 360, maxPatienceMinutes: 95 }],
        totalWaiting: 16,
        transitWaiting: 0,
        totalTransfersHandled: 0,
        ojolLostCount: 0,
      },
    ],
  },
};

/**
 * Estimates an authentic local stop name based on:
 * 1) Any place/street label rendered directly on the MapLibre canvas near the click/hover point
 * 2) Nearest neighborhood centroid coordinate for the active city (Jabodetabek / Bandung / Surabaya / Bali)
 */
export function estimateStopNameFromLocation(
  coords: [number, number],
  category: ZoneCategory,
  existingStops: StopNode[],
  renderedMapName?: string,
  cityId: CityId = 'jabodetabek'
): string {
  const prefix =
    category === 'perumahan'
      ? 'Plang'
      : category === 'kantor'
      ? 'Halte'
      : 'Simpang';

  let areaName = renderedMapName?.trim() || '';

  if (areaName) {
    areaName = areaName
      .replace(/^(Jalan|Jl\.|Jln\.|Tol|Flyover|Underpass)\s+/i, '')
      .trim();
  }

  const centroids =
    CITY_PRESETS[cityId]?.neighborhoodCentroids || JAKARTA_NEIGHBORHOOD_CENTROIDS;

  if (!areaName || areaName.length < 3) {
    let best = centroids[0];
    let bestDist = Infinity;
    for (const item of centroids) {
      const d = turf.distance(coords, item.coords, { units: 'kilometers' });
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    areaName = best.name;
  }

  const baseCandidate = `${prefix} ${areaName}`;

  const sameAreaCount = existingStops.filter((s) =>
    s.name.toLowerCase().includes(areaName.toLowerCase())
  ).length;

  if (sameAreaCount === 0) {
    return baseCandidate;
  }
  const suffixes = ['II', 'III', 'IV', 'V', 'VI'];
  const suffix = suffixes[(sameAreaCount - 1) % suffixes.length];
  return `${baseCandidate} ${suffix}`;
}
