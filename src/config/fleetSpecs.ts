import type {
  BankLoanPackage,
  FleetSpec,
  FleetType,
  MaintenanceTier,
  StopTierLevel,
  StopTierSpec,
} from '../types/game';

export const FLEET_SPECS: Record<FleetType, FleetSpec> = {
  angkot: {
    id: 'angkot',
    name: 'Angkot Mikrolet',
    subtitle: 'Suzuki Carry / M-15 Biru Telur Asin',
    capacity: 12,
    baseSpeedKmh: 38,
    purchasePrice: 12_000_000,
    fareRp: 5_000,
    opCostPerKm: 25_000,
    color: '#06b6d4',
    roofColor: '#22d3ee',
    visualLengthM: 42,
    visualWidthM: 22,
    visualHeightM: 18,
    supportsNgetem: true,
    supportsHailAnywhere: true,
    supportsDedicatedLane: false,
    requiresLevel3Stop: false,
    description:
      'Gesit & murah. Bisa mode "Ngetem" (tunggu penumpang sampai penuh di halte ujung) dan "Angkut Pinggir Jalan" (Hail Anywhere) di sepanjang rute.',
  },
  metromini: {
    id: 'metromini',
    name: 'Metromini / Kopaja',
    subtitle: 'Mitsubishi Colt Diesel Bus Sedang',
    capacity: 30,
    baseSpeedKmh: 44,
    purchasePrice: 35_000_000,
    fareRp: 4_500,
    opCostPerKm: 60_000,
    color: '#f97316',
    roofColor: '#fb923c',
    visualLengthM: 62,
    visualWidthM: 26,
    visualHeightM: 26,
    supportsNgetem: false,
    supportsHailAnywhere: false,
    supportsDedicatedLane: false,
    requiresLevel3Stop: false,
    description:
      'Raja jalanan arteri Jakarta. Kapasitas menengah (30 penumpang), berhenti di Halte Level 1/2/3, cocok untuk trayek penghubung antar-stasiun.',
  },
  brt: {
    id: 'brt',
    name: 'TransJakarta BRT',
    subtitle: 'Scania / Mercedes High-Deck Articulated',
    capacity: 80,
    baseSpeedKmh: 55,
    purchasePrice: 145_000_000,
    fareRp: 3_500,
    opCostPerKm: 120_000,
    color: '#3b82f6',
    roofColor: '#93c5fd',
    visualLengthM: 92,
    visualWidthM: 30,
    visualHeightM: 34,
    supportsNgetem: false,
    supportsHailAnywhere: false,
    supportsDedicatedLane: true,
    requiresLevel3Stop: true,
    description:
      'Armada raksasa 80 penumpang (High-Deck). WAJIB berhenti di Halte Level 3 (Halte BRT + JPO) & mendukung "Jalur Khusus Busway" anti-macet.',
  },
};

export const STOP_TIER_SPECS: Record<StopTierLevel, StopTierSpec> = {
  1: {
    level: 1,
    name: 'Level 1 — Plang Pinggir Jalan',
    shortName: 'Lv.1 Plang Jalan',
    upgradeCostRp: 0,
    maxQueueCapacity: 25,
    patienceMultiplier: 1.0,
    dwellTimeMultiplier: 1.0,
    supportsBRT: false,
    description:
      'Tiang rambu sederhana di bahu jalan. Kapasitas antre maks 25 orang (kelebihan langsung diambil Ojol). Tidak bisa melayani bus tinggi BRT.',
  },
  2: {
    level: 2,
    name: 'Level 2 — Halte Beratap',
    shortName: 'Lv.2 Halte Beratap',
    upgradeCostRp: 12_000_000,
    maxQueueCapacity: 60,
    patienceMultiplier: 1.4,
    dwellTimeMultiplier: 0.85,
    supportsBRT: false,
    description:
      'Halte teduh dengan kursi tunggu. Kapasitas 60 orang, kesabaran warga +40% lebih tahan terhadap godaan Ojol & aman dari hujan.',
  },
  3: {
    level: 3,
    name: 'Level 3 — Halte BRT Terintegrasi + JPO',
    shortName: 'Lv.3 Halte BRT (JPO)',
    upgradeCostRp: 45_000_000,
    maxQueueCapacity: 150,
    patienceMultiplier: 1.8,
    dwellTimeMultiplier: 0.5,
    supportsBRT: true,
    description:
      'Halte tinggi koridor TransJakarta lengkap dengan Jembatan Penyeberangan (JPO). Kapasitas 150 orang, naik-turun 2x lebih cepat, WAJIB untuk armada BRT.',
  },
};

export const MAINTENANCE_SPECS: Record<
  MaintenanceTier,
  {
    id: MaintenanceTier;
    label: string;
    costMultiplier: number;
    wearPerKmPct: number;
    terminalHealPct: number;
    desc: string;
  }
> = {
  hemat: {
    id: 'hemat',
    label: 'Hemat / Kanibal Onderdil',
    costMultiplier: 0.55,
    wearPerKmPct: 0.45,
    terminalHealPct: 0,
    desc: 'Biaya OPEX -45%, keausan mesin 0.45%/km tanpa heal terminal (kondisi mesin turun ~60%/hari jika tanpa servis).',
  },
  standar: {
    id: 'standar',
    label: 'Standar Bengkel',
    costMultiplier: 1.0,
    wearPerKmPct: 0.30,
    terminalHealPct: 0.4,
    desc: 'Perawatan normal. Keausan wajar 0.30%/km dan heal ringan 0.4% di ujung rute (kondisi mesin turun wajar ~20%/hari).',
  },
  prima: {
    id: 'prima',
    label: 'Prima Resmi (Standar ATPM)',
    costMultiplier: 1.65,
    wearPerKmPct: 0.08,
    terminalHealPct: 0.2,
    desc: 'Biaya OPEX +65%, keausan sangat minim 0.08%/km dan heal 0.2% (mesin selalu prima, bebas mogok & bebas razia KIR).',
  },
};

export const BANK_LOAN_PACKAGES: BankLoanPackage[] = [
  {
    id: 'loan-mikro',
    name: 'Kredit Mikro Kupedes',
    principalRp: 50_000_000,
    totalRepayRp: 56_000_000,
    dailyInstallmentRp: 7_000_000,
    durationDays: 8,
    description: 'Suntikan modal cepat untuk tambah 2-3 unit Angkot atau upgrade Halte Beratap.',
  },
  {
    id: 'loan-leasing',
    name: 'Leasing Armada Kopaja / Pool',
    principalRp: 150_000_000,
    totalRepayRp: 170_000_000,
    dailyInstallmentRp: 17_000_000,
    durationDays: 10,
    description: 'Pembiayaan menengah untuk ekspansi Pool Garasi dan pengadaan bus sedang.',
  },
  {
    id: 'loan-obligasi',
    name: 'Obligasi Infrastruktur Busway',
    principalRp: 350_000_000,
    totalRepayRp: 396_000_000,
    dailyInstallmentRp: 33_000_000,
    durationDays: 12,
    description:
      'Dana korporasi besar untuk membangun Halte BRT Level 3 (JPO), Jalur Khusus, & beli unit TransJakarta.',
  },
];

export const ROUTE_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#eab308',
  '#a855f7',
  '#10b981',
  '#f97316',
  '#ec4899',
  '#06b6d4',
];

export const DEDICATED_LANE_COST_PER_KM = 8_000_000;
export const CUSTOM_STOP_BUILD_COST = 1_500_000;
export const VEHICLE_OVERHAUL_COST_RP = 1_500_000;
export const DISHUB_KIR_FINE_RP = 3_500_000;
