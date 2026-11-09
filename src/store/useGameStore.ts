import { create } from 'zustand';
import * as turf from '@turf/turf';
import type {
  ActiveLoan,
  ActiveModalType,
  CameraMode,
  CashPopupEvent,
  CityId,
  CompanyFinancialBreakdown,
  CursorCatchmentPreview,
  DailyLedgerEntry,
  DemandPotentialTier,
  DepotNode,
  DishubContract,
  DraftDetourSegment,
  DraftRouteAnalysis,
  FleetType,
  FloatingNotification,
  GameSpeed,
  GhostRoutePreview,
  InteractionMode,
  MaintenanceTier,
  MapThemeMode,
  RoadsidePassenger,
  StarterMode,
  StopNode,
  StopTierLevel,
  TimeOfDayPhase,
  TransferLink,
  TransitRoute,
  Vehicle,
  WeatherCondition,
  ZoneCategory,
} from '../types/game';
import {
  BANK_LOAN_PACKAGES,
  CUSTOM_STOP_BUILD_COST,
  DEDICATED_LANE_COST_PER_KM,
  DISHUB_KIR_FINE_RP,
  FLEET_SPECS,
  MAINTENANCE_SPECS,
  ROUTE_COLORS,
  STOP_TIER_SPECS,
  VEHICLE_OVERHAUL_COST_RP,
} from '../config/fleetSpecs';
import {
  CITY_PRESETS,
  estimateStopNameFromLocation,
  INITIAL_JAKARTA_DEPOTS,
} from '../config/jakartaPreset';
import {
  buildRoadSnappedRoute,
  analyzeMultiStopRoute,
} from '../services/routingService';
import {
  detectTransferLinks,
  getVehicleTransformAlongRoute,
} from '../services/spatialUtils';

// Batch multiplier: v3 calibrated to 5 (was 8) to prevent late-game runaway snowballing
export const FARE_BATCH_MULTIPLIER = 5;

// v3 Calibration: Global spawn multiplier (was 1.5) to prevent permanent 25/25 queue saturation
export const SPAWN_GLOBAL_MULT = 0.3;

export interface TelemetryPeriodSnapshot {
  day: number;
  periodLabel: string;
  gameMinutes: number;
  timeString: string;
  paxSpawned: number;
  paxServed: number;
  paxOjol: number;
  tripsCompleted: number;
  revenueRp: number;
  opCostRp: number;
  activeVehiclesCount: number;
  vehiclesStatus: Array<{
    plate: string;
    condition: number;
    passengers: number;
    capacity: number;
    trips: number;
    revenueRp: number;
  }>;
}

const SAVE_KEY_PREFIX = 'ntm_save_v4_';

export interface TrafficPhaseInfo {
  label: string;
  sublabel: string;
  trafficMultiplier: number;
  isRushHour: boolean;
  spawnWeights: Record<ZoneCategory, number>;
}

export function getTrafficPhase(gameMinutes: number): TrafficPhaseInfo {
  const hour = (gameMinutes / 60) % 24;
  if (hour >= 6.25 && hour < 9.5) {
    return {
      label: 'Rush Hour Pagi',
      sublabel: 'Perumahan ➔ Kantor (Macet Padat)',
      trafficMultiplier: 0.48,
      isRushHour: true,
      spawnWeights: { perumahan: 2.0, kantor: 0.7, pasar: 1.3 },
    };
  }
  if (hour >= 9.5 && hour < 16.0) {
    return {
      label: 'Jam Operasional Siang',
      sublabel: 'Arus Niaga & Pasar Ramai Lancar',
      trafficMultiplier: 0.85,
      isRushHour: false,
      spawnWeights: { perumahan: 0.9, kantor: 1.0, pasar: 1.8 },
    };
  }
  if (hour >= 16.0 && hour < 19.75) {
    return {
      label: 'Rush Hour Sore',
      sublabel: 'Kantor ➔ Perumahan (Macet Parah)',
      trafficMultiplier: 0.42,
      isRushHour: true,
      spawnWeights: { perumahan: 0.8, kantor: 2.0, pasar: 1.3 },
    };
  }
  return {
    label: 'Malam / Lengang',
    sublabel: 'Jalanan Lancar Jaya',
    trafficMultiplier: 1.12,
    isRushHour: false,
    spawnWeights: { perumahan: 0.3, kantor: 0.2, pasar: 0.2 },
  };
}

export function getEffectiveTimePhase(
  gameMinutes: number,
  mapThemeMode: MapThemeMode
): TimeOfDayPhase {
  if (mapThemeMode === 'day') return 'day';
  if (mapThemeMode === 'night') return 'night';

  const hour = (gameMinutes / 60) % 24;
  if (hour >= 5.25 && hour < 6.5) return 'dawn';
  if (hour >= 6.5 && hour < 17.0) return 'day';
  if (hour >= 17.0 && hour < 18.5) return 'dusk';
  return 'night';
}

function generateCityPlate(type: FleetType, cityId: CityId): string {
  const prefix = CITY_PRESETS[cityId]?.platePrefix || 'B';
  const num = Math.floor(1000 + Math.random() * 8999);
  const suffix =
    type === 'angkot'
      ? ['WT', 'TK', 'WK', 'UL'][Math.floor(Math.random() * 4)]
      : type === 'metromini'
      ? ['GA', 'NP', 'IX', 'UM'][Math.floor(Math.random() * 4)]
      : ['TGA', 'TGB', 'TGC', 'TJ'][Math.floor(Math.random() * 4)];
  return `${prefix} ${num} ${suffix}`;
}

export function computeMaxFleetSlots(depots: DepotNode[]): number {
  return depots.reduce((acc, d) => (d.unlocked ? acc + d.capacitySlots : acc), 0);
}

export function computeFleetLiquidationValueRp(vehicles: Vehicle[]): number {
  return vehicles.reduce((acc, v) => {
    const spec = FLEET_SPECS[v.type];
    const condFactor = Math.max(0.3, v.condition / 100);
    return acc + Math.floor(spec.purchasePrice * 0.6 * condFactor);
  }, 0);
}

export function computeEstimatedMidnightDeduction(state: {
  vehicles: Vehicle[];
  depots: DepotNode[];
  maintenanceTier: MaintenanceTier;
  activeLoans: ActiveLoan[];
}): number {
  const maintSpec = MAINTENANCE_SPECS[state.maintenanceTier] || { costMultiplier: 1.0 };
  const loanPaidRp = state.activeLoans.reduce(
    (acc, l) => acc + Math.min(l.remainingRp, l.dailyInstallmentRp),
    0
  );
  const unlockedDepotsCount = state.depots.filter((d) => d.unlocked).length;
  const fleetFixedDaily = state.vehicles.reduce((acc, v) => {
    if (v.type === 'angkot') return acc + 1_000_000;
    if (v.type === 'metromini') return acc + 2_500_000;
    if (v.type === 'brt') return acc + 4_500_000;
    return acc + 1_000_000;
  }, 0);
  const depotFixedDaily = unlockedDepotsCount * 300_000;
  const workshopDailyFee =
    state.vehicles.length > 0
      ? Math.round((fleetFixedDaily + depotFixedDaily) * maintSpec.costMultiplier)
      : 0;
  return loanPaidRp + workshopDailyFee;
}

export function computeReputationInfo(
  totalPassengersServed: number,
  stops: StopNode[]
): {
  level: number;
  title: string;
  demandBonusMult: number;
  nextTargetPax: number;
} {
  const lv2Or3Count = stops.filter((s) => s.level >= 2).length;
  const score = totalPassengersServed + lv2Or3Count * 60;

  if (score >= 1500) {
    return {
      level: 5,
      title: 'Lv.5 Konglomerat Transit Nusantara',
      demandBonusMult: 1.4,
      nextTargetPax: 1500,
    };
  }
  if (score >= 700) {
    return {
      level: 4,
      title: 'Lv.4 Raja Koridor Busway',
      demandBonusMult: 1.28,
      nextTargetPax: 1500,
    };
  }
  if (score >= 300) {
    return {
      level: 3,
      title: 'Lv.3 Juragan Kopaja & Stasiun',
      demandBonusMult: 1.18,
      nextTargetPax: 700,
    };
  }
  if (score >= 80) {
    return {
      level: 2,
      title: 'Lv.2 Bos Mikrolet Antar-Kelurahan',
      demandBonusMult: 1.08,
      nextTargetPax: 300,
    };
  }
  return {
    level: 1,
    title: 'Lv.1 Perintis PO Baru',
    demandBonusMult: 1.0,
    nextTargetPax: 80,
  };
}

export function formatSignedRp(amountRp: number): string {
  const rounded = Math.round(Math.abs(amountRp));
  const sign = amountRp >= 0 ? '+' : '-';
  return `${sign}Rp ${rounded.toLocaleString('id-ID')}`;
}

export const INITIAL_FINANCIAL_BREAKDOWN: CompanyFinancialBreakdown = {
  ticketRegularRp: 0,
  ticketJaklingkoRp: 0,
  subsidyPsoRp: 0,
  vehicleSalesRefundRp: 0,
  bankLoansDisbursedRp: 0,
  fuelCostRp: 0,
  maintenanceCostRp: 0,
  dishubKirFinesRp: 0,
  loanInterestAndRepayRp: 0,
  fleetPurchaseRp: 0,
  stopBuildAndUpgradeRp: 0,
  depotUnlockRp: 0,
  dedicatedBuswayRp: 0,
};

export interface VehicleProfitSummary {
  revenueRp: number;
  fuelCostRp: number;
  maintenanceCostRp: number;
  totalOpexRp: number;
  netProfitRp: number;
  isProfitable: boolean;
  marginPct: number;
  paxCarried: number;
  distanceKm: number;
  trips: number;
  fuelCostPerKm: number;
}

export function computeVehicleProfit(veh: Vehicle): VehicleProfitSummary {
  const revenueRp = veh.totalRevenueGenerated || 0;
  const fuelCostRp = veh.totalFuelCostRp || 0;
  const maintenanceCostRp = veh.totalMaintenanceCostRp || 0;
  const totalOpexRp = fuelCostRp + maintenanceCostRp;
  const netProfitRp = revenueRp - totalOpexRp;
  const isProfitable = netProfitRp >= 0;
  const marginPct =
    revenueRp > 0
      ? Math.round((netProfitRp / revenueRp) * 100)
      : totalOpexRp > 0
      ? -100
      : 0;
  const paxCarried = veh.totalPaxCarried || 0;
  const distanceKm = veh.totalDistanceTraveledKm || 0;
  const trips = veh.totalTripsCompleted || 0;
  const fuelCostPerKm =
    distanceKm > 0 ? Math.round(fuelCostRp / distanceKm) : 0;

  return {
    revenueRp,
    fuelCostRp,
    maintenanceCostRp,
    totalOpexRp,
    netProfitRp,
    isProfitable,
    marginPct,
    paxCarried,
    distanceKm,
    trips,
    fuelCostPerKm,
  };
}

interface GameState {
  // Company & Multi-City Identity
  companyName: string;
  currentCityId: CityId;
  starterMode: StarterMode;
  weather: WeatherCondition;
  _weatherAccumMinutes: number;

  // Economy, CAPEX/OPEX Accounting & Clock
  balanceRp: number; // Starts at Rp 25.000.000 ("Rintis dari Nol")!
  totalRevenueRp: number;
  totalOpCostRp: number;
  totalCapexSpentRp: number;
  financialBreakdown: CompanyFinancialBreakdown;
  dailyLedger: DailyLedgerEntry[];
  _todayRevenueRp: number;
  _todayVariableOpCostRp: number;
  totalPassengersServed: number;
  totalTransfersCompleted: number;
  jakLingkoBonusRp: number;
  totalTakenByOjol: number;
  senenTanahAbangPax: number;
  gameMinutes: number;
  gameDay: number;
  gameSpeed: GameSpeed;

  // Phase 3, 3.5 & 4 Tycoon Systems
  maintenanceTier: MaintenanceTier;
  depots: DepotNode[];
  activeLoans: ActiveLoan[];
  claimedContractIds: string[];
  cashPopups: CashPopupEvent[];

  // World Entities (Starts at 0 Stops, 0 Routes, 0 Vehicles in "Rintis dari Nol"!)
  stops: StopNode[];
  routes: TransitRoute[];
  transferLinks: TransferLink[];
  vehicles: Vehicle[];
  roadsidePassengers: RoadsidePassenger[];
  notifications: FloatingNotification[];

  // UI, Layout & Map State
  isLeftPanelOpen: boolean;
  activeModal: ActiveModalType;
  mapViewJumpVersion: number;
  cameraMode: CameraMode;
  mapThemeMode: MapThemeMode;
  show3DBuildings: boolean;
  showCatchmentRadius: boolean;
  interactionMode: InteractionMode;
  pendingStopCategory: ZoneCategory;
  cursorPreview: CursorCatchmentPreview | null;
  selectedRouteId: string | null;
  selectedStopId: string | null;
  selectedVehicleId: string | null;
  draftRouteStopIds: string[];
  draftRouteAnalysis: DraftRouteAnalysis | null;
  ghostPreview: GhostRoutePreview | null;
  isBuildingRoute: boolean;
  starterInitialized: boolean;

  // Accumulators
  _spawnAccumMinutes: number;
  _roadsideAccumMinutes: number;
  _opCostAccumRp: number;
  _opCostAccumMinutes: number;

  // Telemetry Accumulators (v3 Section 8)
  _telemetryPeriodPaxSpawned: number;
  _telemetryPeriodPaxServed: number;
  _telemetryPeriodPaxOjol: number;
  _telemetryPeriodTrips: number;
  _telemetryPeriodRev: number;
  _telemetryPeriodOpCost: number;
  _lastTelemetryPeriodLabel: string;
  telemetryHistory: TelemetryPeriodSnapshot[];

