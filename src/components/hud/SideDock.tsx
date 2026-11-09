import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  CornerDownLeft,
  Home,
  Loader2,
  MapPin,
  Minus,
  ParkingSquare,
  Plus,
  Route as RouteIcon,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  computeMaxFleetSlots,
  computeVehicleProfit,
  useGameStore,
} from '../../store/useGameStore';
import { detectTransferLinks } from '../../services/spatialUtils';
import {
  CUSTOM_STOP_BUILD_COST,
  DEDICATED_LANE_COST_PER_KM,
  FLEET_SPECS,
} from '../../config/fleetSpecs';
import type { ZoneCategory } from '../../types/game';

function formatRpShort(val: number): string {
  if (Math.abs(val) >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)} Jt`;
  }
  return `Rp ${val.toLocaleString('id-ID')}`;
}

export const SideDock: React.FC = () => {
  const [customRouteName, setCustomRouteName] = useState('');
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  const isLeftPanelOpen = useGameStore((s) => s.isLeftPanelOpen);
  const stops = useGameStore((s) => s.stops);
  const routes = useGameStore((s) => s.routes);
  const vehicles = useGameStore((s) => s.vehicles);
  const depots = useGameStore((s) => s.depots);

  const selectedRouteId = useGameStore((s) => s.selectedRouteId);
  const interactionMode = useGameStore((s) => s.interactionMode);
  const pendingStopCategory = useGameStore((s) => s.pendingStopCategory);
  const draftRouteStopIds = useGameStore((s) => s.draftRouteStopIds);
  const draftRouteAnalysis = useGameStore((s) => s.draftRouteAnalysis);
  const ghostPreview = useGameStore((s) => s.ghostPreview);
  const isBuildingRoute = useGameStore((s) => s.isBuildingRoute);

  const toggleLeftPanel = useGameStore((s) => s.toggleLeftPanel);
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const setInteractionMode = useGameStore((s) => s.setInteractionMode);
  const setPendingStopCategory = useGameStore((s) => s.setPendingStopCategory);
  const selectRoute = useGameStore((s) => s.selectRoute);
  const selectStop = useGameStore((s) => s.selectStop);
  const clearDraftRoute = useGameStore((s) => s.clearDraftRoute);
  const reverseDraftRoute = useGameStore((s) => s.reverseDraftRoute);
  const removeLastDraftStop = useGameStore((s) => s.removeLastDraftStop);
  const finalizeDraftRoute = useGameStore((s) => s.finalizeDraftRoute);
  const deleteRoute = useGameStore((s) => s.deleteRoute);
  const setRouteCustomFare = useGameStore((s) => s.setRouteCustomFare);
  const assignVehicleToRoute = useGameStore((s) => s.assignVehicleToRoute);
  const serviceVehicle = useGameStore((s) => s.serviceVehicle);
  const toggleRouteNgetem = useGameStore((s) => s.toggleRouteNgetem);
  const upgradeRouteDedicatedLane = useGameStore((s) => s.upgradeRouteDedicatedLane);

  const selectedRoute =
    routes.find((r) => r.id === selectedRouteId) || routes[0] || null;
  const routeVehicles = selectedRoute
    ? vehicles.filter((v) => v.routeId === selectedRoute.id)
    : [];
  const idlePoolVehicles = vehicles.filter((v) => v.status === 'IDLE_IN_POOL');
  const { transferStopIds } = detectTransferLinks(routes, stops);

  const selectedRouteLv3Count = selectedRoute
    ? selectedRoute.stopIds.filter((sid) => {
        const st = stops.find((s) => s.id === sid);
        return st && st.level === 3;
      }).length
    : 0;

  const handleSaveRoute = async () => {
    await finalizeDraftRoute(customRouteName.trim() || undefined);
    setCustomRouteName('');
  };

  // Onboarding Checklist States
  const hasTwoStops = stops.length >= 2;
  const hasRoute = routes.length >= 1;
  const hasVehicle = vehicles.length >= 1;
  const isStarterComplete = hasTwoStops && hasRoute && hasVehicle;

  // KPI calculations for selected route
  const unservedPax = selectedRoute
    ? selectedRoute.stopIds.reduce((acc, sid) => {
        const st = stops.find((s) => s.id === sid);
        return acc + (st ? st.totalWaiting : 0);
      }, 0)
    : 0;

  const totalPaxOnRoute = routeVehicles.reduce((acc, v) => acc + v.passengers, 0);
  const totalCapOnRoute = routeVehicles.reduce((acc, v) => acc + v.capacity, 0);
  const loadAvgLabel =
    routeVehicles.length > 0 && totalCapOnRoute > 0
      ? `${Math.round((totalPaxOnRoute / totalCapOnRoute) * 100)}%`
      : '-';

  const netRouteRp =
    (selectedRoute?.totalRevenueRp || 0) - (selectedRoute?.totalOpCostRp || 0);
  const netRouteLabel =
    selectedRoute && (selectedRoute.totalRevenueRp > 0 || selectedRoute.totalOpCostRp > 0)
      ? `${netRouteRp >= 0 ? '+' : ''}${formatRpShort(netRouteRp)}`
      : '-';

  const roiLabel =
    selectedRoute && selectedRoute.totalRevenueRp > 500_000
      ? `~${Math.max(1, Math.round(12_000_000 / Math.max(100_000, selectedRoute.totalRevenueRp)))} rit`
      : '-';

  const handleBuyOrAssignFleet = () => {
    if (idlePoolVehicles.length > 0 && selectedRoute) {
      assignVehicleToRoute(idlePoolVehicles[0].id, selectedRoute.id);
    } else {
      setActiveModal('dealer');
    }
  };

  // Collapsed State: Sleek floating expand pill on the top-left
  if (!isLeftPanelOpen) {
    return (
      <div className="pointer-events-none fixed top-[68px] left-3 z-20">
        <button
          onClick={toggleLeftPanel}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 shadow-2xl text-xs font-extrabold text-cyan-300 transition"
          title="Buka Panel Operasional Trayek"
        >
          <RouteIcon className="w-4 h-4 text-cyan-400" />
          <span>Panel Trayek ({routes.length})</span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <aside className="pointer-events-none fixed top-[68px] left-3 bottom-[76px] z-20 w-[350px] max-w-[92vw] flex flex-col gap-2.5 overflow-y-auto pr-1">
      {/* 1. BUILDER ACTIONS & ONBOARDING (Checklist auto-hidden when all 3 steps completed!) */}
      <div className="pointer-events-auto bg-slate-900 border border-slate-700 rounded-2xl p-2.5 shadow-2xl space-y-2">
        {!isStarterComplete ? (
          <>
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-white tracking-tight">
                Mulai rintis, 3 langkah
              </span>
              <button
                onClick={toggleLeftPanel}
                className="text-slate-400 hover:text-white p-0.5 rounded-lg hover:bg-slate-800 transition"
                title="Sembunyikan Panel"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-xs font-semibold">
              {/* Step 1 */}
              <div
                className={`flex items-center justify-between p-1.5 rounded-xl border ${
                  hasTwoStops
                    ? 'bg-slate-950/60 border-slate-800 text-emerald-400'
                    : 'bg-slate-950/90 border-cyan-500/40 text-cyan-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{hasTwoStops ? '✓' : '●'}</span>
                  <span>1. Pasang 2 halte</span>
                </div>
                {!hasTwoStops && (
                  <button
                    onClick={() => setInteractionMode('place_stop')}
                    className="px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-extrabold shadow"
                  >
                    + Halte
                  </button>
                )}
              </div>

              {/* Step 2 */}
              <div
                className={`flex items-center justify-between p-1.5 rounded-xl border ${
                  hasRoute
                    ? 'bg-slate-950/60 border-slate-800 text-emerald-400'
                    : hasTwoStops
                    ? 'bg-slate-950/90 border-cyan-500/40 text-cyan-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{hasRoute ? '✓' : '●'}</span>
                  <span>2. Tarik trayek</span>
                </div>
                {!hasRoute && hasTwoStops && (
                  <button
                    onClick={() => setInteractionMode('draw_route')}
                    className="px-2 py-0.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[10px] font-extrabold shadow"
                  >
                    + Trayek
                  </button>
                )}
              </div>

              {/* Step 3 */}
              <div
                className={`flex items-center justify-between p-1.5 rounded-xl border ${
                  hasVehicle
                    ? 'bg-slate-950/60 border-slate-800 text-emerald-400'
                    : hasTwoStops && hasRoute
                    ? 'bg-amber-950/50 border-amber-500/60 text-amber-300 font-extrabold shadow'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{hasVehicle ? '✓' : '●'}</span>
                  <span>3. Beli angkot pertama (Rp 12 jt)</span>
                </div>
                {!hasVehicle && hasRoute && (
                  <button
                    onClick={() => setActiveModal('dealer')}
                    className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-extrabold shadow animate-pulse"
                  >
                    Dealer
                  </button>
                )}
              </div>
            </div>
          </>
        ) : null}

        {/* Builder Quick Access Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() =>
              setInteractionMode(
                interactionMode === 'place_stop' ? 'view' : 'place_stop'
              )
            }
            className={`flex-1 py-1.5 px-2.5 rounded-xl border text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
              interactionMode === 'place_stop'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>{interactionMode === 'place_stop' ? 'Batal' : '+ Halte Baru'}</span>
          </button>

          <button
            onClick={() =>
              setInteractionMode(
                interactionMode === 'draw_route' ? 'view' : 'draw_route'
              )
            }
            className={`flex-1 py-1.5 px-2.5 rounded-xl border text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
              interactionMode === 'draw_route'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <RouteIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>{interactionMode === 'draw_route' ? 'Batal' : '+ Tarik Trayek'}</span>
          </button>

          {isStarterComplete && (
            <button
              onClick={toggleLeftPanel}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 border border-slate-800 transition"
              title="Sembunyikan Panel"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sub-panel when placing a new custom stop */}
        {interactionMode === 'place_stop' && (
          <div className="mt-2 pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold">Tipe Zona (Lv.1 Plang):</span>
              <span className="font-mono text-amber-400 font-bold">
                {formatRpShort(CUSTOM_STOP_BUILD_COST)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'perumahan', label: 'Perumahan', icon: Home },
                  { id: 'kantor', label: 'Kantor', icon: Building2 },
                  { id: 'pasar', label: 'Pasar/Hub', icon: ShoppingBag },
                ] as {
                  id: ZoneCategory;
                  label: string;
                  icon: React.FC<{ className?: string }>;
                }[]
              ).map((z) => {
                const Icon = z.icon;
                const active = pendingStopCategory === z.id;
                return (
                  <button
                    key={z.id}
                    onClick={() => setPendingStopCategory(z.id)}
                    className={`py-1 px-1.5 rounded-xl border text-[10px] font-semibold flex flex-col items-center gap-0.5 transition ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{z.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              💡 Klik di peta dekat hotspot/perempatan jalan untuk pasang.
            </p>
          </div>
        )}

        {/* Sub-panel when drawing a new route */}
        {interactionMode === 'draw_route' && (
          <div className="mt-2 pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
              <span>Urutan Rute ({draftRouteStopIds.length} Halte)</span>
              <div className="flex items-center gap-1.5">
                {draftRouteStopIds.length >= 2 && (
                  <button
                    onClick={reverseDraftRoute}
                    className="text-[10px] text-cyan-300 hover:text-white flex items-center gap-0.5"
                    title="Putar Balik Urutan Halte"
                  >
                    <ArrowUpDown className="w-3 h-3" /> Balik
                  </button>
                )}
                <button
                  onClick={clearDraftRoute}
                  className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-0.5"
                >
                  <X className="w-3 h-3" /> Reset
                </button>
              </div>
            </div>

            {/* Live Detour Warnings / Ghost Preview */}
            {ghostPreview && (
              <div
                className={`p-1.5 rounded-xl border text-[10px] ${
                  ghostPreview.isDetour
                    ? 'bg-amber-950/80 border-amber-500/60 text-amber-200'
                    : 'bg-cyan-950/80 border-cyan-500/60 text-cyan-200'
                }`}
              >
                <div className="font-semibold text-white truncate">
                  {ghostPreview.fromStopName} ➔ {ghostPreview.toStopName}
                </div>
                <div className="flex justify-between font-mono text-slate-300 mt-0.5">
                  <span>Jalan: {ghostPreview.roadKm} km</span>
                  <span>~{ghostPreview.estMinutes} mnt</span>
                </div>
              </div>
            )}

            <input
              type="text"
              value={customRouteName}
              onChange={(e) => setCustomRouteName(e.target.value)}
              placeholder="Nama trayek (opsional)"
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />

            <button
              disabled={draftRouteStopIds.length < 2 || isBuildingRoute}
              onClick={handleSaveRoute}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow"
            >
              {isBuildingRoute ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menghitung Jalan...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Resmikan Trayek ({draftRouteStopIds.length} Halte)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 2. CARD INSPECTOR TRAYEK AKTIF (Focused Route Inspector Card) */}
      {selectedRoute ? (
        <div className="pointer-events-auto bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl space-y-2.5">
          {/* Route Tabs Selector (if multiple routes) */}
          {routes.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {routes.map((r) => {
                const isSel = selectedRoute.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => selectRoute(r.id)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                      isSel
                        ? 'bg-slate-800 border border-white/60 text-white shadow'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: r.color }}
                    />
                    <span>{r.code}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Header Trayek */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-1.5">
                <span
                  className="px-1.5 py-0.2 rounded text-[10px] text-slate-950 font-mono font-black"
                  style={{ backgroundColor: selectedRoute.color }}
                >
                  {selectedRoute.code}
                </span>
                <span className="truncate max-w-[210px]">{selectedRoute.name}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {selectedRoute.totalLengthKm.toFixed(2)} km • {selectedRoute.stopIds.length} halte • {routeVehicles.length} armada
              </div>
            </div>

            <button
              onClick={() => deleteRoute(selectedRoute.id)}
              className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition"
              title="Tutup Trayek"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 2x2 KPI Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Box 1: Load Rata-rata */}
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold">Load rata-rata</div>
              <div className="font-mono font-extrabold text-sm text-white mt-0.5">
                {loadAvgLabel}
              </div>
            </div>

            {/* Box 2: Net per hari */}
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold">Net per hari</div>
              <div
                className={`font-mono font-extrabold text-sm mt-0.5 ${
                  netRouteRp >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {netRouteLabel}
              </div>
            </div>

            {/* Box 3: Balik modal */}
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold">Balik modal</div>
              <div className="font-mono font-extrabold text-sm text-white mt-0.5">
                {roiLabel}
              </div>
            </div>

            {/* Box 4: Belum terlayani */}
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold">Belum terlayani</div>
              <div
                className={`font-mono font-extrabold text-sm mt-0.5 ${
                  unservedPax > 0 ? 'text-rose-400' : 'text-slate-300'
                }`}
              >
                {unservedPax > 0 ? `${unservedPax} pax` : '0 pax'}
              </div>
            </div>
          </div>

          {/* Tarif Tiket */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Tarif tiket</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    setRouteCustomFare(
                      selectedRoute.id,
                      selectedRoute.customFareRp - 500
                    )
                  }
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-mono font-extrabold text-xs text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                  Rp {selectedRoute.customFareRp.toLocaleString('id-ID')}
                </span>
                <button
                  onClick={() =>
                    setRouteCustomFare(
                      selectedRoute.id,
                      selectedRoute.customFareRp + 500
                    )
                  }
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="text-[10px] text-slate-400">
              {selectedRoute.customFareRp <= 3_500 ? (
                <span className="text-emerald-300">🔥 Demand +25% • Tarif rakyat murah</span>
              ) : selectedRoute.customFareRp <= 5_500 ? (
                <span className="text-sky-300">Demand ±0% • Tarif wajar (seimbang)</span>
              ) : (
                <span className="text-rose-400">⚠️ Rawan kabur ke ojol (terlalu mahal)</span>
              )}
            </div>
          </div>

          {/* Mode Ngetem Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <div>
              <div className="text-xs font-bold text-slate-200">Mode Ngetem</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Tunggu ≥70% penuh sebelum berangkat
              </div>
            </div>
            <button
              onClick={() => toggleRouteNgetem(selectedRoute.id)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                selectedRoute.ngetemEnabled ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  selectedRoute.ngetemEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Big CTA Button: Beli Armada Untuk Trayek Ini */}
          <button
            onClick={handleBuyOrAssignFleet}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg transition flex items-center justify-center gap-2"
          >
            {idlePoolVehicles.length > 0 ? (
              <>
                <Zap className="w-4 h-4 text-slate-950" />
                <span>+ Terjunkan Armada Pool ({idlePoolVehicles.length} Standby)</span>
              </>
            ) : (
              <>
                <Store className="w-4 h-4 text-slate-950" />
                <span>Beli armada untuk trayek ini</span>
              </>
            )}
          </button>

          {/* Extra Details Accordion Toggle (Stops sequence, Servicing, Busway) */}
          <div className="pt-1">
            <button
              onClick={() => setShowAdvancedDetails((prev) => !prev)}
              className="w-full py-1 text-[11px] text-slate-400 hover:text-white flex items-center justify-center gap-1 transition"
            >
              <span>{showAdvancedDetails ? 'Tutup Detail Tambahan' : 'Lihat Halte & Armada Aktif'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  showAdvancedDetails ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showAdvancedDetails && (
              <div className="mt-2 space-y-2 border-t border-slate-800 pt-2 text-xs">
                {/* Halte Urutan */}
                <div>
                  <div className="text-[10px] text-slate-400 mb-1">
                    Urutan Halte ({selectedRoute.stopIds.length}):
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                    {selectedRoute.stopIds.map((sid, idx) => {
                      const st = stops.find((s) => s.id === sid);
                      const isXfer = transferStopIds.has(sid);
                      return (
                        <React.Fragment key={sid}>
                          <button
                            onClick={() => selectStop(sid)}
                            className={`shrink-0 px-2 py-1 rounded-lg border flex items-center gap-1 transition hover:border-cyan-400 ${
                              st?.level === 3
                                ? 'bg-sky-950/70 border-sky-400/60 text-sky-200'
                                : isXfer
                                ? 'bg-purple-950/60 border-purple-500/50 text-purple-200'
                                : 'bg-slate-950 border-slate-800 text-slate-200'
                            }`}
                          >
                            <span className="text-[9px] font-mono px-1 rounded bg-slate-900 text-amber-300">
                              Lv.{st?.level ?? 1}
                            </span>
                            <span className="font-medium">{st?.name || sid}</span>
                            <span className="text-[10px] text-cyan-400 font-mono">
                              ({st?.totalWaiting ?? 0})
                            </span>
                          </button>
                          {idx < selectedRoute.stopIds.length - 1 && (
                            <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Separator Jalur Busway */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="pr-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Jalur Busway BRT</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Kebal macet Rush Hour ({selectedRouteLv3Count}/2 Halte Lv.3 siap).
                    </p>
                  </div>
                  {selectedRoute.dedicatedLaneEnabled ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                      AKTIF
                    </span>
                  ) : (
                    <button
                      onClick={() => upgradeRouteDedicatedLane(selectedRoute.id)}
                      className="shrink-0 px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-extrabold transition shadow"
                    >
                      Upgrade ({formatRpShort(Math.round(selectedRoute.totalLengthKm * DEDICATED_LANE_COST_PER_KM))})
                    </button>
                  )}
                </div>

                {/* Active Vehicles List */}
                {routeVehicles.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-400 font-semibold">
                      Armada di Jalan ({routeVehicles.length}):
                    </div>
                    {routeVehicles.map((v) => {
                      const spec = FLEET_SPECS[v.type];
                      const condPct = Math.round(v.condition);
                      return (
                        <div
                          key={v.id}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-sm"
                              style={{ backgroundColor: spec.color }}
                            />
                            <span className="font-bold text-white">{v.plateNumber}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {v.passengers}/{v.capacity} pax
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {condPct < 75 && (
                              <button
                                onClick={() => serviceVehicle(v.id)}
                                className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[9px]"
                              >
                                Servis
                              </button>
                            )}
                            <button
                              onClick={() => assignVehicleToRoute(v.id, null)}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] hover:text-white"
                            >
                              Ke Pool
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="pointer-events-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl text-center space-y-2">
          <p className="text-xs text-slate-300">
            Belum ada trayek aktif. Ikuti langkah di atas untuk membuka trayek pertamamu!
          </p>
        </div>
      )}
    </aside>
  );
};
