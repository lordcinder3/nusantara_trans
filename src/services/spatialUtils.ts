import * as turf from '@turf/turf';
import type maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Polygon, Point } from 'geojson';
import type {
  CashPopupEvent,
  CityId,
  CursorCatchmentPreview,
  DemandPotentialTier,
  DepotNode,
  FloodZone,
  RoadsidePassenger,
  StopNode,
  TimeOfDayPhase,
  TransferLink,
  TransitRoute,
  Vehicle,
  WeatherCondition,
  ZoneCategory,
} from '../types/game';
import { FLEET_SPECS, STOP_TIER_SPECS } from '../config/fleetSpecs';
import {
  CITY_PRESETS,
  type CityLandmarkHotspot,
  estimateStopNameFromLocation,
} from '../config/jakartaPreset';

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LNG = 110.675;
const DEG_TO_RAD = Math.PI / 180;

function createRotatedRectCoords(
  centerLng: number,
  centerLat: number,
  lengthM: number,
  widthM: number,
  bearingDeg: number,
  offsetFwdM = 0,
  offsetRightM = 0
): [number, number][] {
  const rad = bearingDeg * DEG_TO_RAD;
  const cosB = Math.cos(rad);
  const sinB = Math.sin(rad);

  // Apply forward/right local translation offsets in flat-earth degrees
  const cLng =
    centerLng + (offsetFwdM * sinB + offsetRightM * cosB) / (1000 * KM_PER_DEG_LNG);
  const cLat =
    centerLat + (offsetFwdM * cosB - offsetRightM * sinB) / (1000 * KM_PER_DEG_LAT);

  const halfLenKm = lengthM / 2000;
  const halfWidKm = widthM / 2000;

  const fwdLng = (halfLenKm * sinB) / KM_PER_DEG_LNG;
  const fwdLat = (halfLenKm * cosB) / KM_PER_DEG_LAT;
  const rightLng = (halfWidKm * cosB) / KM_PER_DEG_LNG;
  const rightLat = (-halfWidKm * sinB) / KM_PER_DEG_LAT;

  const fl: [number, number] = [cLng + fwdLng - rightLng, cLat + fwdLat - rightLat];
  const fr: [number, number] = [cLng + fwdLng + rightLng, cLat + fwdLat + rightLat];
  const br: [number, number] = [cLng - fwdLng + rightLng, cLat - fwdLat + rightLat];
  const bl: [number, number] = [cLng - fwdLng - rightLng, cLat - fwdLat - rightLat];

  return [fl, fr, br, bl, fl];
}

function createOffsetRotatedRectCoords(
  baseLng: number,
  baseLat: number,
  offsetM: [number, number],
  lengthM: number,
  widthM: number,
  bearingDeg: number
): [number, number][] {
  const dLng = offsetM[0] / 1000 / KM_PER_DEG_LNG;
  const dLat = offsetM[1] / 1000 / KM_PER_DEG_LAT;
  return createRotatedRectCoords(
    baseLng + dLng,
    baseLat + dLat,
    lengthM,
    widthM,
    bearingDeg
  );
}

export function getVehicleTransformAlongRoute(
  geometry: Feature<LineString>,
  distanceKm: number,
  totalLengthKm: number,
  direction: 1 | -1
): { coords: [number, number]; bearing: number } {
  const clampedDist = Math.max(0, Math.min(totalLengthKm, distanceKm));
  const pt = turf.along(geometry, clampedDist, { units: 'kilometers' });
  const coords = pt.geometry.coordinates as [number, number];

  const lookAheadDelta = 0.025 * direction;
  const targetDist = Math.max(0, Math.min(totalLengthKm, clampedDist + lookAheadDelta));

  let bearing = 0;
  if (Math.abs(targetDist - clampedDist) > 0.001) {
    const aheadPt = turf.along(geometry, targetDist, { units: 'kilometers' });
    bearing = turf.bearing(pt, aheadPt);
  } else {
    const behindDist = Math.max(0, Math.min(totalLengthKm, clampedDist - lookAheadDelta));
    const behindPt = turf.along(geometry, behindDist, { units: 'kilometers' });
    bearing = turf.bearing(behindPt, pt);
  }

  return { coords, bearing };
}

/**
 * LOW-POLY 3D VEHICLE ASSETS
 * Transforms generic boxes into iconic, tiered 3D low-poly models:
 * 1. Angkot (Mikrolet): Minivan shape with front hood, cyan body, dark windshield, and white roof.
 * 2. Metromini / Kopaja: Medium diesel bus with orange chassis, dark window band, and cream roof.
 * 3. TransJakarta BRT: Long aerodynamic bus with electric blue lower body, panoramic glass, white roof, and dual rooftop AC pods!
 */
