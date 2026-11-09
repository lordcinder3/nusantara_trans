import type { Feature, LineString } from 'geojson';

export type CityId = 'jabodetabek' | 'bandung' | 'surabaya' | 'bali';

export type WeatherCondition = 'cerah' | 'hujan' | 'banjir';

export type StarterMode = 'zero_25m' | 'investor_75m' | 'sandbox_hubs';

export type FleetType = 'angkot' | 'metromini' | 'brt';

export type ZoneCategory = 'perumahan' | 'kantor' | 'pasar';

export type InteractionMode = 'view' | 'place_stop' | 'draw_route';

export type CameraMode = '3d' | '2d';

export type MapThemeMode = 'auto' | 'day' | 'night';

export type TimeOfDayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export type GameSpeed = 0 | 1 | 2 | 5;

export type DemandPotentialTier = 'Tinggi' | 'Sedang' | 'Rendah';

export type StopTierLevel = 1 | 2 | 3;

export type MaintenanceTier = 'hemat' | 'standar' | 'prima';

export type ActiveModalType =
  | 'none'
  | 'fleet'
  | 'dealer'
  | 'pool'
  | 'bank'
  | 'company';

export type VehicleOperationalStatus =
  | 'ACTIVE'
  | 'IDLE_IN_POOL'
  | 'MAINTENANCE'
  | 'MOGOK';

export interface FloodZone {
  id: string;
  name: string;
  coords: [number, number]; // Strictly [lng, lat]
  radiusKm: number;
}

export interface DailyLedgerEntry {
  day: number;
  revenueRp: number;
  variableOpCostRp: number;
  fixedOpCostRp: number;
  netProfitRp: number;
}

export interface CashPopupEvent {
  id: string;
  amountRp: number; // Positive for income (+), negative for expense (-)
  label: string; // e.g., "+Rp 45.000", "-Rp 15.000.000"
  categoryLabel: string; // e.g., "Setoran M-01 (9 pnp)", "Beli Angkot", "BBM & Bengkel"
  coords?: [number, number]; // Optional map [lng, lat] where the popup floats
  createdAt: number;
}

export interface StopTierSpec {
  level: StopTierLevel;
  name: string;
  shortName: string;
  upgradeCostRp: number;
  maxQueueCapacity: number;
  patienceMultiplier: number;
  dwellTimeMultiplier: number; // 1.0 = normal, 0.5 = 2x faster boarding
  supportsBRT: boolean;
  description: string;
}

export interface DepotNode {
  id: string;
  name: string;
  areaName: string;
  coords: [number, number]; // Strictly [lng, lat]
  capacitySlots: number;
  unlockCostRp: number;
  unlocked: boolean;
}

export interface BankLoanPackage {
  id: string;
  name: string;
  principalRp: number;
  totalRepayRp: number;
  dailyInstallmentRp: number;
  durationDays: number;
  description: string;
}

export interface ActiveLoan {
  id: string;
  packageId: string;
  name: string;
  remainingRp: number;
  dailyInstallmentRp: number;
  daysLeft: number;
}

export interface DishubContract {
  id: string;
  title: string;
  description: string;
  rewardRp: number;
  progressText: string;
  progressPct: number;
  completed: boolean;
  claimed: boolean;
}

export interface FleetSpec {
  id: FleetType;
  name: string;
  subtitle: string;
  capacity: number;
  baseSpeedKmh: number;
  purchasePrice: number;
  fareRp: number;
  opCostPerKm: number;
  color: string;
  roofColor: string;
  visualLengthM: number;
  visualWidthM: number;
  visualHeightM: number;
  supportsNgetem: boolean;
  supportsHailAnywhere: boolean;
  supportsDedicatedLane: boolean;
  requiresLevel3Stop: boolean;
  description: string;
}

export interface WaitingBatch {
  id: string;
  count: number;
  spawnedAtMinute: number;
  maxPatienceMinutes: number;
  isTransferPassenger?: boolean;
}

export interface StopNode {
  id: string;
  name: string;
  coords: [number, number]; // Strictly [lng, lat]
  category: ZoneCategory;
  level: StopTierLevel; // 1 = Plang, 2 = Halte Beratap, 3 = Halte BRT + JPO
  isPrebuiltHub: boolean;
  catchmentRadiusM: number;
  baseDemandWeight: number;
  buildingCount: number;
  demandTier: DemandPotentialTier;
  waitingBatches: WaitingBatch[];
  totalWaiting: number;
  transitWaiting: number;
  totalTransfersHandled: number;
  ojolLostCount: number;
  lastOjolTimestamp?: number;
}

