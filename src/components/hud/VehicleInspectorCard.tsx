import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Bus,
  CheckCircle2,
  Clock,
  Fuel,
  TrendingUp,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { FLEET_SPECS, VEHICLE_OVERHAUL_COST_RP } from '../../config/fleetSpecs';

function formatRupiahCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const valInJt = amount / 1_000_000;
    const formatted = valInJt.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return `Rp ${formatted} jt`;
  }
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatRupiahFull(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

export const VehicleInspectorCard: React.FC = () => {
  const selectedVehicleId = useGameStore((s) => s.selectedVehicleId);
  const vehicles = useGameStore((s) => s.vehicles);
  const routes = useGameStore((s) => s.routes);
  const balanceRp = useGameStore((s) => s.balanceRp);
  const selectVehicle = useGameStore((s) => s.selectVehicle);
  const serviceVehicle = useGameStore((s) => s.serviceVehicle);
  const assignVehicleToRoute = useGameStore((s) => s.assignVehicleToRoute);

  const vehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;
  if (!vehicle) return null;

  const spec = FLEET_SPECS[vehicle.type];
  const assignedRoute = routes.find((r) => r.id === vehicle.routeId) || null;
  const serviceCostRp = VEHICLE_OVERHAUL_COST_RP;

  const fillRatio = Math.round((vehicle.passengers / vehicle.capacity) * 100);
  const isMogok = vehicle.state === 'mogok';
  const isNgetem = vehicle.state === 'ngetem';
  const isHailing = vehicle.state === 'hailing';
  const isBoarding = vehicle.state === 'boarding';

  return (
    <div className="pointer-events-none fixed bottom-16 right-4 z-30 flex flex-col items-end gap-2 select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="pointer-events-auto w-[340px] p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-3.5 text-xs">
        {/* Header: Vehicle Plate & Fleet Type */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0"
              style={{ backgroundColor: spec.color }}
            >
              <Bus className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-sm text-amber-300 tracking-wide bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {vehicle.plateNumber}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-slate-200">
                  {spec.name}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-semibold mt-1 truncate max-w-[200px]">
                {assignedRoute ? `${assignedRoute.code} • ${assignedRoute.name}` : 'Standby di Garasi'}
              </div>
            </div>
          </div>
          <button
            onClick={() => selectVehicle(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Operational State Badge */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400">Status Operasi:</span>
          <div className="flex items-center gap-1 font-bold">
            {isMogok ? (
              <span className="text-rose-400 flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>MOGOK (Bongkar Mesin)</span>
              </span>
            ) : isNgetem ? (
              <span className="text-amber-300 flex items-center gap-1 animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                <span>Mode Ngetem (Tunggu Penumpang)</span>
              </span>
            ) : isHailing ? (
              <span className="text-cyan-300 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>Angkut Pinggir Jalan</span>
              </span>
            ) : isBoarding ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>Naik / Turun di Halte</span>
              </span>
            ) : vehicle.status === 'IDLE_IN_POOL' ? (
              <span className="text-slate-400">💤 Standby di Pool</span>
            ) : (
              <span className="text-sky-300 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                <span>Bergerak Normal (~35 km/j)</span>
              </span>
            )}
          </div>
        </div>

        {/* Passenger Capacity Gauge */}
        <div className="space-y-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-slate-300 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>Muatan Penumpang</span>
            </span>
            <span className="font-mono font-bold text-white">
              {vehicle.passengers} / {vehicle.capacity} pax ({fillRatio}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                fillRatio >= 100
                  ? 'bg-rose-500'
                  : fillRatio >= 70
                  ? 'bg-amber-400'
                  : 'bg-cyan-500'
              }`}
              style={{ width: `${Math.min(100, fillRatio)}%` }}
            />
          </div>
        </div>

        {/* Engine Condition Gauge */}
        <div className="space-y-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-slate-300 flex items-center gap-1">
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>Kondisi Mesin Armada</span>
            </span>
            <span
              className={`font-mono font-bold ${
                vehicle.condition > 70
                  ? 'text-emerald-400'
                  : vehicle.condition > 40
                  ? 'text-amber-300'
                  : 'text-rose-400'
              }`}
            >
              {Math.round(vehicle.condition)}% • {vehicle.condition > 70 ? 'Prima' : vehicle.condition > 40 ? 'Wajar' : 'Kritis!'}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                vehicle.condition > 70
                  ? 'bg-emerald-500'
                  : vehicle.condition > 40
                  ? 'bg-amber-400'
                  : 'bg-rose-500 animate-pulse'
              }`}
              style={{ width: `${Math.min(100, vehicle.condition)}%` }}
            />
          </div>
        </div>

        {/* Operational Stats (2x2 Matrix) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>Total Pemasukan:</span>
            </div>
            <div className="font-mono font-bold text-emerald-400 mt-0.5 text-xs">
              +{formatRupiahCompact(vehicle.totalRevenueGenerated)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <Fuel className="w-3 h-3 text-rose-400" />
              <span>BBM Terpakai:</span>
            </div>
            <div className="font-mono font-bold text-rose-400 mt-0.5 text-xs">
              -{formatRupiahCompact(vehicle.totalFuelCostRp)}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="pt-1 flex items-center gap-2">
          {/* Servis Armada Button */}
          <button
            disabled={vehicle.condition >= 98 || balanceRp < serviceCostRp}
            onClick={() => serviceVehicle(vehicle.id)}
            className="flex-1 py-2 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow transition"
            title={`Servis mesin & ganti oli (${formatRupiahFull(serviceCostRp)})`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Servis ({formatRupiahCompact(serviceCostRp)})</span>
          </button>

          {/* Tarik ke Pool / Garasi */}
          {vehicle.status === 'ACTIVE' ? (
            <button
              onClick={() => assignVehicleToRoute(vehicle.id, null)}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 border border-slate-700 transition"
              title="Tarik armada masuk garasi untuk istirahat & perbaikan"
            >
              <span>Ke Pool</span>
            </button>
          ) : (
            assignedRoute && (
              <button
                onClick={() => assignVehicleToRoute(vehicle.id, assignedRoute.id)}
                className="py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-[11px] flex items-center justify-center gap-1 shadow transition"
              >
                <span>Jalankan</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