export function buildVehicles3DGeoJSON(
  vehicles: Vehicle[],
  routeColorMap: Record<string, string>
): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];

  for (const v of vehicles) {
    if (!v.routeId || v.status === 'IDLE_IN_POOL') continue;
    const spec = FLEET_SPECS[v.type];
    const [lng, lat] = v.coords;
    const isMogok = v.state === 'mogok';

    // Helper to push a low-poly part
    const addPart = (
      partSuffix: string,
      lenM: number,
      widM: number,
      heightM: number,
      baseM: number,
      color: string,
      offsetFwdM = 0,
      offsetRightM = 0
    ) => {
      const ring = createRotatedRectCoords(
        lng,
        lat,
        lenM,
        widM,
        v.bearing,
        offsetFwdM,
        offsetRightM
      );
      features.push({
        type: 'Feature',
        properties: {
          id: `${v.id}-${partSuffix}`,
          vehicleId: v.id,
          type: v.type,
          plateNumber: v.plateNumber,
          passengers: v.passengers,
          capacity: v.capacity,
          state: v.state,
          color,
          height: Math.max(baseM + 0.5, heightM),
          base: baseM,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
      });
    };

    const mainColor = isMogok
      ? '#ef4444'
      : routeColorMap[v.routeId] || spec.color;

    // --- 1. ANGKOT MIKROLET (Suzuki Carry Minivan with Front Hood & White Roof) ---
    if (v.type === 'angkot') {
      const H = spec.visualHeightM;
      const L = spec.visualLengthM;
      const W = spec.visualWidthM;

      // Part A: Chassis & Roda Hitam (Bumper dasar)
      addPart('chassis', L * 0.98, W * 0.94, 1.8, 0.1, '#0f172a');

      // Part B: Moncong Mesin Depan (Front Hood Carry)
      addPart(
        'hood',
        L * 0.32,
        W * 0.90,
        H * 0.52,
        1.2,
        mainColor,
        L * 0.33
      );

      // Part C: Kaca Depan (Slanted Front Windshield)
      addPart(
        'windshield',
        L * 0.14,
        W * 0.88,
        H * 0.86,
        H * 0.46,
        '#0f172a',
        L * 0.16
      );

      // Part D: Kabin Penumpang Belakang (Bodi Utama)
      addPart(
        'cabin-body',
        L * 0.68,
        W * 0.96,
        H * 0.66,
        1.2,
        mainColor,
        -L * 0.11
      );

      // Part E: Jendela Samping Penumpang (Tinted Glass)
      addPart(
        'side-windows',
        L * 0.62,
        W * 0.98,
        H * 0.86,
        H * 0.60,
        '#0f172a',
        -L * 0.11
      );

      // Part F: Atap Putih Khas Angkot (White Roof Cap)
      addPart(
        'roof',
        L * 0.70,
        W * 0.90,
        H,
        H * 0.82,
        isMogok ? '#fca5a5' : '#f8fafc',
        -L * 0.10
      );
    }

    // --- 2. METROMINI / KOPAJA (Bus Sedang Diesel Oranye / Hijau) ---
    else if (v.type === 'metromini') {
      const H = spec.visualHeightM;
      const L = spec.visualLengthM;
      const W = spec.visualWidthM;

      // Part A: Chassis & Bumper Bawah Hitam
      addPart('chassis', L, W * 0.94, 2.2, 0.1, '#0f172a');

      // Part B: Bodi Utama (Oranye Metromini / Hijau Kopaja)
      addPart('body', L, W, H * 0.54, 1.5, mainColor);

      // Part C: Pita Jendela Kaca Melingkar (Glass Band)
      addPart('glass', L * 0.98, W * 0.94, H * 0.84, H * 0.48, '#0f172a');

      // Part D: Kaca Depan Hitam Pekat (Front Windshield)
      addPart(
        'windshield',
        L * 0.12,
        W * 0.92,
        H * 0.88,
        H * 0.46,
        '#020617',
        L * 0.44
      );

      // Part E: Atap Krem Ikonik (Cream/Ivory Roof Cap)
      addPart(
        'roof',
        L * 0.98,
        W * 0.92,
        H,
        H * 0.82,
        isMogok ? '#fca5a5' : '#fef08a'
      );
    }

    // --- 3. TRANSJAKARTA BRT (High-Deck Bus dengan Atap Putih & Pod AC Ganda) ---
    else {
      const H = spec.visualHeightM;
      const L = spec.visualLengthM;
      const W = spec.visualWidthM;

      // Part A: Chassis Bawah / Roda Hitam
      addPart('chassis', L, W * 0.94, 2.6, 0.1, '#0f172a');

      // Part B: Bodi Bawah Biru TransJakarta
      addPart('lower-body', L, W, H * 0.50, 2.0, mainColor);

      // Part C: Kaca Panoramik Modern Hitam (Panoramic Dark Windows)
      addPart('panoramic-glass', L * 0.98, W * 0.94, H * 0.84, H * 0.46, '#020617');

      // Part D: Kaca Depan Aerodinamis (Front Aero Windshield)
      addPart(
        'front-windshield',
        L * 0.10,
        W * 0.92,
        H * 0.88,
        H * 0.44,
        '#020617',
        L * 0.45
      );

      // Part E: Atap Putih Bersih Aerodinamis (Clean White Roof)
      addPart(
        'white-roof',
        L * 0.98,
        W * 0.92,
        H,
        H * 0.82,
        isMogok ? '#fca5a5' : '#f8fafc'
      );

      // Part F: Pod AC Rooftop 1 (Depan)
      addPart(
        'ac-pod-front',
        L * 0.20,
        W * 0.56,
        H + 3.2,
        H,
        '#94a3b8',
        L * 0.22
      );

      // Part G: Pod AC Rooftop 2 (Belakang)
      addPart(
        'ac-pod-rear',
        L * 0.20,
        W * 0.56,
        H + 3.2,
        H,
        '#94a3b8',
        -L * 0.22
      );
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function buildVehiclesPointGeoJSON(
  vehicles: Vehicle[]
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: vehicles
      .filter((v) => v.routeId !== null && v.status !== 'IDLE_IN_POOL')
      .map((v) => {
        const spec = FLEET_SPECS[v.type];
        const statusBadge =
          v.state === 'mogok'
            ? ' [💨 MOGOK!]'
            : v.state === 'ngetem'
            ? ' [NGETEM]'
            : v.state === 'boarding'
            ? ' [NAIK/TURUN]'
            : v.state === 'hailing'
            ? ' [ANGKUT]'
            : '';
        return {
          type: 'Feature',
          properties: {
            id: v.id,
            type: v.type,
            color: v.state === 'mogok' ? '#ef4444' : spec.color,
            bearing: v.bearing,
            passengers: v.passengers,
            capacity: v.capacity,
            state: v.state,
            label: `${v.plateNumber} • ${v.passengers}/${v.capacity}${statusBadge}`,
          },
          geometry: {
            type: 'Point',
            coordinates: v.coords,
          },
        };
      }),
  };
}

export function buildCashPopupsGeoJSON(
  popups: CashPopupEvent[],
  nowMs: number
): FeatureCollection<Point> {
  const active = popups.filter(
    (p) => p.coords && nowMs - p.createdAt < 2600
  );
  return {
    type: 'FeatureCollection',
    features: active.map((p) => {
      const ageRatio = Math.min(1, Math.max(0, (nowMs - p.createdAt) / 2600));
      // Float slightly north on the map as it ages so it rises visually!
      const [lng, lat] = p.coords!;
      const floatedLat = lat + ageRatio * 0.0011;
      const isPositive = p.amountRp >= 0;
      return {
        type: 'Feature',
        properties: {
          id: p.id,
          isPositive,
          text: `${p.label}\n${p.categoryLabel}`,
        },
        geometry: {
          type: 'Point',
          coordinates: [lng, floatedLat],
        },
      };
    }),
  };
}

const catchmentCircleCache = new Map<string, [number, number][][]>();

/**
 * PHASE 3: Builds Stop Points, Catchment Circles, and Tiered 3D Stop Structures (Level 1 / 2 / 3)
 * - Level 1: Compact street pole
 * - Level 2: Sheltered Canopy Bus Stop
 * - Level 3: High-Deck BRT Station + JPO Pedestrian Overpass Structure!
 */
export function buildStopsGeoJSON(
  stops: StopNode[],
  selectedStopIds: string[],
  transferStopIds: Set<string>
): {
  points: FeatureCollection<Point>;
  catchments: FeatureCollection<Polygon>;
  pillars: FeatureCollection<Polygon>;
} {
  const points: Feature<Point>[] = [];
  const catchments: Feature<Polygon>[] = [];
  const pillars: Feature<Polygon>[] = [];

  const now = Date.now();

  for (const s of stops) {
    const isSelected = selectedStopIds.includes(s.id);
    const isTransferHub = transferStopIds.has(s.id);
    const tierSpec = STOP_TIER_SPECS[s.level];
    const recentlyStolenByOjol =
      s.lastOjolTimestamp && now - s.lastOjolTimestamp < 3500 ? true : false;

    const categoryColor =
      s.category === 'perumahan'
        ? '#10b981'
        : s.category === 'kantor'
        ? '#3b82f6'
        : '#f59e0b';

    const levelBadge = s.level === 3 ? ' [BRT JPO]' : s.level === 2 ? ' [Lv.2]' : '';
    const transferText =
      s.transitWaiting > 0
        ? ` 🔄${s.transitWaiting}`
        : isTransferHub
        ? ' 🔄'
        : '';

    const isFull = s.totalWaiting >= tierSpec.maxQueueCapacity;
    const isCrowded = !isFull && s.totalWaiting >= tierSpec.maxQueueCapacity * 0.6;
    const fullnessRatio = s.totalWaiting / tierSpec.maxQueueCapacity;

    const queueBadge = isFull
      ? `PENUH: ${s.totalWaiting}/${tierSpec.maxQueueCapacity}`
      : isCrowded
      ? `RAMAI: ${s.totalWaiting}/${tierSpec.maxQueueCapacity}`
      : `${s.totalWaiting}/${tierSpec.maxQueueCapacity}`;

    const cleanBaseName = s.name.replace(
      /^(Plang|Halte|Shelter|Shelter BRT|Simpang)\s+/i,
      ''
    );
    const tierPrefix = s.level === 3 ? 'Shelter BRT' : s.level === 2 ? 'Halte' : 'Plang';
    const nameBadge = `${tierPrefix} ${cleanBaseName}`;

    const nodeColor = isFull
      ? '#ef4444'
      : isCrowded
      ? '#f59e0b'
      : s.level === 3
      ? '#38bdf8'
      : categoryColor;

    points.push({
      type: 'Feature',
      properties: {
        id: s.id,
        name: s.name,
        nameBadge,
        queueBadge,
        level: s.level,
        category: s.category,
        isPrebuiltHub: s.isPrebuiltHub,
        isTransferHub,
        totalWaiting: s.totalWaiting,
        maxQueueCapacity: tierSpec.maxQueueCapacity,
        transitWaiting: s.transitWaiting,
        ojolLostCount: s.ojolLostCount,
        color: nodeColor,
        isFull,
        isCrowded,
        fullnessRatio,
        isSelected,
        recentlyStolenByOjol,
        label: `${queueBadge}\n${nameBadge}`,
      },
      geometry: {
        type: 'Point',
        coordinates: s.coords,
      },
    });

    // Cached 18-step Catchment Circle
    let catchmentCoords = catchmentCircleCache.get(s.id);
    if (!catchmentCoords) {
      const poly = turf.circle(s.coords, s.catchmentRadiusM / 1000, {
        steps: 18,
        units: 'kilometers',
      });
      catchmentCoords = poly.geometry.coordinates as [number, number][][];
      catchmentCircleCache.set(s.id, catchmentCoords);
    }

    catchments.push({
      type: 'Feature',
      properties: {
        id: s.id,
        color: s.level === 3 ? '#38bdf8' : isTransferHub ? '#a855f7' : categoryColor,
        isSelected,
      },
      geometry: {
        type: 'Polygon',
        coordinates: catchmentCoords,
      },
    });

    const [lng, lat] = s.coords;
    const baseColor = recentlyStolenByOjol
      ? '#22c55e'
      : isSelected
      ? '#facc15'
      : isTransferHub && s.transitWaiting > 0
      ? '#c084fc'
      : categoryColor;

    // 3D Multi-Tier Low-Poly Structure by Stop Level (Level 1 Plang / Level 2 Halte Beratap / Level 3 BRT Station + JPO):
    if (s.level === 1) {
      // Level 1: Plang Stop Bus Pinggir Jalan (Concrete Pad + Metal Pole + Blue Signboard)
      const padRing = createRotatedRectCoords(lng, lat, 10, 8, 0);
      const poleRing = createRotatedRectCoords(lng, lat, 1.8, 1.8, 0);
      const signRing = createRotatedRectCoords(lng, lat, 6, 2.2, 0);
      pillars.push(
        {
          type: 'Feature',
          properties: {
            id: `${s.id}-pad`,
            color: '#64748b', // Concrete ground pad
            height: 0.8,
            base: 0,
          },
          geometry: { type: 'Polygon', coordinates: [padRing] },
        },
        {
          type: 'Feature',
          properties: {
            id: `${s.id}-pole`,
            color: '#334155', // Dark metallic vertical pole
            height: 6.8,
            base: 0.8,
          },
          geometry: { type: 'Polygon', coordinates: [poleRing] },
        },
        {
          type: 'Feature',
          properties: {
            id: s.id,
            color: isSelected ? '#facc15' : '#2563eb', // Royal Blue Plang Stop Signboard
            height: 7.2,
            base: 4.8,
          },
          geometry: { type: 'Polygon', coordinates: [signRing] },
        }
      );
    } else if (s.level === 2) {
      // Level 2: Halte Reguler Beratap (Concrete Platform + Tinted Glass Partition + Vibrant Orange Canopy)
      const platformRing = createRotatedRectCoords(lng, lat, 18, 9, -15);
      const glassWallRing = createOffsetRotatedRectCoords(lng, lat, [-2.5, 0], 16, 1.4, -15);
      const canopyRing = createRotatedRectCoords(lng, lat, 20, 11, -15);
      const edgeStripeRing = createOffsetRotatedRectCoords(lng, lat, [3.6, 0], 18, 1.2, -15);
      pillars.push(
        {
          type: 'Feature',
          properties: {
            id: `${s.id}-platform`,
            color: '#475569',
            height: 1.0,
            base: 0,
          },
          geometry: { type: 'Polygon', coordinates: [platformRing] },
        },
        {
          type: 'Feature',
          properties: {
            id: `${s.id}-glass`,
            color: '#06b6d4', // Tinted cyan glass shelter wall
            height: 4.8,
            base: 1.0,
          },
          geometry: { type: 'Polygon', coordinates: [glassWallRing] },
        },
        {
          type: 'Feature',
          properties: {
            id: s.id,
            color: isSelected ? '#facc15' : '#ea580c', // High-visibility transit orange roof canopy
            height: 5.8,
            base: 4.8,
          },
          geometry: { type: 'Polygon', coordinates: [canopyRing] },
        },
        {
          type: 'Feature',
          properties: {
            id: `${s.id}-edge`,
            color: '#facc15', // Yellow safety line
            height: 1.2,
            base: 1.0,
          },
          geometry: { type: 'Polygon', coordinates: [edgeStripeRing] },
        }
      );
    } else {
      // Level 3: Shelter BRT TransJakarta High-Deck Station + Golden JPO Pedestrian Overpass!
      const deckRing = createRotatedRectCoords(lng, lat, 34, 11, -15);
      const hallRing = createRotatedRectCoords(lng, lat, 31, 9, -15);
      const brtRoofRing = createRotatedRectCoords(lng, lat, 36, 12.5, -15);
      const jpoSpanRing = createRotatedRectCoords(lng, lat, 9, 36, 75);
      const jpoTowerRing = createOffsetRotatedRectCoords(lng, lat, [0, 15], 8, 8, 0);
      pillars.push(
        {
          type: 'Feature',
          properties: {
            id: `${s.id}-deck`,
            color: '#334155', // High deck platform
            height: 1.8,
            base: 0,
          },
          geometry: { type: 'Polygon', coordinates: [deckRing] },
        },
        {
          type: 'Feature',
          properties: {
            id: `${s.id}-hall`,
            color: '#0284c7', // TransJakarta Blue Glass enclosure
            height: 7.2,
            base: 1.8,
          },
          geometry: { type: 'Polygon', coordinates: [hallRing] },
        },
        {
          type: 'Feature',
          properties: {
            id: s.id,
            color: isSelected ? '#facc15' : '#f8fafc', // Aerodynamic white BRT roof
            height: 8.6,
            base: 7.0,
          },
          geometry: { type: 'Polygon', coordinates: [brtRoofRing] },
        },
        {
          type: 'Feature',
          properties: {
            id: `${s.id}-jpo`,
            color: '#f59e0b', // Golden yellow JPO pedestrian bridge
            height: 12.0,
            base: 8.5,
          },
          geometry: { type: 'Polygon', coordinates: [jpoSpanRing] },
        },
        {
          type: 'Feature',
          properties: {
            id: `${s.id}-jpo-tower`,
            color: '#94a3b8', // Silver metallic JPO stair tower
            height: 12.5,
            base: 0,
          },
          geometry: { type: 'Polygon', coordinates: [jpoTowerRing] },
        }
      );
    }
  }

  return {
    points: { type: 'FeatureCollection', features: points },
    catchments: { type: 'FeatureCollection', features: catchments },
    pillars: { type: 'FeatureCollection', features: pillars },
  };
}

/**
 * PHASE 3: Builds 3D Garage Complexes & Point Markers for Jakarta Pool Depots
 */
export function buildDepotsGeoJSON(depots: DepotNode[]): {
  points: FeatureCollection<Point>;
  boxes3D: FeatureCollection<Polygon>;
} {
  const points: Feature<Point>[] = [];
  const boxes3D: Feature<Polygon>[] = [];

  for (const d of depots) {
    const [lng, lat] = d.coords;
    const color = d.unlocked ? '#10b981' : '#64748b';

    points.push({
      type: 'Feature',
      properties: {
        id: d.id,
        name: d.name,
        unlocked: d.unlocked,
        capacitySlots: d.capacitySlots,
        unlockCostRp: d.unlockCostRp,
        color,
        label: d.unlocked
          ? `🏭 ${d.name}\n(Aktif: +${d.capacitySlots} Slot)`
          : `🔒 ${d.name}\n(Buka: Rp ${(d.unlockCostRp / 1_000_000).toFixed(0)} Jt • +${d.capacitySlots} Slot)`,
      },
      geometry: {
        type: 'Point',
        coordinates: d.coords,
      },
    });

    // 3D Garage Hangar Footprint
    const hangarRing = createRotatedRectCoords(lng, lat, 110, 65, 15);
    boxes3D.push({
      type: 'Feature',
      properties: {
        id: d.id,
        color: d.unlocked ? '#059669' : '#475569',
        height: d.unlocked ? 28 : 16,
        base: 0,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [hangarRing],
      },
    });
  }

  return {
    points: { type: 'FeatureCollection', features: points },
    boxes3D: { type: 'FeatureCollection', features: boxes3D },
  };
}

export function detectTransferLinks(
  routes: TransitRoute[],
  stops: StopNode[]
): {
  links: TransferLink[];
  transferStopIds: Set<string>;
  partnerStopsMap: Map<string, string[]>;
} {
  const links: TransferLink[] = [];
  const transferStopIds = new Set<string>();
  const partnerStopsMap = new Map<string, string[]>();

  if (routes.length < 2) {
    return { links, transferStopIds, partnerStopsMap };
  }

  const stopMap = new Map<string, StopNode>(stops.map((s) => [s.id, s]));
  const seenPairs = new Set<string>();

  const addPartner = (a: string, b: string) => {
    const listA = partnerStopsMap.get(a) || [];
    if (!listA.includes(b)) listA.push(b);
    partnerStopsMap.set(a, listA);
  };

  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const rA = routes[i];
      const rB = routes[j];

      for (const idA of rA.stopIds) {
        const sA = stopMap.get(idA);
        if (!sA) continue;

        for (const idB of rB.stopIds) {
          const sB = stopMap.get(idB);
          if (!sB) continue;

          if (idA === idB) {
            const key = `shared-${idA}`;
            transferStopIds.add(idA);
            addPartner(idA, idA);
            if (!seenPairs.has(key)) {
              seenPairs.add(key);
              links.push({
                id: key,
                stopAId: idA,
                stopBId: idB,
                coordsA: sA.coords,
                coordsB: sB.coords,
                distanceMeters: 0,
                isSharedStop: true,
                routeCodes: [rA.code, rB.code],
              });
            }
          } else {
            const distKm = turf.distance(sA.coords, sB.coords, {
              units: 'kilometers',
            });
            if (distKm <= 0.25) {
              const sortedKey = [idA, idB].sort().join('<->');
              transferStopIds.add(idA);
              transferStopIds.add(idB);
              addPartner(idA, idB);
              addPartner(idB, idA);

              if (!seenPairs.has(sortedKey)) {
                seenPairs.add(sortedKey);
                links.push({
                  id: `walk-${sortedKey}`,
                  stopAId: idA,
                  stopBId: idB,
                  coordsA: sA.coords,
                  coordsB: sB.coords,
                  distanceMeters: Math.round(distKm * 1000),
                  isSharedStop: false,
                  routeCodes: [rA.code, rB.code],
                });
              }
            }
          }
        }
      }
    }
  }

  return { links, transferStopIds, partnerStopsMap };
}

