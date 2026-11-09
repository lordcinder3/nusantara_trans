---
name: gis-transit-tycoon-architect
description: >-
  Specialized architectural skill for building, extending, and optimizing real-world map transit tycoon games (Nusantara Transit Manager / City Transport Manager style) using MapLibre GL, Turf.js, OSRM/Overpass routing, and Zustand delta-time game loops. Use this skill whenever modifying map rendering, vehicle simulation, routing, passenger demand, or Indonesian transit gameplay mechanics.
---

# GIS Transit Simulation & Tycoon Architecture Skill

When building, modifying, or debugging this transit simulation game, strictly adhere to the following architectural rules, performance guardrails, and geospatial domain patterns:

---

## 1. Geospatial & Coordinate Discipline (CRITICAL)

- **Strict `[lng, lat]` Order:**
  - `MapLibre GL`, GeoJSON, OSRM, Overpass API, and `@turf/turf` strictly use **`[longitude, latitude]`** (e.g., Central Jakarta is `[106.8317, -6.1865]`).
  - **NEVER** swap coordinates to `[lat, lng]`.
- **Zero React Re-Renders for Frame-by-Frame Map Updates:**
  - **NEVER** use React component state or DOM `<Marker />` elements to animate moving vehicles on the map.
  - Store active vehicles in MapLibre GeoJSON sources (`vehicles-3d-src`, `vehicles-points-src`) and push updates directly via `useGameStore.subscribe()` outside the React render cycle.
- **Multi-Frequency GeoJSON Source Sync (Dirty-Checking & Throttling):**
  - **High Frequency (~24 FPS):** Update only moving vehicle sources (`vehicles-3d-src`, `vehicles-points-src`).
  - **Medium Frequency (Throttled to ~500ms / 2 FPS):** Update passenger queues at stops (`stops-points-src`, `stops-pillars-src`, `roadside-pax-src`). Cache static stop polygon rings (`turf.circle`) in a `Map<string, Position[][]>` so `turf.circle` is never recomputed on every tick.
  - **Event-Driven Only (Dirty-Checked by Reference):** Update `routes-src` and `draft-route-src` **only** when routes are created, deleted, upgraded, or selected.