  // UI & Map Actions
  setGameSpeed: (speed: GameSpeed) => void;
  skipNight: () => void;
  toggleLeftPanel: () => void;
  setLeftPanelOpen: (open: boolean) => void;
  setActiveModal: (modal: ActiveModalType) => void;
  toggleCameraMode: () => void;
  cycleMapThemeMode: () => void;
  cycleWeather: () => void;
  toggle3DBuildings: () => void;
  toggleCatchmentRadius: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setPendingStopCategory: (cat: ZoneCategory) => void;
  setCursorPreview: (preview: CursorCatchmentPreview | null) => void;
  selectRoute: (routeId: string | null) => void;
  selectStop: (stopId: string | null) => void;
  selectVehicle: (vehicleId: string | null) => void;

  // Phase 4 Multi-City, Save/Load & Onboarding PO Actions
  setCompanyName: (name: string) => void;
  saveCurrentCityToStorage: () => void;
  loadCityFromStorage: (cityId: CityId) => boolean;
  switchCity: (cityId: CityId) => void;
  resetCityGame: (mode: StarterMode, customCompanyName?: string) => void;

  // Stop & Route Actions
  addCustomStop: (
    coords: [number, number],
    inspected?: {
      detectedAreaName?: string;
      buildingCount: number;
      demandTier: DemandPotentialTier;
      estimatedWeight: number;
    },
    customName?: string
  ) => void;
  upgradeStopLevel: (stopId: string) => void;
  toggleDraftStop: (stopId: string) => void;
  reverseDraftRoute: () => void;
  removeLastDraftStop: () => void;
  setGhostPreview: (preview: GhostRoutePreview | null) => void;
  refreshDraftRouteAnalysis: () => Promise<void>;
  clearDraftRoute: () => void;
  finalizeDraftRoute: (customName?: string) => Promise<void>;
  deleteRoute: (routeId: string) => void;
  setRouteCustomFare: (routeId: string, fareRp: number) => void;

  // Fleet Inventory (Pool Stock vs Active Route) & Economy Actions
  buyVehicle: (fleetType: FleetType, targetRouteId?: string | null) => void;
  assignVehicleToRoute: (vehicleId: string, targetRouteId: string | null) => void;
  sellVehicle: (vehicleId: string) => void;
  serviceVehicle: (vehicleId: string) => void;
  serviceAllVehicles: () => void;
  setMaintenanceTier: (tier: MaintenanceTier) => void;
  unlockDepot: (depotId: string) => void;
  takeBankLoan: (packageId: string) => void;
  repayLoanEarly: (loanId: string) => void;
  claimContractReward: (contractId: string, rewardRp: number, title: string) => void;
  toggleRouteNgetem: (routeId: string) => void;
  upgradeRouteDedicatedLane: (routeId: string) => void;

  initStarterNetwork: () => Promise<void>;
  tickSimulation: (deltaRealSec: number) => void;
  pushNotification: (notif: Omit<FloatingNotification, 'id' | 'createdAt'>) => void;
  pushCashPopup: (
    amountRp: number,
    categoryLabel: string,
    coords?: [number, number]
  ) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  companyName: 'PO Nusantara Jaya Trans',
  currentCityId: 'jabodetabek',
  starterMode: 'zero_25m',
  weather: 'cerah',
  _weatherAccumMinutes: 0,

  // DEFAULT START: Rp 25 Juta, 0 Halte & 0 Armada ("Rintis dari Nol")!
  balanceRp: 25_000_000,
  totalRevenueRp: 0,
  totalOpCostRp: 0,
  totalCapexSpentRp: 0,
  financialBreakdown: { ...INITIAL_FINANCIAL_BREAKDOWN },
  dailyLedger: [],
  _todayRevenueRp: 0,
  _todayVariableOpCostRp: 0,
  totalPassengersServed: 0,
  totalTransfersCompleted: 0,
  jakLingkoBonusRp: 0,
  totalTakenByOjol: 0,
  senenTanahAbangPax: 0,
  gameMinutes: 375, // 06:15 WIB
  gameDay: 1,
  gameSpeed: 1,

  maintenanceTier: 'standar',
  depots: INITIAL_JAKARTA_DEPOTS.map((d) => ({ ...d })),
  activeLoans: [],
  claimedContractIds: [],
  cashPopups: [],

  // Starts with 0 Stops, 0 Routes, 0 Vehicles!
  stops: [],
  routes: [],
  transferLinks: [],
  vehicles: [],
  roadsidePassengers: [],
  notifications: [],

  isLeftPanelOpen: true,
  activeModal: 'none',
  mapViewJumpVersion: 1,
  cameraMode: '3d',
  mapThemeMode: 'auto',
  show3DBuildings: true,
  showCatchmentRadius: true,
  interactionMode: 'view',
  pendingStopCategory: 'perumahan',
  cursorPreview: null,
  selectedRouteId: null,
  selectedStopId: null,
  selectedVehicleId: null,
  draftRouteStopIds: [],
  draftRouteAnalysis: null,
  ghostPreview: null,
  isBuildingRoute: false,
  starterInitialized: false,

  _spawnAccumMinutes: 0,
  _roadsideAccumMinutes: 0,
  _opCostAccumRp: 0,
  _opCostAccumMinutes: 0,

  // Telemetry Defaults
  _telemetryPeriodPaxSpawned: 0,
  _telemetryPeriodPaxServed: 0,
  _telemetryPeriodPaxOjol: 0,
  _telemetryPeriodTrips: 0,
  _telemetryPeriodRev: 0,
  _telemetryPeriodOpCost: 0,
  _lastTelemetryPeriodLabel: 'Rush Hour Pagi',
  telemetryHistory: [],

  setGameSpeed: (speed) => set({ gameSpeed: speed }),

  skipNight: () => {
    const state = get();
    const currentHour = (state.gameMinutes / 60) % 24;
    // Fast-forward night hours (21:00 - 05:00) straight to Dawn (05:30 WIB)
    const isNightTime = currentHour >= 21 || currentHour < 5;
    if (!isNightTime) {
      set((s) => ({
        notifications: [
          ...s.notifications.slice(-10),
          {
            id: `skip-warn-${Date.now()}`,
            text: 'Belum Waktu Malam',
            subtext: 'Fitur lewati malam aktif pukul 21:00 - 05:00 WIB.',
            type: 'info',
            createdAt: Date.now(),
          },
        ],
      }));
      return;
    }

    let nextDay = state.gameDay;
    let nextBalance = state.balanceRp;
    let nextLoans = state.activeLoans;
    let nextDailyLedger = state.dailyLedger;
    let newPopups = state.cashPopups;

    if (currentHour >= 21) {
      nextDay += 1;
      const estDeduction = computeEstimatedMidnightDeduction(state);
      nextBalance -= estDeduction;

      if (state.activeLoans.length > 0) {
        const updatedLoans: ActiveLoan[] = [];
        for (const l of state.activeLoans) {
          const pay = Math.min(l.remainingRp, l.dailyInstallmentRp);
          const rem = l.remainingRp - pay;
          const dLeft = l.daysLeft - 1;
          if (rem > 0 && dLeft > 0) {
            updatedLoans.push({ ...l, remainingRp: rem, daysLeft: dLeft });
          }
        }
        nextLoans = updatedLoans;
      }

      if (estDeduction > 0) {
        const popup: CashPopupEvent = {
          id: `cash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          amountRp: -Math.round(estDeduction),
          label: formatSignedRp(-estDeduction),
          categoryLabel: `Tutup Buku H-${state.gameDay}`,
          createdAt: Date.now(),
        };
        newPopups = [...state.cashPopups.slice(-15), popup];
      }

      const netProfitToday =
        state._todayRevenueRp - state._todayVariableOpCostRp - estDeduction;
      const newEntry: DailyLedgerEntry = {
        day: state.gameDay,
        revenueRp: Math.round(state._todayRevenueRp),
        variableOpCostRp: Math.round(state._todayVariableOpCostRp),
        fixedOpCostRp: Math.round(estDeduction),
        netProfitRp: Math.round(netProfitToday),
      };
      nextDailyLedger = [...state.dailyLedger.slice(-14), newEntry];
    }

    set({
      gameDay: nextDay,
      gameMinutes: 330, // 05:30 WIB Subuh
      balanceRp: nextBalance,
      activeLoans: nextLoans,
      dailyLedger: nextDailyLedger,
      cashPopups: newPopups,
      _todayRevenueRp: 0,
      _todayVariableOpCostRp: 0,
      notifications: [
        ...state.notifications.slice(-10),
        {
          id: `skip-${Date.now()}`,
          text: '🌙 Malam Dilewati ➔ 05:30 WIB',
          subtext: 'Waktu Subuh! Bersiap menyambut Rush Hour Pagi.',
          type: 'info',
          createdAt: Date.now(),
        },
      ],
    });
  },

  toggleLeftPanel: () => set((s) => ({ isLeftPanelOpen: !s.isLeftPanelOpen })),

  setLeftPanelOpen: (open) => set({ isLeftPanelOpen: open }),

  setActiveModal: (modal) =>
    set((s) => ({ activeModal: s.activeModal === modal ? 'none' : modal })),

  toggleCameraMode: () =>
    set((s) => ({ cameraMode: s.cameraMode === '3d' ? '2d' : '3d' })),

  cycleMapThemeMode: () =>
    set((s) => ({
      mapThemeMode:
        s.mapThemeMode === 'auto'
          ? 'day'
          : s.mapThemeMode === 'day'
          ? 'night'
          : 'auto',
    })),

  cycleWeather: () =>
    set((s) => {
      const next: WeatherCondition =
        s.weather === 'cerah'
          ? 'hujan'
          : s.weather === 'hujan'
          ? 'banjir'
          : 'cerah';
      return { weather: next, _weatherAccumMinutes: 0 };
    }),

  toggle3DBuildings: () =>
    set((s) => {
      const nextShow = !s.show3DBuildings;
      return {
        show3DBuildings: nextShow,
        cameraMode: nextShow ? '3d' : s.cameraMode,
      };
    }),

  toggleCatchmentRadius: () =>
    set((s) => ({ showCatchmentRadius: !s.showCatchmentRadius })),

  setInteractionMode: (mode) =>
    set({
      interactionMode: mode,
      isLeftPanelOpen: true,
      activeModal: 'none',
      cursorPreview: mode === 'place_stop' ? get().cursorPreview : null,
      draftRouteStopIds: mode === 'draw_route' ? [] : get().draftRouteStopIds,
      draftRouteAnalysis: mode === 'draw_route' ? null : get().draftRouteAnalysis,
      ghostPreview: null,
    }),

  setPendingStopCategory: (cat) => set({ pendingStopCategory: cat }),

  setCursorPreview: (preview) => set({ cursorPreview: preview }),

  selectRoute: (routeId) => set({ selectedRouteId: routeId }),

  selectStop: (stopId) => set({ selectedStopId: stopId }),

  selectVehicle: (vehicleId) => set({ selectedVehicleId: vehicleId }),

  setCompanyName: (name) => {
    set({ companyName: name.trim() || 'PO Nusantara Jaya Trans' });
    get().saveCurrentCityToStorage();
  },

  pushNotification: (notif) =>
    set((s) => ({
      notifications: [
        ...s.notifications.slice(-8),
        {
          ...notif,
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: Date.now(),
        },
      ],
    })),

  pushCashPopup: (amountRp, categoryLabel, coords) => {
    if (Math.round(Math.abs(amountRp)) === 0) return;
    const now = Date.now();
    const newPopup: CashPopupEvent = {
      id: `cash-${now}-${Math.random().toString(36).slice(2, 6)}`,
      amountRp: Math.round(amountRp),
      label: formatSignedRp(amountRp),
      categoryLabel,
      coords,
      createdAt: now,
    };
    set((s) => ({
      cashPopups: [...s.cashPopups.slice(-15), newPopup],
    }));
  },

  saveCurrentCityToStorage: () => {
    try {
      const s = get();
      const payload = {
        companyName: s.companyName,
        currentCityId: s.currentCityId,
        starterMode: s.starterMode,
        weather: s.weather,
        balanceRp: s.balanceRp,
        totalRevenueRp: s.totalRevenueRp,
        totalOpCostRp: s.totalOpCostRp,
        totalCapexSpentRp: s.totalCapexSpentRp,
        financialBreakdown: s.financialBreakdown,
        dailyLedger: s.dailyLedger,
        totalPassengersServed: s.totalPassengersServed,
        totalTransfersCompleted: s.totalTransfersCompleted,
        jakLingkoBonusRp: s.jakLingkoBonusRp,
        totalTakenByOjol: s.totalTakenByOjol,
        senenTanahAbangPax: s.senenTanahAbangPax,
        gameMinutes: s.gameMinutes,
        gameDay: s.gameDay,
        maintenanceTier: s.maintenanceTier,
        depots: s.depots,
        activeLoans: s.activeLoans,
        claimedContractIds: s.claimedContractIds,
        stops: s.stops,
        routes: s.routes,
        vehicles: s.vehicles,
        savedAt: Date.now(),
      };
      localStorage.setItem(
        `${SAVE_KEY_PREFIX}${s.currentCityId}`,
        JSON.stringify(payload)
      );
    } catch (e) {
      console.warn('Failed to save city state:', e);
    }
  },

  loadCityFromStorage: (cityId) => {
    try {
      const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${cityId}`);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data.balanceRp !== 'number') return false;

      const loadedStops: StopNode[] = Array.isArray(data.stops) ? data.stops : [];
      const loadedRoutes: TransitRoute[] = Array.isArray(data.routes)
        ? data.routes
        : [];
      const { links } = detectTransferLinks(loadedRoutes, loadedStops);

      set((s) => ({
        companyName: data.companyName || s.companyName,
        currentCityId: cityId,
        starterMode: data.starterMode || 'zero_25m',
        weather: data.weather || 'cerah',
        balanceRp: data.balanceRp,
        totalRevenueRp: data.totalRevenueRp || 0,
        totalOpCostRp: data.totalOpCostRp || 0,
        totalCapexSpentRp: data.totalCapexSpentRp || 0,
        financialBreakdown: {
          ...INITIAL_FINANCIAL_BREAKDOWN,
          ...(data.financialBreakdown || {}),
        },
        dailyLedger: Array.isArray(data.dailyLedger) ? data.dailyLedger : [],
        _todayRevenueRp: 0,
        _todayVariableOpCostRp: 0,
        totalPassengersServed: data.totalPassengersServed || 0,
        totalTransfersCompleted: data.totalTransfersCompleted || 0,
        jakLingkoBonusRp: data.jakLingkoBonusRp || 0,
        totalTakenByOjol: data.totalTakenByOjol || 0,
        senenTanahAbangPax: data.senenTanahAbangPax || 0,
        gameMinutes: data.gameMinutes || 375,
        gameDay: data.gameDay || 1,
        maintenanceTier: data.maintenanceTier || 'standar',
        depots: Array.isArray(data.depots)
          ? data.depots
          : CITY_PRESETS[cityId].depots.map((d) => ({ ...d })),
        activeLoans: Array.isArray(data.activeLoans) ? data.activeLoans : [],
        claimedContractIds: Array.isArray(data.claimedContractIds)
          ? data.claimedContractIds
          : [],
        stops: loadedStops,
        routes: loadedRoutes,
        transferLinks: links,
        vehicles: Array.isArray(data.vehicles)
          ? data.vehicles.map((v: any) => ({
              ...v,
              totalFuelCostRp: v.totalFuelCostRp || 0,
              totalMaintenanceCostRp: v.totalMaintenanceCostRp || 0,
              totalPaxCarried: v.totalPaxCarried || 0,
              totalDistanceTraveledKm: v.totalDistanceTraveledKm || 0,
            }))
          : [],
        roadsidePassengers: [],
        selectedRouteId: loadedRoutes[0]?.id ?? null,
        selectedStopId: null,
        draftRouteStopIds: [],
        interactionMode: 'view',
        mapViewJumpVersion: s.mapViewJumpVersion + 1,
      }));
      return true;
    } catch (e) {
      console.warn('Failed to load city state:', e);
      return false;
    }
  },

