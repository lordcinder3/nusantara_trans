import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Banknote,
  BarChart3,
  BookOpen,
  Bus,
  Check,
  DollarSign,
  FileText,
  Fuel,
  Globe,
  Landmark,
  Lock,
  ParkingSquare,
  Play,
  RotateCcw,
  Rocket,
  Save,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
  Warehouse,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  computeFleetLiquidationValueRp,
  computeMaxFleetSlots,
  computeReputationInfo,
  computeVehicleProfit,
  evaluateDishubContracts,
  useGameStore,
} from '../../store/useGameStore';
import {
  BANK_LOAN_PACKAGES,
  FLEET_SPECS,
  MAINTENANCE_SPECS,
  VEHICLE_OVERHAUL_COST_RP,
} from '../../config/fleetSpecs';
import { CITY_PRESETS } from '../../config/jakartaPreset';
import type { CityId, FleetType, MaintenanceTier } from '../../types/game';

function formatRp(val: number): string {
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
}

function formatRpShort(val: number): string {
  if (val >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)} Jt`;
  }
  return `Rp ${val.toLocaleString('id-ID')}`;
}

export const TycoonModals: React.FC = () => {
  const activeModal = useGameStore((s) => s.activeModal);
  const currentCityId = useGameStore((s) => s.currentCityId);
  const companyName = useGameStore((s) => s.companyName);
  const starterMode = useGameStore((s) => s.starterMode);
  const balanceRp = useGameStore((s) => s.balanceRp);
  const totalRevenueRp = useGameStore((s) => s.totalRevenueRp);
  const totalOpCostRp = useGameStore((s) => s.totalOpCostRp);
  const totalCapexSpentRp = useGameStore((s) => s.totalCapexSpentRp);
  const dailyLedger = useGameStore((s) => s.dailyLedger);
  const cashPopups = useGameStore((s) => s.cashPopups);
  const stops = useGameStore((s) => s.stops);
  const routes = useGameStore((s) => s.routes);
  const vehicles = useGameStore((s) => s.vehicles);
  const depots = useGameStore((s) => s.depots);
  const maintenanceTier = useGameStore((s) => s.maintenanceTier);
  const activeLoans = useGameStore((s) => s.activeLoans);
  const claimedContractIds = useGameStore((s) => s.claimedContractIds);
  const senenTanahAbangPax = useGameStore((s) => s.senenTanahAbangPax);
  const totalPassengersServed = useGameStore((s) => s.totalPassengersServed);
  const totalTakenByOjol = useGameStore((s) => s.totalTakenByOjol);
  const selectedRouteId = useGameStore((s) => s.selectedRouteId);
  const financialBreakdown = useGameStore((s) => s.financialBreakdown);

  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const setCompanyName = useGameStore((s) => s.setCompanyName);
  const switchCity = useGameStore((s) => s.switchCity);
  const resetCityGame = useGameStore((s) => s.resetCityGame);
  const saveCurrentCityToStorage = useGameStore((s) => s.saveCurrentCityToStorage);
  const selectRoute = useGameStore((s) => s.selectRoute);
  const buyVehicle = useGameStore((s) => s.buyVehicle);
  const serviceVehicle = useGameStore((s) => s.serviceVehicle);
  const serviceAllVehicles = useGameStore((s) => s.serviceAllVehicles);
  const assignVehicleToRoute = useGameStore((s) => s.assignVehicleToRoute);
  const sellVehicle = useGameStore((s) => s.sellVehicle);
  const setMaintenanceTier = useGameStore((s) => s.setMaintenanceTier);
  const unlockDepot = useGameStore((s) => s.unlockDepot);
  const takeBankLoan = useGameStore((s) => s.takeBankLoan);
  const repayLoanEarly = useGameStore((s) => s.repayLoanEarly);
  const claimContractReward = useGameStore((s) => s.claimContractReward);

  const [nameDraft, setNameDraft] = useState(companyName);
  const [savedToast, setSavedToast] = useState(false);
  const [bankTab, setBankTab] = useState<'statement' | 'fleet' | 'contracts' | 'loans'>('statement');
  const [fleetReportFilter, setFleetReportFilter] = useState<'all' | 'profitable' | 'unprofitable'>('all');

  if (
    activeModal !== 'dealer' &&
    activeModal !== 'pool' &&
    activeModal !== 'bank' &&
    activeModal !== 'company'
  ) {
    return null;
  }

  const maxFleetSlots = computeMaxFleetSlots(depots);
  const idleCount = vehicles.filter((v) => v.status === 'IDLE_IN_POOL').length;
  const fleetValuationRp = computeFleetLiquidationValueRp(vehicles);
  const repInfo = computeReputationInfo(totalPassengersServed, stops);
  const repScore =
    totalPassengersServed + stops.filter((s) => s.level >= 2).length * 60;
  const repNextPct = Math.min(
    100,
    Math.round((repScore / Math.max(1, repInfo.nextTargetPax)) * 100)
  );
  const selectedRoute =
    routes.find((r) => r.id === selectedRouteId) || routes[0] || null;
  const selectedRouteLv3Count = selectedRoute
    ? selectedRoute.stopIds.filter((sid) => {
        const st = stops.find((s) => s.id === sid);
        return st && st.level === 3;
      }).length
    : 0;

  const contracts = evaluateDishubContracts({
    routes,
    stops,
    vehicles,
    senenTanahAbangPax,
    totalPassengersServed,
    totalTakenByOjol,
    claimedContractIds,
  });

  return (
    <div
      onClick={() => setActiveModal('none')}
      className="pointer-events-auto fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-2 sm:p-4"
    >
      {/* =====================================================================
          MODAL 1: DEALER ARMADA (Beli & Simpan di Pool vs Langsung Terjunkan)
         ===================================================================== */}
      {activeModal === 'dealer' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-[96vw] max-w-7xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <span>Showroom & Dealer Armada Nusantara</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-emerald-300 border border-slate-700">
                    Slot Garasi: {vehicles.length}/{maxFleetSlots} ({idleCount} di Pool)
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Pilih untuk <strong>Simpan di Pool (Stok Cadangan)</strong> atau{' '}
                  <strong>Langsung Terjunkan ke Trayek</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveModal('fleet')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs"
              >
                🚌 Lihat Stok Armada ({vehicles.length})
              </button>
              <button
                onClick={() => setActiveModal('none')}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Target Route Selector Bar for Direct Deployment */}
          <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-300">
                Target Terjun Langsung:
              </span>
              {routes.map((r) => {
                const active = selectedRoute?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => selectRoute(r.id)}
                    className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                      active
                        ? 'bg-slate-800 border-white text-white shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span>
                      {r.code} ({r.name})
                    </span>
                  </button>
                );
              })}
            </div>
            {vehicles.length >= maxFleetSlots && (
              <button
                onClick={() => setActiveModal('pool')}
                className="px-3 py-1 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs"
              >
                ⚠️ Slot Pool Penuh! Buka Pool Baru ➔
              </button>
            )}
          </div>

          {/* 3 Vehicle Tier Cards */}
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['angkot', 'metromini', 'brt'] as FleetType[]).map((type) => {
              const spec = FLEET_SPECS[type];
              const poolFull = vehicles.length >= maxFleetSlots;
              const canAfford = balanceRp >= spec.purchasePrice && !poolFull;
              const brtGateLockedOnSelectedRoute =
                spec.requiresLevel3Stop && selectedRouteLv3Count < 2;
              const canDeployDirectly =
                canAfford &&
                Boolean(selectedRoute) &&
                !brtGateLockedOnSelectedRoute;

              return (
                <div
                  key={type}
                  className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-sm"
                            style={{ backgroundColor: spec.color }}
                          />
                          <h3 className="font-extrabold text-sm text-white">
                            {spec.name}
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {spec.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">
                          Harga Unit Baru
                        </div>
                        <div className="font-mono font-extrabold text-base text-emerald-400">
                          {formatRpShort(spec.purchasePrice)}
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px] text-slate-300">
                        <div>👥 {spec.capacity} Penumpang</div>
                        <div>⚡ {spec.baseSpeedKmh} km/j</div>
                        <div className="text-rose-300">
                          ⛽ Rp {spec.opCostPerKm}/km
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {spec.description}
                    </p>

                    {spec.requiresLevel3Stop && (
                      <div
                        className={`p-2 rounded-xl border text-[11px] flex items-center gap-1.5 font-semibold ${
                          selectedRouteLv3Count >= 2
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          Syarat Terjun ke {selectedRoute?.code || 'Trayek'}: Min. 2
                          Halte Lv.3 JPO ({selectedRouteLv3Count}/2 siap). Bisa beli &
                          simpan di Pool dulu!
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Two Explicit Purchase Buttons */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    {/* Button 1: Beli & Simpan di Pool (Stok Cadangan) */}
                    <button
                      disabled={!canAfford}
                      onClick={() => buyVehicle(type, null)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 border border-amber-500/40 disabled:border-slate-800 text-amber-300 font-extrabold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <ParkingSquare className="w-4 h-4" />
                      <span>
                        {poolFull
                          ? 'Slot Pool Penuh'
                          : balanceRp < spec.purchasePrice
                          ? 'Saldo Kurang'
                          : 'Beli & Simpan di Pool (Cadangan)'}
                      </span>
                    </button>

                    {/* Button 2: Beli & Langsung Terjunkan ke Trayek */}
                    <button
                      disabled={!canDeployDirectly}
                      onClick={() =>
                        selectedRoute && buyVehicle(type, selectedRoute.id)
                      }
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition shadow-lg"
                    >
                      <Rocket className="w-4 h-4" />
                      <span>
                        {poolFull
                          ? 'Buka Pool Baru Dulu'
                          : brtGateLockedOnSelectedRoute
                          ? `Butuh 2 Halte Lv.3 di ${selectedRoute?.code}`
                          : `Beli & Terjunkan ke ${selectedRoute?.code || 'Trayek'}`}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: GARASI POOL & BENGKEL KIR DISHUB
         ===================================================================== */}
      {activeModal === 'pool' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-[96vw] max-w-7xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300">
                <Warehouse className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white">
                  Garasi Pool Armada & Standar Bengkel KIR Dishub
                </h2>
                <p className="text-xs text-slate-400">
                  Perluas kapasitas pool garasi di DKI Jakarta & atur anggaran perawatan
                  mesin agar armada bebas mogok.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveModal('none')}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left Column: Maintenance Tier & Workshop Overhaul */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    <span>Standar Perawatan Bengkel Harian</span>
                  </span>
                  {vehicles.some(
                    (v) => v.condition < 90 || v.state === 'mogok'
                  ) && (
                    <button
                      onClick={serviceAllVehicles}
                      className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs"
                    >
                      Servis Semua Unit (
                      {formatRpShort(
                        vehicles.filter(
                          (v) => v.condition < 90 || v.state === 'mogok'
                        ).length * VEHICLE_OVERHAUL_COST_RP
                      )}
                      )
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['hemat', 'standar', 'prima'] as MaintenanceTier[]).map(
                    (tier) => {
                      const mSpec = MAINTENANCE_SPECS[tier];
                      const active = maintenanceTier === tier;
                      return (
                        <button
                          key={tier}
                          onClick={() => setMaintenanceTier(tier)}
                          className={`p-2.5 rounded-xl border text-left transition ${
                            active
                              ? 'bg-emerald-500/20 border-emerald-400 text-white shadow'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-xs font-extrabold">{mSpec.label}</div>
                          <div className="text-[10px] font-mono text-emerald-300 mt-0.5">
                            OPEX {Math.round(mSpec.costMultiplier * 100)}%
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  {MAINTENANCE_SPECS[maintenanceTier].desc}
                </p>

                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 space-y-1">
                  <div className="font-bold text-rose-300">
                    ⚠️ Risiko Mogok & Razia KIR Dishub:
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Jika kondisi mesin armada di jalan turun di bawah <strong>30%</strong>
                    , armada berisiko <strong>💨 MOGOK 30 menit</strong> (penumpang kabur
                    ke Ojol) atau kena tilang <strong>Razia KIR Dishub (-Rp 3,5 Jt)</strong>.
                    Armada yang diparkir di Pool akan pulih perlahan tanpa biaya!
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Unlockable Jakarta Depots */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-white">
                  🏭 Ekspansi Pool Garasi DKI Jakarta
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  Total Kapasitas: {vehicles.length}/{maxFleetSlots} Slot
                </span>
              </div>

              {depots.map((d) => (
                <div
                  key={d.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                    d.unlocked
                      ? 'bg-emerald-950/25 border-emerald-500/40'
                      : 'bg-slate-950/90 border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-white">
                        {d.unlocked ? '🏭' : '🔒'} {d.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-300 border border-slate-700">
                        +{d.capacitySlots} Slot Armada
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{d.areaName}</p>
                  </div>

                  {d.unlocked ? (
                    <span className="shrink-0 px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                      AKTIF
                    </span>
                  ) : (
                    <button
                      disabled={balanceRp < d.unlockCostRp}
                      onClick={() => unlockDepot(d.id)}
                      className="shrink-0 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-xs transition flex items-center gap-1.5 shadow"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Buka ({formatRpShort(d.unlockCostRp)})</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: LAPORAN KEUANGAN PO, BANK PEMBANGUNAN & KONTRAK PSO DISHUB
         ===================================================================== */}
      {activeModal === 'bank' && (() => {
        const netOperatingProfit = totalRevenueRp - totalOpCostRp;
        const operatingMarginPct =
          totalRevenueRp > 0
            ? Math.round((netOperatingProfit / totalRevenueRp) * 100)
            : totalOpCostRp > 0
            ? -100
            : 0;

        const vehicleProfitList = vehicles.map((v) => ({
          vehicle: v,
          profit: computeVehicleProfit(v),
        }));

        const profitableVehiclesCount = vehicleProfitList.filter(
          (item) => item.profit.netProfitRp >= 0 && (item.profit.revenueRp > 0 || item.profit.distanceKm > 0)
        ).length;
        const unprofitableVehiclesCount = vehicleProfitList.filter(
          (item) => item.profit.netProfitRp < 0
        ).length;

        const sortedVehicles = [...vehicleProfitList]
          .filter((item) => {
            if (fleetReportFilter === 'profitable') return item.profit.netProfitRp >= 0;
            if (fleetReportFilter === 'unprofitable') return item.profit.netProfitRp < 0;
            return true;
          })
          .sort((a, b) => {
            if (fleetReportFilter === 'unprofitable') {
              return a.profit.netProfitRp - b.profit.netProfitRp; // Most negative first
            }
            return b.profit.netProfitRp - a.profit.netProfitRp; // Highest profit first
          });

        const claimableContractsCount = contracts.filter(
          (c) => c.completed && !c.claimed
        ).length;

        return (
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[96vw] max-w-7xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                    <span>Laporan Keuangan & Perbankan PO</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-emerald-300 border border-slate-700">
                      Kas: {formatRp(balanceRp)}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Laporan Laba / Rugi Komprehensif, Evaluasi Untung-Rugi Tiap Armada, Subsidi PSO & Kredit Bank.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4 Interactive Navigation Tabs */}
            <div className="px-5 py-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setBankTab('statement')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  bankTab === 'statement'
                    ? 'bg-purple-500 text-slate-950 shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📊 Laporan Laba / Rugi & Arus Kas</span>
              </button>

              <button
                onClick={() => setBankTab('fleet')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  bankTab === 'fleet'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <Bus className="w-3.5 h-3.5" />
                <span>
                  🏆 Profitabilitas Armada ({vehicles.length} Unit •{' '}
                  <span className="text-emerald-300 font-extrabold">{profitableVehiclesCount} Untung</span> /{' '}
                  <span className="text-rose-300 font-extrabold">{unprofitableVehiclesCount} Boncos</span>)
                </span>
              </button>

              <button
                onClick={() => setBankTab('contracts')}
                className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  bankTab === 'contracts'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>📜 Subsidi Dishub PSO ({contracts.length})</span>
                {claimableContractsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold">
                    {claimableContractsCount} Klaim!
                  </span>
                )}
              </button>

              <button
                onClick={() => setBankTab('loans')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  bankTab === 'loans'
                    ? 'bg-sky-400 text-slate-950 shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>
                  🏛️ Kredit Bank ({activeLoans.length > 0 ? `${activeLoans.length} Aktif` : 'Fasilitas Pinjaman'})
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* ==============================================================
                  TAB 1: LAPORAN LABA / RUGI & ARUS KAS (INCOME STATEMENT)
                 ============================================================== */}
              {bankTab === 'statement' && (
                <div className="space-y-4">
                  {/* Executive KPI Summary 4-Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                        <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                        <span>KAS TERSEDIA JURAGAN</span>
                      </div>
                      <div className="text-base font-extrabold text-cyan-300 mt-1">
                        {formatRp(balanceRp)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Likuiditas kas siap pakai
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                        <span>TOTAL PENDAPATAN (OMZET)</span>
                      </div>
                      <div className="text-base font-extrabold text-emerald-400 mt-1">
                        +{formatRp(totalRevenueRp)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Tiket, JakLingko & Subsidi
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-rose-400 flex items-center gap-1 font-bold">
                        <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                        <span>TOTAL BEBAN OPERASIONAL (OPEX)</span>
                      </div>
                      <div className="text-base font-extrabold text-rose-400 mt-1">
                        -{formatRp(totalOpCostRp)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        BBM, Servis, Tilang & Bank
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border ${
                        netOperatingProfit >= 0
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      <div className="text-[10px] flex items-center gap-1 font-bold">
                        {netOperatingProfit >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span>LABA OPERASIONAL BERSIH</span>
                      </div>
                      <div className="text-base font-extrabold mt-1">
                        {netOperatingProfit >= 0 ? '+' : ''}
                        {formatRp(netOperatingProfit)}
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        {netOperatingProfit >= 0 ? '🟢 UNTUNG' : '🔴 BONCOS'} (Margin: {operatingMarginPct}%)
                      </div>
                    </div>
                  </div>

                  {/* Main Financial Report (Double Column) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left Column (7 cols): Detailed Income & Expense Statement */}
                    <div className="lg:col-span-7 space-y-4">
                      {/* Section 1: Pemasukan Operasional */}
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-extrabold text-sm text-emerald-300 flex items-center gap-1.5">
                            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                            <span>1. Rincian Pemasukan Operasional (+)</span>
                          </span>
                          <span className="font-mono text-xs font-bold text-emerald-400">
                            +{formatRp(totalRevenueRp)}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs font-mono">
                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300">Tiket Penumpang Reguler</span>
                            <span className="text-emerald-400 font-bold">
                              +{formatRp(financialBreakdown?.ticketRegularRp || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300">
                              Bonus Oper JakLingko (+25% Integrasi Halte)
                            </span>
                            <span className="text-emerald-400 font-bold">
                              +{formatRp(financialBreakdown?.ticketJaklingkoRp || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300">Subsidi Kontrak Dishub (PSO)</span>
                            <span className="text-emerald-400 font-bold">
                              +{formatRp(financialBreakdown?.subsidyPsoRp || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300">Penjualan Armada Bekas (Refund 60%)</span>
                            <span className="text-slate-400 font-bold">
                              +{formatRp(financialBreakdown?.vehicleSalesRefundRp || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300">Pencairan Fasilitas Kredit Bank</span>
                            <span className="text-purple-300 font-bold">
                              +{formatRp(financialBreakdown?.bankLoansDisbursedRp || 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Beban Operasional (OPEX) */}
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-extrabold text-sm text-rose-300 flex items-center gap-1.5">
                            <ArrowDownRight className="w-4 h-4 text-rose-400" />
                            <span>2. Rincian Beban Operasional (OPEX) (-)</span>
                          </span>
                          <span className="font-mono text-xs font-bold text-rose-400">
                            -{formatRp(totalOpCostRp)}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs font-mono">
                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300 flex items-center gap-1">
                              <Fuel className="w-3.5 h-3.5 text-rose-400" />
                              <span>Biaya Bahan Bakar (BBM) Armada</span>
                            </span>
                            <span className="text-rose-400 font-bold">
                              -{formatRp(financialBreakdown?.fuelCostRp || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300 flex items-center gap-1">
                              <Wrench className="w-3.5 h-3.5 text-amber-400" />
                              <span>Biaya Servis / Overhaul Bengkel Mesin</span>
                            </span>
                            <span className="text-amber-400 font-bold">
                              -{formatRp(financialBreakdown?.maintenanceCostRp || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                              <span>Denda Razia KIR Dishub (Mesin &lt;30%)</span>
                            </span>
                            <span className="text-rose-400 font-bold">
                              -{formatRp(financialBreakdown?.dishubKirFinesRp || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300 flex items-center gap-1">
                              <Landmark className="w-3.5 h-3.5 text-purple-400" />
                              <span>Cicilan Pokok & Bunga Pinjaman Bank</span>
                            </span>
                            <span className="text-purple-400 font-bold">
                              -{formatRp(financialBreakdown?.loanInterestAndRepayRp || 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Belanja Modal / Investasi Aset (CAPEX) */}
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-extrabold text-sm text-amber-300 flex items-center gap-1.5">
                            <Store className="w-4 h-4 text-amber-400" />
                            <span>3. Belanja Modal / Investasi Aset (CAPEX)</span>
                          </span>
                          <span className="font-mono text-xs font-bold text-amber-300">
                            Total {formatRp(totalCapexSpentRp)}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs font-mono">
                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300">Pengadaan / Beli Armada Baru</span>
                            <span className="text-slate-300 font-bold">
                              {formatRp(financialBreakdown?.fleetPurchaseRp || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300">Konstruksi & Upgrade Halte</span>
                            <span className="text-slate-300 font-bold">
                              {formatRp(financialBreakdown?.stopBuildAndUpgradeRp || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300">Akuisisi Lahan Pool Garasi</span>
                            <span className="text-slate-300 font-bold">
                              {formatRp(financialBreakdown?.depotUnlockRp || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900">
                            <span className="text-slate-300">Separator Busway Khusus BRT</span>
                            <span className="text-slate-300 font-bold">
                              {formatRp(financialBreakdown?.dedicatedBuswayRp || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-sky-950/40 border border-sky-500/30">
                            <span className="text-sky-300 font-bold">Valuasi Likuidasi Seluruh Armada</span>
                            <span className="text-sky-300 font-extrabold">
                              {formatRp(fleetValuationRp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column (5 cols): Tutup Buku Harian & Arus Mutasi Kas */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* Tutup Buku Harian */}
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                            📅 Laporan Tutup Buku Harian (00:00 WIB)
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {dailyLedger.length} Hari Tercatat
                          </span>
                        </div>

                        {dailyLedger.length === 0 ? (
                          <div className="text-xs text-slate-500 py-6 text-center">
                            Menunggu penutupan buku hari pertama (00:00 WIB)...
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {[...dailyLedger].reverse().map((d) => (
                              <div
                                key={d.day}
                                className="p-2 rounded-xl bg-slate-900 border border-slate-800/80 text-xs font-mono space-y-1"
                              >
                                <div className="flex items-center justify-between font-bold">
                                  <span className="text-white">Hari ke-{d.day}</span>
                                  <span
                                    className={
                                      d.netProfitRp >= 0
                                        ? 'text-emerald-400 font-extrabold'
                                        : 'text-rose-400 font-extrabold'
                                    }
                                  >
                                    {d.netProfitRp >= 0 ? '+' : ''}
                                    {formatRp(d.netProfitRp)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>Rev: +{formatRpShort(d.revenueRp)}</span>
                                  <span>OPEX: -{formatRpShort(d.variableOpCostRp)}</span>
                                  <span>Tetap: -{formatRpShort(d.fixedOpCostRp)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Log Mutasi Real-Time */}
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider">
                            ⚡ Mutasi Kas Real-Time Terkini
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {cashPopups.length} Transaksi
                          </span>
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                          {cashPopups.length === 0 ? (
                            <div className="text-xs text-slate-500 py-8 text-center">
                              Menunggu transaksi operasional...
                            </div>
                          ) : (
                            [...cashPopups].reverse().map((item) => {
                              const pos = item.amountRp >= 0;
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono"
                                >
                                  <span className="text-slate-300 truncate pr-2 font-sans">
                                    {item.categoryLabel}
                                  </span>
                                  <span
                                    className={`font-extrabold shrink-0 ${
                                      pos ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {item.label}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==============================================================
                  TAB 2: LAPORAN PROFITABILITAS ARMADA (PER-VEHICLE P&L)
                 ============================================================== */}
              {bankTab === 'fleet' && (
                <div className="space-y-4">
                  {/* Filter Sub-bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Filter Profit:</span>
                      <button
                        onClick={() => setFleetReportFilter('all')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                          fleetReportFilter === 'all'
                            ? 'bg-cyan-500 text-slate-950 shadow'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        Semua ({vehicles.length})
                      </button>
                      <button
                        onClick={() => setFleetReportFilter('profitable')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                          fleetReportFilter === 'profitable'
                            ? 'bg-emerald-500 text-slate-950 shadow'
                            : 'bg-slate-800 text-emerald-400 hover:text-white'
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>🟢 Untung ({profitableVehiclesCount})</span>
                      </button>
                      <button
                        onClick={() => setFleetReportFilter('unprofitable')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                          fleetReportFilter === 'unprofitable'
                            ? 'bg-rose-500 text-white shadow'
                            : 'bg-slate-800 text-rose-400 hover:text-white'
                        }`}
                      >
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>🔴 Boncos ({unprofitableVehiclesCount})</span>
                      </button>
                    </div>

                    <button
                      onClick={() => setActiveModal('fleet')}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-1"
                    >
                      <Bus className="w-3.5 h-3.5" />
                      <span>Buka Manajemen Armada Lengkap ➔</span>
                    </button>
                  </div>

                  {/* Vehicles Table / Card View */}
                  {sortedVehicles.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                      <p>Tidak ada armada pada kriteria filter ini.</p>
                      <button
                        onClick={() => setActiveModal('dealer')}
                        className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-extrabold text-xs"
                      >
                        🏪 Beli Armada Baru
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sortedVehicles.map(({ vehicle: v, profit }) => {
                        const spec = FLEET_SPECS[v.type];
                        const isIdle = v.status === 'IDLE_IN_POOL' || !v.routeId;
                        const currentRoute = routes.find((r) => r.id === v.routeId);
                        const condPct = Math.round(v.condition);

                        return (
                          <div
                            key={v.id}
                            className={`p-3.5 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                              profit.isProfitable
                                ? 'bg-slate-950/90 border-slate-800 hover:border-emerald-500/40'
                                : 'bg-slate-950/90 border-rose-900/60 hover:border-rose-500/60'
                            }`}
                          >
                            {/* Left: Info & Plate */}
                            <div className="min-w-[220px] space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-sm shrink-0"
                                  style={{ backgroundColor: spec.color }}
                                />
                                <span className="font-mono font-extrabold text-sm text-amber-300 px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                                  {v.plateNumber}
                                </span>
                                <span className="font-extrabold text-xs text-white">
                                  {spec.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                                {isIdle ? (
                                  <span className="text-amber-300 font-bold">
                                    🅿️ Standby di Pool
                                  </span>
                                ) : (
                                  <span className="text-cyan-300 font-bold">
                                    🛣️ {currentRoute?.code || 'TRAYEK'}: {currentRoute?.name || ''}
                                  </span>
                                )}
                                <span>• Mesin: {condPct}%</span>
                              </div>
                            </div>

                            {/* Middle: 4 Financial Columns */}
                            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                                <div className="text-[10px] text-slate-400">Setoran Tiket</div>
                                <div className="text-emerald-400 font-extrabold">
                                  +{formatRp(profit.revenueRp)}
                                </div>
                              </div>

                              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                                <div className="text-[10px] text-slate-400">Biaya BBM</div>
                                <div className="text-rose-400 font-extrabold">
                                  -{formatRp(profit.fuelCostRp)}
                                </div>
                              </div>

                              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                                <div className="text-[10px] text-slate-400">Biaya Servis</div>
                                <div className="text-amber-300 font-extrabold">
                                  -{formatRp(profit.maintenanceCostRp)}
                                </div>
                              </div>

                              <div
                                className={`p-2 rounded-xl border ${
                                  profit.isProfitable
                                    ? 'bg-emerald-950/40 border-emerald-500/40'
                                    : 'bg-rose-950/40 border-rose-500/40'
                                }`}
                              >
                                <div className="text-[10px] text-slate-300 font-bold">
                                  Laba Bersih ({profit.marginPct}%)
                                </div>
                                <div
                                  className={`font-extrabold ${
                                    profit.isProfitable ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {profit.isProfitable ? '+' : ''}
                                  {formatRp(profit.netProfitRp)}
                                </div>
                              </div>
                            </div>

                            {/* Right: Operational Telemetry & Badge */}
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right font-mono text-[11px] text-slate-400 hidden lg:block">
                                <div>{profit.paxCarried} Pax • {profit.distanceKm} km</div>
                                <div className="text-[10px] text-slate-500">{profit.trips} Ritase</div>
                              </div>

                              {profit.isProfitable ? (
                                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs">
                                  🟢 UNTUNG
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-extrabold text-xs animate-pulse">
                                  🔴 BONCOS
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ==============================================================
                  TAB 3: KONTRAK SUBSIDI DISHUB (PSO)
                 ============================================================== */}
              {bankTab === 'contracts' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <p className="font-bold text-amber-300">
                      💡 Kontrak Pelayanan Publik (PSO) Dishub:
                    </p>
                    <p className="text-slate-400">
                      Penuhi target operasional trayek, integrasi halte & keselamatan armada untuk mencairkan dana subsidi operasional dari Dishub Pemprov DKI.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contracts.map((c) => (
                      <div
                        key={c.id}
                        className={`p-4 rounded-2xl border space-y-2.5 ${
                          c.claimed
                            ? 'bg-slate-950/50 border-slate-800/60 opacity-75'
                            : c.completed
                            ? 'bg-emerald-950/40 border-emerald-400/70'
                            : 'bg-slate-950/90 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-extrabold text-white">
                              {c.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                              {c.description}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-xs font-extrabold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                            +{formatRpShort(c.rewardRp)}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                            <span>{c.progressText}</span>
                            <span>{c.progressPct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all"
                              style={{ width: `${c.progressPct}%` }}
                            />
                          </div>
                        </div>

                        {c.claimed ? (
                          <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Subsidi Telah Diklaim
                          </div>
                        ) : c.completed ? (
                          <button
                            onClick={() =>
                              claimContractReward(c.id, c.rewardRp, c.title)
                            }
                            className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 animate-pulse"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Klaim Subsidi +{formatRpShort(c.rewardRp)}!</span>
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ==============================================================
                  TAB 4: FASILITAS KREDIT & PINJAMAN BANK
                 ============================================================== */}
              {bankTab === 'loans' && (
                <div className="space-y-4">
                  {activeLoans.length > 0 && (
                    <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/40 space-y-2.5">
                      <div className="text-xs font-bold text-purple-200">
                        Pinjaman Berjalan (Dipotong otomatis setiap 00:00 WIB):
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeLoans.map((l) => (
                          <div
                            key={l.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs"
                          >
                            <div>
                              <div className="font-bold text-white">{l.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Sisa Pokok: {formatRp(l.remainingRp)} • Cicilan {formatRpShort(l.dailyInstallmentRp)}/hr
                              </div>
                            </div>
                            <button
                              disabled={balanceRp < l.remainingRp}
                              onClick={() => repayLoanEarly(l.id)}
                              className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-[10px]"
                            >
                              Lunasi Sekarang
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {BANK_LOAN_PACKAGES.map((pkg) => {
                      const alreadyActive = activeLoans.some(
                        (l) => l.packageId === pkg.id
                      );
                      return (
                        <div
                          key={pkg.id}
                          className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs font-extrabold text-white">
                                {pkg.name}
                              </h4>
                              <span className="font-mono text-xs font-extrabold text-emerald-400">
                                +{formatRpShort(pkg.principalRp)}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 leading-snug">
                              {pkg.description}
                            </p>

                            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono space-y-1">
                              <div className="flex justify-between text-slate-400">
                                <span>Total Pengembalian:</span>
                                <span className="text-rose-300 font-bold">{formatRp(pkg.totalRepayRp)}</span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Cicilan Harian:</span>
                                <span className="text-rose-300 font-bold">{formatRpShort(pkg.dailyInstallmentRp)}/hari</span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Tenor Waktu:</span>
                                <span className="text-slate-300">{pkg.durationDays} Hari Operasional</span>
                              </div>
                            </div>
                          </div>

                          <button
                            disabled={alreadyActive}
                            onClick={() => takeBankLoan(pkg.id)}
                            className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-xs transition"
                          >
                            {alreadyActive
                              ? 'Paket Ini Sedang Berjalan'
                              : `Cairkan Dana +${formatRpShort(pkg.principalRp)}`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* =====================================================================
          MODAL 4: PROFIL PO, MULTI-KOTA NUSANTARA, SAVE/RESET & BUKU PINTAR
         ===================================================================== */}
      {activeModal === 'company' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-[96vw] max-w-7xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <span>Profil Perusahaan Otobus (PO), Multi-Kota Nusantara & Save</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    Lv.{repInfo.level} • {repInfo.title}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Pindah kota operasional (Jabodetabek, Bandung, Surabaya, Bali) dengan
                  auto-save terpisah di setiap kota, atau reset dengan mode modal awal.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveModal('none')}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Col 1: PO Identity, Reputation & Save/Reset Starter Modes */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider">
                  🏢 Identitas Perusahaan Otobus (PO)
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Nama PO kamu..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={() => setCompanyName(nameDraft)}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs"
                  >
                    Simpan
                  </button>
                </div>

                {/* Reputation Bar */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      Lv.{repInfo.level} — {repInfo.title}
                    </span>
                    <span className="font-mono text-cyan-300 text-[11px]">
                      Skor: {repScore} pt
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400"
                      style={{ width: `${repNextPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Skor reputasi naik dari penumpang terangkut ({totalPassengersServed}{' '}
                    pax) & jumlah halte beratap/JPO (Bonus Demand:{' '}
                    {Math.round(repInfo.demandBonusMult * 100)}%).
                  </p>
                </div>

                {/* Manual Save Button */}
                <button
                  onClick={() => {
                    saveCurrentCityToStorage();
                    setSavedToast(true);
                    window.setTimeout(() => setSavedToast(false), 2000);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {savedToast
                      ? '✓ Tersimpan di Browser (LocalStorage)!'
                      : `Simpan Progress Kota ${CITY_PRESETS[currentCityId].name}`}
                  </span>
                </button>
              </div>

              {/* Reset / Choose Starter Mode for Current City */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Kota Ini & Pilih Mode Modal Awal</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Mode saat ini:{' '}
                  <strong className="text-white">
                    {starterMode === 'zero_25m'
                      ? 'Rintis dari Nol (Rp 25 Jt)'
                      : starterMode === 'investor_75m'
                      ? 'Kredit Investor (Rp 75 Jt)'
                      : 'Sandbox (4 Hub Awal)'}
                  </strong>
                </p>

                <button
                  onClick={() => {
                    resetCityGame('zero_25m');
                    setActiveModal('none');
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-left transition space-y-0.5"
                >
                  <div className="text-xs font-extrabold text-cyan-300">
                    🔥 Mode "Rintis dari Nol" (Rp 25 Jt • 0 Halte • 0 Armada)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Pasang 2 Plang Halte (Rp 3 Jt) + Beli 1 Angkot (Rp 12 Jt) = Sisa Kas
                    Rp 10 Jt!
                  </div>
                </button>

                <button
                  onClick={() => {
                    resetCityGame('investor_75m');
                    setActiveModal('none');
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-purple-500/40 text-left transition space-y-0.5"
                >
                  <div className="text-xs font-extrabold text-purple-300">
                    🏦 Mode "Kredit Investor" (Rp 75 Jt + Cicilan Bank)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Langsung pegang Rp 75 Jt untuk beli Kopaja/2 Angkot, tapi wajib bayar
                    cicilan Rp 3,8 Jt tiap 00:00 WIB.
                  </div>
                </button>

                <button
                  onClick={() => {
                    resetCityGame('sandbox_hubs');
                    setActiveModal('none');
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-left transition space-y-0.5"
                >
                  <div className="text-xs font-extrabold text-emerald-300">
                    🏙️ Mode "Sandbox 4 Hub" (Rp 50 Jt + 4 Stasiun Lv.2 Siap)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    4 Hub Stasiun Lv.2 sudah tersedia di peta, tinggal tarik trayek &
                    beli armada.
                  </div>
                </button>
              </div>
            </div>

            {/* Col 2: Multi-City Nusantara Selector (Jabodetabek, Bandung, Surabaya, Bali) */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-cyan-300">
                <Globe className="w-4 h-4" />
                <span>Peta Ekspansi Multi-Kota Nusantara</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Setiap kota punya batas peta, Pool Garasi, titik banjir, dan slot
                penyimpanan (Save) masing-masing.
              </p>

              {(['jabodetabek', 'bandung', 'surabaya', 'bali'] as CityId[]).map(
                (cid) => {
                  const preset = CITY_PRESETS[cid];
                  const isCurrent = currentCityId === cid;
                  return (
                    <div
                      key={cid}
                      className={`p-3.5 rounded-2xl border space-y-2 transition ${
                        isCurrent
                          ? 'bg-cyan-950/40 border-cyan-400 shadow-lg'
                          : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-white">
                              {preset.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-300">
                              Plat {preset.platePrefix}
                            </span>
                          </div>
                          <div className="text-[11px] font-semibold text-cyan-300 mt-0.5">
                            {preset.subtitle}
                          </div>
                        </div>
                        {isCurrent ? (
                          <span className="shrink-0 px-2.5 py-1 rounded-xl bg-cyan-500 text-slate-950 font-extrabold text-[10px]">
                            KOTA AKTIF
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              switchCity(cid);
                              setActiveModal('none');
                            }}
                            className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-extrabold text-xs transition"
                          >
                            Pindah Kota ➔
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {preset.specialRuleLabel}
                      </p>
                      <div className="text-[10px] font-mono text-slate-500">
                        📍 {preset.neighborhoodCentroids.length} Wilayah • 🏭{' '}
                        {preset.depots.length} Pool Garasi • 🔥 {preset.hotspots.length}{' '}
                        Hotspot
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {/* Col 3: Buku Pintar Juragan (In-Game Guidebook) */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-amber-300">
                <BookOpen className="w-4 h-4" />
                <span>📖 Buku Pintar Juragan</span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="font-extrabold text-emerald-300 mb-0.5">
                    1. Strategi Modal Awal Rp 25 Juta
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Pasang <strong>2 Plang Halte Lv.1 (Rp 5 Jt)</strong> di dekat titik{' '}
                    <span className="text-amber-300">🔥 Hotspot</span> yang jaraknya
                    tidak terlalu jauh (2–4 km), tarik trayek, lalu beli{' '}
                    <strong>1 Angkot (Rp 15 Jt)</strong>. Sisa Rp 5 Jt jadi modal kerja
                    BBM sampai setoran masuk!
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="font-extrabold text-indigo-300 mb-0.5">
                    2. Cuaca Hujan & Dilema Atap Halte
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Saat <strong>🌧️ Hujan Deras</strong>, jumlah penumpang naik{' '}
                    <strong>+35%</strong> karena tarif Ojol mahal. TAPI di{' '}
                    <strong>Halte Lv.1 (Plang Tanpa Atap)</strong> penumpang kehujanan &
                    kabur <strong>2x lebih cepat</strong>! Segera upgrade halte ramai ke{' '}
                    <strong>Lv.2 Halte Beratap (Rp 18 Jt)</strong>.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="font-extrabold text-purple-300 mb-0.5">
                    3. Titik Oper & Bonus JakLingko (+25%)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Jika halte dari 2 trayek berbeda berjarak <strong>&lt;250m</strong>,
                    otomatis muncul garis ungu <strong>Titik Oper</strong>. Penumpang
                    transit membayar lagi di trayek kedua dengan{' '}
                    <strong>Bonus Integrasi JakLingko +25%</strong>!
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="font-extrabold text-sky-300 mb-0.5">
                    4. Koridor BRT & Kebal Banjir/Macet
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Bus <strong>TransJakarta BRT (80 pax)</strong> wajib memiliki minimal{' '}
                    <strong>2 Halte Lv.3 JPO</strong> di trayeknya. Pasang{' '}
                    <strong>Separator Busway</strong> agar kebal macet Rush Hour dan
                    tahan genangan banjir!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
