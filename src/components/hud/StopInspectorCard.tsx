import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpCircle,
  Bike,
  Building2,
  CheckCircle2,
  MapPin,
  PlusCircle,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { detectTransferLinks } from '../../services/spatialUtils';
import { STOP_TIER_SPECS } from '../../config/fleetSpecs';
import type { StopTierLevel } from '../../types/game';

export const StopInspectorCard: React.FC = () => {
  const balanceRp = useGameStore((s) => s.balanceRp);
  const stops = useGameStore((s) => s.stops);
  const routes = useGameStore((s) => s.routes);
  const vehicles = useGameStore((s) => s.vehicles);
  const selectedStopId = useGameStore((s) => s.selectedStopId);
  const notifications = useGameStore((s) => s.notifications);
  const selectStop = useGameStore((s) => s.selectStop);
  const upgradeStopLevel = useGameStore((s) => s.upgradeStopLevel);
  const setInteractionMode = useGameStore((s) => s.setInteractionMode);
  const toggleDraftStop = useGameStore((s) => s.toggleDraftStop);

  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);

  const selectedStop = stops.find((s) => s.id === selectedStopId) || null;
  const recentNotifs = notifications.filter((n) => Date.now() - n.createdAt < 5000);

  const { transferStopIds, links } = detectTransferLinks(routes, stops);
  const isTransferHub = selectedStop ? transferStopIds.has(selectedStop.id) : false;
  const stopLinks = selectedStop
    ? links.filter(
        (l) => l.stopAId === selectedStop.id || l.stopBId === selectedStop.id
      )
    : [];

  const currentTierSpec = selectedStop ? STOP_TIER_SPECS[selectedStop.level] : null;
  const nextTierSpec =
    selectedStop && selectedStop.level < 3
      ? STOP_TIER_SPECS[(selectedStop.level + 1) as StopTierLevel]
      : null;

  // Step 3 onboarding highlight (2 stops + 1 route, but 0 vehicles)
  const isStep3Tutorial =
    stops.length >= 2 && routes.length >= 1 && vehicles.length === 0;

  // The active stop to show in-map callout for
  const calloutStop = selectedStop || (isStep3Tutorial ? stops[0] : null);

  useEffect(() => {
    if (!calloutStop) {
      setScreenPos(null);
      return;
    }

    const updatePos = () => {
      const map = (window as unknown as { __MAP__?: { project: (c: [number, number]) => { x: number; y: number } } }).__MAP__;
      if (map && calloutStop.coords) {
        try {
          const pt = map.project(calloutStop.coords);
          // Check if coordinates are within reasonable window viewport
          if (
            pt.x > -100 &&
            pt.x < window.innerWidth + 100 &&
            pt.y > -100 &&
            pt.y < window.innerHeight + 100
          ) {
            setScreenPos({ x: Math.round(pt.x), y: Math.round(pt.y) });
          } else {
            setScreenPos(null);
          }
        } catch {
          setScreenPos(null);
        }
      }
    };

    updatePos();
    const map = (window as unknown as { __MAP__?: { on: (e: string, fn: () => void) => void; off: (e: string, fn: () => void) => void } }).__MAP__;
    if (map) {
      map.on('move', updatePos);
      map.on('zoom', updatePos);
      return () => {
        map.off('move', updatePos);
        map.off('zoom', updatePos);
      };
    }
  }, [calloutStop?.id, calloutStop?.coords, stops.length, routes.length, vehicles.length]);

  return (
    <>
      {/* Top-Right Toast Notifications */}
      <div className="pointer-events-none fixed top-16 right-3 z-20 flex flex-col gap-2 w-72">
        {recentNotifs.map((n) => (
          <div
            key={n.id}
            className="pointer-events-auto p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-xl"
          >
            <div className="text-xs font-extrabold text-white">{n.text}</div>
            {n.subtext && (
              <div className="text-[11px] text-cyan-300 mt-0.5">{n.subtext}</div>
            )}
          </div>
        ))}
      </div>

      {/* IN-MAP FLOATING CALLOUT BALLOON (Anchored directly over Stop coordinate) */}
      {calloutStop && screenPos && (
        <div
          className="pointer-events-auto fixed -translate-x-1/2 -translate-y-full z-20 flex flex-col items-center gap-1 transition-transform duration-75 select-none"
          style={{ left: `${screenPos.x}px`, top: `${screenPos.y - 12}px` }}
        >
          {/* Callout Bubble */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl w-64 text-xs">
            {(() => {
              const tierPrefix =
                calloutStop.level === 3
                  ? 'Shelter BRT'
                  : calloutStop.level === 2
                  ? 'Halte'
                  : 'Plang';
              const cleanBaseName = calloutStop.name.replace(
                /^(Plang|Halte|Shelter|Shelter BRT|Simpang)\s+/i,
                ''
              );
              const maxCap = STOP_TIER_SPECS[calloutStop.level].maxQueueCapacity;
              const isFull = calloutStop.totalWaiting >= maxCap;
              const isCrowded = !isFull && calloutStop.totalWaiting >= maxCap * 0.6;

              return (
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-white truncate pr-1">
                    {tierPrefix} {cleanBaseName}
                  </span>
                  <span
                    className={`font-mono font-bold text-[11px] shrink-0 px-2 py-0.5 rounded-lg border ${
                      isFull
                        ? 'bg-rose-500/30 text-rose-300 border-rose-500/60 animate-pulse'
                        : isCrowded
                        ? 'bg-amber-500/30 text-amber-300 border-amber-500/60'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {isFull ? '🔴 PENUH ' : isCrowded ? '🟡 ' : '👥 '}
                    {calloutStop.totalWaiting}/{maxCap}
                  </span>
                </div>
              );
            })()}
            <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
              {calloutStop.totalWaiting > 0
                ? `${calloutStop.totalWaiting} pax menunggu di halte. Layani halte ini dengan armada.`
                : 'Halte siap melayani calon penumpang.'}
            </p>
          </div>

          {/* Callout Arrow */}
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-700 -mt-1" />

          {/* Onboarding Step 3 Indicator */}
          {isStep3Tutorial && (
            <div className="mt-1 px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-[11px] shadow-lg animate-bounce flex items-center gap-1">
              <span>Langkah 3: beli angkot pertama</span>
              <span>⬇</span>
            </div>
          )}
        </div>
      )}

      {/* Selected Stop Details Card (when explicitly selected) */}
      <div className="pointer-events-none fixed bottom-16 right-4 z-20 flex flex-col items-end gap-2.5">
        {selectedStop && currentTierSpec && (
          <div className="pointer-events-auto w-[320px] p-3.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white leading-tight">
                    {selectedStop.name}
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    {currentTierSpec.shortName} • Zona {selectedStop.category}
                  </span>
                </div>
              </div>
              <button
                onClick={() => selectStop(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Kapasitas Antrean:</div>
                <div className="font-mono font-bold text-white mt-0.5">
                  {selectedStop.totalWaiting}/{currentTierSpec.maxQueueCapacity} pax
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Diambil Ojol:</div>
                <div className="font-mono font-bold text-rose-400 mt-0.5">
                  {selectedStop.ojolLostCount} pax
                </div>
              </div>
            </div>

            {nextTierSpec && (
              <button
                disabled={balanceRp < nextTierSpec.upgradeCostRp}
                onClick={() => upgradeStopLevel(selectedStop.id)}
                className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-xs transition shadow flex items-center justify-center gap-1.5"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                <span>
                  Upgrade ke {nextTierSpec.shortName} (Rp {(nextTierSpec.upgradeCostRp / 1_000_000).toFixed(0)} Jt)
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};
