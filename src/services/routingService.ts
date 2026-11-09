import * as turf from '@turf/turf';
import type { Feature, LineString } from 'geojson';
import type {
  StopNode,
  DraftRouteAnalysis,
  DraftDetourSegment,
} from '../types/game';
import { findOfflineJakartaRoute } from './offlineRoadGraph';

const STORAGE_KEY = 'ntm_road_segments_cache_v2';
const segmentCache = new Map<string, [number, number][]>();

// Hydrate segment cache from localStorage on boot for instant 0ms offline road snapping
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, [number, number][]>;
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v) && v.length >= 2) {
        segmentCache.set(k, v);
      }
    }
  }
} catch {
  // Ignore storage errors in private browsing
}

function persistSegmentCache() {
  try {
    // Keep up to 120 recent road segments in localStorage
    const entries = Array.from(segmentCache.entries()).slice(-120);
    const obj: Record<string, [number, number][]> = {};
    for (const [k, v] of entries) {
      obj[k] = v;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Fetches road-snapped route geometry between two coordinates using:
 * 1) Persistent LocalStorage + Memory Cache (0ms)
 * 2) OSRM Driving API (with 3.2s timeout)
 * 3) Offline Jakarta Arterial Graph Dijkstra Router (<1ms)
 */
export async function fetchSegmentCoords(
  from: [number, number],
  to: [number, number]
): Promise<{
  coords: [number, number][];
  source: 'cache' | 'osrm' | 'offline-graph';
}> {
  const key = `${from[0].toFixed(4)},${from[1].toFixed(4)}->${to[0].toFixed(4)},${to[1].toFixed(4)}`;
  if (segmentCache.has(key)) {
    return { coords: segmentCache.get(key)!, source: 'cache' };
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3200);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM HTTP ${response.status}`);
    }

    const data = await response.json();
    if (
      data.code === 'Ok' &&
      data.routes &&
      data.routes.length > 0 &&
      data.routes[0].geometry?.coordinates?.length >= 2
    ) {
      const coords = data.routes[0].geometry.coordinates as [number, number][];
      segmentCache.set(key, coords);
      persistSegmentCache();
      return { coords, source: 'osrm' };
    }
  } catch (err) {
    console.warn('OSRM unreachable, using Offline Jakarta Road Graph for:', key, err);
  }

  // Fallback to Offline Jakarta Arterial Road Graph Router
  const offlineCoords = findOfflineJakartaRoute(from, to);
  segmentCache.set(key, offlineCoords);
  return { coords: offlineCoords, source: 'offline-graph' };
}

export interface RouteSegmentAnalysis {
  coords: [number, number][];
  roadKm: number;
  straightKm: number;
  detourRatio: number;
  isDetour: boolean;
  estDriveMinutes: number;
  source: 'cache' | 'osrm' | 'offline-graph';
}

/**
 * Detailed single segment analysis comparing road driving distance vs straight distance.
 * Catches Jakarta one-way & U-turn detours!
 */
export async function analyzeRouteSegment(
  from: [number, number],
  to: [number, number]
): Promise<RouteSegmentAnalysis> {
  const { coords, source } = await fetchSegmentCoords(from, to);
  const roadLine = turf.lineString(coords);
  const roadKm = Number(turf.length(roadLine, { units: 'kilometers' }).toFixed(2));
  const straightKm = Number(turf.distance(from, to, { units: 'kilometers' }).toFixed(2));

  const detourRatio = straightKm > 0.05 ? Number((roadKm / straightKm).toFixed(2)) : 1.0;
  // Detour flag: road distance >= 1.65x straight distance with >= 0.45 km extra driving,
  // or short hop (straight <= 0.6 km) forced into a long loop (>= 1.5 km road).
  const isDetour =
    (detourRatio >= 1.65 && roadKm - straightKm >= 0.45) ||
    (roadKm >= 1.5 && straightKm <= 0.6);

  const estDriveMinutes = Math.max(1, Math.ceil((roadKm / 22) * 60));

  return {
    coords,
    roadKm,
    straightKm,
    detourRatio,
    isDetour,
    estDriveMinutes,
    source,
  };
}

/**
 * Analyzes an entire sequence of stops during draft route creation.
 * Returns cumulative road distance, travel times, and identifies any detour segments.
 */
export async function analyzeMultiStopRoute(
  stops: StopNode[]
): Promise<DraftRouteAnalysis> {
  if (stops.length < 2) {
    return {
      totalRoadKm: 0,
      totalStraightKm: 0,
      estOneWayMinutes: 0,
      estRoundTripMinutes: 0,
      hasDetour: false,
      detourSegments: [],
    };
  }

  const allCoords: [number, number][] = [];
  const detourSegments: DraftDetourSegment[] = [];
  let totalRoadKm = 0;
  let totalStraightKm = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    const fromStop = stops[i];
    const toStop = stops[i + 1];
    const seg = await analyzeRouteSegment(fromStop.coords, toStop.coords);
    totalRoadKm += seg.roadKm;
    totalStraightKm += seg.straightKm;

    if (seg.isDetour) {
      detourSegments.push({
        fromStopId: fromStop.id,
        fromStopName: fromStop.name,
        toStopId: toStop.id,
        toStopName: toStop.name,
        roadKm: seg.roadKm,
        straightKm: seg.straightKm,
        detourRatio: seg.detourRatio,
        isDetour: true,
      });
    }

    if (i === 0) {
      allCoords.push(...seg.coords);
    } else {
      allCoords.push(...seg.coords.slice(1));
    }
  }

  const roundedRoadKm = Number(totalRoadKm.toFixed(2));
  const roundedStraightKm = Number(totalStraightKm.toFixed(2));
  const estOneWayMinutes = Math.max(2, Math.ceil((roundedRoadKm / 22) * 60));
  const estRoundTripMinutes = estOneWayMinutes * 2;
  const roadSnappedGeometry = turf.lineString(allCoords);

  return {
    totalRoadKm: roundedRoadKm,
    totalStraightKm: roundedStraightKm,
    estOneWayMinutes,
    estRoundTripMinutes,
    hasDetour: detourSegments.length > 0,
    detourSegments,
    roadSnappedGeometry,
  };
}


/**
 * Builds a complete multi-stop route geometry snapped to Jakarta roads,
 * plus exact cumulative kilometer distances for each stop.
 */
export async function buildRoadSnappedRoute(stops: StopNode[]): Promise<{
  geometry: Feature<LineString>;
  totalLengthKm: number;
  stopDistancesKm: number[];
  routingSource: 'osrm' | 'cache' | 'offline-graph';
}> {
  if (stops.length < 2) {
    throw new Error('Minimal 2 halte diperlukan untuk membuat trayek.');
  }

  const allCoords: [number, number][] = [];
  const stopDistancesKm: number[] = [0];
  let cumulativeKm = 0;
  let primarySource: 'osrm' | 'cache' | 'offline-graph' = 'cache';

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i].coords;
    const to = stops[i + 1].coords;
    const { coords, source } = await fetchSegmentCoords(from, to);
    if (source === 'offline-graph') primarySource = 'offline-graph';
    else if (source === 'osrm' && primarySource === 'cache') primarySource = 'osrm';

    const segLine = turf.lineString(coords);
    const segLengthKm = turf.length(segLine, { units: 'kilometers' });
    cumulativeKm += segLengthKm;
    stopDistancesKm.push(Number(cumulativeKm.toFixed(4)));

    if (i === 0) {
      allCoords.push(...coords);
    } else {
      allCoords.push(...coords.slice(1));
    }
  }

  const geometry = turf.lineString(allCoords);
  const totalLengthKm = Number(turf.length(geometry, { units: 'kilometers' }).toFixed(4));
  stopDistancesKm[stopDistancesKm.length - 1] = totalLengthKm;

  return {
    geometry,
    totalLengthKm: Math.max(totalLengthKm, 0.1),
    stopDistancesKm,
    routingSource: primarySource,
  };
}