  switchCity: (cityId) => {
    const state = get();
    // 1. Save current city before leaving
    state.saveCurrentCityToStorage();

    // 2. Try loading saved progress for the target city
    const loaded = state.loadCityFromStorage(cityId);
    if (loaded) {
      state.pushNotification({
        text: `✈️ Pindah Cabang: ${CITY_PRESETS[cityId].name}`,
        subtext: 'Progres tersimpan berhasil dimuat dari penyimpanan lokal.',
        type: 'info',
      });
      return;
    }

    // 3. Otherwise initialize fresh Rp 25 Jt Zero-Stop/Zero-Fleet in the target city
    const preset = CITY_PRESETS[cityId];
    set((s) => ({
      currentCityId: cityId,
      starterMode: 'zero_25m',
      weather: 'cerah',
      balanceRp: 25_000_000,
      totalRevenueRp: 0,
      totalOpCostRp: 0,
      totalCapexSpentRp: 0,
      financialBreakdown: { ...INITIAL_FINANCIAL_BREAKDOWN },
      dailyLedger: [],
      _todayRevenueRp: 0,
      _todayVariableOpCostRp: 0,
      totalPassengersServed: 0,
      totalTransfersCompleted: 0,
      jakLingkoBonusRp: 0,
      totalTakenByOjol: 0,
      senenTanahAbangPax: 0,
      gameMinutes: 375,
      gameDay: 1,
      maintenanceTier: 'standar',
      depots: preset.depots.map((d) => ({ ...d })),
      activeLoans: [],
      claimedContractIds: [],
      cashPopups: [],
      stops: [],
      routes: [],
      transferLinks: [],
      vehicles: [],
      roadsidePassengers: [],
      selectedRouteId: null,
      selectedStopId: null,
      draftRouteStopIds: [],
      interactionMode: 'view',
      mapViewJumpVersion: s.mapViewJumpVersion + 1,
    }));

    get().saveCurrentCityToStorage();
    get().pushNotification({
      text: `🌱 Buka Cabang Baru: ${preset.name}!`,
      subtext:
        'Modal awal Rp 25 Jt • 0 Halte & 0 Armada. Pasang 2 Halte pertama lalu tarik trayek!',
      type: 'info',
    });
  },

  resetCityGame: (mode, customCompanyName) => {
    const state = get();
    const cityId = state.currentCityId;
    const preset = CITY_PRESETS[cityId];

    const initialStops =
      mode === 'sandbox_hubs'
        ? preset.sandboxHubs.map((st) => ({
            ...st,
            waitingBatches: st.waitingBatches.map((b) => ({ ...b })),
          }))
        : [];

    const initialBalance =
      mode === 'investor_75m'
        ? 75_000_000
        : mode === 'sandbox_hubs'
        ? 50_000_000
        : 25_000_000;

    const initialLoans: ActiveLoan[] =
      mode === 'investor_75m'
        ? [
            {
              id: `loan-init-${Date.now()}`,
              packageId: 'loan-mikro',
              name: 'Kredit Modal Kerja Awal',
              remainingRp: 60_000_000,
              dailyInstallmentRp: 12_000_000,
              daysLeft: 5,
            },
          ]
        : [];

    try {
      localStorage.removeItem(`${SAVE_KEY_PREFIX}${cityId}`);
    } catch {
      // ignore
    }

    set((s) => ({
      companyName:
        customCompanyName?.trim() || s.companyName || 'PO Nusantara Jaya Trans',
      starterMode: mode,
      weather: 'cerah',
      balanceRp: initialBalance,
      totalRevenueRp: 0,
      totalOpCostRp: 0,
      totalCapexSpentRp: 0,
      financialBreakdown: { ...INITIAL_FINANCIAL_BREAKDOWN },
      dailyLedger: [],
      _todayRevenueRp: 0,
      _todayVariableOpCostRp: 0,
      totalPassengersServed: 0,
      totalTransfersCompleted: 0,
      jakLingkoBonusRp: 0,
      totalTakenByOjol: 0,
      senenTanahAbangPax: 0,
      gameMinutes: 375,
      gameDay: 1,
      maintenanceTier: 'standar',
      depots: preset.depots.map((d) => ({ ...d })),
      activeLoans: initialLoans,
      claimedContractIds: [],
      cashPopups: [],
      stops: initialStops,
      routes: [],
      transferLinks: [],
      vehicles: [],
      roadsidePassengers: [],
      selectedRouteId: null,
      selectedStopId: null,
      draftRouteStopIds: [],
      interactionMode: 'view',
      activeModal: 'none',
      mapViewJumpVersion: s.mapViewJumpVersion + 1,
    }));

    get().saveCurrentCityToStorage();
    get().pushCashPopup(
      initialBalance,
      `Modal Awal PO (${
        mode === 'zero_25m'
          ? 'Rintis Mandiri Rp 25 Jt'
          : mode === 'investor_75m'
          ? 'Investor + Kredit Rp 75 Jt'
          : 'Konsesi Hub Rp 50 Jt'
      })`
    );
  },

  addCustomStop: (coords, inspected, customName) => {
    const state = get();
    if (state.balanceRp < CUSTOM_STOP_BUILD_COST) {
      state.pushNotification({
        text: 'Saldo Tidak Cukup!',
        subtext: `Butuh Rp ${(CUSTOM_STOP_BUILD_COST / 1_000_000).toFixed(1)} Jt untuk pasang plang/halte.`,
        type: 'expense',
        coords,
      });
      return;
    }

    const defaultName =
      customName ||
      inspected?.detectedAreaName ||
      estimateStopNameFromLocation(
        coords,
        state.pendingStopCategory,
        state.stops,
        undefined,
        state.currentCityId
      );

    const buildingCount = inspected?.buildingCount ?? 55;
    const demandTier = inspected?.demandTier ?? 'Sedang';
    const baseDemandWeight = inspected?.estimatedWeight ?? 1.8;

    let resolvedCategory = state.pendingStopCategory;
    const lowerName = defaultName.toLowerCase();
    if (
      lowerName.includes('sudirman') ||
      lowerName.includes('thamrin') ||
      lowerName.includes('kuningan') ||
      lowerName.includes('rasuna') ||
      lowerName.includes('gatot subroto') ||
      lowerName.includes('scbd') ||
      lowerName.includes('kantor') ||
      lowerName.includes('cbd') ||
      lowerName.includes('bumn') ||
      lowerName.includes('senayan') ||
      lowerName.includes('setiabudi')
    ) {
      resolvedCategory = 'kantor';
    } else if (
      lowerName.includes('pasar') ||
      lowerName.includes('tanah abang') ||
      lowerName.includes('senen') ||
      lowerName.includes('glodok') ||
      lowerName.includes('mall') ||
      lowerName.includes('plaza') ||
      lowerName.includes('grosir')
    ) {
      resolvedCategory = 'pasar';
    }

    const initCount = Math.min(20, Math.floor(6 + baseDemandWeight * 4));
    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
    const newStop: StopNode = {
      id: `stop-custom-${Date.now()}-${uniqueSuffix}`,
      name: defaultName,
      coords,
      category: resolvedCategory,
      level: 1,
      isPrebuiltHub: false,
      catchmentRadiusM: 300,
      baseDemandWeight,
      buildingCount,
      demandTier,
      waitingBatches: [
        {
          id: `batch-init-${Date.now()}-${uniqueSuffix}`,
          count: initCount,
          spawnedAtMinute: state.gameMinutes,
          maxPatienceMinutes: 65,
        },
      ],
      totalWaiting: initCount,
      transitWaiting: 0,
      totalTransfersHandled: 0,
      ojolLostCount: 0,
    };

    set((s) => {
      const nextStops = [...s.stops, newStop];
      const { links } = detectTransferLinks(s.routes, nextStops);
      return {
        balanceRp: s.balanceRp - CUSTOM_STOP_BUILD_COST,
        totalCapexSpentRp: s.totalCapexSpentRp + CUSTOM_STOP_BUILD_COST,
        financialBreakdown: {
          ...s.financialBreakdown,
          stopBuildAndUpgradeRp:
            (s.financialBreakdown?.stopBuildAndUpgradeRp || 0) + CUSTOM_STOP_BUILD_COST,
        },
        stops: nextStops,
        transferLinks: links,
        selectedStopId: newStop.id,
        interactionMode: 'view',
        cursorPreview: null,
      };
    });

    get().pushCashPopup(-CUSTOM_STOP_BUILD_COST, `Bangun ${defaultName}`, coords);
    get().saveCurrentCityToStorage();
  },

  upgradeStopLevel: (stopId) => {
    const state = get();
    const stop = state.stops.find((s) => s.id === stopId);
    if (!stop || stop.level >= 3) return;

    const nextLevel = (stop.level + 1) as StopTierLevel;
    const nextSpec = STOP_TIER_SPECS[nextLevel];

    if (state.balanceRp < nextSpec.upgradeCostRp) {
      state.pushNotification({
        text: 'Dana Upgrade Halte Kurang!',
        subtext: `Butuh Rp ${(nextSpec.upgradeCostRp / 1_000_000).toFixed(0)} Jt untuk ${nextSpec.shortName}.`,
        type: 'expense',
        coords: stop.coords,
      });
      return;
    }

    set((s) => ({
      balanceRp: s.balanceRp - nextSpec.upgradeCostRp,
      totalCapexSpentRp: s.totalCapexSpentRp + nextSpec.upgradeCostRp,
      financialBreakdown: {
        ...s.financialBreakdown,
        stopBuildAndUpgradeRp:
          (s.financialBreakdown?.stopBuildAndUpgradeRp || 0) + nextSpec.upgradeCostRp,
      },
      stops: s.stops.map((st) => {
        if (st.id !== stopId) return st;
        const cleanName = st.name.replace(
          /^(Plang|Halte|Shelter|Shelter BRT|Simpang)\s+/i,
          ''
        );
        const newPrefix =
          nextLevel === 3 ? 'Shelter BRT' : nextLevel === 2 ? 'Halte' : 'Plang';
        return {
          ...st,
          name: `${newPrefix} ${cleanName}`,
          level: nextLevel,
          catchmentRadiusM: nextLevel === 3 ? 500 : st.catchmentRadiusM,
        };
      }),
    }));

    get().pushCashPopup(
      -nextSpec.upgradeCostRp,
      `Upgrade ${stop.name} (Lv.${nextLevel})`,
      stop.coords
    );
    get().saveCurrentCityToStorage();
  },

  toggleDraftStop: (stopId) => {
    set((s) => {
      const exists = s.draftRouteStopIds.includes(stopId);
      if (exists) {
        return {
          draftRouteStopIds: s.draftRouteStopIds.filter((id) => id !== stopId),
        };
      }
      return {
        draftRouteStopIds: [...s.draftRouteStopIds, stopId],
      };
    });
    get().refreshDraftRouteAnalysis();
  },

  reverseDraftRoute: () => {
    set((s) => ({
      draftRouteStopIds: [...s.draftRouteStopIds].reverse(),
    }));
    get().refreshDraftRouteAnalysis();
  },

  removeLastDraftStop: () => {
    set((s) => ({
      draftRouteStopIds: s.draftRouteStopIds.slice(0, -1),
    }));
    get().refreshDraftRouteAnalysis();
  },

  setGhostPreview: (preview) => set({ ghostPreview: preview }),

  refreshDraftRouteAnalysis: async () => {
    const state = get();
    const orderedStops = state.draftRouteStopIds
      .map((id) => state.stops.find((s) => s.id === id))
      .filter((s): s is StopNode => Boolean(s));

    if (orderedStops.length < 2) {
      set({ draftRouteAnalysis: null });
      return;
    }

    try {
      const currentDraftKey = state.draftRouteStopIds.join(',');
      const analysis = await analyzeMultiStopRoute(orderedStops);
      if (get().draftRouteStopIds.join(',') === currentDraftKey) {
        set({ draftRouteAnalysis: analysis });
      }
    } catch (err) {
      console.warn('Gagal analisis rute draft:', err);
    }
  },

