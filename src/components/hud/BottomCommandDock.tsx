import React from 'react';
import {
  Banknote,
  Bus,
  Globe,
  Home,
  MapPin,
  Store,
} from 'lucide-react';
import {
  evaluateDishubContracts,
  useGameStore,
} from '../../store/useGameStore';

export const BottomCommandDock: React.FC = () => {
  const isLeftPanelOpen = useGameStore((s) => s.isLeftPanelOpen);
  const activeModal = useGameStore((s) => s.activeModal);
  const routes = useGameStore((s) => s.routes);
  const stops = useGameStore((s) => s.stops);
  const vehicles = useGameStore((s) => s.vehicles);
  const senenTanahAbangPax = useGameStore((s) => s.senenTanahAbangPax);
  const totalPassengersServed = useGameStore((s) => s.totalPassengersServed);
  const totalTakenByOjol = useGameStore((s) => s.totalTakenByOjol);
  const claimedContractIds = useGameStore((s) => s.claimedContractIds);

  const toggleLeftPanel = useGameStore((s) => s.toggleLeftPanel);
  const setActiveModal = useGameStore((s) => s.setActiveModal);

  // Evaluate contracts & alerts for badges
  const contracts = evaluateDishubContracts({
    routes,
    stops,
    vehicles,
    senenTanahAbangPax,
    totalPassengersServed,
    totalTakenByOjol,
    claimedContractIds,
  });
  const claimableCount = contracts.filter((c) => c.completed && !c.claimed).length;

  const mogokOrLowCount = vehicles.filter(
    (v) => v.state === 'mogok' || v.condition < 35
  ).length;

  // Onboarding Step 3 highlight (If 2 stops & 1 route built, guide player to buy first Angkot)
  const isStep3GuideActive =
    stops.length >= 2 && routes.length >= 1 && vehicles.length === 0;

  return (
    <nav className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-[96vw]">
      <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-x-auto">
        {/* 1. Halte & Trayek (Toggles Left Panel) */}
        <button
          onClick={toggleLeftPanel}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            isLeftPanelOpen
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow'
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Buka / Tutup Panel Halte & Trayek"
        >
          <MapPin className="w-4 h-4 text-cyan-400" />
          <span>Halte</span>
        </button>

        {/* 2. Armada */}
        <button
          onClick={() => setActiveModal('fleet')}
          className={`relative px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeModal === 'fleet'
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow'
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Daftar Armada & Stok Pool"
        >
          <Bus className="w-4 h-4 text-emerald-400" />
          <span>Armada</span>
          {mogokOrLowCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold animate-bounce">
              {mogokOrLowCount}
            </span>
          )}
        </button>

        {/* 3. Dealer (Highlighted if Step 3 Tutorial is active!) */}
        <button
          onClick={() => setActiveModal('dealer')}
          className={`relative px-3.5 py-1.5 rounded-xl border text-xs font-extrabold transition flex items-center gap-1.5 shrink-0 ${
            isStep3GuideActive
              ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)] ring-2 ring-amber-400/50 animate-pulse'
              : activeModal === 'dealer'
              ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow'
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Dealer Bus & Angkot Baru/Bekas"
        >
          <Store className="w-4 h-4 text-amber-400" />
          <span>Dealer</span>
        </button>

        {/* 4. Garasi */}
        <button
          onClick={() => setActiveModal('pool')}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeModal === 'pool'
              ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow'
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Garasi Pool & Fasilitas Perawatan"
        >
          <Home className="w-4 h-4 text-sky-400" />
          <span>Garasi</span>
        </button>

        {/* 5. Keuangan */}
        <button
          onClick={() => setActiveModal('bank')}
          className={`relative px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeModal === 'bank'
              ? 'bg-purple-500/20 border-purple-400 text-purple-200 shadow'
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Laporan Keuangan, Pinjaman & Kontrak Dishub"
        >
          <Banknote className="w-4 h-4 text-purple-400" />
          <span>Keuangan</span>
          {claimableCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold animate-bounce">
              {claimableCount}
            </span>
          )}
        </button>

        {/* 6. Kota */}
        <button
          onClick={() => setActiveModal('company')}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeModal === 'company'
              ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200 shadow'
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Ganti Kota & Buku Pintar PO"
        >
          <Globe className="w-4 h-4 text-indigo-400" />
          <span>Kota</span>
        </button>
      </div>
    </nav>
  );
};