export interface TransferLink {
  id: string;
  stopAId: string;
  stopBId: string;
  coordsA: [number, number];
  coordsB: [number, number];
  distanceMeters: number;
  isSharedStop: boolean;
  routeCodes: string[];
}

export interface CursorCatchmentPreview {
  coords: [number, number];
  screenX: number;
  screenY: number;
  radiusM: number;
  detectedAreaName: string; // Real neighborhood/street name at cursor!
  buildingCount: number;
  demandTier: DemandPotentialTier;
  estimatedWeight: number;
  estimatedPaxPerHour: number;
  nearbyTransferStopName?: string;
}

export interface RoadsidePassenger {
  id: string;
  routeId: string;
  coords: [number, number];
  distanceAlongKm: number;
  count: number;
  spawnedAtMinute: number;
}

export interface TransitRoute {
  id: string;
  name: string;
  code: string;
  color: string;
  stopIds: string[];
  geometry: Feature<LineString>;
  totalLengthKm: number;
  stopDistancesKm: number[];
  routingSource?: 'osrm' | 'cache' | 'offline-graph';
  customFareRp: number; // Dynamic fare per route (Rp 2.000 - Rp 15.000)
  ngetemEnabled: boolean;
  ngetemThresholdPct: number;
  dedicatedLaneEnabled: boolean;
  dedicatedLaneCostPaid: number;
  totalRevenueRp: number;
  totalOpCostRp: number; // Tracks cumulative variable fuel/maintenance OPEX on this route
  totalPassengersCarried: number;
}

export type VehicleState =
  | 'moving'
  | 'boarding'
  | 'ngetem'
  | 'hailing'
  | 'mogok'
  | 'idle_pool';

export interface Vehicle {
  id: string;
  routeId: string | null; // null = sitting in Pool Garage ("IDLE_IN_POOL")
  status: VehicleOperationalStatus;
  type: FleetType;
  plateNumber: string;
  distanceKm: number;
  direction: 1 | -1;
  coords: [number, number];
  bearing: number;
  currentSpeedKmh: number;
  passengers: number;
  capacity: number;
  condition: number; // 0 to 100% mechanical health
  state: VehicleState;
  dwellTimerSec: number;
  maxNgetemTimerSec: number;
  mogokTimerMinutes: number; // Remaining in-game minutes when broken down
  currentStopIndex: number | null;
  totalRevenueGenerated: number;
  totalTripsCompleted: number;

  // Real-time Per-Armada Financial & Operational Metrics:
  totalFuelCostRp: number; // Biaya BBM kumulatif unit ini
  totalMaintenanceCostRp: number; // Biaya servis / bengkel unit ini
  totalPaxCarried: number; // Total penumpang terangkut unit ini
  totalDistanceTraveledKm: number; // Total km jarak tempuh unit ini
}

export interface CompanyFinancialBreakdown {
  // Pemasukan Operasional & Non-Operasional
  ticketRegularRp: number;
  ticketJaklingkoRp: number;
  subsidyPsoRp: number;
  vehicleSalesRefundRp: number;
  bankLoansDisbursedRp: number;

  // Pengeluaran Operasional (OPEX)
  fuelCostRp: number;
  maintenanceCostRp: number;
  dishubKirFinesRp: number;
  loanInterestAndRepayRp: number;

  // Belanja Modal (CAPEX)
  fleetPurchaseRp: number;
  stopBuildAndUpgradeRp: number;
  depotUnlockRp: number;
  dedicatedBuswayRp: number;
}

export interface FloatingNotification {
  id: string;
  text: string;
  subtext?: string;
  type: 'revenue' | 'ojol' | 'info' | 'expense';
  coords?: [number, number];
  createdAt: number;
}

export interface DraftDetourSegment {
  fromStopId: string;
  fromStopName: string;
  toStopId: string;
  toStopName: string;
  roadKm: number;
  straightKm: number;
  detourRatio: number;
  isDetour: boolean;
}

export interface DraftRouteAnalysis {
  totalRoadKm: number;
  totalStraightKm: number;
  estOneWayMinutes: number;
  estRoundTripMinutes: number;
  hasDetour: boolean;
  detourSegments: DraftDetourSegment[];
  roadSnappedGeometry?: Feature<LineString>;
}

export interface GhostRoutePreview {
  fromStopId: string;
  fromStopName: string;
  toStopId: string;
  toStopName: string;
  roadKm: number;
  straightKm: number;
  detourRatio: number;
  isDetour: boolean;
  estMinutes: number;
  source: 'cache' | 'osrm' | 'offline-graph';
}

