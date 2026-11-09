import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { useGameStore, getEffectiveTimePhase } from '../../store/useGameStore';
import { CITY_PRESETS } from '../../config/jakartaPreset';
import {
  buildCashPopupsGeoJSON,
  buildDepotsGeoJSON,
  buildFloodZonesGeoJSON,
  buildHotspotsGeoJSON,
  buildPOIBuildings3DGeoJSON,
  buildRoadsidePassengersGeoJSON,
  buildStopsGeoJSON,
  buildTransferLinksGeoJSON,
  buildVehicles3DGeoJSON,
  buildVehiclesPointGeoJSON,
  detectTransferLinks,
  inspectCatchmentAtCursor,
} from '../../services/spatialUtils';
import {
  analyzeRouteSegment,
  buildRoadSnappedRoute,
} from '../../services/routingService';
import type { CityId, StopNode, TimeOfDayPhase, WeatherCondition } from '../../types/game';

const OPENFREEMAP_LIBERTY_STYLE =
  'https://tiles.openfreemap.org/styles/liberty';

export const MapCanvas: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isMapLoadedRef = useRef<boolean>(false);
  const lastInspectMsRef = useRef<number>(0);

  const currentCityId = useGameStore((s) => s.currentCityId);
  const mapViewJumpVersion = useGameStore((s) => s.mapViewJumpVersion);
  const weather = useGameStore((s) => s.weather);
  const cameraMode = useGameStore((s) => s.cameraMode);
  const showCatchmentRadius = useGameStore((s) => s.showCatchmentRadius);
  const show3DBuildings = useGameStore((s) => s.show3DBuildings);
  const interactionMode = useGameStore((s) => s.interactionMode);
  const cursorPreview = useGameStore((s) => s.cursorPreview);
  const draftRouteStopIds = useGameStore((s) => s.draftRouteStopIds);
  const ghostPreview = useGameStore((s) => s.ghostPreview);
  const gameMinutes = useGameStore((s) => s.gameMinutes);
  const mapThemeMode = useGameStore((s) => s.mapThemeMode);
  const lastGhostCandidateIdRef = useRef<string | null>(null);

  const timePhase = getEffectiveTimePhase(gameMinutes, mapThemeMode);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCity = CITY_PRESETS[useGameStore.getState().currentCityId];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OPENFREEMAP_LIBERTY_STYLE,
      center: initialCity.center,
      zoom: initialCity.defaultZoom,
      minZoom: initialCity.minZoom,
      maxZoom: 16.8,
      maxBounds: initialCity.maxBounds,
      pitch: 42,
      bearing: -14,
      maxPitch: 48,
      antialias: false,
      fadeDuration: 0,
    });

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      'bottom-right'
    );

    map.on('load', () => {
      isMapLoadedRef.current = true;
      (window as unknown as { __MAP__: maplibregl.Map }).__MAP__ = map;

      // 1. Initial Sunlight & Directional Shading (Angle 42°, Azimuth 210° for crisp 3D volume)
      try {
        map.setLight({
          anchor: 'map',
          color: '#ffffff',
          intensity: 0.55,
          position: [1.3, 210, 42],
        });
      } catch (e) {
        console.warn('Map setLight skipped:', e);
      }

      // 2. OPSI A: Hide 2D residential building clutter (17,000+ tiny house footprints)
      // to achieve clean transit tycoon aesthetics and silky smooth 60 FPS!
      if (map.getLayer('building')) {
        map.setLayoutProperty('building', 'visibility', 'none');
      }
      if (map.getLayer('building-top')) {
        map.setLayoutProperty('building-top', 'visibility', 'none');
      }

      // 3. OpenFreeMap 3D Skyscraper Extrusions ONLY (filter >= 25m so ONLY prominent towers show)
      if (map.getLayer('building-3d')) {
        try {
          map.setFilter('building-3d', [
            'all',
            ['!', ['has', 'hide_3d']],
            ['>=', ['coalesce', ['get', 'render_height'], 0], 25],
          ]);
          map.setPaintProperty('building-3d', 'fill-extrusion-color', [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'render_height'], 25],
            25,
            '#64748b',
            55,
            '#0284c7',
            110,
            '#38bdf8',
          ]);
          map.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.88);
          if (typeof (map as any).setLayerZoomRange === 'function') {
            (map as any).setLayerZoomRange('building-3d', 13.5, 22);
          }
        } catch (e) {
          console.warn('OpenFreeMap building-3d setup failed:', e);
        }
      } else {
        const style = map.getStyle();
        const vectorSourceId = Object.keys(style.sources || {}).find(
          (key) => style.sources[key].type === 'vector'
        );

        if (vectorSourceId && !map.getLayer('jakarta-3d-buildings')) {
          try {
            map.addLayer({
              id: 'jakarta-3d-buildings',
              source: vectorSourceId,
              'source-layer': 'building',
              type: 'fill-extrusion',
              minzoom: 13.5,
              filter: ['>=', ['coalesce', ['get', 'render_height'], 0], 25],
              paint: {
                'fill-extrusion-color': [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', 'render_height'], 25],
                  25,
                  '#64748b',
                  55,
                  '#0284c7',
                  110,
                  '#38bdf8',
                ],
                'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 32],
                'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
                'fill-extrusion-opacity': 0.88,
              },
            });
          } catch (e) {
            console.warn('3D building extrusion layer skipped:', e);
          }
        }
      }

      // 2. GeoJSON Sources for Dynamic Simulation & Phase 3 Features
      map.addSource('poi-buildings-3d-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('depots-3d-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('depots-points-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('catchments-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('transfer-links-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('routes-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('draft-route-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('ghost-route-preview-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('stops-pillars-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('stops-points-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('roadside-pax-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('vehicles-3d-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('vehicles-points-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('hover-stop-preview-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('cash-popups-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('hotspots-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('flood-zones-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      map.addSource('flood-zones-points-src', {
        type: 'geojson',
        data: turf.featureCollection([]),
      });

      // LAYER: Flood Zones (Active during Banjir weather)
      map.addLayer({
        id: 'flood-zones-fill',
        type: 'fill',
        source: 'flood-zones-src',
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.28,
        },
      });

      map.addLayer({
        id: 'flood-zones-outline',
        type: 'line',
        source: 'flood-zones-src',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2.5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.85,
        },
      });

      map.addLayer({
        id: 'flood-zones-labels',
        type: 'symbol',
        source: 'flood-zones-points-src',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-anchor': 'center',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#e0f2fe',
          'text-halo-color': '#0369a1',
          'text-halo-width': 2.2,
        },
      });

      // LAYER: Demand Hotspot Guide Markers (Uncovered high-demand stations/markets)
      map.addLayer({
        id: 'hotspots-circles',
        type: 'circle',
        source: 'hotspots-src',
        paint: {
          'circle-radius': 6,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.45,
          'circle-stroke-width': 2,
          'circle-stroke-color': ['get', 'color'],
        },
      });

      map.addLayer({
        id: 'hotspots-labels',
        type: 'symbol',
        source: 'hotspots-src',
        minzoom: 11.2,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 10.5,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#fef08a',
          'text-halo-width': 1.8,
        },
      });

      // LAYER: Catchment Radius Fill & Dashed Outline
      map.addLayer({
        id: 'catchments-fill',
        type: 'fill',
        source: 'catchments-src',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['boolean', ['get', 'isSelected'], false], 0.16, 0.07],
        },
      });

      map.addLayer({
        id: 'catchments-outline',
        type: 'line',
        source: 'catchments-src',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 2, 1.2],
          'line-dasharray': [3, 3],
          'line-opacity': 0.6,
        },
      });

      // LAYER: 3D Low-Poly POI & Landmark Buildings
      map.addLayer({
        id: 'poi-buildings-3d-layer',
        type: 'fill-extrusion',
        source: 'poi-buildings-3d-src',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 0.84,
        },
      });

      // LAYER: Phase 3 Pool Depots 3D Garage Hangar & Markers
      map.addLayer({
        id: 'depots-3d-layer',
        type: 'fill-extrusion',
        source: 'depots-3d-src',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'depots-circles',
        type: 'circle',
        source: 'depots-points-src',
        paint: {
          'circle-radius': 9,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#facc15',
        },
      });

      map.addLayer({
        id: 'depots-labels',
        type: 'symbol',
        source: 'depots-points-src',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#fef08a',
          'text-halo-width': 2,
        },
      });

      // LAYER: Hover preview circle when placing a custom stop (300m radius)
      map.addLayer({
        id: 'hover-stop-preview-fill',
        type: 'fill',
        source: 'hover-stop-preview-src',
        paint: {
          'fill-color': '#06b6d4',
          'fill-opacity': 0.22,
        },
      });

      map.addLayer({
        id: 'hover-stop-preview-line',
        type: 'line',
        source: 'hover-stop-preview-src',
        paint: {
          'line-color': '#0891b2',
          'line-width': 2.5,
          'line-dasharray': [2, 2],
        },
      });

      // LAYER: Transit Routes Casing / Shadow
      map.addLayer({
        id: 'routes-glow',
        type: 'line',
        source: 'routes-src',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#0f172a',
          'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 9, 6.5],
          'line-opacity': 0.45,
        },
      });

      // LAYER: Transit Routes Core Line
      map.addLayer({
        id: 'routes-core',
        type: 'line',
        source: 'routes-src',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 6, 4],
          'line-opacity': 0.95,
        },
      });

      // LAYER: Dedicated Busway Lane Striping
      map.addLayer({
        id: 'routes-busway-stripe',
        type: 'line',
        source: 'routes-src',
        filter: ['==', ['get', 'dedicatedLaneEnabled'], true],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#fde047',
          'line-width': 2,
          'line-dasharray': [2, 3],
          'line-opacity': 0.95,
        },
      });

      // LAYER: Phase 2 Walking Transfer Connector Lines (< 250m between routes)
      map.addLayer({
        id: 'transfer-links-casing',
        type: 'line',
        source: 'transfer-links-src',
        paint: {
          'line-color': '#581c87',
          'line-width': 5,
          'line-opacity': 0.7,
        },
      });

      map.addLayer({
        id: 'transfer-links-line',
        type: 'line',
        source: 'transfer-links-src',
        paint: {
          'line-color': '#e9d5ff',
          'line-width': 2.5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.95,
        },
      });

      // LAYER: Confirmed Draft Route Casing (Glowing Halo)
      map.addLayer({
        id: 'draft-route-casing',
        type: 'line',
        source: 'draft-route-src',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#0284c7',
          'line-width': 7,
          'line-opacity': 0.5,
          'line-blur': 2,
        },
      });

      // LAYER: Confirmed Draft Route Line (Solid vibrant cyan)
      map.addLayer({
        id: 'draft-route-line',
        type: 'line',
        source: 'draft-route-src',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#38bdf8',
          'line-width': 3.5,
          'line-opacity': 0.95,
        },
      });

      // LAYER: Ghost Line Glow (Amber if Detour, Cyan if Normal)
      map.addLayer({
        id: 'ghost-route-preview-glow',
        type: 'line',
        source: 'ghost-route-preview-src',
        filter: ['==', '$type', 'LineString'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'isDetour'], false],
            '#f59e0b',
            '#38bdf8',
          ],
          'line-width': 8,
          'line-opacity': 0.6,
          'line-blur': 3,
        },
      });

      // LAYER: Ghost Line Dashed Center
      map.addLayer({
        id: 'ghost-route-preview-line',
        type: 'line',
        source: 'ghost-route-preview-src',
        filter: ['==', '$type', 'LineString'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'isDetour'], false],
            '#ea580c',
            '#0284c7',
          ],
          'line-width': 3.5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.95,
        },
      });

      // LAYER: Ghost Preview Detour / Distance Symbol Badge
      map.addLayer({
        id: 'ghost-route-preview-symbol',
        type: 'symbol',
        source: 'ghost-route-preview-src',
        filter: ['==', '$type', 'Point'],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11.5,
          'text-offset': [0, -1.8],
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': [
            'case',
            ['boolean', ['get', 'isDetour'], false],
            '#fef08a',
            '#ffffff',
          ],
          'text-halo-color': [
            'case',
            ['boolean', ['get', 'isDetour'], false],
            '#78350f',
            '#0284c7',
          ],
          'text-halo-width': 2.5,
        },
      });

      // LAYER: Stops 3D Structures (Level 1 Pole / Level 2 Shelter / Level 3 BRT + JPO Bridge!)
      map.addLayer({
        id: 'stops-3d-pillars',
        type: 'fill-extrusion',
        source: 'stops-pillars-src',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['coalesce', ['get', 'base'], 0],
          'fill-extrusion-opacity': 0.92,
        },
      });

      // LAYER: Stops 2D Circle Nodes (size & stroke scale with Stop Level 1 / 2 / 3 and Fullness)
      map.addLayer({
        id: 'stops-circles',
        type: 'circle',
        source: 'stops-points-src',
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            12,
            ['boolean', ['get', 'isFull'], false],
            10.5,
            ['==', ['get', 'level'], 3],
            10.5,
            ['==', ['get', 'level'], 2],
            8.5,
            7,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': [
            'case',
            ['boolean', ['get', 'isFull'], false],
            3.5,
            ['boolean', ['get', 'isSelected'], false],
            3.5,
            ['boolean', ['get', 'isCrowded'], false],
            3,
            ['==', ['get', 'level'], 3],
            3,
            ['boolean', ['get', 'isTransferHub'], false],
            3,
            2,
          ],
          'circle-stroke-color': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            '#facc15',
            ['boolean', ['get', 'isFull'], false],
            '#fee2e2',
            ['boolean', ['get', 'isCrowded'], false],
            '#fef08a',
            ['==', ['get', 'level'], 3],
            '#fbbf24',
            ['boolean', ['get', 'isTransferHub'], false],
            '#c084fc',
            '#0f172a',
          ],
        },
      });

      // LAYER: Roadside "Hail Anywhere" Passengers (Core circle)
      map.addLayer({
        id: 'roadside-pax-circles',
        type: 'circle',
        source: 'roadside-pax-src',
        minzoom: 10.5,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10.5,
            4,
            13,
            6,
            16,
            8.5,
          ],
          'circle-color': '#22d3ee',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#020617',
        },
      });

      // LAYER: Roadside "Hail Anywhere" Passengers (Label)
      map.addLayer({
        id: 'roadside-pax-labels',
        type: 'symbol',
        source: 'roadside-pax-src',
        minzoom: 11.0,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-offset': [0, -1.2],
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#38bdf8',
          'text-halo-color': '#020617',
          'text-halo-width': 2.5,
        },
      });

      // LAYER: 3D Low-Poly Vehicles
      map.addLayer({
        id: 'vehicles-3d-boxes',
        type: 'fill-extrusion',
        source: 'vehicles-3d-src',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 0.96,
        },
      });

      // LAYER: 2D Vehicle Circle Fallback/Core
      map.addLayer({
        id: 'vehicles-2d-dots',
        type: 'circle',
        source: 'vehicles-points-src',
        paint: {
          'circle-radius': 5.5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f172a',
        },
      });

      // LAYER: Stops Passenger Queue Floating Badge (Above Stop Node)
      map.addLayer({
        id: 'stops-queue-badge',
        type: 'symbol',
        source: 'stops-points-src',
        layout: {
          'text-field': ['get', 'queueBadge'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-offset': [0, -1.2],
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': [
            'case',
            ['boolean', ['get', 'isFull'], false],
            '#f87171',
            ['boolean', ['get', 'isCrowded'], false],
            '#fde047',
            '#4ade80',
          ],
          'text-halo-color': '#020617',
          'text-halo-width': 3,
        },
      });

      // LAYER: Stops Text Labels (Stop Name, Below Stop Node)
      map.addLayer({
        id: 'stops-labels',
        type: 'symbol',
        source: 'stops-points-src',
        layout: {
          'text-field': ['get', 'nameBadge'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 10.5,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#020617',
          'text-halo-width': 2.5,
        },
      });

      // LAYER: Vehicles Live Floating Telemetry Labels
      map.addLayer({
        id: 'vehicles-labels',
        type: 'symbol',
        source: 'vehicles-points-src',
        minzoom: 11.2,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 10,
          'text-offset': [0, -1.5],
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#fef08a',
          'text-halo-width': 2.2,
        },
      });

      // LAYER: Floating On-Map Cash Flow Popups (+Rp Setoran / -Rp BBM & Belanja)
      map.addLayer({
        id: 'cash-popups-layer',
        type: 'symbol',
        source: 'cash-popups-src',
        layout: {
          'text-field': ['get', 'text'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12.5,
          'text-offset': [0, -2.6],
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': [
            'case',
            ['boolean', ['get', 'isPositive'], true],
            '#10b981',
            '#f43f5e',
          ],
          'text-halo-color': '#020617',
          'text-halo-width': 2.2,
        },
      });

      const currentState = useGameStore.getState();
      applyTimeOfDayMapPaint(
        map,
        getEffectiveTimePhase(currentState.gameMinutes, currentState.mapThemeMode)
      );
      syncDataToMap(map, true);
    });

    // Live Catchment + Neighborhood Name Inspection on Mouse Move
    map.on('mousemove', (e) => {
      const state = useGameStore.getState();
      if (state.interactionMode === 'place_stop') {
        map.getCanvas().style.cursor = 'crosshair';
        const previewSrc = map.getSource(
          'hover-stop-preview-src'
        ) as maplibregl.GeoJSONSource;
        if (previewSrc) {
          const circle = turf.circle([e.lngLat.lng, e.lngLat.lat], 0.3, {
            steps: 18,
            units: 'kilometers',
          });
          previewSrc.setData(turf.featureCollection([circle]));
        }

        const now = Date.now();
        if (now - lastInspectMsRef.current >= 80) {
          lastInspectMsRef.current = now;
          const preview = inspectCatchmentAtCursor(
            map,
            e.point,
            [e.lngLat.lng, e.lngLat.lat],
            state.stops,
            state.pendingStopCategory,
            state.currentCityId
          );
          state.setCursorPreview(preview);
        }
        return;
      }

      if (state.interactionMode === 'draw_route') {
        map.getCanvas().style.cursor = 'pointer';

        if (state.draftRouteStopIds.length === 0) {
          lastGhostCandidateIdRef.current = null;
          const ghostSrc = map.getSource('ghost-route-preview-src') as maplibregl.GeoJSONSource;
          if (ghostSrc) ghostSrc.setData(turf.featureCollection([]));
          if (state.ghostPreview) state.setGhostPreview(null);
          return;
        }

        const lastStopId = state.draftRouteStopIds[state.draftRouteStopIds.length - 1];
        const lastStop = state.stops.find((s) => s.id === lastStopId);
        if (!lastStop) return;

        // Query if hovering over or near a StopNode (~22px snap zone)
        const snapBox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - 22, e.point.y - 22],
          [e.point.x + 22, e.point.y + 22],
        ];
        const stopLayers = ['stops-circles', 'stops-3d-pillars'].filter((id) => !!map.getLayer(id));
        const stopFeatures =
          stopLayers.length > 0 ? map.queryRenderedFeatures(snapBox, { layers: stopLayers }) : [];

        let candidateStop: StopNode | null = null;
        if (stopFeatures.length > 0) {
          const rawId = String(stopFeatures[0].properties?.id || '').replace(/-jpo$/, '');
          const found = state.stops.find((s) => s.id === rawId);
          if (found && found.id !== lastStop.id) {
            candidateStop = found;
          }
        }

        const ghostSrc = map.getSource('ghost-route-preview-src') as maplibregl.GeoJSONSource;
        if (!ghostSrc) return;

        if (candidateStop) {
          if (lastGhostCandidateIdRef.current !== candidateStop.id) {
            lastGhostCandidateIdRef.current = candidateStop.id;
            analyzeRouteSegment(lastStop.coords, candidateStop.coords).then((analysis) => {
              if (
                lastGhostCandidateIdRef.current !== candidateStop!.id ||
                useGameStore.getState().interactionMode !== 'draw_route'
              ) {
                return;
              }

              const lineFeat = turf.lineString(analysis.coords, {
                isDetour: analysis.isDetour,
                roadKm: analysis.roadKm,
                straightKm: analysis.straightKm,
              });

              const midIdx = Math.floor(analysis.coords.length / 2);
              const midCoord = analysis.coords[midIdx] || candidateStop!.coords;

              const labelText = analysis.isDetour
                ? `⚠️ MUTER JAUH ${analysis.roadKm} km (Lurus ${analysis.straightKm} km • U-Turn/Satu Arah)`
                : `➔ ${analysis.roadKm} km (~${analysis.estDriveMinutes} mnt)`;

              const pointFeat = turf.point(midCoord, {
                label: labelText,
                isDetour: analysis.isDetour,
              });

              ghostSrc.setData(turf.featureCollection([lineFeat, pointFeat] as any));

              state.setGhostPreview({
                fromStopId: lastStop.id,
                fromStopName: lastStop.name,
                toStopId: candidateStop!.id,
                toStopName: candidateStop!.name,
                roadKm: analysis.roadKm,
                straightKm: analysis.straightKm,
                detourRatio: analysis.detourRatio,
                isDetour: analysis.isDetour,
                estMinutes: analysis.estDriveMinutes,
                source: analysis.source,
              });
            });
          }
        } else {
          lastGhostCandidateIdRef.current = null;
          if (state.ghostPreview) state.setGhostPreview(null);

          const cursorCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          const distKm = Number(turf.distance(lastStop.coords, cursorCoords, { units: 'kilometers' }).toFixed(1));
          if (distKm >= 0.05) {
            const guideLine = turf.lineString([lastStop.coords, cursorCoords], {
              isDetour: false,
              roadKm: distKm,
              straightKm: distKm,
            });
            const guidePoint = turf.point(cursorCoords, {
              label: `${distKm} km (arahkan ke halte)`,
              isDetour: false,
            });
            ghostSrc.setData(turf.featureCollection([guideLine, guidePoint] as any));
          } else {
            ghostSrc.setData(turf.featureCollection([]));
          }
        }
        return;
      }

      if (!isMapLoadedRef.current) return;

      // Default idle map panning mode: check if hovering over interactive markers
      const queryLayers = ['stops-circles', 'vehicles-points', 'depots-circles'].filter(
        (id) => !!map.getLayer(id)
      );
      const features =
        queryLayers.length > 0
          ? map.queryRenderedFeatures(e.point, { layers: queryLayers })
          : [];
      if (features.length > 0) {
        map.getCanvas().style.cursor = 'pointer';
      } else {
        map.getCanvas().style.cursor = '';
      }
    });

    map.on('dragstart', () => {
      const st = useGameStore.getState();
      if (st.interactionMode !== 'place_stop' && st.interactionMode !== 'draw_route') {
        map.getCanvas().style.cursor = 'grabbing';
      }
    });
    map.on('dragend', () => {
      const st = useGameStore.getState();
      if (st.interactionMode !== 'place_stop' && st.interactionMode !== 'draw_route') {
        map.getCanvas().style.cursor = '';
      }
    });

    // Pointer hover for interactive map markers
    map.on('mouseenter', 'stops-circles', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'stops-circles', () => {
      const st = useGameStore.getState();
      map.getCanvas().style.cursor =
        st.interactionMode === 'place_stop'
          ? 'crosshair'
          : st.interactionMode === 'draw_route'
          ? 'pointer'
          : '';
    });
    map.on('mouseenter', 'depots-circles', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'depots-circles', () => {
      const st = useGameStore.getState();
      map.getCanvas().style.cursor =
        st.interactionMode === 'place_stop'
          ? 'crosshair'
          : st.interactionMode === 'draw_route'
          ? 'pointer'
          : '';
    });

    map.on('click', (e) => {
      const state = useGameStore.getState();

      // Check if user clicked on a Pool Depot marker
      const depotLayers = ['depots-circles', 'depots-3d-layer'].filter((id) => !!map.getLayer(id));
      const depotFeatures =
        depotLayers.length > 0
          ? map.queryRenderedFeatures(e.point, { layers: depotLayers })
          : [];
      if (depotFeatures.length > 0 && state.interactionMode === 'view') {
        const depotId = depotFeatures[0].properties?.id;
        if (depotId) {
          state.unlockDepot(depotId);
          syncDataToMap(map, true);
          return;
        }
      }

      // Check if user clicked on a Vehicle
      const vehicleLayers = ['vehicles-3d-boxes', 'vehicles-2d-dots', 'vehicles-labels'].filter((id) => !!map.getLayer(id));
      const vehicleFeatures =
        vehicleLayers.length > 0
          ? map.queryRenderedFeatures(e.point, { layers: vehicleLayers })
          : [];
      if (vehicleFeatures.length > 0 && state.interactionMode === 'view') {
        const rawVId = String(vehicleFeatures[0].properties?.id || '');
        if (rawVId) {
          state.selectVehicle(rawVId);
          state.selectStop(null);
          return;
        }
      }

      // Check if user clicked on a Stop
      const stopLayers = ['stops-circles', 'stops-3d-pillars'].filter((id) => !!map.getLayer(id));
      const stopFeatures =
        stopLayers.length > 0
          ? map.queryRenderedFeatures(e.point, { layers: stopLayers })
          : [];

      if (stopFeatures.length > 0) {
        const rawId = String(stopFeatures[0].properties?.id || '');
        const clickedStopId = rawId.replace(/-jpo$/, '').replace(/-(pad|pole|platform|glass|edge|deck|hall|jpo-tower)$/, '');
        if (clickedStopId) {
          if (state.interactionMode === 'draw_route') {
            state.toggleDraftStop(clickedStopId);
            syncDataToMap(map, true);
            return;
          } else {
            state.selectStop(clickedStopId);
            state.selectVehicle(null);
            syncDataToMap(map, true);
            return;
          }
        }
      }

      if (state.interactionMode === 'place_stop') {
        const inspected = inspectCatchmentAtCursor(
          map,
          e.point,
          [e.lngLat.lng, e.lngLat.lat],
          state.stops,
          state.pendingStopCategory,
          state.currentCityId
        );
        state.addCustomStop([e.lngLat.lng, e.lngLat.lat], {
          detectedAreaName: inspected.detectedAreaName,
          buildingCount: inspected.buildingCount,
          demandTier: inspected.demandTier,
          estimatedWeight: inspected.estimatedWeight,
        });
        const previewSrc = map.getSource(
          'hover-stop-preview-src'
        ) as maplibregl.GeoJSONSource;
        if (previewSrc) {
          previewSrc.setData(turf.featureCollection([]));
        }
        syncDataToMap(map, true);
      } else if (state.interactionMode === 'view') {
        state.selectStop(null);
        state.selectVehicle(null);
        syncDataToMap(map, true);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Multi-City / Reset Camera FlyTo & MaxBounds Sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    const cityPreset = CITY_PRESETS[currentCityId];
    if (!cityPreset) return;

    map.setMaxBounds(null);
    map.setMinZoom(cityPreset.minZoom);
    map.flyTo({
      center: cityPreset.center,
      zoom: cityPreset.defaultZoom,
      pitch: cameraMode === '3d' ? 42 : 0,
      bearing: cameraMode === '3d' ? -14 : 0,
      duration: 1400,
    });
    const timer = window.setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.setMaxBounds(cityPreset.maxBounds);
      }
    }, 1450);
    syncDataToMap(map, true);
    return () => window.clearTimeout(timer);
  }, [currentCityId, mapViewJumpVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    if (interactionMode === 'place_stop') {
      map.getCanvas().style.cursor = 'crosshair';
    } else if (interactionMode === 'draw_route') {
      map.getCanvas().style.cursor = 'pointer';
      const previewSrc = map.getSource(
        'hover-stop-preview-src'
      ) as maplibregl.GeoJSONSource;
      if (previewSrc) {
        previewSrc.setData(turf.featureCollection([]));
      }
    } else {
      map.getCanvas().style.cursor = '';
      const previewSrc = map.getSource(
        'hover-stop-preview-src'
      ) as maplibregl.GeoJSONSource;
      if (previewSrc) {
        previewSrc.setData(turf.featureCollection([]));
      }
      const ghostSrc = map.getSource(
        'ghost-route-preview-src'
      ) as maplibregl.GeoJSONSource;
      if (ghostSrc) {
        ghostSrc.setData(turf.featureCollection([]));
      }
      lastGhostCandidateIdRef.current = null;
    }
  }, [interactionMode]);

  useEffect(() => {
    const unsubscribe = useGameStore.subscribe(() => {
      if (mapRef.current && isMapLoadedRef.current) {
        syncDataToMap(mapRef.current, false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    applyTimeOfDayMapPaint(map, timePhase);
    syncDataToMap(map, true);
  }, [timePhase]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    const showBldgs = show3DBuildings ? 'visible' : 'none';
    if (map.getLayer('poi-buildings-3d-layer')) {
      map.setLayoutProperty('poi-buildings-3d-layer', 'visibility', showBldgs);
    }
    if (map.getLayer('building-3d')) {
      map.setLayoutProperty('building-3d', 'visibility', showBldgs);
    }
    if (map.getLayer('jakarta-3d-buildings')) {
      map.setLayoutProperty('jakarta-3d-buildings', 'visibility', showBldgs);
    }

    if (cameraMode === '3d') {
      map.easeTo({ pitch: 42, bearing: -14, duration: 600 });
      if (map.getLayer('stops-3d-pillars')) {
        map.setLayoutProperty('stops-3d-pillars', 'visibility', 'visible');
      }
      if (map.getLayer('vehicles-3d-boxes')) {
        map.setLayoutProperty('vehicles-3d-boxes', 'visibility', 'visible');
      }
      if (map.getLayer('depots-3d-layer')) {
        map.setLayoutProperty('depots-3d-layer', 'visibility', 'visible');
      }
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      if (map.getLayer('stops-3d-pillars')) {
        map.setLayoutProperty('stops-3d-pillars', 'visibility', 'none');
      }
      if (map.getLayer('vehicles-3d-boxes')) {
        map.setLayoutProperty('vehicles-3d-boxes', 'visibility', 'none');
      }
      if (map.getLayer('depots-3d-layer')) {
        map.setLayoutProperty('depots-3d-layer', 'visibility', 'none');
      }
    }
  }, [cameraMode, show3DBuildings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    const vis = showCatchmentRadius ? 'visible' : 'none';
    if (map.getLayer('catchments-fill')) {
      map.setLayoutProperty('catchments-fill', 'visibility', vis);
    }
    if (map.getLayer('catchments-outline')) {
      map.setLayoutProperty('catchments-outline', 'visibility', vis);
    }
  }, [showCatchmentRadius]);

  const ambientOverlayClass =
    timePhase === 'dawn'
      ? 'bg-gradient-to-b from-amber-500/15 via-sky-500/5 to-transparent'
      : timePhase === 'dusk'
      ? 'bg-gradient-to-b from-orange-600/20 via-rose-500/10 to-indigo-950/20'
      : timePhase === 'night'
      ? 'bg-slate-950/15'
      : 'bg-transparent';

  const weatherOverlayClass =
    weather === 'banjir'
      ? 'bg-sky-900/20'
      : weather === 'hujan'
      ? 'bg-slate-800/15'
      : 'bg-transparent';

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Atmospheric Day/Dusk/Night Lighting Tint */}
      <div
        className={`pointer-events-none absolute inset-0 transition-colors duration-1000 ${ambientOverlayClass}`}
      />

      {/* Dynamic Weather Rain/Flood Tint */}
      <div
        className={`pointer-events-none absolute inset-0 transition-colors duration-700 ${weatherOverlayClass}`}
      />

      {/* PHASE 2 & 3: Live Cursor Ghost Tooltip showing Local Area Name, OSM Buildings & Demand */}
      {interactionMode === 'place_stop' && cursorPreview && (
        <div
          className="pointer-events-none fixed z-30 transition-transform duration-75"
          style={{
            left: `${Math.min(window.innerWidth - 310, cursorPreview.screenX + 20)}px`,
            top: `${Math.max(70, cursorPreview.screenY - 24)}px`,
          }}
        >
          <div className="px-3 py-2 rounded-xl bg-slate-900 border border-cyan-400 shadow-2xl text-xs space-y-1">
            <div className="text-cyan-300 font-extrabold text-xs flex items-center gap-1.5">
              <span>🪧 Calon Nama:</span>
              <span className="text-white underline decoration-cyan-400">
                {cursorPreview.detectedAreaName}
              </span>
            </div>
            <div className="flex items-center gap-2 font-semibold text-slate-200 text-[11px]">
              <span>📍 Jangkauan (300m): ~{cursorPreview.buildingCount} Bangunan</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-300">Potensi Demand:</span>
              <span
                className={`font-extrabold px-1.5 py-0.5 rounded uppercase text-[10px] ${
                  cursorPreview.demandTier === 'Tinggi'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : cursorPreview.demandTier === 'Sedang'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {cursorPreview.demandTier} (~{cursorPreview.estimatedPaxPerHour} pax/jam)
              </span>
            </div>
            {cursorPreview.nearbyTransferStopName && (
              <div className="text-[10px] font-bold text-purple-300 bg-purple-500/20 border border-purple-400/40 px-2 py-0.5 rounded-lg">
                🔄 Terhubung Oper Jalan Kaki (&lt;250m) ke {cursorPreview.nearbyTransferStopName}!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode Banner Overlay */}
      {interactionMode !== 'view' && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-20 max-w-[92vw]">
          <div
            className={`pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-full border shadow-2xl text-xs font-medium transition-colors ${
              ghostPreview?.isDetour
                ? 'bg-amber-950 border-amber-500 text-amber-200'
                : 'bg-slate-900 border-cyan-400 text-cyan-100'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                ghostPreview?.isDetour
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-cyan-400 animate-ping'
              }`}
            />
            {interactionMode === 'place_stop' ? (
              <span>
                <strong>MODE PASANG HALTE (Lv.1 Plang Jalan):</strong> Nama halte otomatis
                menyesuaikan wilayah peta yang kamu tunjuk (Rp 2,5 Jt).
              </span>
            ) : ghostPreview ? (
              <span>
                <strong>GHOST PREVIEW:</strong> {ghostPreview.fromStopName} ➔{' '}
                <strong className="underline underline-offset-2">{ghostPreview.toStopName}</strong> ({ghostPreview.roadKm} km • ~{ghostPreview.estMinutes} mnt)
                {ghostPreview.isDetour && (
                  <span className="ml-2 font-bold text-amber-300 bg-amber-900/70 px-2 py-0.5 rounded border border-amber-500/50">
                    ⚠️ Muter Jauh ({ghostPreview.detourRatio}x dari lurus {ghostPreview.straightKm} km • U-Turn/Satu Arah)
                  </span>
                )}
              </span>
            ) : draftRouteStopIds.length === 0 ? (
              <span>
                <strong>MODE TARIK TRAYEK:</strong> Klik halte pertama di peta untuk memulai rute jalan.
              </span>
            ) : (
              <span>
                <strong>MODE TARIK TRAYEK ({draftRouteStopIds.length} Halte Terpilih):</strong> Arahkan kursor ke halte berikutnya untuk melihat Ghost Preview rute jalan.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

let lastRoutesRef: unknown = null;
let lastSelectedRouteId: string | null = null;
let lastDraftStopsRef: unknown = null;
let lastDraftAnalysisRef: unknown = null;
let lastDepotsRef: unknown = null;
let lastStopsCount = -1;
let lastStopsLevelSignature = '';
let lastTimePhase: TimeOfDayPhase | null = null;
let lastCityId: CityId | null = null;
let lastWeather: WeatherCondition | null = null;
let lastSlowSyncTimeMs = 0;

function syncDataToMap(map: maplibregl.Map, forceAll: boolean) {
  const state = useGameStore.getState();
  const nowMs = Date.now();
  const currentPhase = getEffectiveTimePhase(state.gameMinutes, state.mapThemeMode);

  const routeColorMap: Record<string, string> = {};
  for (const r of state.routes) {
    routeColorMap[r.id] = r.color;
  }

  // 1. Always update live moving vehicles
  if (state.cameraMode === '3d') {
    const vehicles3DSrc = map.getSource('vehicles-3d-src') as maplibregl.GeoJSONSource;
    if (vehicles3DSrc) {
      vehicles3DSrc.setData(buildVehicles3DGeoJSON(state.vehicles, routeColorMap));
    }
  }
  const vehiclesPointsSrc = map.getSource(
    'vehicles-points-src'
  ) as maplibregl.GeoJSONSource;
  if (vehiclesPointsSrc) {
    vehiclesPointsSrc.setData(buildVehiclesPointGeoJSON(state.vehicles));
  }

  const cashPopupsSrc = map.getSource(
    'cash-popups-src'
  ) as maplibregl.GeoJSONSource;
  if (cashPopupsSrc) {
    cashPopupsSrc.setData(buildCashPopupsGeoJSON(state.cashPopups, nowMs));
  }

  // 2. Update Depots when unlocked state changes
  if (forceAll || state.depots !== lastDepotsRef) {
    lastDepotsRef = state.depots;
    const { points: depotPts, boxes3D: depotBoxes } = buildDepotsGeoJSON(state.depots);
    const depotsPtsSrc = map.getSource('depots-points-src') as maplibregl.GeoJSONSource;
    if (depotsPtsSrc) depotsPtsSrc.setData(depotPts);
    const depots3DSrc = map.getSource('depots-3d-src') as maplibregl.GeoJSONSource;
    if (depots3DSrc) depots3DSrc.setData(depotBoxes);
  }

  // 3. Update 3D POI & Landmark Buildings + Hotspots + Flood Zones when stops, city, weather, or timePhase changes
  if (
    forceAll ||
    state.stops.length !== lastStopsCount ||
    currentPhase !== lastTimePhase ||
    state.currentCityId !== lastCityId ||
    state.weather !== lastWeather
  ) {
    lastStopsCount = state.stops.length;
    lastTimePhase = currentPhase;
    lastCityId = state.currentCityId;
    lastWeather = state.weather;

    const poiBldgSrc = map.getSource(
      'poi-buildings-3d-src'
    ) as maplibregl.GeoJSONSource;
    if (poiBldgSrc) {
      poiBldgSrc.setData(
        buildPOIBuildings3DGeoJSON(state.stops, currentPhase, state.currentCityId)
      );
    }

    const cityPreset = CITY_PRESETS[state.currentCityId];

    const hotspotsSrc = map.getSource('hotspots-src') as maplibregl.GeoJSONSource;
    if (hotspotsSrc && cityPreset) {
      hotspotsSrc.setData(buildHotspotsGeoJSON(cityPreset.hotspots, state.stops));
    }

    const floodGeo = buildFloodZonesGeoJSON(
      cityPreset ? cityPreset.floodZones : [],
      state.weather
    );
    const floodPolySrc = map.getSource('flood-zones-src') as maplibregl.GeoJSONSource;
    if (floodPolySrc) {
      floodPolySrc.setData(floodGeo.polygons);
    }
    const floodPtSrc = map.getSource(
      'flood-zones-points-src'
    ) as maplibregl.GeoJSONSource;
    if (floodPtSrc) {
      floodPtSrc.setData(floodGeo.points);
    }
  }

  // 4. Only update Routes & Transfer Links when routes or stops change
  if (
    forceAll ||
    state.routes !== lastRoutesRef ||
    state.selectedRouteId !== lastSelectedRouteId
  ) {
    lastRoutesRef = state.routes;
    lastSelectedRouteId = state.selectedRouteId;

    const routeFeatures = state.routes.map((r) => ({
      ...r.geometry,
      properties: {
        id: r.id,
        code: r.code,
        color: r.color,
        isSelected: r.id === state.selectedRouteId,
        dedicatedLaneEnabled: r.dedicatedLaneEnabled,
      },
    }));
    const routesSrc = map.getSource('routes-src') as maplibregl.GeoJSONSource;
    if (routesSrc) {
      routesSrc.setData(turf.featureCollection(routeFeatures));
    }

    const { links } = detectTransferLinks(state.routes, state.stops);
    const transferSrc = map.getSource('transfer-links-src') as maplibregl.GeoJSONSource;
    if (transferSrc) {
      transferSrc.setData(buildTransferLinksGeoJSON(links));
    }
  }

  // 5. Update Draft Route line (Strictly Road-Snapped!)
  if (
    forceAll ||
    state.draftRouteStopIds !== lastDraftStopsRef ||
    state.draftRouteAnalysis !== lastDraftAnalysisRef
  ) {
    lastDraftStopsRef = state.draftRouteStopIds;
    lastDraftAnalysisRef = state.draftRouteAnalysis;
    const draftSrc = map.getSource('draft-route-src') as maplibregl.GeoJSONSource;
    if (draftSrc) {
      if (state.draftRouteStopIds.length >= 2) {
        if (state.draftRouteAnalysis?.roadSnappedGeometry) {
          draftSrc.setData(
            turf.featureCollection([state.draftRouteAnalysis.roadSnappedGeometry])
          );
        } else {
          const orderedStops = state.draftRouteStopIds
            .map((id) => state.stops.find((s) => s.id === id))
            .filter((s): s is StopNode => Boolean(s));
          if (orderedStops.length >= 2) {
            buildRoadSnappedRoute(orderedStops).then((res) => {
              const currentDraftSrc = map.getSource('draft-route-src') as maplibregl.GeoJSONSource;
              if (
                currentDraftSrc &&
                useGameStore.getState().interactionMode === 'draw_route'
              ) {
                currentDraftSrc.setData(turf.featureCollection([res.geometry]));
              }
            });
          }
        }
      } else {
        draftSrc.setData(turf.featureCollection([]));
      }
    }
  }

  // 6. Throttle Stops & Roadside Passengers updates to once every 500ms (or immediately on stop level upgrade!)
  const currentLevelSig = state.stops.map((s) => `${s.id}:${s.level}`).join('|');
  if (
    forceAll ||
    currentLevelSig !== lastStopsLevelSignature ||
    nowMs - lastSlowSyncTimeMs >= 500
  ) {
    lastSlowSyncTimeMs = nowMs;
    lastStopsLevelSignature = currentLevelSig;

    const selectedIds =
      state.interactionMode === 'draw_route'
        ? state.draftRouteStopIds
        : state.selectedStopId
        ? [state.selectedStopId]
        : [];

    const { transferStopIds } = detectTransferLinks(state.routes, state.stops);
    const { points, catchments, pillars } = buildStopsGeoJSON(
      state.stops,
      selectedIds,
      transferStopIds
    );

    const stopsPointsSrc = map.getSource('stops-points-src') as maplibregl.GeoJSONSource;
    if (stopsPointsSrc) stopsPointsSrc.setData(points);

    const catchmentsSrc = map.getSource('catchments-src') as maplibregl.GeoJSONSource;
    if (catchmentsSrc) catchmentsSrc.setData(catchments);

    if (state.cameraMode === '3d') {
      const pillarsSrc = map.getSource('stops-pillars-src') as maplibregl.GeoJSONSource;
      if (pillarsSrc) pillarsSrc.setData(pillars);
    }

    const roadsideSrc = map.getSource('roadside-pax-src') as maplibregl.GeoJSONSource;
    if (roadsideSrc) {
      roadsideSrc.setData(buildRoadsidePassengersGeoJSON(state.roadsidePassengers));
    }
  }
}

function applyTimeOfDayMapPaint(map: maplibregl.Map, phase: TimeOfDayPhase) {
  const palette = {
    dawn: {
      bg: '#e2e8f0',
      water: '#93c5fd',
      building: '#94a3b8',
      park: '#dcfce7',
      roadFill: '#ffffff',
      roadCase: '#cbd5e1',
      labelColor: '#1e293b',
      labelHalo: '#ffffff',
      stopText: '#0f172a',
      stopHalo: '#f8fafc',
    },
    day: {
      bg: '#f1f5f9',
      water: '#bae6fd',
      building: '#94a3b8',
      park: '#dcfce7',
      roadFill: '#ffffff',
      roadCase: '#cbd5e1',
      labelColor: '#1e293b',
      labelHalo: '#ffffff',
      stopText: '#0f172a',
      stopHalo: '#ffffff',
    },
    dusk: {
      bg: '#cbd5e1',
      water: '#60a5fa',
      building: '#64748b',
      park: '#bbf7d0',
      roadFill: '#f8fafc',
      roadCase: '#94a3b8',
      labelColor: '#0f172a',
      labelHalo: '#fef3c7',
      stopText: '#0f172a',
      stopHalo: '#fef3c7',
    },
    night: {
      bg: '#0f172a',
      water: '#111c2e',
      building: '#1e293b',
      park: '#062d22',
      roadFill: '#243347',
      roadCase: '#0d1522',
      labelColor: '#f8fafc',
      labelHalo: '#020617',
      stopText: '#f8fafc',
      stopHalo: '#020617',
    },
  }[phase];

  const style = map.getStyle();
  if (!style || !style.layers) return;

  for (const layer of style.layers) {
    try {
      // 1. ALL TEXT & SYMBOL LAYERS (Road names, river names, place names, POIs, suburban districts)
      if (layer.type === 'symbol') {
        if (
          !layer.id.startsWith('stops-') &&
          !layer.id.startsWith('vehicles-') &&
          !layer.id.startsWith('depots-') &&
          !layer.id.startsWith('hotspots-') &&
          !layer.id.startsWith('cash-') &&
          !layer.id.startsWith('flood-') &&
          !layer.id.startsWith('roadside-') &&
          !layer.id.startsWith('hover-')
        ) {
          map.setPaintProperty(layer.id, 'text-color', palette.labelColor);
          map.setPaintProperty(layer.id, 'text-halo-color', palette.labelHalo);
          map.setPaintProperty(
            layer.id,
            'text-halo-width',
            phase === 'night' ? 2.5 : 1.8
          );
          map.setPaintProperty(layer.id, 'text-halo-blur', 0.5);
        }
      }

      // 2. LINE LAYERS (Roads, highways, flyover bridges, tunnels, railways)
      else if (layer.type === 'line') {
        if (
          !layer.id.startsWith('routes-') &&
          !layer.id.startsWith('transfer-') &&
          !layer.id.startsWith('draft-') &&
          !layer.id.startsWith('flood-') &&
          !layer.id.startsWith('catchments-') &&
          !layer.id.startsWith('hover-')
        ) {
          if (
            layer.id.includes('road') ||
            layer.id.includes('highway') ||
            layer.id.includes('bridge') ||
            layer.id.includes('tunnel') ||
            layer.id.includes('rail')
          ) {
            const isCase = layer.id.includes('case');
            map.setPaintProperty(
              layer.id,
              'line-color',
              phase === 'night'
                ? isCase
                  ? palette.roadCase
                  : palette.roadFill
                : isCase
                ? palette.roadCase
                : palette.roadFill
            );
          }
        }
      }

      // 3. FILL LAYERS (Water bodies, parks/green spaces, base buildings)
      else if (layer.type === 'fill') {
        if (
          !layer.id.startsWith('flood-') &&
          !layer.id.startsWith('catchments-') &&
          !layer.id.startsWith('hover-')
        ) {
          if (layer.id.includes('water')) {
            map.setPaintProperty(layer.id, 'fill-color', palette.water);
          } else if (
            layer.id.includes('landcover') ||
            layer.id.includes('park') ||
            layer.id.includes('landuse')
          ) {
            map.setPaintProperty(layer.id, 'fill-color', palette.park);
          } else if (
            layer.id.includes('building') &&
            layer.id !== 'jakarta-3d-buildings' &&
            layer.id !== 'building-3d' &&
            layer.id !== 'poi-buildings-3d-layer' &&
            layer.id !== 'depots-3d-layer'
          ) {
            // Opsi A: Keep 2D residential houses hidden to maintain silky 60 FPS performance
            map.setLayoutProperty(layer.id, 'visibility', 'none');
          }
        }
      }

      // 4. BACKGROUND CANVAS
      else if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', palette.bg);
      }
    } catch {
      // Ignore layers that don't support simple color overrides
    }
  }

  // 5. UPDATE GAME-SPECIFIC 3D & SYMBOL OVERLAYS
  const bldg3dId = map.getLayer('building-3d')
    ? 'building-3d'
    : map.getLayer('jakarta-3d-buildings')
    ? 'jakarta-3d-buildings'
    : null;

  if (bldg3dId) {
    if (phase === 'night') {
      map.setPaintProperty(bldg3dId, 'fill-extrusion-color', [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'render_height'], 25],
        25,
        '#1e293b',
        60,
        '#0f3a61',
        120,
        '#0284c7',
      ]);
      map.setPaintProperty(bldg3dId, 'fill-extrusion-opacity', 0.92);
    } else if (phase === 'dusk') {
      map.setPaintProperty(bldg3dId, 'fill-extrusion-color', [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'render_height'], 25],
        25,
        '#475569',
        60,
        '#1e40af',
        120,
        '#0284c7',
      ]);
      map.setPaintProperty(bldg3dId, 'fill-extrusion-opacity', 0.88);
    } else {
      map.setPaintProperty(bldg3dId, 'fill-extrusion-color', [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'render_height'], 25],
        25,
        '#64748b',
        55,
        '#0284c7',
        110,
        '#38bdf8',
      ]);
      map.setPaintProperty(bldg3dId, 'fill-extrusion-opacity', 0.88);
    }
  }

  // Dynamic Sun Light Direction & Intensity per Phase
  try {
    if (phase === 'night') {
      map.setLight({
        anchor: 'map',
        color: '#38bdf8',
        intensity: 0.25,
        position: [1.3, 210, 20],
      });
    } else if (phase === 'dusk') {
      map.setLight({
        anchor: 'map',
        color: '#f59e0b',
        intensity: 0.58,
        position: [1.3, 250, 24],
      });
    } else if (phase === 'dawn') {
      map.setLight({
        anchor: 'map',
        color: '#fed7aa',
        intensity: 0.55,
        position: [1.3, 70, 30],
      });
    } else {
      map.setLight({
        anchor: 'map',
        color: '#ffffff',
        intensity: 0.55,
        position: [1.3, 210, 42],
      });
    }
  } catch {
    // Ignore if setLight is not supported
  }

  if (map.getLayer('stops-labels')) {
    map.setPaintProperty('stops-labels', 'text-color', palette.stopText);
    map.setPaintProperty('stops-labels', 'text-halo-color', palette.stopHalo);
    map.setPaintProperty('stops-labels', 'text-halo-width', phase === 'night' ? 2.5 : 2);
  }

  if (map.getLayer('stops-queue-badge')) {
    map.setPaintProperty(
      'stops-queue-badge',
      'text-halo-color',
      phase === 'night' ? '#020617' : '#0f172a'
    );
    map.setPaintProperty('stops-queue-badge', 'text-halo-width', 3.0);
  }

  if (map.getLayer('depots-labels')) {
    map.setPaintProperty(
      'depots-labels',
      'text-color',
      phase === 'night' ? '#fef08a' : '#0f172a'
    );
    map.setPaintProperty(
      'depots-labels',
      'text-halo-color',
      phase === 'night' ? '#020617' : '#fef08a'
    );
    map.setPaintProperty('depots-labels', 'text-halo-width', 2.0);
  }

  if (map.getLayer('hotspots-labels')) {
    map.setPaintProperty(
      'hotspots-labels',
      'text-color',
      phase === 'night' ? '#fde047' : '#0f172a'
    );
    map.setPaintProperty(
      'hotspots-labels',
      'text-halo-color',
      phase === 'night' ? '#020617' : '#fef08a'
    );
    map.setPaintProperty('hotspots-labels', 'text-halo-width', 2.0);
  }

  if (map.getLayer('roadside-pax-labels')) {
    map.setPaintProperty(
      'roadside-pax-labels',
      'text-color',
      phase === 'night' ? '#38bdf8' : '#0e7490'
    );
    map.setPaintProperty(
      'roadside-pax-labels',
      'text-halo-color',
      phase === 'night' ? '#020617' : '#ffffff'
    );
    map.setPaintProperty('roadside-pax-labels', 'text-halo-width', 2.0);
  }
}