  clearDraftRoute: () =>
    set({
      draftRouteStopIds: [],
      draftRouteAnalysis: null,
      ghostPreview: null,
      interactionMode: 'view',
    }),

  finalizeDraftRoute: async (customName) => {
    const state = get();
    if (state.draftRouteStopIds.length < 2 || state.isBuildingRoute) return;

    const orderedStops = state.draftRouteStopIds
      .map((id) => state.stops.find((s) => s.id === id))
      .filter((s): s is StopNode => Boolean(s));

    if (orderedStops.length < 2) return;

    set({ isBuildingRoute: true });

    try {
      const { geometry, totalLengthKm, stopDistancesKm, routingSource } =
        await buildRoadSnappedRoute(orderedStops);

      const routeIdx = get().routes.length + 1;
      const color = ROUTE_COLORS[(routeIdx - 1) % ROUTE_COLORS.length];
      const firstStopName = orderedStops[0].name.replace(
        /^(Stasiun|Terminal|Pasar|Halte|Plang|Simpang)\s+/i,
        ''
      );
      const lastStopName = orderedStops[orderedStops.length - 1].name.replace(
        /^(Stasiun|Terminal|Pasar|Halte|Plang|Simpang)\s+/i,
        ''
      );

      const newRoute: TransitRoute = {
        id: `route-${Date.now()}`,
        code: `T-${String(routeIdx).padStart(2, '0')}`,
        name: customName || `${firstStopName} – ${lastStopName}`,
        color,
        stopIds: orderedStops.map((s) => s.id),
        geometry,
        totalLengthKm,
        stopDistancesKm,
        routingSource,
        customFareRp: 5_000,
        ngetemEnabled: true,
        ngetemThresholdPct: 0.7,
        dedicatedLaneEnabled: false,
        dedicatedLaneCostPaid: 0,
        totalRevenueRp: 0,
        totalOpCostRp: 0,
        totalPassengersCarried: 0,
      };

      const nextRoutes = [...get().routes, newRoute];
      const { links } = detectTransferLinks(nextRoutes, get().stops);

      set({
        routes: nextRoutes,
        transferLinks: links,
        selectedRouteId: newRoute.id,
        draftRouteStopIds: [],
        draftRouteAnalysis: null,
        ghostPreview: null,
        interactionMode: 'view',
        isBuildingRoute: false,
      });

      const sourceLabel =
        routingSource === 'osrm'
          ? 'OSRM Jalan Raya'
          : routingSource === 'cache'
          ? 'Cache Lokal 0ms'
          : 'Graf Jalan Offline';

      get().pushNotification({
        text: `Trayek ${newRoute.code} Dibuka!`,
        subtext: `${newRoute.name} (${totalLengthKm.toFixed(1)} km • ${sourceLabel})`,
        type: 'info',
      });
      get().saveCurrentCityToStorage();
    } catch (err) {
      console.error(err);
      set({ isBuildingRoute: false });
    }
  },

  deleteRoute: (routeId) => {
    const state = get();
    const targetRoute = state.routes.find((r) => r.id === routeId);
    const nextRoutes = state.routes.filter((r) => r.id !== routeId);
    const { links } = detectTransferLinks(nextRoutes, state.stops);
    const poolCoords = state.depots[0]?.coords || [106.8438, -6.1985];

    set((s) => ({
      routes: nextRoutes,
      transferLinks: links,
      vehicles: s.vehicles.map((v) =>
        v.routeId === routeId
          ? {
              ...v,
              routeId: null,
              status: 'IDLE_IN_POOL',
              state: 'idle_pool',
              passengers: 0,
              currentSpeedKmh: 0,
              coords: poolCoords,
              currentStopIndex: null,
            }
          : v
      ),
      roadsidePassengers: s.roadsidePassengers.filter((p) => p.routeId !== routeId),
      selectedRouteId:
        s.selectedRouteId === routeId ? (nextRoutes[0]?.id ?? null) : s.selectedRouteId,
    }));

    if (targetRoute) {
      get().pushNotification({
        text: `Trayek ${targetRoute.code} Ditutup`,
        subtext: 'Seluruh armada di trayek ini ditarik kembali ke Stok Pool Garasi.',
        type: 'info',
      });
    }
    get().saveCurrentCityToStorage();
  },

