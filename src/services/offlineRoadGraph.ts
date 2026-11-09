import * as turf from '@turf/turf';

interface GraphNode {
  id: string;
  coords: [number, number]; // Strictly [lng, lat]
}

// Key arterial intersections across Central Jakarta
const JAKARTA_ROAD_NODES: GraphNode[] = [
  { id: 'n-harmoni', coords: [106.8203, -6.1660] },
  { id: 'n-monas-barat', coords: [106.8218, -6.1755] },
  { id: 'n-sarinah', coords: [106.8235, -6.1872] },
  { id: 'n-bundaran-hi', coords: [106.8230, -6.1950] },
  { id: 'n-dukuh-atas', coords: [106.8228, -6.2046] },
  { id: 'n-karet-sudirman', coords: [106.8195, -6.2135] },
  { id: 'n-tanah-abang', coords: [106.8108, -6.1857] },
  { id: 'n-cideng', coords: [106.8115, -6.1735] },
  { id: 'n-karet-bivak', coords: [106.8135, -6.2015] },
  { id: 'n-kebon-sirih', coords: [106.8305, -6.1835] },
  { id: 'n-tugu-tani', coords: [106.8365, -6.1823] },
  { id: 'n-kwitang', coords: [106.8405, -6.1802] },
  { id: 'n-senen', coords: [106.8441, -6.1747] },
  { id: 'n-kramat', coords: [106.8482, -6.1865] },
  { id: 'n-salemba', coords: [106.8518, -6.1925] },
  { id: 'n-matraman', coords: [106.8548, -6.1965] },
  { id: 'n-diponegoro', coords: [106.8465, -6.1995] },
  { id: 'n-cikini', coords: [106.8413, -6.1984] },
  { id: 'n-menteng', coords: [106.8335, -6.1955] },
  { id: 'n-imam-bonjol', coords: [106.8315, -6.2005] },
  { id: 'n-manggarai', coords: [106.8502, -6.2098] },
  { id: 'n-sultan-agung', coords: [106.8385, -6.2080] },
  { id: 'n-halimun', coords: [106.8318, -6.2075] },
  { id: 'n-kuningan-utara', coords: [106.8320, -6.2135] },
  { id: 'n-kuningan-rasuna', coords: [106.8323, -6.2202] },
  { id: 'n-casablanca', coords: [106.8425, -6.2215] },
  { id: 'n-tebet-barat', coords: [106.8495, -6.2210] },
];

// Bidirectional arterial road connections
const JAKARTA_ROAD_EDGES: [string, string][] = [
  // Thamrin - Sudirman Spine
  ['n-harmoni', 'n-monas-barat'],
  ['n-monas-barat', 'n-sarinah'],
  ['n-sarinah', 'n-bundaran-hi'],
  ['n-bundaran-hi', 'n-dukuh-atas'],
  ['n-dukuh-atas', 'n-karet-sudirman'],
  // Tanah Abang - Cideng - Karet West Wing
  ['n-harmoni', 'n-cideng'],
  ['n-cideng', 'n-tanah-abang'],
  ['n-tanah-abang', 'n-sarinah'],
  ['n-tanah-abang', 'n-bundaran-hi'],
  ['n-tanah-abang', 'n-karet-bivak'],
  ['n-karet-bivak', 'n-dukuh-atas'],
  // Kebon Sirih - Tugu Tani - Kwitang - Senen
  ['n-monas-barat', 'n-tugu-tani'],
  ['n-sarinah', 'n-kebon-sirih'],
  ['n-kebon-sirih', 'n-tugu-tani'],
  ['n-tugu-tani', 'n-kwitang'],
  ['n-kwitang', 'n-senen'],
  // Senen - Kramat - Salemba - Matraman - Manggarai East Spine
  ['n-senen', 'n-kramat'],
  ['n-kwitang', 'n-kramat'],
  ['n-kramat', 'n-salemba'],
  ['n-salemba', 'n-matraman'],
  ['n-matraman', 'n-diponegoro'],
  ['n-matraman', 'n-manggarai'],
  // Menteng - Cikini - Diponegoro Center
  ['n-tugu-tani', 'n-cikini'],
  ['n-kebon-sirih', 'n-menteng'],
  ['n-bundaran-hi', 'n-menteng'],
  ['n-bundaran-hi', 'n-imam-bonjol'],
  ['n-menteng', 'n-cikini'],
  ['n-menteng', 'n-imam-bonjol'],
  ['n-imam-bonjol', 'n-diponegoro'],
  ['n-cikini', 'n-diponegoro'],
  ['n-cikini', 'n-manggarai'],
  ['n-diponegoro', 'n-manggarai'],
  // Manggarai - Sultan Agung - Dukuh Atas - Kuningan South Link
  ['n-manggarai', 'n-sultan-agung'],
  ['n-sultan-agung', 'n-halimun'],
  ['n-halimun', 'n-dukuh-atas'],
  ['n-imam-bonjol', 'n-halimun'],
  ['n-halimun', 'n-kuningan-utara'],
  ['n-dukuh-atas', 'n-kuningan-utara'],
  ['n-kuningan-utara', 'n-kuningan-rasuna'],
  ['n-karet-sudirman', 'n-kuningan-rasuna'],
  ['n-kuningan-rasuna', 'n-casablanca'],
  ['n-casablanca', 'n-tebet-barat'],
  ['n-tebet-barat', 'n-manggarai'],
];