export function buildTransferLinksGeoJSON(
  links: TransferLink[]
): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];

  for (const link of links) {
    if (!link.isSharedStop) {
      features.push(
        turf.lineString([link.coordsA, link.coordsB], {
          id: link.id,
          distanceMeters: link.distanceMeters,
          label: `🔄 Oper Jalan Kaki (${link.distanceMeters}m)`,
        })
      );
    }
  }

  return turf.featureCollection(features);
}

/**
 * PHASE 2 & 3: Zero-Lag OSM Building Inspection + Local Area Name Detection
 * Reads actual place/neighborhood/street labels rendered on the MapLibre canvas near the cursor
 * and combines with our 60-neighborhood Jakarta lookup table!
 */
export function inspectCatchmentAtCursor(
  map: maplibregl.Map,
  screenPoint: { x: number; y: number },
  coords: [number, number],
  stops: StopNode[],
  pendingCategory: ZoneCategory = 'perumahan',
  cityId: CityId = 'jabodetabek'
): CursorCatchmentPreview {
  const radiusM = 300;

  const bbox: [[number, number], [number, number]] = [
    [screenPoint.x - 65, screenPoint.y - 65],
    [screenPoint.x + 65, screenPoint.y + 65],
  ];

  let renderedBuildings = 0;
  let renderedRoads = 0;
  let detectedMapLabel: string | undefined;

  try {
    const features = map.queryRenderedFeatures(bbox);
    for (const f of features) {
      const lid = f.layer?.id || '';
      const srcLayer = f.sourceLayer || '';

      if (
        !detectedMapLabel &&
        (srcLayer === 'place' ||
          srcLayer === 'poi' ||
          srcLayer === 'transportation_name' ||
          lid.includes('place') ||
          lid.includes('label')) &&
        !lid.startsWith('stops-') &&
        !lid.startsWith('vehicles-') &&
        !lid.startsWith('depots-') &&
        !lid.startsWith('hotspots-')
      ) {
        const rawName =
          f.properties?.['name:id'] ||
          f.properties?.['name:latin'] ||
          f.properties?.name;
        if (typeof rawName === 'string' && rawName.trim().length >= 3) {
          detectedMapLabel = rawName.trim();
        }
      }

      if (
        srcLayer === 'building' ||
        lid.includes('building') ||
        lid === 'poi-buildings-3d-layer'
      ) {
        renderedBuildings += 1;
      } else if (
        srcLayer === 'transportation' ||
        lid.includes('road') ||
        lid.includes('highway')
      ) {
        renderedRoads += 1;
      }
    }
  } catch {
    // Fallback if style is still loading
  }

  const detectedAreaName = estimateStopNameFromLocation(
    coords,
    pendingCategory,
    stops,
    detectedMapLabel,
    cityId
  );

  let urbanDensityScore = renderedBuildings * 2.5 + renderedRoads * 5.5;
  let nearbyTransferStopName: string | undefined;

  for (const s of stops) {
    const distKm = turf.distance(coords, s.coords, { units: 'kilometers' });
    if (distKm <= 0.25) {
      nearbyTransferStopName = s.name;
    }
    if (distKm < 1.1) {
      urbanDensityScore += (1.1 - distKm) * 38 * (s.baseDemandWeight / 2);
    }
  }

  // Also check proximity to City Hotspots (so even when starting with 0 stops, major stations/markets give High Demand!)
  const cityHotspots = CITY_PRESETS[cityId]?.hotspots || [];
  for (const hs of cityHotspots) {
    const distKm = turf.distance(coords, hs.coords, { units: 'kilometers' });
    if (distKm < 1.5) {
      urbanDensityScore += (1.5 - distKm) * 48;
    }
  }

  const buildingCount = Math.max(
    8,
    Math.min(180, Math.round(urbanDensityScore + 12))
  );

  let demandTier: DemandPotentialTier = 'Rendah';
  let estimatedWeight = 1.25;

  if (buildingCount >= 75) {
    demandTier = 'Tinggi';
    estimatedWeight = Number(
      Math.min(2.6, 1.85 + (buildingCount - 75) / 140).toFixed(2)
    );
  } else if (buildingCount >= 38) {
    demandTier = 'Sedang';
    estimatedWeight = Number((1.4 + (buildingCount - 38) / 90).toFixed(2));
  } else {
    demandTier = 'Rendah';
    estimatedWeight = 1.15;
  }

  const estimatedPaxPerHour = Math.round(estimatedWeight * 15);

  return {
    coords,
    screenX: screenPoint.x,
    screenY: screenPoint.y,
    radiusM,
    detectedAreaName,
    buildingCount,
    demandTier,
    estimatedWeight,
    estimatedPaxPerHour,
    nearbyTransferStopName,
  };
}