  setRouteCustomFare: (routeId, fareRp) => {
    const clamped = Math.max(2_000, Math.min(15_000, Math.round(fareRp / 500) * 500));
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === routeId ? { ...r, customFareRp: clamped } : r
      ),
    }));
  },

  buyVehicle: (fleetType, targetRouteId = null) => {
    const state = get();

    const maxSlots = computeMaxFleetSlots(state.depots);
    if (state.vehicles.length >= maxSlots) {
      state.pushNotification({
        text: `Kapasitas Pool Garasi Penuh (${state.vehicles.length}/${maxSlots})!`,
        subtext: 'Buka Pool baru di menu Garasi Pool untuk tambah slot.',
        type: 'expense',
      });
      return;
    }

    const spec = FLEET_SPECS[fleetType];
    if (state.balanceRp < spec.purchasePrice) {
      state.pushNotification({
        text: 'Modal Juragan Kurang!',
        subtext: `Harga ${spec.name}: Rp ${(spec.purchasePrice / 1_000_000).toFixed(0)} Juta`,
        type: 'expense',
      });
      return;
    }

    const targetRoute = targetRouteId
      ? state.routes.find((r) => r.id === targetRouteId) || null
      : null;

    if (targetRoute && spec.requiresLevel3Stop) {
      const level3StopsOnRoute = targetRoute.stopIds.filter((sid) => {
        const st = state.stops.find((s) => s.id === sid);
        return st && st.level === 3;
      });
      if (level3StopsOnRoute.length < 2) {
        state.pushNotification({
          text: 'Syarat BRT: Minimal 2 Halte Level 3 (JPO)!',
          subtext: `Trayek ${targetRoute.code} baru punya ${level3StopsOnRoute.length} Halte Lv.3. Pilih "Simpan di Pool" atau upgrade halte dulu!`,
          type: 'expense',
        });
        return;
      }
    }

    const poolCoords = state.depots[0]?.coords || [106.8438, -6.1985];
    let startDistKm = 0;
    let coords: [number, number] = poolCoords;
    let bearing = 0;

    if (targetRoute) {
      const existingOnRoute = state.vehicles.filter(
        (v) => v.routeId === targetRoute.id
      ).length;
      startDistKm =
        existingOnRoute === 0
          ? 0
          : (existingOnRoute * 0.27) % Math.max(0.2, targetRoute.totalLengthKm * 0.85);

      const transform = getVehicleTransformAlongRoute(
        targetRoute.geometry,
        startDistKm,
        targetRoute.totalLengthKm,
        1
      );
      coords = transform.coords;
      bearing = transform.bearing;
    }

    const newVehicle: Vehicle = {
      id: `veh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      routeId: targetRoute ? targetRoute.id : null,
      status: targetRoute ? 'ACTIVE' : 'IDLE_IN_POOL',
      type: fleetType,
      plateNumber: generateCityPlate(fleetType, state.currentCityId),
      distanceKm: startDistKm,
      direction: 1,
      coords,
      bearing,
      currentSpeedKmh: targetRoute ? spec.baseSpeedKmh : 0,
      passengers: 0,
      capacity: spec.capacity,
      condition: 100,
      state: targetRoute ? 'moving' : 'idle_pool',
      dwellTimerSec: 0,
      maxNgetemTimerSec: 0,
      mogokTimerMinutes: 0,
      currentStopIndex: null,
      totalRevenueGenerated: 0,
      totalTripsCompleted: 0,
      totalFuelCostRp: 0,
      totalMaintenanceCostRp: 0,
      totalPaxCarried: 0,
      totalDistanceTraveledKm: 0,
    };

    set((s) => ({
      balanceRp: s.balanceRp - spec.purchasePrice,
      totalCapexSpentRp: s.totalCapexSpentRp + spec.purchasePrice,
      financialBreakdown: {
        ...s.financialBreakdown,
        fleetPurchaseRp:
          (s.financialBreakdown?.fleetPurchaseRp || 0) + spec.purchasePrice,
      },
      vehicles: [...s.vehicles, newVehicle],
    }));

    get().pushCashPopup(
      -spec.purchasePrice,
      `Beli ${spec.name} (${newVehicle.plateNumber})`,
      coords
    );
    get().saveCurrentCityToStorage();
  },

  assignVehicleToRoute: (vehicleId, targetRouteId) => {
    const state = get();
    const veh = state.vehicles.find((v) => v.id === vehicleId);
    if (!veh) return;

    const spec = FLEET_SPECS[veh.type];
    const poolCoords = state.depots[0]?.coords || [106.8438, -6.1985];

    if (!targetRouteId) {
      set((s) => ({
        vehicles: s.vehicles.map((v) =>
          v.id === vehicleId
            ? {
                ...v,
                routeId: null,
                status: 'IDLE_IN_POOL',
                state: 'idle_pool',
                passengers: 0,
                currentSpeedKmh: 0,
                coords: poolCoords,
                dwellTimerSec: 0,
                maxNgetemTimerSec: 0,
                mogokTimerMinutes: 0,
                currentStopIndex: null,
              }
            : v
        ),
      }));
      get().saveCurrentCityToStorage();
      return;
    }

    const targetRoute = state.routes.find((r) => r.id === targetRouteId);
    if (!targetRoute) return;

    if (spec.requiresLevel3Stop) {
      const level3StopsOnRoute = targetRoute.stopIds.filter((sid) => {
        const st = state.stops.find((s) => s.id === sid);
        return st && st.level === 3;
      });
      if (level3StopsOnRoute.length < 2) {
        state.pushNotification({
          text: `Gagal Terjunkan BRT ke ${targetRoute.code}!`,
          subtext: `Trayek ${targetRoute.code} wajib memiliki minimal 2 Halte Level 3 (BRT + JPO).`,
          type: 'expense',
        });
        return;
      }
    }

    const existingOnRoute = state.vehicles.filter(
      (v) => v.routeId === targetRoute.id && v.id !== vehicleId
    ).length;
    const startDistKm =
      existingOnRoute === 0
        ? 0
        : (existingOnRoute * 0.27) % Math.max(0.2, targetRoute.totalLengthKm * 0.85);

    const { coords, bearing } = getVehicleTransformAlongRoute(
      targetRoute.geometry,
      startDistKm,
      targetRoute.totalLengthKm,
      1
    );

    set((s) => ({
      vehicles: s.vehicles.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              routeId: targetRoute.id,
              status: 'ACTIVE',
              state: 'moving',
              distanceKm: startDistKm,
              direction: 1,
              coords,
              bearing,
              currentSpeedKmh: spec.baseSpeedKmh,
              passengers: 0,
              dwellTimerSec: 0,
              maxNgetemTimerSec: 0,
              mogokTimerMinutes: 0,
              currentStopIndex: null,
            }
          : v
      ),
    }));
    get().saveCurrentCityToStorage();
  },

  sellVehicle: (vehicleId) => {
    const state = get();
    const v = state.vehicles.find((veh) => veh.id === vehicleId);
    if (!v) return;
    const condFactor = Math.max(0.35, v.condition / 100);
    const refund = Math.floor(FLEET_SPECS[v.type].purchasePrice * 0.6 * condFactor);

    set((s) => ({
      balanceRp: s.balanceRp + refund,
      financialBreakdown: {
        ...s.financialBreakdown,
        vehicleSalesRefundRp:
          (s.financialBreakdown?.vehicleSalesRefundRp || 0) + refund,
      },
      vehicles: s.vehicles.filter((veh) => veh.id !== vehicleId),
    }));

    get().pushCashPopup(refund, `Jual Bekas ${v.plateNumber}`, v.coords);
    get().saveCurrentCityToStorage();
  },

  serviceVehicle: (vehicleId) => {
    const state = get();
    const v = state.vehicles.find((veh) => veh.id === vehicleId);
    if (!v || v.condition >= 99) return;
    if (state.balanceRp < VEHICLE_OVERHAUL_COST_RP) {
      state.pushNotification({
        text: 'Saldo Kurang untuk Servis Turun Mesin!',
        subtext: `Biaya servis Rp ${(VEHICLE_OVERHAUL_COST_RP / 1_000_000).toFixed(1)} Jt.`,
        type: 'expense',
      });
      return;
    }

    set((s) => ({
      balanceRp: s.balanceRp - VEHICLE_OVERHAUL_COST_RP,
      totalOpCostRp: s.totalOpCostRp + VEHICLE_OVERHAUL_COST_RP,
      financialBreakdown: {
        ...s.financialBreakdown,
        maintenanceCostRp:
          (s.financialBreakdown?.maintenanceCostRp || 0) + VEHICLE_OVERHAUL_COST_RP,
      },
      vehicles: s.vehicles.map((veh) =>
        veh.id === vehicleId
          ? {
              ...veh,
              condition: 100,
              totalMaintenanceCostRp:
                (veh.totalMaintenanceCostRp || 0) + VEHICLE_OVERHAUL_COST_RP,
              status: veh.routeId ? 'ACTIVE' : 'IDLE_IN_POOL',
              state: veh.routeId
                ? veh.state === 'mogok'
                  ? 'moving'
                  : veh.state
                : 'idle_pool',
              mogokTimerMinutes: 0,
            }
          : veh
      ),
    }));

    get().pushCashPopup(
      -VEHICLE_OVERHAUL_COST_RP,
      `Servis Mesin ${v.plateNumber}`,
      v.coords
    );
  },

  serviceAllVehicles: () => {
    const state = get();
    const needsService = state.vehicles.filter(
      (v) => v.condition < 90 || v.state === 'mogok'
    );
    if (needsService.length === 0) return;

    const totalCost = needsService.length * VEHICLE_OVERHAUL_COST_RP;
    if (state.balanceRp < totalCost) {
      state.pushNotification({
        text: 'Saldo Kurang untuk Servis Semua Armada!',
        subtext: `Butuh Rp ${(totalCost / 1_000_000).toFixed(1)} Jt untuk ${needsService.length} unit.`,
        type: 'expense',
      });
      return;
    }

    set((s) => ({
      balanceRp: s.balanceRp - totalCost,
      totalOpCostRp: s.totalOpCostRp + totalCost,
      financialBreakdown: {
        ...s.financialBreakdown,
        maintenanceCostRp:
          (s.financialBreakdown?.maintenanceCostRp || 0) + totalCost,
      },
      vehicles: s.vehicles.map((veh) => {
        const willService = veh.condition < 90 || veh.state === 'mogok';
        return willService
          ? {
              ...veh,
              condition: 100,
              totalMaintenanceCostRp:
                (veh.totalMaintenanceCostRp || 0) + VEHICLE_OVERHAUL_COST_RP,
              status: veh.routeId ? 'ACTIVE' : 'IDLE_IN_POOL',
              state: veh.routeId
                ? veh.state === 'mogok'
                  ? 'moving'
                  : veh.state
                : 'idle_pool',
              mogokTimerMinutes: 0,
            }
          : veh;
      }),
    }));

    get().pushCashPopup(
      -totalCost,
      `Servis Total ${needsService.length} Armada`
    );
  },

  setMaintenanceTier: (tier) => set({ maintenanceTier: tier }),

  unlockDepot: (depotId) => {
    const state = get();
    const depot = state.depots.find((d) => d.id === depotId);
    if (!depot || depot.unlocked) return;

    if (state.balanceRp < depot.unlockCostRp) {
      state.pushNotification({
        text: 'Dana Akuisisi Lahan Pool Kurang!',
        subtext: `Butuh Rp ${(depot.unlockCostRp / 1_000_000).toFixed(0)} Jt untuk membuka ${depot.name}.`,
        type: 'expense',
        coords: depot.coords,
      });
      return;
    }

    set((s) => ({
      balanceRp: s.balanceRp - depot.unlockCostRp,
      totalCapexSpentRp: s.totalCapexSpentRp + depot.unlockCostRp,
      financialBreakdown: {
        ...s.financialBreakdown,
        depotUnlockRp:
          (s.financialBreakdown?.depotUnlockRp || 0) + depot.unlockCostRp,
      },
      depots: s.depots.map((d) => (d.id === depotId ? { ...d, unlocked: true } : d)),
    }));

    get().pushCashPopup(
      -depot.unlockCostRp,
      `Buka ${depot.name} (+${depot.capacitySlots} Slot)`,
      depot.coords
    );
    get().saveCurrentCityToStorage();
  },

  takeBankLoan: (packageId) => {
    const state = get();
    const pkg = BANK_LOAN_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return;

    if (state.activeLoans.some((l) => l.packageId === packageId)) {
      state.pushNotification({
        text: 'Fasilitas Kredit Ini Masih Aktif!',
        subtext: 'Lunasi dulu pinjaman berjalan pada paket yang sama.',
        type: 'expense',
      });
      return;
    }

    const newLoan: ActiveLoan = {
      id: `loan-${Date.now()}`,
      packageId: pkg.id,
      name: pkg.name,
      remainingRp: pkg.totalRepayRp,
      dailyInstallmentRp: pkg.dailyInstallmentRp,
      daysLeft: pkg.durationDays,
    };

    set((s) => ({
      balanceRp: s.balanceRp + pkg.principalRp,
      financialBreakdown: {
        ...s.financialBreakdown,
        bankLoansDisbursedRp:
          (s.financialBreakdown?.bankLoansDisbursedRp || 0) + pkg.principalRp,
      },
      activeLoans: [...s.activeLoans, newLoan],
    }));

    get().pushCashPopup(pkg.principalRp, `Pencairan ${pkg.name}`);
    get().saveCurrentCityToStorage();
  },

  repayLoanEarly: (loanId) => {
    const state = get();
    const loan = state.activeLoans.find((l) => l.id === loanId);
    if (!loan) return;

    if (state.balanceRp < loan.remainingRp) {
      state.pushNotification({
        text: 'Saldo Belum Cukup untuk Pelunasan Dipercepat!',
        subtext: `Sisa pokok + bunga: Rp ${(loan.remainingRp / 1_000_000).toFixed(1)} Jt.`,
        type: 'expense',
      });
      return;
    }

    set((s) => ({
      balanceRp: s.balanceRp - loan.remainingRp,
      totalOpCostRp: s.totalOpCostRp + loan.remainingRp,
      financialBreakdown: {
        ...s.financialBreakdown,
        loanInterestAndRepayRp:
          (s.financialBreakdown?.loanInterestAndRepayRp || 0) + loan.remainingRp,
      },
      activeLoans: s.activeLoans.filter((l) => l.id !== loanId),
    }));

    get().pushCashPopup(-loan.remainingRp, `Pelunasan ${loan.name}`);
    get().saveCurrentCityToStorage();
  },

  claimContractReward: (contractId, rewardRp, title) => {
    const state = get();
    if (state.claimedContractIds.includes(contractId)) return;

    set((s) => ({
      balanceRp: s.balanceRp + rewardRp,
      totalRevenueRp: s.totalRevenueRp + rewardRp,
      financialBreakdown: {
        ...s.financialBreakdown,
        subsidyPsoRp:
          (s.financialBreakdown?.subsidyPsoRp || 0) + rewardRp,
      },
      claimedContractIds: [...s.claimedContractIds, contractId],
    }));

    get().pushCashPopup(rewardRp, `Subsidi PSO: ${title}`);
    get().saveCurrentCityToStorage();
  },

  toggleRouteNgetem: (routeId) => {
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === routeId ? { ...r, ngetemEnabled: !r.ngetemEnabled } : r
      ),
    }));
  },

  upgradeRouteDedicatedLane: (routeId) => {
    const state = get();
    const route = state.routes.find((r) => r.id === routeId);
    if (!route || route.dedicatedLaneEnabled) return;

    const cost = Math.round(route.totalLengthKm * DEDICATED_LANE_COST_PER_KM);
    if (state.balanceRp < cost) {
      state.pushNotification({
        text: 'Dana Bangun Busway Kurang!',
        subtext: `Butuh Rp ${(cost / 1_000_000).toFixed(1)} Jt untuk ${route.totalLengthKm.toFixed(1)} km Jalur Khusus.`,
        type: 'expense',
      });
      return;
    }

    set((s) => ({
      balanceRp: s.balanceRp - cost,
      totalCapexSpentRp: s.totalCapexSpentRp + cost,
      financialBreakdown: {
        ...s.financialBreakdown,
        dedicatedBuswayRp:
          (s.financialBreakdown?.dedicatedBuswayRp || 0) + cost,
      },
      routes: s.routes.map((r) =>
        r.id === routeId
          ? {
              ...r,
              dedicatedLaneEnabled: true,
              dedicatedLaneCostPaid: cost,
            }
          : r
      ),
    }));

    get().pushCashPopup(-cost, `Separator Busway ${route.code}`);
    get().saveCurrentCityToStorage();
  },

  initStarterNetwork: async () => {
    const state = get();
    if (state.starterInitialized) return;
    set({ starterInitialized: true });

    // Try loading saved game for Jabodetabek first
    const loaded = get().loadCityFromStorage('jabodetabek');
    if (loaded) {
      return;
    }

    // Otherwise start fresh at Rp 25 Jt, 0 Stops & 0 Vehicles ("Rintis PO dari Nol")!
    set({
      balanceRp: 25_000_000,
      stops: [],
      routes: [],
      vehicles: [],
    });

    get().pushNotification({
      text: '🌱 Selamat Datang Juragan PO Baru!',
      subtext:
        'Modal awal Rp 25 Jt: Pasang 2 Halte (Rp 1,5 Jt/unit), Tarik Trayek, lalu Beli Angkot (Rp 12 Jt)! Sisa kas Rp 10 Jt.',
      type: 'info',
    });
  },

  tickSimulation: (deltaRealSec) => {
    const state = get();
    if (state.gameSpeed === 0 || deltaRealSec <= 0) return;

    const clampedRealSec = Math.min(deltaRealSec, 0.1);
    const scaledSec = clampedRealSec * state.gameSpeed;

    const deltaGameMinutes = scaledSec * 1.2;
    let nextGameMinutes = state.gameMinutes + deltaGameMinutes;
    let nextGameDay = state.gameDay;
    let dayRolledOver = false;

    if (nextGameMinutes >= 1440) {
      nextGameMinutes -= 1440;
      nextGameDay += 1;
      dayRolledOver = true;
    }

    // Dynamic Weather Transition every ~210 in-game minutes (3.5 hours)
    let nextWeather = state.weather;
    let nextWeatherAccum = state._weatherAccumMinutes + deltaGameMinutes;
    if (nextWeatherAccum >= 210) {
      nextWeatherAccum = 0;
      const roll = Math.random();
      if (state.weather === 'cerah') {
        nextWeather = roll < 0.38 ? 'hujan' : 'cerah';
      } else if (state.weather === 'hujan') {
        nextWeather = roll < 0.35 ? 'banjir' : roll < 0.8 ? 'cerah' : 'hujan';
      } else {
        nextWeather = roll < 0.75 ? 'cerah' : 'hujan';
      }
      if (nextWeather !== state.weather) {
        if (nextWeather === 'hujan') {
          get().pushNotification({
            text: '🌧️ Hujan Deras Mengguyur Kota!',
            subtext:
              'Tarif Ojol naik mahal (Demand +35%), tapi warga di Halte Lv.1 (Tanpa Atap) cepat kabur kehujanan!',
            type: 'info',
          });
        } else if (nextWeather === 'banjir') {
          get().pushNotification({
            text: '🌊 Peringatan Titik Banjir Genangan!',
            subtext:
              'Sejumlah ruas jalan tergenang banjir (Angkot/Metromini melambat & mesin rawan aus).',
            type: 'ojol',
          });
        }
      }
    }

    const cityPreset = CITY_PRESETS[state.currentCityId];
    const phase = getTrafficPhase(nextGameMinutes);
    const maintSpec = MAINTENANCE_SPECS[state.maintenanceTier];
    const { partnerStopsMap } = detectTransferLinks(state.routes, state.stops);
    const repInfo = computeReputationInfo(state.totalPassengersServed, state.stops);
    const nowMs = Date.now();

    const newTickPopups: CashPopupEvent[] = [];
    const emitTickCashPopup = (
      amountRp: number,
      categoryLabel: string,
      coords?: [number, number]
    ) => {
      if (Math.round(Math.abs(amountRp)) === 0) return;
      newTickPopups.push({
        id: `cash-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
        amountRp: Math.round(amountRp),
        label: formatSignedRp(amountRp),
        categoryLabel,
        coords,
        createdAt: nowMs,
      });
    };

    // Handle 00:00 WIB Daily Closing (Fixed Workshop Overhead + Bank Loan Installments + Ledger Entry)
    let nextLoans = state.activeLoans;
    let fixedDailyDeductionRp = 0;
    let dailyLoanPaidRp = 0;
    let dailyWorkshopFeeRp = 0;
    let nextDailyLedger = state.dailyLedger;
    let nextTodayRev = state._todayRevenueRp;
    let nextTodayVarOp = state._todayVariableOpCostRp;

    if (dayRolledOver) {
      let loanPaidRp = 0;
      if (state.activeLoans.length > 0) {
        const updatedLoans: ActiveLoan[] = [];
        for (const l of state.activeLoans) {
          const pay = Math.min(l.remainingRp, l.dailyInstallmentRp);
          loanPaidRp += pay;
          const rem = l.remainingRp - pay;
          const dLeft = l.daysLeft - 1;
          if (rem > 0 && dLeft > 0) {
            updatedLoans.push({ ...l, remainingRp: rem, daysLeft: dLeft });
          }
        }
        nextLoans = updatedLoans;
      }

      // Fixed daily workshop & pool overhead (v3 Section 4.A: Angkot 1jt, Metromini 2.5jt, BRT 4.5jt, Depot 300rb)
      const unlockedDepotsCount = state.depots.filter((d) => d.unlocked).length;
      const fleetFixedDaily = state.vehicles.reduce((acc, v) => {
        if (v.type === 'angkot') return acc + 1_000_000;
        if (v.type === 'metromini') return acc + 2_500_000;
        if (v.type === 'brt') return acc + 4_500_000;
        return acc + 1_000_000;
      }, 0);
      const depotFixedDaily = unlockedDepotsCount * 300_000;
      const workshopDailyFee =
        state.vehicles.length > 0
          ? Math.round(
              (fleetFixedDaily + depotFixedDaily) *
                maintSpec.costMultiplier
            )
          : 0;

      dailyLoanPaidRp = loanPaidRp;
      dailyWorkshopFeeRp = workshopDailyFee;
      fixedDailyDeductionRp = loanPaidRp + workshopDailyFee;
      if (fixedDailyDeductionRp > 0) {
        emitTickCashPopup(
          -fixedDailyDeductionRp,
          `Tutup Buku H-${state.gameDay} (Bengkel & Bank)`
        );
      }

      const netProfitToday =
        nextTodayRev - nextTodayVarOp - fixedDailyDeductionRp;
      const newEntry: DailyLedgerEntry = {
        day: state.gameDay,
        revenueRp: Math.round(nextTodayRev),
        variableOpCostRp: Math.round(nextTodayVarOp),
        fixedOpCostRp: Math.round(fixedDailyDeductionRp),
        netProfitRp: Math.round(netProfitToday),
      };
      nextDailyLedger = [...state.dailyLedger.slice(-14), newEntry];
      nextTodayRev = 0;
      nextTodayVarOp = 0;
    }

    // 1. PASSENGER SPAWNING, WEATHER ROOF DILEMMA, STOP CAPACITY OVERFLOW & OJOL DESPAWN
    let spawnAccum = state._spawnAccumMinutes + deltaGameMinutes;
    const shouldSpawnStopPax = spawnAccum >= 2.5;
    if (shouldSpawnStopPax) {
      spawnAccum = 0;
    }

    const weatherDemandMult =
      nextWeather === 'hujan' || nextWeather === 'banjir' ? 1.35 : 1.0;

    let newlyStolenByOjol = 0;
    let newlySpawnedPaxCount = 0;

    const updatedStops = state.stops.map((stop) => {
      const tierSpec = STOP_TIER_SPECS[stop.level];
      let batches = stop.waitingBatches.map((b) => ({ ...b }));
      let ojolLostHere = 0;

      // Weather Roof Dilemma: Level 1 stops (Plang Tanpa Atap) lose patience 2x faster during rain/flood!
      const rainRooflessPenalty =
        (nextWeather === 'hujan' || nextWeather === 'banjir') && stop.level === 1
          ? 0.5
          : 1.0;

      const survivingBatches = [];
      for (const batch of batches) {
        const waitedMin =
          nextGameMinutes >= batch.spawnedAtMinute
            ? nextGameMinutes - batch.spawnedAtMinute
            : 1440 - batch.spawnedAtMinute + nextGameMinutes;

        const effectiveMaxPatience =
          batch.maxPatienceMinutes * rainRooflessPenalty;

        if (waitedMin >= effectiveMaxPatience) {
          ojolLostHere += batch.count;
        } else {
          survivingBatches.push(batch);
        }
      }
      batches = survivingBatches;

      if (shouldSpawnStopPax) {
        const servingRoutes = state.routes.filter((r) => r.stopIds.includes(stop.id));
        let fareElasticityDemandMult = 1.0;
        const cityToleranceRp = cityPreset.fareToleranceThresholdRp;

        if (servingRoutes.length > 0) {
          const avgFare =
            servingRoutes.reduce((acc, r) => acc + r.customFareRp, 0) /
            servingRoutes.length;
          if (avgFare < 4_500) {
            fareElasticityDemandMult = 1 + ((4_500 - avgFare) / 2_500) * 0.25;
          } else if (avgFare > cityToleranceRp + 500) {
            fareElasticityDemandMult = Math.max(
              0.55,
              1 - ((avgFare - (cityToleranceRp + 500)) / 9_000) * 0.45
            );
          }
        }

        const zoneMultiplier = phase.spawnWeights[stop.category] || 1.0;
        const spawnExpected =
          stop.baseDemandWeight *
          zoneMultiplier *
          fareElasticityDemandMult *
          weatherDemandMult *
          repInfo.demandBonusMult *
          SPAWN_GLOBAL_MULT *
          (0.85 + Math.random() * 0.75);

        // v3 Probabilistic rounding: floor + (random < frac ? 1 : 0)
        const spawnInt = Math.floor(spawnExpected);
        const spawnFrac = spawnExpected - spawnInt;
        const spawnCount = spawnInt + (Math.random() < spawnFrac ? 1 : 0);
        newlySpawnedPaxCount += spawnCount;

        const currentTotal = batches.reduce((acc, b) => acc + b.count, 0);
        const availableQueueSpace = Math.max(
          0,
          tierSpec.maxQueueCapacity - currentTotal
        );

        const acceptedCount = Math.min(spawnCount, availableQueueSpace);
        const overflowToOjol = spawnCount - acceptedCount;
        ojolLostHere += overflowToOjol;

        if (acceptedCount > 0) {
          const basePatience = 55 + Math.floor(Math.random() * 20);
          batches.push({
            id: `b-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
            count: acceptedCount,
            spawnedAtMinute: nextGameMinutes,
            maxPatienceMinutes: Math.round(
              basePatience * tierSpec.patienceMultiplier
            ),
            isTransferPassenger: false,
          });
        }
      }

      const totalWaiting = batches.reduce((acc, b) => acc + b.count, 0);
      const transitWaiting = batches
        .filter((b) => b.isTransferPassenger)
        .reduce((acc, b) => acc + b.count, 0);
      newlyStolenByOjol += ojolLostHere;

      return {
        ...stop,
        waitingBatches: batches,
        totalWaiting,
        transitWaiting,
        ojolLostCount: stop.ojolLostCount + ojolLostHere,
        lastOjolTimestamp: ojolLostHere > 0 ? nowMs : stop.lastOjolTimestamp,
      };
    });

    const boardFromStop = (
      stopId: string,
      maxCanBoard: number,
      routeFareRp: number
    ): { boarded: number; transferBoarded: number } => {
      if (maxCanBoard <= 0) return { boarded: 0, transferBoarded: 0 };
      const stopIdx = updatedStops.findIndex((s) => s.id === stopId);
      if (stopIdx === -1) return { boarded: 0, transferBoarded: 0 };

      const stop = updatedStops[stopIdx];
      const cityToleranceRp = cityPreset.fareToleranceThresholdRp;

      let balkRatio = 0;
      if (routeFareRp > cityToleranceRp) {
        balkRatio = Math.min(0.65, (routeFareRp - cityToleranceRp) / 14_000);
      }

      let remainingNeeded = maxCanBoard;
      let boarded = 0;
      let transferBoarded = 0;
      let balkedToOjol = 0;
      const nextBatches = [];

      for (const batch of stop.waitingBatches) {
        if (remainingNeeded <= 0) {
          nextBatches.push(batch);
          continue;
        }
        const takeFromBatch = Math.min(batch.count, remainingNeeded);
        const refusedCount =
          balkRatio > 0 ? Math.floor(takeFromBatch * balkRatio) : 0;
        const actualBoarded = takeFromBatch - refusedCount;

        boarded += actualBoarded;
        balkedToOjol += refusedCount;
        if (batch.isTransferPassenger) {
          transferBoarded += actualBoarded;
        }
        remainingNeeded -= takeFromBatch;

        const leftover = batch.count - takeFromBatch;
        if (leftover > 0) {
          nextBatches.push({
            ...batch,
            count: leftover,
          });
        }
      }

      newlyStolenByOjol += balkedToOjol;

      const nextTotalWaiting = nextBatches.reduce((acc, b) => acc + b.count, 0);
      const nextTransitWaiting = nextBatches
        .filter((b) => b.isTransferPassenger)
        .reduce((acc, b) => acc + b.count, 0);

      updatedStops[stopIdx] = {
        ...stop,
        waitingBatches: nextBatches,
        totalWaiting: nextTotalWaiting,
        transitWaiting: nextTransitWaiting,
        ojolLostCount: stop.ojolLostCount + balkedToOjol,
        lastOjolTimestamp: balkedToOjol > 0 ? nowMs : stop.lastOjolTimestamp,
      };

      return { boarded, transferBoarded };
    };

    const injectTransferPassengers = (targetStopId: string, count: number) => {
      if (count <= 0) return;
      const idx = updatedStops.findIndex((s) => s.id === targetStopId);
      if (idx === -1) return;
      const st = updatedStops[idx];
      const tierSpec = STOP_TIER_SPECS[st.level];
      const space = Math.max(0, tierSpec.maxQueueCapacity - st.totalWaiting);
      const accepted = Math.min(count, space);
      const overflow = count - accepted;
      newlyStolenByOjol += overflow;

      if (accepted <= 0) return;

      const nextBatches = [
        ...st.waitingBatches,
        {
          id: `xfer-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
          count: accepted,
          spawnedAtMinute: nextGameMinutes,
          maxPatienceMinutes: Math.round(70 * tierSpec.patienceMultiplier),
          isTransferPassenger: true,
        },
      ];
      updatedStops[idx] = {
        ...st,
        waitingBatches: nextBatches,
        totalWaiting: st.totalWaiting + accepted,
        transitWaiting: st.transitWaiting + accepted,
        totalTransfersHandled: st.totalTransfersHandled + accepted,
        ojolLostCount: st.ojolLostCount + overflow,
      };
    };

    // 2. ROADSIDE PASSENGERS SPAWNING ("Hail Anywhere" for Angkot)
    let roadsideAccum = state._roadsideAccumMinutes + deltaGameMinutes;
    let nextRoadsidePax = [...state.roadsidePassengers];

    for (const route of state.routes) {
      const hasActiveAngkot = state.vehicles.some(
        (v) =>
          v.routeId === route.id &&
          v.status === 'ACTIVE' &&
          v.type === 'angkot'
      );
      const existingRoutePax = nextRoadsidePax.filter((p) => p.routeId === route.id);
      const needInitialSpawn =
        hasActiveAngkot && existingRoutePax.length === 0 && route.totalLengthKm > 0.4;

      if (
        (roadsideAccum >= 2.5 || needInitialSpawn) &&
        hasActiveAngkot &&
        route.totalLengthKm > 0.4
      ) {
        if (roadsideAccum >= 2.5) roadsideAccum = 0;
        nextRoadsidePax = nextRoadsidePax.slice(-32);

        const spawnCount = needInitialSpawn ? 2 : 1;
        for (let sIdx = 0; sIdx < spawnCount; sIdx++) {
          const randDistKm =
            0.15 + Math.random() * Math.max(0.1, route.totalLengthKm - 0.3);
          const pt = turf.along(route.geometry, randDistKm, { units: 'kilometers' });
          nextRoadsidePax.push({
            id: `hail-${nowMs}-${Math.random().toString(36).slice(2, 5)}`,
            routeId: route.id,
            coords: pt.geometry.coordinates as [number, number],
            distanceAlongKm: randDistKm,
            count: 2 + Math.floor(Math.random() * 4),
            spawnedAtMinute: nextGameMinutes,
          });
        }
      }
    }

    // 3. VEHICLE MOVEMENT, WEATHER/FLOOD PENALTY, IDLE POOL HEALING, CONDITION WEAR & BOARDING
    let frameRevenueRp = 0;
    let frameJakLingkoBonusRp = 0;
    let frameOpCostIncrementRp = 0;
    let frameKirFinesRp = 0;
    let framePaxServed = 0;
    let frameSenenTanahAbangPax = 0;
    let frameTransfersCompleted = 0;
    let frameTripsCompleted = 0;
    const routeStatsDelta: Record<
      string,
      { rev: number; opCost: number; pax: number }
    > = {};

    const updatedVehicles = state.vehicles.map((veh) => {
      if (!veh.routeId || veh.status === 'IDLE_IN_POOL') {
        const healRate =
          state.maintenanceTier === 'prima'
            ? 0.45
            : state.maintenanceTier === 'standar'
            ? 0.2
            : 0;
        const healedCond = Math.min(
          100,
          Number((veh.condition + deltaGameMinutes * healRate).toFixed(2))
        );
        return {
          ...veh,
          status: 'IDLE_IN_POOL' as const,
          state: 'idle_pool' as const,
          currentSpeedKmh: 0,
          passengers: 0,
          condition: healedCond,
          totalFuelCostRp: veh.totalFuelCostRp || 0,
          totalMaintenanceCostRp: veh.totalMaintenanceCostRp || 0,
          totalPaxCarried: veh.totalPaxCarried || 0,
          totalDistanceTraveledKm: veh.totalDistanceTraveledKm || 0,
        };
      }

      const route = state.routes.find((r) => r.id === veh.routeId);
      if (!route || route.stopIds.length < 2) return veh;

      const spec = FLEET_SPECS[veh.type];
      const isSenenTanahAbangRoute =
        route.stopIds.includes('hub-senen') &&
        route.stopIds.includes('hub-tanah-abang');

      if (veh.state === 'mogok') {
        const nextMogokMin = veh.mogokTimerMinutes - deltaGameMinutes;
        if (nextMogokMin <= 0) {
          return {
            ...veh,
            status: 'ACTIVE' as const,
            state: 'moving' as const,
            condition: Math.max(45, veh.condition),
            mogokTimerMinutes: 0,
          };
        }
        return {
          ...veh,
          status: 'MOGOK' as const,
          currentSpeedKmh: 0,
          mogokTimerMinutes: nextMogokMin,
        };
      }

      if (veh.state !== 'moving') {
        const nextDwell = veh.dwellTimerSec - scaledSec;

        if (veh.state === 'ngetem' && veh.currentStopIndex !== null) {
          const stopId = route.stopIds[veh.currentStopIndex];
          const freeSeats = veh.capacity - veh.passengers;
          if (freeSeats > 0 && stopId) {
            const { boarded, transferBoarded } = boardFromStop(
              stopId,
              freeSeats,
              route.customFareRp
            );
            if (boarded > 0) {
              const distanceBonus = 1 + Math.min(1.5, route.totalLengthKm / 8);
              const baseEarned = Math.round(
                boarded * route.customFareRp * FARE_BATCH_MULTIPLIER * distanceBonus
              );
              const bonusEarned = Math.round(
                transferBoarded *
                  route.customFareRp *
                  FARE_BATCH_MULTIPLIER *
                  distanceBonus *
                  0.25
              );
              const totalEarned = baseEarned + bonusEarned;

              frameRevenueRp += totalEarned;
              frameJakLingkoBonusRp += bonusEarned;
              framePaxServed += boarded;
              if (isSenenTanahAbangRoute) frameSenenTanahAbangPax += boarded;
              frameTransfersCompleted += transferBoarded;

              emitTickCashPopup(
                totalEarned,
                `${route.code} Ngetem (+${boarded} pnp)`,
                veh.coords
              );

              routeStatsDelta[route.id] = {
                rev: (routeStatsDelta[route.id]?.rev || 0) + totalEarned,
                opCost: routeStatsDelta[route.id]?.opCost || 0,
                pax: (routeStatsDelta[route.id]?.pax || 0) + boarded,
              };
              veh = {
                ...veh,
                passengers: veh.passengers + boarded,
                totalRevenueGenerated: veh.totalRevenueGenerated + totalEarned,
                totalPaxCarried: (veh.totalPaxCarried || 0) + boarded,
              };
            }
          }

          const fillRatio = veh.passengers / veh.capacity;
          const nextMaxNgetem = veh.maxNgetemTimerSec - scaledSec;
          if (fillRatio >= route.ngetemThresholdPct || nextMaxNgetem <= 0) {
            return {
              ...veh,
              status: 'ACTIVE' as const,
              state: 'moving' as const,
              dwellTimerSec: 0,
              maxNgetemTimerSec: 0,
            };
          }
          return {
            ...veh,
            maxNgetemTimerSec: nextMaxNgetem,
          };
        }

        if (nextDwell <= 0) {
          return {
            ...veh,
            status: 'ACTIVE' as const,
            state: 'moving' as const,
            dwellTimerSec: 0,
          };
        }

        return {
          ...veh,
          dwellTimerSec: nextDwell,
        };
      }

      const blockedByMogok = state.vehicles.some(
        (other) =>
          other.id !== veh.id &&
          other.routeId === veh.routeId &&
          other.state === 'mogok' &&
          Math.abs(other.distanceKm - veh.distanceKm) < 0.25
      );

      const ignoresTraffic =
        spec.supportsDedicatedLane && route.dedicatedLaneEnabled;
      let effectiveMultiplier = ignoresTraffic
        ? Math.max(1.0, phase.trafficMultiplier)
        : phase.trafficMultiplier;

      if (blockedByMogok) {
        effectiveMultiplier *= 0.45;
      }

      // City-specific speed bonuses (Bandung Angkot +15%, Surabaya Arterial +15%)
      effectiveMultiplier *= cityPreset.globalSpeedBonusMult;
      if (veh.type === 'angkot') {
        effectiveMultiplier *= cityPreset.angkotSpeedBonusMult;
      }

      // Weather & Flood Zone Penalties
      let floodWearMult = 1.0;
      if (nextWeather === 'hujan') {
        effectiveMultiplier *= 0.82;
      } else if (nextWeather === 'banjir') {
        effectiveMultiplier *= 0.78;
        if (!ignoresTraffic) {
          const inFloodZone = cityPreset.floodZones.some(
            (fz) =>
              turf.distance(veh.coords, fz.coords, { units: 'kilometers' }) <=
              fz.radiusKm
          );
          if (inFloodZone) {
            effectiveMultiplier *= 0.45; // Severe flood slowdown
            floodWearMult = 2.2; // Waterlogged engine wear
          }
        }
      }

      const currentSpeedKmh = Number(
        (spec.baseSpeedKmh * effectiveMultiplier).toFixed(1)
      );

      const distanceStepKm = (currentSpeedKmh / 3600) * scaledSec * 19;
      const stepOpCost =
        distanceStepKm * spec.opCostPerKm * maintSpec.costMultiplier;
      frameOpCostIncrementRp += stepOpCost;

      routeStatsDelta[route.id] = {
        rev: routeStatsDelta[route.id]?.rev || 0,
        opCost: (routeStatsDelta[route.id]?.opCost || 0) + stepOpCost,
        pax: routeStatsDelta[route.id]?.pax || 0,
      };

      const nextCondition = Math.max(
        5,
        Number(
          (
            veh.condition -
            distanceStepKm * maintSpec.wearPerKmPct * floodWearMult
          ).toFixed(2)
        )
      );

      if (nextCondition < 30 && Math.random() < 0.008 * state.gameSpeed) {
        if (veh.type !== 'brt' && Math.random() < 0.35) {
          // v3 Section 4.I: Proportional KIR Fine: clamp(10% of balance, 500rb, 3.5jt)
          const kirFineRp = Math.max(
            500_000,
            Math.min(3_500_000, Math.round(state.balanceRp * 0.1))
          );
          frameKirFinesRp += kirFineRp;
          emitTickCashPopup(
            -kirFineRp,
            `Tilang KIR Dishub (${veh.plateNumber})`,
            veh.coords
          );
          get().pushNotification({
            text: `🚨 Razia KIR Dishub: ${veh.plateNumber} Ditilang!`,
            subtext: `Kondisi mesin <30%. Denda ${formatSignedRp(-kirFineRp)} & wajib perbaikan darurat.`,
            type: 'expense',
            coords: veh.coords,
          });
          return {
            ...veh,
            condition: 65,
            passengers: 0,
            totalFuelCostRp: Math.round((veh.totalFuelCostRp || 0) + stepOpCost),
            totalMaintenanceCostRp: veh.totalMaintenanceCostRp || 0,
            totalPaxCarried: veh.totalPaxCarried || 0,
            totalDistanceTraveledKm: Number(
              ((veh.totalDistanceTraveledKm || 0) + distanceStepKm).toFixed(2)
            ),
          };
        } else {
          newlyStolenByOjol += veh.passengers;
          get().pushNotification({
            text: `💨 Armada ${veh.plateNumber} MOGOK di Jalan!`,
            subtext: `${veh.passengers} penumpang turun pindah ke Ojol. Servis atau Tarik ke Pool!`,
            type: 'ojol',
            coords: veh.coords,
          });
          return {
            ...veh,
            status: 'MOGOK' as const,
            condition: nextCondition,
            passengers: 0,
            currentSpeedKmh: 0,
            state: 'mogok' as const,
            mogokTimerMinutes: 30,
            totalFuelCostRp: Math.round((veh.totalFuelCostRp || 0) + stepOpCost),
            totalMaintenanceCostRp: veh.totalMaintenanceCostRp || 0,
            totalPaxCarried: veh.totalPaxCarried || 0,
            totalDistanceTraveledKm: Number(
              ((veh.totalDistanceTraveledKm || 0) + distanceStepKm).toFixed(2)
            ),
          };
        }
      }

      let nextDistKm = veh.distanceKm + distanceStepKm * veh.direction;
      let nextDirection = veh.direction;
      let nextState: Vehicle['state'] = 'moving';
      let nextDwellSec = 0;
      let nextMaxNgetemSec = 0;
      let nextPassengers = veh.passengers;
      let nextStopIdx = veh.currentStopIndex;
      let nextRevenueGen = veh.totalRevenueGenerated;
      let nextTrips = veh.totalTripsCompleted;
      let finalCondition = nextCondition;

      // Track Per-Armada Financials & Stats
      let nextFuelCost = (veh.totalFuelCostRp || 0) + stepOpCost;
      let nextDistanceTraveled = (veh.totalDistanceTraveledKm || 0) + distanceStepKm;
      let nextPaxCarried = veh.totalPaxCarried || 0;

      if (spec.supportsHailAnywhere && nextPassengers < veh.capacity) {
        const hailIndex = nextRoadsidePax.findIndex(
          (p) =>
            p.routeId === route.id &&
            Math.abs(p.distanceAlongKm - nextDistKm) <=
              Math.max(0.06, distanceStepKm * 1.3)
        );
        if (hailIndex !== -1) {
          const hailPax = nextRoadsidePax[hailIndex];
          const canTake = Math.min(veh.capacity - nextPassengers, hailPax.count);
          if (canTake > 0) {
            nextPassengers += canTake;
            nextPaxCarried += canTake;
            const distanceBonus = 1 + Math.min(1.5, route.totalLengthKm / 8);
            const earned = Math.round(
              canTake * route.customFareRp * FARE_BATCH_MULTIPLIER * distanceBonus
            );
            frameRevenueRp += earned;
            framePaxServed += canTake;
            if (isSenenTanahAbangRoute) frameSenenTanahAbangPax += canTake;
            nextRevenueGen += earned;
            routeStatsDelta[route.id] = {
              rev: (routeStatsDelta[route.id]?.rev || 0) + earned,
              opCost: routeStatsDelta[route.id]?.opCost || 0,
              pax: (routeStatsDelta[route.id]?.pax || 0) + canTake,
            };
            emitTickCashPopup(
              earned,
              `${route.code} Angkut Jalan (+${canTake} pnp)`,
              hailPax.coords
            );
            nextRoadsidePax.splice(hailIndex, 1);
            nextState = 'hailing';
            nextDwellSec = 1.1;
          }
        }
      }

      const targetStopIndex =
        veh.direction === 1
          ? route.stopDistancesKm.findIndex(
              (d, idx) =>
                idx !== veh.currentStopIndex &&
                veh.distanceKm <= d &&
                nextDistKm >= d - 0.005
            )
          : route.stopDistancesKm.findIndex(
              (d, idx) =>
                idx !== veh.currentStopIndex &&
                veh.distanceKm >= d &&
                nextDistKm <= d + 0.005
            );

      if (targetStopIndex !== -1) {
        nextStopIdx = targetStopIndex;
        nextDistKm = route.stopDistancesKm[targetStopIndex];
        const stopId = route.stopIds[targetStopIndex];
        const stopObj = updatedStops.find((s) => s.id === stopId);
        const stopLevel = stopObj?.level ?? 1;
        const stopTierSpec = STOP_TIER_SPECS[stopLevel];

        const isTerminalEnd =
          targetStopIndex === 0 || targetStopIndex === route.stopIds.length - 1;

        let alightedHere = 0;
        if (isTerminalEnd) {
          alightedHere = nextPassengers;
          nextDirection = targetStopIndex === 0 ? 1 : -1;
          nextPassengers = 0;
          nextTrips += 1;
          frameTripsCompleted += 1;
          finalCondition = Math.min(100, finalCondition + maintSpec.terminalHealPct);
        }

        const canStopServeVehicle =
          !spec.requiresLevel3Stop || stopTierSpec.supportsBRT;

        if (canStopServeVehicle) {
          if (!isTerminalEnd && nextPassengers > 0) {
            alightedHere = Math.max(
              1,
              Math.round(nextPassengers * (0.35 + Math.random() * 0.3))
            );
            nextPassengers = Math.max(0, nextPassengers - alightedHere);
          }

          const partnerStopIds = partnerStopsMap.get(stopId);
          if (alightedHere > 0 && partnerStopIds && partnerStopIds.length > 0) {
            const transferCount = Math.max(1, Math.round(alightedHere * 0.38));
            const targetPartnerId =
              partnerStopIds[Math.floor(Math.random() * partnerStopIds.length)];
            injectTransferPassengers(targetPartnerId, transferCount);
          }

          const freeSeats = veh.capacity - nextPassengers;
          const { boarded, transferBoarded } = boardFromStop(
            stopId,
            freeSeats,
            route.customFareRp
          );

          if (boarded > 0) {
            nextPassengers += boarded;
            nextPaxCarried += boarded;
            const distanceBonus = 1 + Math.min(1.5, route.totalLengthKm / 8);
            const baseEarned = Math.round(
              boarded * route.customFareRp * FARE_BATCH_MULTIPLIER * distanceBonus
            );
            const bonusEarned = Math.round(
              transferBoarded *
                route.customFareRp *
                FARE_BATCH_MULTIPLIER *
                distanceBonus *
                0.25
            );
            const totalEarned = baseEarned + bonusEarned;

            frameRevenueRp += totalEarned;
            frameJakLingkoBonusRp += bonusEarned;
            framePaxServed += boarded;
            if (isSenenTanahAbangRoute) frameSenenTanahAbangPax += boarded;
            frameTransfersCompleted += transferBoarded;
            nextRevenueGen += totalEarned;

            const stopShortName = (stopObj?.name || route.code).replace(
              /^(Stasiun|Terminal|Pasar|Halte|Plang|Simpang)\s+/i,
              ''
            );
            emitTickCashPopup(
              totalEarned,
              `${route.code} • ${stopShortName} (+${boarded} pnp)`,
              stopObj?.coords || veh.coords
            );

            routeStatsDelta[route.id] = {
              rev: (routeStatsDelta[route.id]?.rev || 0) + totalEarned,
              opCost: routeStatsDelta[route.id]?.opCost || 0,
              pax: (routeStatsDelta[route.id]?.pax || 0) + boarded,
            };
          }

          const fillRatio = nextPassengers / veh.capacity;
          if (
            spec.supportsNgetem &&
            route.ngetemEnabled &&
            fillRatio < route.ngetemThresholdPct
          ) {
            nextState = 'ngetem';
            nextMaxNgetemSec = 7.5;
            nextDwellSec = 2.0;
          } else {
            nextState = 'boarding';
            nextDwellSec = Number((1.8 * stopTierSpec.dwellTimeMultiplier).toFixed(2));
          }
        }
      } else {
        if (nextDistKm >= route.totalLengthKm) {
          nextDistKm = route.totalLengthKm;
          nextDirection = -1;
          nextPassengers = 0;
        } else if (nextDistKm <= 0) {
          nextDistKm = 0;
          nextDirection = 1;
          nextPassengers = 0;
        }
      }

      const { coords, bearing } = getVehicleTransformAlongRoute(
        route.geometry,
        nextDistKm,
        route.totalLengthKm,
        nextDirection
      );

      return {
        ...veh,
        status: 'ACTIVE' as const,
        distanceKm: nextDistKm,
        direction: nextDirection,
        coords,
        bearing,
        currentSpeedKmh,
        passengers: nextPassengers,
        condition: finalCondition,
        state: nextState,
        dwellTimerSec: nextDwellSec,
        maxNgetemTimerSec: nextMaxNgetemSec,
        currentStopIndex: nextStopIdx,
        totalRevenueGenerated: nextRevenueGen,
        totalTripsCompleted: nextTrips,
        totalFuelCostRp: Math.round(nextFuelCost),
        totalMaintenanceCostRp: veh.totalMaintenanceCostRp || 0,
        totalPaxCarried: nextPaxCarried,
        totalDistanceTraveledKm: Number(nextDistanceTraveled.toFixed(2)),
      };
    });

    const updatedRoutes = state.routes.map((r) => {
      const delta = routeStatsDelta[r.id];
      if (!delta) return r;
      return {
        ...r,
        totalRevenueRp: r.totalRevenueRp + delta.rev,
        totalOpCostRp: (r.totalOpCostRp || 0) + Math.round(delta.opCost),
        totalPassengersCarried: r.totalPassengersCarried + delta.pax,
      };
    });

    // DISCRETE OPEX BILLING
    let nextOpCostAccumRp = state._opCostAccumRp + frameOpCostIncrementRp;
    let nextOpCostAccumMin = state._opCostAccumMinutes + deltaGameMinutes;
    let billedOpCostRp = 0;

    if (
      (nextOpCostAccumMin >= 22 && nextOpCostAccumRp >= 25_000) ||
      nextOpCostAccumRp >= 75_000
    ) {
      billedOpCostRp = Math.round(nextOpCostAccumRp);
      nextOpCostAccumRp = 0;
      nextOpCostAccumMin = 0;

      const activeVehs = updatedVehicles.filter((v) => v.status === 'ACTIVE');
      const randomActiveCoords =
        activeVehs.length > 0
          ? activeVehs[Math.floor(Math.random() * activeVehs.length)].coords
          : undefined;

      emitTickCashPopup(
        -billedOpCostRp,
        `BBM & Jalan (${activeVehs.length} Armada)`,
        randomActiveCoords
      );
    }

    const netDeltaRp = Math.round(
      frameRevenueRp - billedOpCostRp - frameKirFinesRp - fixedDailyDeductionRp
    );

    // Telemetry Tracking (v3 Section 8)
    let nextTelemetryPaxSpawned =
      state._telemetryPeriodPaxSpawned + newlySpawnedPaxCount;
    let nextTelemetryPaxServed =
      state._telemetryPeriodPaxServed + framePaxServed;
    let nextTelemetryPaxOjol =
      state._telemetryPeriodPaxOjol + newlyStolenByOjol;
    let nextTelemetryTrips =
      state._telemetryPeriodTrips + frameTripsCompleted;
    let nextTelemetryRev = state._telemetryPeriodRev + frameRevenueRp;
    let nextTelemetryOpCost =
      state._telemetryPeriodOpCost + frameOpCostIncrementRp;
    let nextTelemetryHistory = state.telemetryHistory;
    let nextLastPeriodLabel = state._lastTelemetryPeriodLabel;

    const isPeriodChanged =
      state._lastTelemetryPeriodLabel !== '' &&
      state._lastTelemetryPeriodLabel !== phase.label;

    if (isPeriodChanged || dayRolledOver) {
      const snapHour = Math.floor(nextGameMinutes / 60) % 24;
      const snapMin = Math.floor(nextGameMinutes % 60);
      const timeStr = `${String(snapHour).padStart(2, '0')}:${String(
        snapMin
      ).padStart(2, '0')} WIB`;

      const snapshot: TelemetryPeriodSnapshot = {
        day: state.gameDay,
        periodLabel: state._lastTelemetryPeriodLabel || phase.label,
        gameMinutes: Math.round(state.gameMinutes),
        timeString: timeStr,
        paxSpawned: nextTelemetryPaxSpawned,
        paxServed: nextTelemetryPaxServed,
        paxOjol: nextTelemetryPaxOjol,
        tripsCompleted: nextTelemetryTrips,
        revenueRp: Math.round(nextTelemetryRev),
        opCostRp: Math.round(nextTelemetryOpCost),
        activeVehiclesCount: updatedVehicles.filter(
          (v) => v.status === 'ACTIVE'
        ).length,
        vehiclesStatus: updatedVehicles.map((v) => ({
          plate: v.plateNumber,
          condition: v.condition,
          passengers: v.passengers,
          capacity: v.capacity,
          trips: v.totalTripsCompleted,
          revenueRp: v.totalRevenueGenerated,
        })),
      };

      nextTelemetryHistory = [...state.telemetryHistory.slice(-48), snapshot];

      console.log(
        `%c[NTM Telemetry] H-${snapshot.day} • ${snapshot.periodLabel} (${snapshot.timeString})`,
        'color: #06b6d4; font-weight: bold; background: #0f172a; padding: 2px 6px; border-radius: 4px;',
        {
          paxSpawned: snapshot.paxSpawned,
          paxServed: snapshot.paxServed,
          paxToOjol: snapshot.paxOjol,
          tripsCompleted: snapshot.tripsCompleted,
          grossRevenue: formatSignedRp(snapshot.revenueRp),
          fuelCost: formatSignedRp(-snapshot.opCostRp),
          net: formatSignedRp(snapshot.revenueRp - snapshot.opCostRp),
          vehicles: snapshot.vehiclesStatus.map(
            (v) =>
              `${v.plate}: ${v.condition}% hp, ${v.passengers}/${v.capacity} pax, ${v.trips} trips`
          ),
        }
      );

      // Reset accumulators for the new period
      nextTelemetryPaxSpawned = 0;
      nextTelemetryPaxServed = 0;
      nextTelemetryPaxOjol = 0;
      nextTelemetryTrips = 0;
      nextTelemetryRev = 0;
      nextTelemetryOpCost = 0;
      nextLastPeriodLabel = phase.label;

      if (typeof window !== 'undefined') {
        (window as any).__NTM_TELEMETRY__ = nextTelemetryHistory;
        (window as any).__NTM_PRINT_LOG__ = () => {
          console.table(
            get().telemetryHistory.map((t) => ({
              Day: `H-${t.day}`,
              Periode: t.periodLabel,
              Waktu: t.timeString,
              Spawned: t.paxSpawned,
              Served: t.paxServed,
              Ojol: t.paxOjol,
              Trips: t.tripsCompleted,
              Revenue: formatSignedRp(t.revenueRp),
              BBM: formatSignedRp(-t.opCostRp),
              Net: formatSignedRp(t.revenueRp - t.opCostRp),
            }))
          );
        };
      }
    }

    const mergedPopups =
      newTickPopups.length > 0
        ? [...state.cashPopups, ...newTickPopups].slice(-16)
        : state.cashPopups;

    set({
      weather: nextWeather,
      _weatherAccumMinutes: nextWeatherAccum,
      gameMinutes: nextGameMinutes,
      gameDay: nextGameDay,
      balanceRp: state.balanceRp + netDeltaRp,
      totalRevenueRp: state.totalRevenueRp + Math.round(frameRevenueRp),
      totalOpCostRp:
        state.totalOpCostRp +
        Math.round(billedOpCostRp + frameKirFinesRp + fixedDailyDeductionRp),
      financialBreakdown: {
        ticketRegularRp:
          (state.financialBreakdown?.ticketRegularRp || 0) +
          Math.max(0, Math.round(frameRevenueRp - frameJakLingkoBonusRp)),
        ticketJaklingkoRp:
          (state.financialBreakdown?.ticketJaklingkoRp || 0) +
          Math.round(frameJakLingkoBonusRp),
        subsidyPsoRp: state.financialBreakdown?.subsidyPsoRp || 0,
        vehicleSalesRefundRp:
          state.financialBreakdown?.vehicleSalesRefundRp || 0,
        bankLoansDisbursedRp:
          state.financialBreakdown?.bankLoansDisbursedRp || 0,
        fuelCostRp:
          (state.financialBreakdown?.fuelCostRp || 0) +
          Math.round(billedOpCostRp),
        maintenanceCostRp:
          (state.financialBreakdown?.maintenanceCostRp || 0) + dailyWorkshopFeeRp,
        dishubKirFinesRp:
          (state.financialBreakdown?.dishubKirFinesRp || 0) +
          Math.round(frameKirFinesRp),
        loanInterestAndRepayRp:
          (state.financialBreakdown?.loanInterestAndRepayRp || 0) + dailyLoanPaidRp,
        fleetPurchaseRp: state.financialBreakdown?.fleetPurchaseRp || 0,
        stopBuildAndUpgradeRp:
          state.financialBreakdown?.stopBuildAndUpgradeRp || 0,
        depotUnlockRp: state.financialBreakdown?.depotUnlockRp || 0,
        dedicatedBuswayRp:
          state.financialBreakdown?.dedicatedBuswayRp || 0,
      },
      dailyLedger: nextDailyLedger,
      _todayRevenueRp: nextTodayRev + frameRevenueRp,
      _todayVariableOpCostRp: nextTodayVarOp + billedOpCostRp + frameKirFinesRp,
      totalPassengersServed: state.totalPassengersServed + framePaxServed,
      senenTanahAbangPax: state.senenTanahAbangPax + frameSenenTanahAbangPax,
      totalTransfersCompleted:
        state.totalTransfersCompleted + frameTransfersCompleted,
      jakLingkoBonusRp: state.jakLingkoBonusRp + frameJakLingkoBonusRp,
      totalTakenByOjol: state.totalTakenByOjol + newlyStolenByOjol,
      activeLoans: nextLoans,
      cashPopups: mergedPopups,
      stops: updatedStops,
      routes: updatedRoutes,
      vehicles: updatedVehicles,
      roadsidePassengers: nextRoadsidePax,
      _spawnAccumMinutes: spawnAccum,
      _roadsideAccumMinutes: roadsideAccum,
      _opCostAccumRp: nextOpCostAccumRp,
      _opCostAccumMinutes: nextOpCostAccumMin,
      _telemetryPeriodPaxSpawned: nextTelemetryPaxSpawned,
      _telemetryPeriodPaxServed: nextTelemetryPaxServed,
      _telemetryPeriodPaxOjol: nextTelemetryPaxOjol,
      _telemetryPeriodTrips: nextTelemetryTrips,
      _telemetryPeriodRev: nextTelemetryRev,
      _telemetryPeriodOpCost: nextTelemetryOpCost,
      _lastTelemetryPeriodLabel: nextLastPeriodLabel,
      telemetryHistory: nextTelemetryHistory,
    });

    if (dayRolledOver) {
      get().saveCurrentCityToStorage();
    }
  },
}));

