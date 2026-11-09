import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bus,
  CheckCircle2,
  DollarSign,
  Fuel,
  ParkingSquare,
  Play,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  computeMaxFleetSlots,
  computeVehicleProfit,
  useGameStore,
} from '../../store/useGameStore';
import { FLEET_SPECS, VEHICLE_OVERHAUL_COST_RP } from '../../config/fleetSpecs';
import type { Vehicle } from '../../types/game';

type FleetFilterTab =
  | 'all'
  | 'profitable'
  | 'unprofitable'
  | 'active'
  | 'idle'
  | 'service';

function formatRp(val: number): string {
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
}

function formatRpShort(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)} Jt`;
  }
  return val.toLocaleString('id-ID');
}

export const FleetManagerModal: React.FC = () => {
  const [filterTab, setFilterTab] = useState<FleetFilterTab>('all');

  const activeModal = useGameStore((s) => s.activeModal);
  const vehicles = useGameStore((s) => s.vehicles);
  const routes = useGameStore((s) => s.routes);
  const depots = useGameStore((s) => s.depots);
  const selectedRouteId = useGameStore((s) => s.selectedRouteId);

  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const assignVehicleToRoute = useGameStore((s) => s.assignVehicleToRoute);
  const serviceVehicle = useGameStore((s) => s.serviceVehicle);
  const serviceAllVehicles = useGameStore((s) => s.serviceAllVehicles);
  const sellVehicle = useGameStore((s) => s.sellVehicle);

  if (activeModal !== 'fleet') return null;

  const maxFleetSlots = computeMaxFleetSlots(depots);
  const activeCount = vehicles.filter((v) => v.status === 'ACTIVE').length;
  const idleCount = vehicles.filter((v) => v.status === 'IDLE_IN_POOL').length;
  const serviceCount = vehicles.filter(
    (v) => v.state === 'mogok' || v.condition < 80
  ).length;

  const fleetMetrics = vehicles.map(computeVehicleProfit);
  const totalFleetRevenue = fleetMetrics.reduce((sum, m) => sum + m.revenueRp, 0);
  const totalFleetFuel = fleetMetrics.reduce((sum, m) => sum + m.fuelCostRp, 0);
  const totalFleetMaint = fleetMetrics.reduce((sum, m) => sum + m.maintenanceCostRp, 0);
  const totalFleetOpex = totalFleetFuel + totalFleetMaint;
  const totalFleetNetProfit = totalFleetRevenue - totalFleetOpex;
  const totalFleetPax = fleetMetrics.reduce((sum, m) => sum + m.paxCarried, 0);
  const totalFleetDistance = fleetMetrics.reduce((sum, m) => sum + m.distanceKm, 0);
  const profitableCount = fleetMetrics.filter(
    (m) => m.netProfitRp >= 0 && (m.revenueRp > 0 || m.distanceKm > 0)
  ).length;
  const unprofitableCount = fleetMetrics.filter((m) => m.netProfitRp < 0).length;

  const filteredVehicles = vehicles
    .filter((v) => {
      const p = computeVehicleProfit(v);
      if (filterTab === 'profitable') return p.netProfitRp >= 0;
      if (filterTab === 'unprofitable') return p.netProfitRp < 0;
      if (filterTab === 'active') return v.status === 'ACTIVE';
      if (filterTab === 'idle') return v.status === 'IDLE_IN_POOL';
      if (filterTab === 'service') return v.state === 'mogok' || v.condition < 80;
      return true;
    })
    .sort((a, b) => {
      const pa = computeVehicleProfit(a);
      const pb = computeVehicleProfit(b);
      if (filterTab === 'profitable') {
        return pb.netProfitRp - pa.netProfitRp;
      }
      if (filterTab === 'unprofitable') {
        return pa.netProfitRp - pb.netProfitRp; // Most negative first
      }
      return 0;
    });

  const defaultTargetRoute =
    routes.find((r) => r.id === selectedRouteId) || routes[0] || null;

  return (
    <div
      onClick={() => setActiveModal('none')}
      className="pointer-events-auto fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-2 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[96vw] max-w-7xl max-h-[94vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Laporan & Manajemen Kinerja Armada</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-emerald-300 border border-slate-700">
                  Slot Pool: {vehicles.length}/{maxFleetSlots} Unit
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Pantau neraca laba/rugi setiap unit (Setoran tiket vs Beban BBM & Servis overhaul).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {serviceCount > 0 && (
              <button
                onClick={serviceAllVehicles}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>
                  Servis Semua ({serviceCount} unit •{' '}
                  {formatRp(serviceCount * VEHICLE_OVERHAUL_COST_RP)})
                </span>
              </button>
            )}
            <button
              onClick={() => setActiveModal('dealer')}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Beli Armada Baru</span>
            </button>
            <button
              onClick={() => setActiveModal('none')}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Fleet Financial Summary Strip */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              <span>Total Setoran (Bruto)</span>
            </div>
            <div className="font-extrabold text-emerald-300 text-sm mt-0.5">
              +{formatRp(totalFleetRevenue)}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-rose-400 flex items-center gap-1">
              <Fuel className="w-3 h-3 text-rose-400" />
              <span>Total Beban BBM</span>
            </div>
            <div className="font-extrabold text-rose-300 text-sm mt-0.5">
              -{formatRp(totalFleetFuel)}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-amber-400 flex items-center gap-1">
              <Wrench className="w-3 h-3 text-amber-400" />
              <span>Beban Bengkel / Servis</span>
            </div>
            <div className="font-extrabold text-amber-300 text-sm mt-0.5">
              -{formatRp(totalFleetMaint)}
            </div>
          </div>

          <div
            className={`p-2.5 rounded-xl border ${
              totalFleetNetProfit >= 0
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
            }`}
          >
            <div className="text-[10px] flex items-center gap-1 font-bold">
              {totalFleetNetProfit >= 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-rose-400" />
              )}
              <span>Laba Bersih Armada</span>
            </div>
            <div className="font-extrabold text-sm mt-0.5">
              {totalFleetNetProfit >= 0 ? '+' : ''}
              {formatRp(totalFleetNetProfit)}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-sky-400 flex items-center gap-1">
              <Users className="w-3 h-3 text-sky-400" />
              <span>Operasional Armada</span>
            </div>
            <div className="font-extrabold text-sky-300 text-xs mt-0.5">
              {totalFleetPax.toLocaleString('id-ID')} pax • {totalFleetDistance.toFixed(1)} km
            </div>
          </div>
        </div>

        {/* 6 Filter Tabs */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filterTab === 'all'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            Semua Armada ({vehicles.length})
          </button>

          <button
            onClick={() => setFilterTab('profitable')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filterTab === 'profitable'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'bg-slate-900 text-emerald-400 hover:text-emerald-300 border border-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>🟢 Paling Untung ({profitableCount})</span>
          </button>

          <button
            onClick={() => setFilterTab('unprofitable')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filterTab === 'unprofitable'
                ? 'bg-rose-500 text-white shadow'
                : 'bg-slate-900 text-rose-400 hover:text-rose-300 border border-slate-800'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>🔴 Boncos / Rugi ({unprofitableCount})</span>
          </button>

          <button
            onClick={() => setFilterTab('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filterTab === 'active'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            🛣️ Sedang Narik ({activeCount})
          </button>

          <button
            onClick={() => setFilterTab('idle')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filterTab === 'idle'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            🅿️ Standby di Pool ({idleCount})
          </button>

          <button
            onClick={() => setFilterTab('service')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              filterTab === 'service'
                ? 'bg-rose-500 text-white shadow'
                : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Perlu Servis / Mogok ({serviceCount})</span>
          </button>
        </div>

        {/* Vehicle Cards / Table List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {filteredVehicles.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
              <p className="text-sm text-slate-400">
                Tidak ada armada pada kategori filter ini.
              </p>
              <button
                onClick={() => setActiveModal('dealer')}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-extrabold text-xs shadow"
              >
                🏪 Buka Dealer Armada
              </button>
            </div>
          ) : (
            filteredVehicles.map((v) => {
              const spec = FLEET_SPECS[v.type];
              const isIdle = v.status === 'IDLE_IN_POOL' || !v.routeId;
              const currentRoute = routes.find((r) => r.id === v.routeId);
              const fillPct = Math.round((v.passengers / v.capacity) * 100);
              const condPct = Math.round(v.condition);
              const refundRp = Math.floor(spec.purchasePrice * 0.6);
              const profit = computeVehicleProfit(v);

              return (
                <div
                  key={v.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition flex flex-col gap-3.5 bg-slate-950 shadow-lg ${
                    v.state === 'mogok'
                      ? 'border-rose-500/80 ring-1 ring-rose-500/30'
                      : !profit.isProfitable && !isIdle
                      ? 'border-rose-900/80 hover:border-rose-700'
                      : isIdle
                      ? 'border-amber-500/50 hover:border-amber-400'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Row 1: Vehicle Identity & Profitability Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-md shrink-0 shadow-sm"
                        style={{ backgroundColor: spec.color }}
                      />
                      <span className="font-mono font-black text-sm text-amber-300 px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-700">
                        {v.plateNumber}
                      </span>
                      <span className="font-extrabold text-sm text-white">
                        {spec.name}
                      </span>
                      <span className="text-xs text-slate-400 hidden sm:inline">
                        ({spec.subtitle})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Profitability Status Tag */}
                      {profit.isProfitable ? (
                        <div className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          <span>UNTUNG +{formatRp(profit.netProfitRp)}</span>
                          <span className="text-[10px] opacity-80 font-mono">
                            ({profit.marginPct}% Margin)
                          </span>
                        </div>
                      ) : (
                        <div className="px-3 py-1 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                          <span>BONCOS -{formatRp(Math.abs(profit.netProfitRp))}</span>
                          <span className="text-[10px] opacity-80 font-mono">
                            ({profit.marginPct}% Margin)
                          </span>
                        </div>
                      )}

                      {/* Operational Status Tag */}
                      {v.state === 'mogok' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-extrabold text-xs animate-pulse">
                          💨 MOGOK DI JALAN!
                        </span>
                      ) : isIdle ? (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs">
                          🅿️ STANDBY POOL (Rp 0 BBM)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold text-xs">
                          🛣️ {currentRoute?.code || 'TRAYEK'} ({v.currentSpeedKmh} km/j)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Comprehensive Per-Armada P&L Financial Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                        <span>Setoran Tiket</span>
                      </div>
                      <div className="font-extrabold text-emerald-400 text-sm mt-0.5">
                        +{formatRp(profit.revenueRp)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Fuel className="w-3 h-3 text-rose-400" />
                        <span>Beban BBM</span>
                      </div>
                      <div className="font-extrabold text-rose-400 text-sm mt-0.5">
                        -{formatRp(profit.fuelCostRp)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-amber-400" />
                        <span>Servis Bengkel</span>
                      </div>
                      <div className="font-extrabold text-amber-300 text-sm mt-0.5">
                        -{formatRp(profit.maintenanceCostRp)}
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border ${
                        profit.isProfitable
                          ? 'bg-emerald-950/40 border-emerald-500/40'
                          : 'bg-rose-950/40 border-rose-500/40'
                      }`}
                    >
                      <div className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-cyan-400" />
                        <span>Laba Bersih Unit</span>
                      </div>
                      <div
                        className={`font-extrabold text-sm mt-0.5 ${
                          profit.isProfitable ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {profit.isProfitable ? '+' : ''}
                        {formatRp(profit.netProfitRp)}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Spacious Telemetry & Live Gauges */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
                    {/* Telemetry info chips */}
                    <div className="flex flex-wrap items-center gap-3 text-slate-300">
                      <span className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        <span><strong className="text-white">{profit.paxCarried}</strong> pax</span>
                      </span>
                      <span className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <span><strong className="text-white">{profit.distanceKm}</strong> km</span>
                      </span>
                      <span className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <span><strong className="text-white">{profit.trips}</strong> rit</span>
                      </span>
                      <span className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <span>BBM: <strong className="text-amber-300">Rp {profit.fuelCostPerKm}</strong>/km</span>
                      </span>
                    </div>

                    {/* Progress bars: Pax & Engine */}
                    <div className="flex items-center gap-4 w-full md:w-80 shrink-0">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-400">Muatan:</span>
                          <span className="text-slate-200 font-bold">
                            {v.passengers}/{v.capacity} ({fillPct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${fillPct}%`,
                              backgroundColor: spec.color,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-400">Mesin:</span>
                          <span
                            className={`font-bold ${
                              condPct < 35
                                ? 'text-rose-400'
                                : condPct < 65
                                ? 'text-amber-300'
                                : 'text-emerald-400'
                            }`}
                          >
                            {condPct}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              condPct < 35
                                ? 'bg-rose-500'
                                : condPct < 65
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                            style={{ width: `${condPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Route Assignment Selector & Management Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
                    {/* Route assignment dropdown */}
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <span className="text-xs font-semibold text-slate-400 shrink-0">Penugasan:</span>
                      <select
                        value={v.routeId || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          assignVehicleToRoute(v.id, val === '' ? null : val);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-cyan-400 shadow-sm"
                      >
                        <option value="">🅿️ Standby di Pool (Garasi)</option>
                        {routes.map((r) => (
                          <option key={r.id} value={r.id}>
                            🛣️ {r.code}: {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        disabled={condPct >= 99 && v.state !== 'mogok'}
                        onClick={() => serviceVehicle(v.id)}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition shadow"
                        title={`Servis Overhaul (${formatRp(VEHICLE_OVERHAUL_COST_RP)})`}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Servis Mesin</span>
                      </button>

                      {isIdle ? (
                        <button
                          disabled={!defaultTargetRoute}
                          onClick={() =>
                            defaultTargetRoute &&
                            assignVehicleToRoute(v.id, defaultTargetRoute.id)
                          }
                          className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition shadow"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>
                            Jalankan {defaultTargetRoute ? defaultTargetRoute.code : ''}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => assignVehicleToRoute(v.id, null)}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          <ParkingSquare className="w-3.5 h-3.5 text-amber-300" />
                          <span>Tarik ke Pool</span>
                        </button>
                      )}

                      <button
                        onClick={() => sellVehicle(v.id)}
                        className="px-3 py-2 rounded-xl bg-rose-950 hover:bg-rose-600 border border-rose-500/50 text-rose-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition"
                        title={`Jual Bekas (Refund 60%: +${formatRp(refundRp)})`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Jual</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