interface LandmarkBuildingDef {
  offsetM: [number, number];
  lengthM: number;
  widthM: number;
  heightM: number;
  bearing: number;
  kind: 'office' | 'market' | 'station' | 'landmark';
}

const EXTRA_JAKARTA_LANDMARKS: {
  id: string;
  name: string;
  coords: [number, number];
  buildings: LandmarkBuildingDef[];
}[] = [
  // 1. MONAS & GOV CENTER
  {
    id: 'poi-monas',
    name: 'Monumen Nasional (Monas)',
    coords: [106.82715, -6.17539],
    buildings: [
      { offsetM: [0, 0], lengthM: 95, widthM: 95, heightM: 24, bearing: 0, kind: 'landmark' },
      { offsetM: [0, 0], lengthM: 28, widthM: 28, heightM: 132, bearing: 0, kind: 'landmark' },
    ],
  },
  {
    id: 'poi-gambir-bumn',
    name: 'Stasiun Gambir & Menara BUMN',
    coords: [106.8305, -6.1770],
    buildings: [
      { offsetM: [0, 0], lengthM: 140, widthM: 65, heightM: 32, bearing: 5, kind: 'station' },
      { offsetM: [-80, -35], lengthM: 75, widthM: 52, heightM: 88, bearing: 5, kind: 'office' },
      { offsetM: [85, 30], lengthM: 70, widthM: 48, heightM: 72, bearing: 5, kind: 'office' },
    ],
  },

  // 2. THAMRIN & BUNDARAN HI
  {
    id: 'poi-sarang-thamrin',
    name: 'Sarinah & Menara Thamrin',
    coords: [106.8236, -6.1875],
    buildings: [
      { offsetM: [-55, 0], lengthM: 95, widthM: 58, heightM: 78, bearing: -8, kind: 'office' },
      { offsetM: [65, 20], lengthM: 80, widthM: 55, heightM: 95, bearing: -8, kind: 'office' },
      { offsetM: [55, -85], lengthM: 70, widthM: 50, heightM: 70, bearing: -8, kind: 'office' },
    ],
  },
  {
    id: 'poi-bundaran-hi',
    name: 'Bundaran HI • Grand Indonesia & Menara BCA',
    coords: [106.8227, -6.1950],
    buildings: [
      { offsetM: [-80, -25], lengthM: 120, widthM: 75, heightM: 135, bearing: -12, kind: 'office' },
      { offsetM: [-85, 80], lengthM: 140, widthM: 85, heightM: 52, bearing: -12, kind: 'market' },
      { offsetM: [85, -20], lengthM: 110, widthM: 70, heightM: 65, bearing: -12, kind: 'market' },
      { offsetM: [80, 75], lengthM: 75, widthM: 55, heightM: 115, bearing: -12, kind: 'office' },
    ],
  },

  // 3. DUKUH ATAS & SUDIRMAN UTARA (WISMA 46 & MENARA ASTRA)
  {
    id: 'poi-dukuh-atas-towers',
    name: 'CBD Dukuh Atas • Wisma 46 & Menara Astra',
    coords: [106.8210, -6.2045],
    buildings: [
      { offsetM: [-75, 45], lengthM: 75, widthM: 50, heightM: 165, bearing: -14, kind: 'office' }, // Wisma 46 BNI
      { offsetM: [80, 50], lengthM: 70, widthM: 52, heightM: 145, bearing: -14, kind: 'office' }, // Menara Astra
      { offsetM: [-70, -60], lengthM: 85, widthM: 48, heightM: 110, bearing: -14, kind: 'office' }, // Sinarmas MSIG
      { offsetM: [75, -55], lengthM: 80, widthM: 50, heightM: 95, bearing: -14, kind: 'office' }, // Chase Plaza
    ],
  },
  {
    id: 'poi-sahid-sudirman',
    name: 'Karet Sudirman • Sahid Sudirman & MidPlaza',
    coords: [106.8198, -6.2095],
    buildings: [
      { offsetM: [-65, 30], lengthM: 85, widthM: 55, heightM: 155, bearing: -15, kind: 'office' }, // Sahid Sudirman
      { offsetM: [70, 35], lengthM: 75, widthM: 50, heightM: 105, bearing: -15, kind: 'office' }, // MidPlaza
      { offsetM: [-60, -50], lengthM: 70, widthM: 48, heightM: 88, bearing: -15, kind: 'office' }, // Menara Batavia
    ],
  },

  // 4. SUDIRMAN TENGAH (WTC & SAMPOERNA STRATEGIC)
  {
    id: 'poi-sudirman-wtc',
    name: 'Sudirman Central • WTC Jakarta & Sampoerna Square',
    coords: [106.8190, -6.2165],
    buildings: [
      { offsetM: [-75, 40], lengthM: 80, widthM: 55, heightM: 125, bearing: -16, kind: 'office' }, // WTC 1-3
      { offsetM: [75, 45], lengthM: 85, widthM: 50, heightM: 115, bearing: -16, kind: 'office' }, // Sampoerna Strategic
      { offsetM: [-70, -45], lengthM: 75, widthM: 48, heightM: 98, bearing: -16, kind: 'office' }, // Mayapada Tower
      { offsetM: [70, -50], lengthM: 70, widthM: 52, heightM: 90, bearing: -16, kind: 'office' }, // Sona Topas
    ],
  },

  // 5. SCBD & SEMANGGI (PACIFIC PLACE & IDX BURSA EFEK)
  {
    id: 'poi-scbd-semanggi',
    name: 'SCBD Semanggi • Pacific Place & Treasury Tower',
    coords: [106.8100, -6.2260],
    buildings: [
      { offsetM: [-80, -30], lengthM: 135, widthM: 80, heightM: 65, bearing: -20, kind: 'market' }, // Pacific Place Mall
      { offsetM: [-75, 55], lengthM: 75, widthM: 55, heightM: 175, bearing: -20, kind: 'office' }, // Treasury Tower
      { offsetM: [75, -25], lengthM: 70, widthM: 52, heightM: 135, bearing: -20, kind: 'office' }, // The Energy
      { offsetM: [80, 50], lengthM: 75, widthM: 50, heightM: 120, bearing: -20, kind: 'office' }, // Equity Tower
      { offsetM: [0, 115], lengthM: 85, widthM: 50, heightM: 110, bearing: 70, kind: 'office' }, // IDX Bursa Efek
    ],
  },
  {
    id: 'poi-senayan-city',
    name: 'Senayan • Senayan City & Plaza Senayan',
    coords: [106.7990, -6.2250],
    buildings: [
      { offsetM: [-70, 30], lengthM: 125, widthM: 75, heightM: 55, bearing: 10, kind: 'market' },
      { offsetM: [-65, -55], lengthM: 70, widthM: 50, heightM: 110, bearing: 10, kind: 'office' },
      { offsetM: [75, 35], lengthM: 120, widthM: 70, heightM: 52, bearing: 10, kind: 'market' },
      { offsetM: [70, -45], lengthM: 65, widthM: 48, heightM: 95, bearing: 10, kind: 'office' },
    ],
  },

  // 6. RASUNA SAID / KUNINGAN UTARA (SETIABUDI & IMPERIUM)
  {
    id: 'poi-rasuna-utara',
    name: 'Kuningan Utara • Setiabudi One & Menara Imperium',
    coords: [106.8315, -6.2125],
    buildings: [
      { offsetM: [-65, 35], lengthM: 85, widthM: 50, heightM: 115, bearing: -5, kind: 'office' }, // Menara Imperium
      { offsetM: [70, 30], lengthM: 110, widthM: 65, heightM: 48, bearing: -5, kind: 'market' }, // Setiabudi One
      { offsetM: [-60, -45], lengthM: 75, widthM: 48, heightM: 85, bearing: -5, kind: 'office' }, // KPK Baru
      { offsetM: [65, -50], lengthM: 70, widthM: 52, heightM: 92, bearing: -5, kind: 'office' }, // Atrium Mulia
    ],
  },

  // 7. RASUNA SAID TENGAH (KADIN, PALMA, CYBER 2, EPICENTRUM)
  {
    id: 'poi-rasuna-tengah',
    name: 'Kuningan Tengah • Menara Kadin & Cyber 2',
    coords: [106.8290, -6.2245],
    buildings: [
      { offsetM: [-65, 40], lengthM: 75, widthM: 50, heightM: 125, bearing: -6, kind: 'office' }, // Cyber 2 Tower
      { offsetM: [70, 45], lengthM: 80, widthM: 55, heightM: 110, bearing: -6, kind: 'office' }, // Menara Kadin
      { offsetM: [-60, -45], lengthM: 70, widthM: 48, heightM: 95, bearing: -6, kind: 'office' }, // Menara Palma
      { offsetM: [65, -50], lengthM: 75, widthM: 52, heightM: 105, bearing: -6, kind: 'office' }, // Bakrie Tower
    ],
  },

  // 8. MEGA KUNINGAN & CASABLANCA (WORLD CAPITAL, RITZ, CIPUTRA WORLD)
  {
    id: 'poi-mega-kuningan',
    name: 'Mega Kuningan • World Capital & Ciputra World',
    coords: [106.8245, -6.2275],
    buildings: [
      { offsetM: [-75, 45], lengthM: 80, widthM: 55, heightM: 145, bearing: 25, kind: 'office' }, // World Capital Tower
      { offsetM: [75, 40], lengthM: 75, widthM: 52, heightM: 125, bearing: 25, kind: 'office' }, // Menara BTPN
      { offsetM: [-70, -45], lengthM: 90, widthM: 60, heightM: 88, bearing: 25, kind: 'landmark' }, // Ritz Carlton
      { offsetM: [70, -50], lengthM: 135, widthM: 75, heightM: 58, bearing: 25, kind: 'market' }, // Lotte Shopping Ave
    ],
  },

  // 9. GATOT SUBROTO (TELKOM LANDMARK & CAPITAL PLACE)
  {
    id: 'poi-gatot-subroto',
    name: 'Gatot Subroto • Telkom Landmark & Capital Place',
    coords: [106.8210, -6.2380],
    buildings: [
      { offsetM: [-75, 35], lengthM: 85, widthM: 55, heightM: 155, bearing: 82, kind: 'office' }, // Telkom Landmark
      { offsetM: [75, 40], lengthM: 80, widthM: 52, heightM: 135, bearing: 82, kind: 'office' }, // Capital Place
      { offsetM: [-70, -45], lengthM: 75, widthM: 50, heightM: 95, bearing: 82, kind: 'office' }, // Menara Jamsostek
      { offsetM: [70, -50], lengthM: 80, widthM: 48, heightM: 88, bearing: 82, kind: 'office' }, // Wisma Mulia
    ],
  },

  // 10. PASAR TANAH ABANG (TEXTILE WHOLESALE MEGA BLOCKS)
  {
    id: 'poi-tanah-abang-blocks',
    name: 'Pasar Grosir Tanah Abang • Blok A, B & F',
    coords: [106.8130, -6.1870],
    buildings: [
      { offsetM: [-65, 35], lengthM: 140, widthM: 85, heightM: 48, bearing: 12, kind: 'market' }, // Blok A
      { offsetM: [75, 30], lengthM: 130, widthM: 80, heightM: 44, bearing: 12, kind: 'market' }, // Blok B
      { offsetM: [-60, -55], lengthM: 110, widthM: 65, heightM: 38, bearing: 12, kind: 'market' }, // Blok F
      { offsetM: [70, -50], lengthM: 95, widthM: 55, heightM: 54, bearing: 12, kind: 'office' }, // Metro Tanah Abang
    ],
  },

  // 11. PASAR SENEN & ATRIUM
  {
    id: 'poi-senen-blocks',
    name: 'Kawasan Senen • Pasar Senen & Plaza Atrium',
    coords: [106.8440, -6.1755],
    buildings: [
      { offsetM: [-65, 30], lengthM: 135, widthM: 75, heightM: 38, bearing: -8, kind: 'market' }, // Pasar Senen
      { offsetM: [75, 35], lengthM: 120, widthM: 70, heightM: 55, bearing: -8, kind: 'market' }, // Plaza Atrium
      { offsetM: [0, -65], lengthM: 130, widthM: 55, heightM: 32, bearing: -8, kind: 'station' }, // Stasiun Senen
    ],
  },

  // 12. MANGGARAI CENTRAL TRANSIT HUB
  {
    id: 'poi-manggarai-hub',
    name: 'Transit Hub Manggarai & Pasar Rumput',
    coords: [106.8480, -6.2090],
    buildings: [
      { offsetM: [60, -20], lengthM: 155, widthM: 65, heightM: 42, bearing: -20, kind: 'station' }, // Terminal Manggarai
      { offsetM: [-65, 35], lengthM: 110, widthM: 65, heightM: 34, bearing: -20, kind: 'market' }, // Pasar Rumput
      { offsetM: [40, 75], lengthM: 75, widthM: 50, heightM: 78, bearing: 70, kind: 'office' }, // TOD Tower
    ],
  },

  // 13. GLODOK & HAYAM WURUK
  {
    id: 'poi-glodok-commercial',
    name: 'Glodok • LTC Glodok & Gajah Mada Plaza',
    coords: [106.8160, -6.1485],
    buildings: [
      { offsetM: [-65, 30], lengthM: 140, widthM: 80, heightM: 52, bearing: 0, kind: 'market' }, // LTC Glodok
      { offsetM: [70, 35], lengthM: 115, widthM: 70, heightM: 48, bearing: 0, kind: 'market' }, // Harco Glodok
      { offsetM: [0, -65], lengthM: 100, widthM: 65, heightM: 68, bearing: 0, kind: 'office' }, // Gajah Mada Plaza
    ],
  },

  // 14. RSCM & SALEMBA
  {
    id: 'poi-rscm-salemba',
    name: 'RSCM & Kampus UI Salemba',
    coords: [106.8475, -6.1972],
    buildings: [
      { offsetM: [0, 0], lengthM: 130, widthM: 55, heightM: 44, bearing: 20, kind: 'landmark' },
      { offsetM: [-70, -40], lengthM: 90, widthM: 48, heightM: 36, bearing: 20, kind: 'landmark' },
    ],
  },
];