- **Fast Flat-Earth Trigonometry for 3D Vehicle Boxes:**
  - Do **NOT** call `@turf/destination` 4–6 times per vehicle per frame to build 3D vehicle footprints.
  - Use direct flat-earth degree offsets (`KM_PER_DEG_LAT = 110.574`, `KM_PER_DEG_LNG = 110.675` at Jakarta's `-6.2°` latitude) with `Math.sin(bearingRad)` and `Math.cos(bearingRad)` to compute the 4 corners of each 3D vehicle box in $O(1)$ time.
- **Road Snapping & Segment Caching:**
  - Connect sequential stops via OSRM (`https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson`).
  - Cache segment coordinate arrays in memory (`Map<string, [number, number][]>`) keyed by coordinate pair or stop ID pair so the API is never queried twice for the same road segment.
  - Always include an `AbortController` timeout (~4.5s) and an automatic straight-line fallback (`@turf/lineString`) if OSRM is unreachable or rate-limited.

---

## 2. View Distance Culling, Camera & Dynamic Day/Night Lighting

- **View Distance & GPU Guardrails:**
  - Always configure `maxBounds` to the active city's play area (e.g., Greater Central Jakarta `[[106.74, -6.28], [106.92, -6.12]]`), `minZoom: 12.3`, and `maxZoom: 16.5` so the browser never downloads distant outer tiles.
  - Cap camera pitch at `maxPitch: 46` (default 3D pitch `38°`). High pitch angles (`>55°`) exponentially increase horizon vector tile counts.
  - Initialize MapLibre with `antialias: false` and `fadeDuration: 0` to minimize integrated GPU memory and frame times.
  - Apply view-distance culling (`minzoom: 13.7`) on the `fill-extrusion` 3D buildings layer and provide a user toggle (`show3DBuildings`) in the HUD.
- **Zero-Reload Dynamic Day/Night Map Theme:**
  - **NEVER** call `map.setStyle()` during gameplay to switch between Day and Night (calling `setStyle` destroys custom GeoJSON sources and triggers full tile reloads).
  - Instead, load a single clean vector style (`OpenFreeMap Liberty`) and dynamically mutate layer paint properties (`map.setPaintProperty`) for `background`, `water`, `park/landcover`, `road`, and `building-3d` across 4 time phases (`'dawn' | 'day' | 'dusk' | 'night'`).

---

## 3. Game Loop & Delta Time (`dt`) Mechanics

- **Decoupled & Frame-Capped Simulation Tick:**
  - Use a central `requestAnimationFrame` hook (`useGameLoop`) throttled to ~24 FPS (`deltaSec >= 0.04`) and clamped (`Math.min(deltaSec, 0.1)`) to prevent teleportation after background tab switching.
  - Multiply `deltaSec` by `gameSpeed` (`0` Pause, `1x`, `2x`, `5x`).
  - Track each vehicle's progress along its route as `distanceKm` (float) and `direction` (`1` forward, `-1` reverse).
  - Compute exact vehicle coordinates and street orientation (`bearing`) using `@turf/along(route.geometry, distanceKm, { units: 'kilometers' })` and a look-ahead point along the route.

---

## 4. Indonesian Transit Domain Logic

- **Vehicle State Machine:**
  - Every vehicle must operate within explicit states: `'moving' | 'boarding' | 'ngetem' | 'hailing'`.
- **Mekanik "Ngetem" (Angkot / Mikrolet):**
  - When `spec.supportsNgetem && route.ngetemEnabled` is active, an Angkot arriving at a stop enters `'ngetem'` state if `passengers / capacity < route.ngetemThresholdPct` (e.g., `70%`).
  - While in `'ngetem'`, it continues boarding newly spawned passengers at that stop until either the occupancy threshold is met OR `maxNgetemTimerSec` expires.
- **Mekanik "Hail Anywhere" (Angkot Cegat Pinggir Jalan):**
  - Spawn `RoadsidePassenger` nodes along active route segments.
  - Vehicles with `supportsHailAnywhere: true` (Angkot) detect roadside passengers within `distanceAlongKm` proximity, transition briefly to `'hailing'`, board them, and collect flat fare (`Rp`).
- **Mekanik "Jalur Khusus Busway" (TransJakarta BRT):**
  - In-game rush hours (Morning `06:15–09:30` and Evening `16:00–19:45`) apply a `trafficMultiplier` slowdown (e.g., `0.42x–0.48x`) to all road vehicles.
  - Routes upgraded with `dedicatedLaneEnabled: true` grant immunity to vehicles with `supportsDedicatedLane: true` (BRT), allowing them to maintain `1.0x` cruise speed during peak congestion.
- **Mekanik Kompetitor "Diambil Ojol" (Passenger Patience Decay):**
  - Each spawned passenger batch at a stop tracks `spawnedAtMinute` and `maxPatienceMinutes`.
  - If `waitedMinutes >= maxPatienceMinutes` before a vehicle boards them, despawn the batch, increment `ojolLostCount` / `totalTakenByOjol`, and trigger a visual indicator on the stop.

---

## 5. UI, Currency & Verification Standards

- **Unobstructed Floating HUD:**
  - Wrap HUD overlays in `pointer-events-none` containers and apply `pointer-events-auto` only to interactive glassmorphic cards so map panning, zooming, and pitch rotation remain responsive.
- **Indonesian Localization & Currency:**
  - Format all monetary values in Indonesian Rupiah (`Rp 15.000.000` / `Rp 15 Jt`) using `toLocaleString('id-ID')` or `Intl.NumberFormat('id-ID')`.
- **Verification Step:**
  - After modifying simulation types, store logic, or MapLibre layers, always run `npm run build` (`tsc && vite build`) to ensure strict TypeScript and bundle integrity.
