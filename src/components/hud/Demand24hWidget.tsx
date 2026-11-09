import React from 'react';
import { useGameStore } from '../../store/useGameStore';

export const Demand24hWidget: React.FC = () => {
  const gameMinutes = useGameStore((s) => s.gameMinutes);

  const curMins = Math.floor(gameMinutes) % 1440;
  const playheadPct = (curMins / 1440) * 100;

  // Calculate upcoming peak
  // Pagi peak: 07:45 (465 min), Sore peak: 16:00 (960 min)
  let peakLabel = '';
  if (curMins < 465) {
    const diff = 465 - curMins;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    peakLabel = `Puncak pagi 07:45, ${h > 0 ? `${h}j ` : ''}${m}m lagi`;
  } else if (curMins < 960) {
    const diff = 960 - curMins;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    peakLabel = `Puncak sore 16:00, ${h > 0 ? `${h}j ` : ''}${m}m lagi`;
  } else {
    const diff = 1440 - curMins + 465;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    peakLabel = `Puncak pagi 07:45, ${h > 0 ? `${h}j ` : ''}${m}m lagi`;
  }

  // Smooth SVG path coordinates for 24-hour demand curve (viewBox 0 0 320 38)
  const pathD =
    'M 0 32 ' +
    'C 40 32, 60 30, 80 20 ' +
    'C 95 10, 110 10, 125 18 ' +
    'C 145 22, 175 22, 195 18 ' +
    'C 210 10, 230 10, 245 18 ' +
    'C 265 26, 290 32, 320 32';

  const areaD = `${pathD} L 320 38 L 0 38 Z`;

  return (
    <div className="pointer-events-auto bg-slate-900 border border-slate-700 rounded-2xl px-3 py-1.5 shadow-2xl w-[320px] sm:w-[380px] shrink-0">
      {/* Header Info */}
      <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase mb-1">
        <span className="text-slate-400">DEMAND 24 JAM</span>
        <span className="text-sky-400 font-mono font-bold tracking-normal lowercase first-letter:uppercase">
          {peakLabel}
        </span>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full h-8">
        <svg
          viewBox="0 0 320 38"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="demandCurveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Fill Area */}
          <path d={areaD} fill="url(#demandCurveGrad)" />

          {/* Stroke Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Baseline */}
          <line
            x1="0"
            y1="36"
            x2="320"
            y2="36"
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        </svg>

        {/* Yellow Vertical Playhead Needle */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none transition-all duration-300"
          style={{ left: `${playheadPct}%` }}
        >
          <div className="w-[2px] h-full bg-amber-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
          <div className="w-1.5 h-1.5 rounded-full bg-amber-300 -translate-x-[2px] -translate-y-1 shadow" />
        </div>
      </div>

      {/* Hour Axis Markers */}
      <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-0.5 px-0.5">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
};