const EXTRA_BANDUNG_LANDMARKS: {
  id: string;
  name: string;
  coords: [number, number];
  buildings: LandmarkBuildingDef[];
}[] = [
  {
    id: 'bdg-asia-afrika',
    name: 'CBD Asia Afrika & Gedung Merdeka',
    coords: [107.6080, -6.9210],
    buildings: [
      { offsetM: [-55, 30], lengthM: 85, widthM: 50, heightM: 68, bearing: 15, kind: 'office' },
      { offsetM: [60, 35], lengthM: 95, widthM: 55, heightM: 75, bearing: 15, kind: 'office' },
      { offsetM: [0, -50], lengthM: 110, widthM: 55, heightM: 35, bearing: 15, kind: 'landmark' },
    ],
  },
  {
    id: 'bdg-gedung-sate',
    name: 'Gedung Sate & Kantor Gubernur',
    coords: [107.6186, -6.9025],
    buildings: [
      { offsetM: [0, 0], lengthM: 135, widthM: 55, heightM: 45, bearing: 0, kind: 'landmark' },
      { offsetM: [0, 60], lengthM: 70, widthM: 48, heightM: 55, bearing: 0, kind: 'office' },
    ],
  },
];

const EXTRA_SURABAYA_LANDMARKS: {
  id: string;
  name: string;
  coords: [number, number];
  buildings: LandmarkBuildingDef[];
}[] = [
  {
    id: 'sby-tunjungan-cbd',
    name: 'CBD Tunjungan Plaza & Basuki Rahmat',
    coords: [107.7390, -7.2625],
    buildings: [
      { offsetM: [-75, 35], lengthM: 145, widthM: 85, heightM: 65, bearing: -10, kind: 'market' }, // TP 1-6
      { offsetM: [75, 40], lengthM: 85, widthM: 55, heightM: 145, bearing: -10, kind: 'office' }, // Pakuwon Tower
      { offsetM: [0, -60], lengthM: 75, widthM: 50, heightM: 110, bearing: -10, kind: 'office' },
    ],
  },
];