/**
 * Helper to compute live status of the 3 Pemprov / Dishub PSO Contracts
 */
export function evaluateDishubContracts(state: {
  routes: TransitRoute[];
  stops: StopNode[];
  vehicles: Vehicle[];
  senenTanahAbangPax: number;
  totalPassengersServed: number;
  totalTakenByOjol: number;
  claimedContractIds: string[];
}): DishubContract[] {
  // Contract 1: Buka minimal 2 Trayek dan angkut 1.000 penumpang komuter (v3: target 1.000, hadiah 25 Jt)
  const hasTwoRoutes = state.routes.length >= 2;
  const c1Pax = state.totalPassengersServed;
  const routesFactor = Math.min(1, state.routes.length / 2);
  const paxFactor = Math.min(1, c1Pax / 1_000);
  const c1Pct = Math.round(((routesFactor + paxFactor) / 2) * 100);
  const c1Done = hasTwoRoutes && c1Pax >= 1_000;

  // Contract 2: Bangun 2 Halte BRT Level 3 (JPO) dan operasikan minimal 2 unit TransJakarta (v3: hadiah 45 Jt)
  const lv3Count = state.stops.filter((s) => s.level === 3).length;
  const brtCount = state.vehicles.filter(
    (v) => v.type === 'brt' && v.status === 'ACTIVE'
  ).length;
  const c2Pct = Math.min(
    100,
    Math.round(((Math.min(2, lv3Count) + Math.min(2, brtCount)) / 4) * 100)
  );
  const c2Done = lv3Count >= 2 && brtCount >= 2;

  // Contract 3: Tekan rasio Penumpang Diambil Ojol di bawah 35% (v3: target 1.500 pax, hadiah 30 Jt)
  const totalHandled = state.totalPassengersServed + state.totalTakenByOjol;
  const ojolRatioPct =
    totalHandled > 0
      ? Math.round((state.totalTakenByOjol / totalHandled) * 100)
      : 0;
  const paxProgress = Math.min(1_500, state.totalPassengersServed);
  const c3PaxFactor = paxProgress / 1_500;
  const ojolGood = ojolRatioPct < 35;
  const ratioFactor = ojolGood ? 1 : Math.max(0, 1 - (ojolRatioPct - 35) / 65);
  const c3Pct = Math.min(100, Math.round(((c3PaxFactor + ratioFactor) / 2) * 100));
  const c3Done = state.totalPassengersServed >= 1_500 && ojolGood;

  return [
    {
      id: 'pso-senen-tanahabang',
      title: 'Koneksi Jaringan Pengumpan Komuter',
      description:
        'Buka minimal 2 trayek aktif yang melayani warga dan angkut total 1.000 penumpang.',
      rewardRp: 25_000_000,
      progressText: `Trayek: ${state.routes.length}/2 • ${c1Pax}/1.000 pax`,
      progressPct: c1Pct,
      completed: c1Done,
      claimed: state.claimedContractIds.includes('pso-senen-tanahabang'),
    },
    {
      id: 'pso-brt-corridor',
      title: 'Modernisasi Koridor Busway (JPO)',
      description:
        'Upgrade minimal 2 Halte ke Level 3 (Halte BRT + JPO) dan operasikan minimal 2 unit bus TransJakarta BRT aktif.',
      rewardRp: 45_000_000,
      progressText: `Halte Lv.3: ${lv3Count}/2 • Unit BRT Aktif: ${brtCount}/2`,
      progressPct: c2Pct,
      completed: c2Done,
      claimed: state.claimedContractIds.includes('pso-brt-corridor'),
    },
    {
      id: 'pso-anti-ojol',
      title: 'Penghargaan Layanan Publik Dishub',
      description:
        'Angkut minimal 1.500 penumpang dengan menjaga rasio warga yang kabur ke Ojol di bawah 35%.',
      rewardRp: 30_000_000,
      progressText: `Terangkut: ${paxProgress}/1.500 • Rasio Ojol: ${ojolRatioPct}% (<35%)`,
      progressPct: c3Pct,
      completed: c3Done,
      claimed: state.claimedContractIds.includes('pso-anti-ojol'),
    },
  ];
}

if (typeof window !== 'undefined') {
  (window as any).__GAME_STORE__ = useGameStore;
}
