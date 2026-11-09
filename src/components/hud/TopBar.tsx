import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Bike,
  Box,
  Building,
  Bus,
  CloudRain,
  Clock,
  Compass,
  Flame,
  Globe,
  Menu as MenuIcon,
  Moon,
  Pause,
  Play,
  Radar,
  RotateCcw,
  Sun,
  Sunset,
  Users,
  Waves,
  X,
} from 'lucide-react';
import {
  useGameStore,
  getTrafficPhase,
  getEffectiveTimePhase,
  computeReputationInfo,
  computeEstimatedMidnightDeduction,
} from '../../store/useGameStore';
import { CITY_PRESETS } from '../../config/jakartaPreset';
import type { GameSpeed, WeatherCondition } from '../../types/game';
import { Demand24hWidget } from './Demand24hWidget';

function formatRupiahCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    const valInJt = Math.abs(amount) / 1_000_000;
    const formatted = valInJt.toLocaleString('id-ID', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${amount < 0 ? '-' : ''}Rp ${formatted} jt`;
  }
  return `${amount < 0 ? '-' : ''}Rp ${Math.round(Math.abs(amount)).toLocaleString('id-ID')}`;
}

function formatRupiahFull(amount: number): string {
  return `${amount < 0 ? '-' : ''}Rp ${Math.round(Math.abs(amount)).toLocaleString('id-ID')}`;
}

function formatGameClock(gameMinutes: number): string {
  const totalMins = Math.floor(gameMinutes) % 1440;
  const hh = Math.floor(totalMins / 60);
  const mm = totalMins % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function getTimeOfDayLabel(gameMinutes: number): string {
  const hour = (gameMinutes / 60) % 24;
  if (hour >= 5 && hour < 11) return 'Pagi';
  if (hour >= 11 && hour < 15) return 'Siang';
  if (hour >= 15 && hour < 18.5) return 'Sore';
  return 'Malam';
}

export const TopBar: React.FC = () => {
  const [showLedgerPopover, setShowLedgerPopover] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const currentCityId = useGameStore((s) => s.currentCityId);
  const companyName = useGameStore((s) => s.companyName);
  const weather = useGameStore((s) => s.weather);
  const balanceRp = useGameStore((s) => s.balanceRp);
  const totalRevenueRp = useGameStore((s) => s.totalRevenueRp);
  const totalOpCostRp = useGameStore((s) => s.totalOpCostRp);
  const cashPopups = useGameStore((s) => s.cashPopups);
  const totalPassengersServed = useGameStore((s) => s.totalPassengersServed);
  const gameMinutes = useGameStore((s) => s.gameMinutes);
  const gameDay = useGameStore((s) => s.gameDay);
  const gameSpeed = useGameStore((s) => s.gameSpeed);
  const vehicles = useGameStore((s) => s.vehicles);
  const depots = useGameStore((s) => s.depots);
  const stops = useGameStore((s) => s.stops);
  const maintenanceTier = useGameStore((s) => s.maintenanceTier);
  const activeLoans = useGameStore((s) => s.activeLoans);
  const cameraMode = useGameStore((s) => s.cameraMode);
  const mapThemeMode = useGameStore((s) => s.mapThemeMode);
  const show3DBuildings = useGameStore((s) => s.show3DBuildings);
  const showCatchmentRadius = useGameStore((s) => s.showCatchmentRadius);

  const setGameSpeed = useGameStore((s) => s.setGameSpeed);
  const skipNight = useGameStore((s) => s.skipNight);
  const cycleWeather = useGameStore((s) => s.cycleWeather);
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const toggleCameraMode = useGameStore((s) => s.toggleCameraMode);
  const cycleMapThemeMode = useGameStore((s) => s.cycleMapThemeMode);
  const toggle3DBuildings = useGameStore((s) => s.toggle3DBuildings);
  const toggleCatchmentRadius = useGameStore((s) => s.toggleCatchmentRadius);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 300);
    return () => window.clearInterval(id);
  }, []);

  const activeFloatingPopups = cashPopups
    .filter((p) => nowMs - p.createdAt < 3400)
    .slice(-4);

  const repInfo = computeReputationInfo(totalPassengersServed, stops);
  const cityPreset = CITY_PRESETS[currentCityId];
  const phase = getTrafficPhase(gameMinutes);
  const effectiveTimePhase = getEffectiveTimePhase(gameMinutes, mapThemeMode);
  const speeds: GameSpeed[] = [0, 1, 2, 5];

  const estimatedMidnightDeduction = computeEstimatedMidnightDeduction({
    vehicles,
    depots,
    maintenanceTier,
    activeLoans,
  });

  const curHour = (gameMinutes / 60) % 24;
  const isNightOrLate = curHour >= 21 || curHour < 5;

  return (
    <>
      <header className="pointer-events-none fixed top-0 left-0 right-0 z-30 px-3 py-2">
        <div className="pointer-events-auto w-full flex items-center justify-between gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-2xl shadow-2xl overflow-x-auto">
          {/* 1. Left: PO Brand & Financial Mini Card */}
          <div className="flex items-center gap-3 shrink-0">
            {/* PO Brand Badge */}
            <button
              onClick={() => setActiveModal('company')}
              className="flex items-center gap-2.5 hover:bg-slate-800/70 px-2 py-1 rounded-xl transition text-left"
              title="Klik untuk membuka Profil PO & Buku Juragan"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Bus className="w-4 h-4 text-white" />
              </div>
              <div className="leading-tight">
                <div className="font-extrabold text-xs text-white tracking-tight truncate max-w-[130px]">
                  {companyName}
                </div>
                <div className="text-[10px] font-semibold text-slate-400">
                  Lv.{repInfo.level} {repInfo.title}
                </div>
              </div>
            </button>

            {/* Financial Mini Card (Kas & Tagihan 00:00) */}
            <button
              onClick={() => setShowLedgerPopover((prev) => !prev)}
              className="border-l border-slate-800 pl-3 pr-2 py-1 flex flex-col items-start hover:bg-slate-800/60 rounded-xl transition text-left"
              title="Klik untuk rincian arus kas"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                  KAS
                </span>
                <span className="font-mono font-extrabold text-xs sm:text-sm text-emerald-400">
                  {formatRupiahCompact(balanceRp)}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                <span>Tagihan tutup buku 00:00</span>
                <span
                  className={`font-mono font-bold ${
                    estimatedMidnightDeduction > 0 ? 'text-amber-300' : 'text-slate-400'
                  }`}
                >
                  {estimatedMidnightDeduction > 0
                    ? `-${formatRupiahCompact(estimatedMidnightDeduction)}`
                    : 'Rp 0'}
                </span>
              </div>
            </button>
          </div>

          {/* 2. Center: Clock & Speed Controls (with Skip Night button) */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Clock & Day Indicator */}
            <div className="text-center px-1">
              <div className="font-mono font-extrabold text-base text-white leading-none tracking-tight">
                {formatGameClock(gameMinutes)}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                Hari {gameDay} • {getTimeOfDayLabel(gameMinutes)}
              </div>
            </div>

            {/* Speed Pills + Lewati Malam */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              {speeds.map((sp) => {
                const active = gameSpeed === sp;
                return (
                  <button
                    key={sp}
                    onClick={() => setGameSpeed(sp)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition ${
                      active
                        ? sp === 0
                          ? 'bg-rose-600 text-white shadow'
                          : 'bg-cyan-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {sp === 0 ? 'Pause' : `${sp}x`}
                  </button>
                );
              })}

              {/* Lewati Malam Button */}
              <button
                onClick={skipNight}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                  isNightOrLate
                    ? 'bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 border-indigo-400/50 shadow animate-pulse'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Melompati jam malam (21:00 - 05:00) langsung ke Subuh 05:30 WIB"
              >
                <span>Lewati malam</span>
              </button>
            </div>
          </div>

          {/* 3. Right: Rush Hour Status Pill, Pax Counter & Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Dynamic Status / Rush Hour Pill */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold ${
                phase.isRushHour
                  ? 'bg-amber-950/50 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300'
              }`}
            >
              <Flame
                className={`w-3.5 h-3.5 ${
                  phase.isRushHour ? 'text-amber-400 animate-pulse' : 'text-slate-400'
                }`}
              />
              <span className="font-bold">{phase.label}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {phase.isRushHour ? 'Demand ×1,3 • Macet ×1,3' : 'Demand Normal'}
              </span>
            </div>

            {/* Terangkut Counter */}
            <div className="hidden lg:flex items-center gap-1 text-xs font-semibold text-slate-300 px-1 font-mono">
              <span className="text-slate-400">Terangkut:</span>
              <span className="text-white font-bold">{totalPassengersServed} pax</span>
            </div>

            {/* Menu Hamburger Button */}
            <button
              onClick={() => setShowMenuDropdown((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition ${
                showMenuDropdown
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                  : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
              }`}
            >
              <MenuIcon className="w-3.5 h-3.5" />
              <span>Menu</span>
            </button>
          </div>
        </div>

        {/* CLICKABLE MENU & SETTINGS DROPDOWN (Outside overflow container) */}
        {showMenuDropdown && (
          <>
            {/* Click outside backdrop to close */}
            <div
              className="pointer-events-auto fixed inset-0 z-40 bg-black/40"
              onClick={() => setShowMenuDropdown(false)}
            />
            <div className="pointer-events-auto fixed top-[56px] right-3 z-50 w-72 p-3.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-1">
                <span className="font-extrabold text-white text-sm">⚙️ Menu & Pengaturan</span>
                <button
                  onClick={() => setShowMenuDropdown(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Weather Cycle */}
              <button
                onClick={() => cycleWeather()}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-left text-slate-200 transition"
              >
                <span className="flex items-center gap-2">
                  {weather === 'banjir' ? (
                    <Waves className="w-4 h-4 text-sky-400" />
                  ) : weather === 'hujan' ? (
                    <CloudRain className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Cuaca:</span>
                </span>
                <span className="font-bold capitalize text-amber-300">
                  {weather === 'banjir'
                    ? '🌊 Banjir'
                    : weather === 'hujan'
                    ? '🌧️ Hujan'
                    : '☀️ Cerah'}
                </span>
              </button>

              {/* Camera 3D / 2D */}
              <button
                onClick={() => toggleCameraMode()}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-left text-slate-200 transition"
              >
                <span className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span>Kamera:</span>
                </span>
                <span className="font-bold text-cyan-300 uppercase">
                  {cameraMode === '3d' ? '3D Miring' : '2D Top-Down'}
                </span>
              </button>

              {/* Toggle 3D Buildings */}
              <button
                onClick={toggle3DBuildings}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-left text-slate-200 transition"
              >
                <span className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-400" />
                  <span>Gedung 3D:</span>
                </span>
                <span
                  className={`font-bold ${
                    show3DBuildings ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {show3DBuildings ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Toggle Catchment Radius */}
              <button
                onClick={toggleCatchmentRadius}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-left text-slate-200 transition"
              >
                <span className="flex items-center gap-2">
                  <Radar className="w-4 h-4 text-sky-400" />
                  <span>Radius Halte:</span>
                </span>
                <span
                  className={`font-bold ${
                    showCatchmentRadius ? 'text-sky-300' : 'text-slate-500'
                  }`}
                >
                  {showCatchmentRadius ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Cycle Theme Mode */}
              <button
                onClick={cycleMapThemeMode}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-left text-slate-200 transition"
              >
                <span className="flex items-center gap-2">
                  {effectiveTimePhase === 'night' ? (
                    <Moon className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Tema Peta:</span>
                </span>
                <span className="font-bold text-amber-300 capitalize">
                  {mapThemeMode}
                </span>
              </button>

              {/* Open PO / City Management Modal */}
              <button
                onClick={() => {
                  setShowMenuDropdown(false);
                  setActiveModal('company');
                }}
                className="w-full mt-2 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-extrabold flex items-center justify-center gap-1.5 shadow"
              >
                <Globe className="w-4 h-4" />
                <span>Ganti Kota & Buku PO</span>
              </button>
            </div>
          </>
        )}

        {/* FLOATING CASH FLOW POPUPS (+Rp Setoran / -Rp BBM) */}
        {activeFloatingPopups.length > 0 && (
          <div className="pointer-events-none fixed top-[64px] left-[180px] z-40 flex flex-col gap-1">
            {activeFloatingPopups.map((p) => {
              const isPositive = p.amountRp >= 0;
              return (
                <div
                  key={p.id}
                  className={`px-2.5 py-1 rounded-xl border shadow-xl flex items-center gap-1.5 text-xs font-mono font-extrabold animate-bounce ${
                    isPositive
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : 'bg-rose-950 border-rose-500 text-rose-300'
                  }`}
                >
                  {isPositive ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span>{p.label}</span>
                  <span className="font-sans font-semibold text-[10px] text-slate-200 opacity-90">
                    • {p.categoryLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* CLICKABLE CASHFLOW LEDGER POPOVER */}
        {showLedgerPopover && (
          <div className="pointer-events-auto fixed top-[64px] left-36 z-50 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-extrabold text-white">📊 Rincian Arus Kas PO</span>
              <button
                onClick={() => setShowLedgerPopover(false)}
                className="text-slate-400 hover:text-white text-[11px] font-bold"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                <div className="text-[10px] text-emerald-300/80">Total Pemasukan (+)</div>
                <div className="font-mono font-bold text-emerald-400">
                  +{formatRupiahFull(totalRevenueRp)}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/30">
                <div className="text-[10px] text-rose-300/80">Total Pengeluaran (-)</div>
                <div className="font-mono font-bold text-rose-400">
                  -{formatRupiahFull(totalOpCostRp)}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowLedgerPopover(false);
                setActiveModal('bank');
              }}
              className="w-full py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition shadow"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Buka Laporan Keuangan & Pinjaman Bank</span>
            </button>
          </div>
        )}
      </header>

      {/* TOP-CENTER FLOATING WIDGET: DEMAND 24 JAM */}
      <div className="pointer-events-none fixed top-[60px] left-1/2 -translate-x-1/2 z-20">
        <Demand24hWidget />
      </div>
    </>
  );
};