const EXTRA_BALI_LANDMARKS: {
  id: string;
  name: string;
  coords: [number, number];
  buildings: LandmarkBuildingDef[];
}[] = [
  {
    id: 'bali-kuta-strip',
    name: 'Kuta Beachwalk & Resort Strip',
    coords: [115.1695, -8.7185],
    buildings: [
      { offsetM: [-60, 25], lengthM: 130, widthM: 75, heightM: 32, bearing: 5, kind: 'market' },
      { offsetM: [65, 30], lengthM: 110, widthM: 65, heightM: 28, bearing: 5, kind: 'landmark' },
    ],
  },
];

export function buildPOIBuildings3DGeoJSON(
  stops: StopNode[],
  timePhase: TimeOfDayPhase,
  cityId: CityId = 'jabodetabek'
): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];

  const colors =
    timePhase === 'night'
      ? {
          office: '#38bdf8', // Neon Sky Blue (Sudirman / Thamrin Towers)
          market: '#fbbf24', // Warm Glowing Gold (Tanah Abang / Senen Markets)
          station: '#34d399', // Mint / Emerald (Manggarai / Dukuh Atas Hubs)
          landmark: '#c084fc', // Vibrant Violet (Monas / GBK Landmarks)
        }
      : {
          office: '#0284c7', // Vibrant Corporate Blue
          market: '#f59e0b', // Commercial Amber/Orange
          station: '#059669', // Transit Emerald Green
          landmark: '#7c3aed', // Royal Purple
        };

  const addCluster = (
    baseCoords: [number, number],
    defs: LandmarkBuildingDef[],
    prefix: string
  ) => {
    const [baseLng, baseLat] = baseCoords;
    defs.forEach((b, idx) => {
      const dLng = b.offsetM[0] / 1000 / KM_PER_DEG_LNG;
      const dLat = b.offsetM[1] / 1000 / KM_PER_DEG_LAT;
      const ring = createRotatedRectCoords(
        baseLng + dLng,
        baseLat + dLat,
        b.lengthM,
        b.widthM,
        b.bearing
      );
      features.push({
        type: 'Feature',
        properties: {
          id: `${prefix}-bldg-${idx}`,
          height: b.heightM,
          base: 0,
          color: colors[b.kind],
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
      });
    });
  };

  // Note: Synthetic POI boxes around player stops removed - OpenFreeMap Liberty renders real OSM buildings naturally!

  // Always render 3D POI buildings at the active city's major Hotspots (even when starting with 0 stops!)
  const cityHotspots = CITY_PRESETS[cityId]?.hotspots || [];
  for (const hs of cityHotspots) {
    if (hs.category === 'kantor') {
      addCluster(
        hs.coords,
        [
          { offsetM: [-70, 40], lengthM: 85, widthM: 55, heightM: 98, bearing: -10, kind: 'office' },
          { offsetM: [75, -45], lengthM: 75, widthM: 55, heightM: 112, bearing: -10, kind: 'office' },
          { offsetM: [0, 95], lengthM: 90, widthM: 48, heightM: 68, bearing: 80, kind: 'landmark' },
        ],
        hs.id
      );
    } else if (hs.category === 'pasar') {
      addCluster(
        hs.coords,
        [
          { offsetM: [-60, 30], lengthM: 130, widthM: 70, heightM: 34, bearing: 12, kind: 'market' },
          { offsetM: [70, -35], lengthM: 110, widthM: 60, heightM: 28, bearing: 12, kind: 'market' },
        ],
        hs.id
      );
    } else {
      addCluster(
        hs.coords,
        [
          { offsetM: [50, -20], lengthM: 135, widthM: 55, heightM: 32, bearing: -15, kind: 'station' },
          { offsetM: [-60, 30], lengthM: 90, widthM: 48, heightM: 45, bearing: -15, kind: 'office' },
        ],
        hs.id
      );
    }
  }

  if (cityId === 'jabodetabek') {
    for (const lm of EXTRA_JAKARTA_LANDMARKS) {
      addCluster(lm.coords, lm.buildings, lm.id);
    }
  } else if (cityId === 'bandung') {
    for (const lm of EXTRA_BANDUNG_LANDMARKS) {
      addCluster(lm.coords, lm.buildings, lm.id);
    }
  } else if (cityId === 'surabaya') {
    for (const lm of EXTRA_SURABAYA_LANDMARKS) {
      addCluster(lm.coords, lm.buildings, lm.id);
    }
  } else if (cityId === 'bali') {
    for (const lm of EXTRA_BALI_LANDMARKS) {
      addCluster(lm.coords, lm.buildings, lm.id);
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function buildHotspotsGeoJSON(
  hotspots: CityLandmarkHotspot[],
  stops: StopNode[]
): FeatureCollection<Point> {
  // Only show hotspot guide markers where the player hasn't already placed a stop within 350m
  const uncovered = hotspots.filter(
    (hs) =>
      !stops.some(
        (s) => turf.distance(hs.coords, s.coords, { units: 'kilometers' }) < 0.35
      )
  );
  return {
    type: 'FeatureCollection',
    features: uncovered.map((hs) => ({
      type: 'Feature',
      properties: {
        id: hs.id,
        name: hs.name,
        category: hs.category,
        label: `📍 ${hs.name}\n(${hs.demandLabel})`,
      },
      geometry: {
        type: 'Point',
        coordinates: hs.coords,
      },
    })),
  };
}

export function buildFloodZonesGeoJSON(
  floodZones: FloodZone[],
  weather: WeatherCondition
): {
  polygons: FeatureCollection<Polygon>;
  points: FeatureCollection<Point>;
} {
  if (weather !== 'banjir') {
    return {
      polygons: { type: 'FeatureCollection', features: [] },
      points: { type: 'FeatureCollection', features: [] },
    };
  }

  const polygons: Feature<Polygon>[] = [];
  const points: Feature<Point>[] = [];

  for (const fz of floodZones) {
    const circle = turf.circle(fz.coords, fz.radiusKm, {
      steps: 24,
      units: 'kilometers',
    });
    polygons.push({
      type: 'Feature',
      properties: {
        id: fz.id,
        name: fz.name,
      },
      geometry: circle.geometry,
    });
    points.push({
      type: 'Feature',
      properties: {
        id: fz.id,
        label: `🌊 ${fz.name}\n(Laju -55% • Aus Mesin 2.2x)`,
      },
      geometry: {
        type: 'Point',
        coordinates: fz.coords,
      },
    });
  }

  return {
    polygons: { type: 'FeatureCollection', features: polygons },
    points: { type: 'FeatureCollection', features: points },
  };
}

export function buildRoadsidePassengersGeoJSON(
  roadsidePax: RoadsidePassenger[]
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: roadsidePax.map((p) => ({
      type: 'Feature',
      properties: {
        id: p.id,
        count: p.count,
        label: `+${p.count} PNP`,
      },
      geometry: {
        type: 'Point',
        coordinates: p.coords,
      },
    })),
  };
}