const nodeMap = new Map<string, GraphNode>(
  JAKARTA_ROAD_NODES.map((n) => [n.id, n])
);

const adjacency = new Map<string, { to: string; weightKm: number }[]>();
for (const n of JAKARTA_ROAD_NODES) {
  adjacency.set(n.id, []);
}
for (const [a, b] of JAKARTA_ROAD_EDGES) {
  const na = nodeMap.get(a);
  const nb = nodeMap.get(b);
  if (na && nb) {
    const dist = turf.distance(na.coords, nb.coords, { units: 'kilometers' });
    adjacency.get(a)!.push({ to: b, weightKm: dist });
    adjacency.get(b)!.push({ to: a, weightKm: dist });
  }
}

function findNearestGraphNode(coords: [number, number]): GraphNode {
  let best = JAKARTA_ROAD_NODES[0];
  let bestDist = Infinity;
  for (const n of JAKARTA_ROAD_NODES) {
    const d = turf.distance(coords, n.coords, { units: 'kilometers' });
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}

/**
 * Offline client-side Dijkstra shortest path across Central Jakarta arterial roads.
 * Used as an instant offline fallback when OSRM is unreachable or rate-limited.
 */
export function findOfflineJakartaRoute(
  from: [number, number],
  to: [number, number]
): [number, number][] {
  const directDistKm = turf.distance(from, to, { units: 'kilometers' });
  if (directDistKm < 0.35) {
    return [from, to];
  }

  const startNode = findNearestGraphNode(from);
  const endNode = findNearestGraphNode(to);

  if (startNode.id === endNode.id) {
    return [from, startNode.coords, to];
  }

  const dists = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const unvisited = new Set<string>();

  for (const n of JAKARTA_ROAD_NODES) {
    dists.set(n.id, Infinity);
    prev.set(n.id, null);
    unvisited.add(n.id);
  }
  dists.set(startNode.id, 0);

  while (unvisited.size > 0) {
    let u: string | null = null;
    let smallest = Infinity;
    for (const id of unvisited) {
      const d = dists.get(id)!;
      if (d < smallest) {
        smallest = d;
        u = id;
      }
    }

    if (!u || u === endNode.id || smallest === Infinity) break;
    unvisited.delete(u);

    for (const neighbor of adjacency.get(u) || []) {
      if (!unvisited.has(neighbor.to)) continue;
      const alt = smallest + neighbor.weightKm;
      if (alt < dists.get(neighbor.to)!) {
        dists.set(neighbor.to, alt);
        prev.set(neighbor.to, u);
      }
    }
  }

  const pathCoords: [number, number][] = [];
  let curr: string | null = endNode.id;
  while (curr) {
    const node = nodeMap.get(curr);
    if (node) pathCoords.unshift(node.coords);
    curr = prev.get(curr) || null;
  }

  // Ensure start and end exact stop coordinates are included cleanly
  const result: [number, number][] = [from];
  for (const pt of pathCoords) {
    const dFromStart = turf.distance(from, pt, { units: 'kilometers' });
    const dFromEnd = turf.distance(to, pt, { units: 'kilometers' });
    if (dFromStart > 0.08 && dFromEnd > 0.08) {
      result.push(pt);
    }
  }
  result.push(to);

  return result;
}
