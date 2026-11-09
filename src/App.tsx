import React from 'react';
import { MapCanvas } from './components/map/MapCanvas';
import { TopBar } from './components/hud/TopBar';
import { SideDock } from './components/hud/SideDock';
import { BottomCommandDock } from './components/hud/BottomCommandDock';
import { FleetManagerModal } from './components/hud/FleetManagerModal';
import { TycoonModals } from './components/hud/TycoonModals';
import { StopInspectorCard } from './components/hud/StopInspectorCard';
import { VehicleInspectorCard } from './components/hud/VehicleInspectorCard';
import { useGameLoop } from './hooks/useGameLoop';

export const App: React.FC = () => {
  // Run the live simulation & OSRM starter route initialization
  useGameLoop();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Full-Screen 3D/2D MapLibre GL Canvas */}
      <MapCanvas />

      {/* Top HUD Bar: Balance + Floating Cashflow Popups, Clock, Rush Hour, Speed & Ojol Counter */}
      <TopBar />

      {/* Collapsible Left Panel: Dedicated Strictly to Map Operations & Active Routes */}
      <SideDock />

      {/* Floating Bottom Command Dock (5 Tycoon Command Buttons) */}
      <BottomCommandDock />

      {/* Dedicated Modals: Fleet Manager, Dealer Showroom, Pool & KIR, Bank & PSO */}
      <FleetManagerModal />
      <TycoonModals />

      {/* Right Stop & Vehicle Inspector Cards & Toast Notifications */}
      <StopInspectorCard />
      <VehicleInspectorCard />
    </main>
  );
};

export default App;
