import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';

/**
 * Runs the simulation loop capped at ~24 FPS (42ms) to minimize browser CPU/GPU load
 * while keeping vehicle interpolation smooth.
 */
export function useGameLoop() {
  const tickSimulation = useGameStore((s) => s.tickSimulation);
  const initStarterNetwork = useGameStore((s) => s.initStarterNetwork);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    initStarterNetwork();
  }, [initStarterNetwork]);

  useEffect(() => {
    const saveInterval = window.setInterval(() => {
      useGameStore.getState().saveCurrentCityToStorage();
    }, 10_000);
    const handleUnload = () => {
      useGameStore.getState().saveCurrentCityToStorage();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.clearInterval(saveInterval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  useEffect(() => {
    let frameId: number;

    const loop = (now: number) => {
      if (lastTimeRef.current !== null) {
        const deltaSec = (now - lastTimeRef.current) / 1000;
        // Cap simulation tick rate to ~24 FPS (0.04s) to keep browser lightweight
        if (deltaSec >= 0.04) {
          tickSimulation(deltaSec);
          lastTimeRef.current = now;
        }
      } else {
        lastTimeRef.current = now;
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [tickSimulation]);
}
