// Solmar Bay — seeded procedural city: a road grid, districts, buildings and a
// road graph for traffic, police and missions. Generation is pure data (a tile
// grid + lists), so it runs without Phaser and replays from one seed.
//
// Layout: 96x96 tiles of 32px (3072x3072 world). Roads are 2 tiles wide on an
// 8-tile pitch; blocks are 6x6 interiors. East edge is beach + water.
import { Rng } from './rng.js';

export const TILE = 32;
export const WORLD_W = 96;
export const WORLD_H = 96;
export const WORLD_PX = WORLD_W * TILE;

// Tile ids (see assets.js tileset, same order).
export const T = {
  GRASS: 0, ROAD: 1, ROAD_H: 2, ROAD_V: 3, CROSS: 4, WALK: 5,
  SAND: 6, WATER: 7, PARK: 8, PARKING: 9, CROSS_H: 10, CROSS_V: 11, PLAZA: 12,
};

const BLOCK = 8; // road pitch in tiles
const ROAD_W = 2; // road width in tiles

function isRoadLine(i) {
  return i % BLOCK < ROAD_W;
}

export function generateCity(seed) {
  const rng = new Rng(seed);
  const grid = new Uint8Array(WORLD_W * WORLD_H);
  const buildings = [];
  const parks = new Set();

  // District of a block (bx, by in 0..11).
  function district(bx, by) {
    const cx = bx - 6, cy = by - 6;
    if (bx >= 10) return 'beach';
    if (Math.abs(cx) <= 2 && Math.abs(cy) <= 2) return 'downtown';
    if (by >= 9) return 'industrial';
    if (by <= 2) return 'residential';
    return 'mixed';
  }

  // Pick park blocks (seeded, away from landmarks).
  const parkBlocks = [];
  while (parkBlocks.length < 5) {
    const bx = rng.range(1, 10), by = rng.range(1, 10);
    const key = bx + ',' + by;
    if (district(bx, by) === 'beach' || district(bx, by) === 'downtown') continue;
    if (!parkBlocks.includes(key)) parkBlocks.push(key);
  }
  for (const k of parkBlocks) parks.add(k);

  // Base terrain + roads.
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      let t = T.GRASS;
      if (x >= 92) t = T.WATER;
      else if (x >= 88) t = T.SAND;
      else if (isRoadLine(x) || isRoadLine(y)) t = T.ROAD;
      grid[y * WORLD_W + x] = t;
    }
  }

  // Sidewalks: the outer ring of every block interior.
  for (let by = 0; by < 12; by++) {
    for (let bx = 0; bx < 12; bx++) {
      if (bx >= 11) continue; // beach columns
      const x0 = bx * BLOCK + ROAD_W, y0 = by * BLOCK + ROAD_W;
      for (let y = y0; y < y0 + 6; y++) {
        for (let x = x0; x < x0 + 6; x++) {
          if (x >= 88 || y >= WORLD_H) continue;
          const ring = x === x0 || y === y0 || x === x0 + 5 || y === y0 + 5;
          if (ring) grid[y * WORLD_W + x] = T.WALK;
        }
      }
    }
  }

  // Parks and the central plaza.
  for (const key of parks) {
    const [bx, by] = key.split(',').map(Number);
    const x0 = bx * BLOCK + ROAD_W, y0 = by * BLOCK + ROAD_W;
    for (let y = y0 + 1; y < y0 + 5; y++) {
      for (let x = x0 + 1; x < x0 + 5; x++) grid[y * WORLD_W + x] = T.PARK;
    }
  }
  for (let y = 47; y <= 48; y++) for (let x = 47; x <= 48; x++) grid[y * WORLD_W + x] = T.PLAZA;

  // Road tiles: lane lines and intersections.
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      if (grid[y * WORLD_W + x] !== T.ROAD) continue;
      const h = x + 1 < WORLD_W && grid[y * WORLD_W + x + 1] === T.ROAD;
      const v = y + 1 < WORLD_H && grid[(y + 1) * WORLD_W + x] === T.ROAD;
      const hl = x > 0 && grid[y * WORLD_W + x - 1] === T.ROAD;
      const vu = y > 0 && grid[(y - 1) * WORLD_W + x] === T.ROAD;
      if ((h || hl) && (v || vu)) grid[y * WORLD_W + x] = T.CROSS;
      else if (h || hl) grid[y * WORLD_W + x] = T.ROAD_H;
      else grid[y * WORLD_W + x] = T.ROAD_V;
    }
  }

  // Buildings: 1-4 per block interior, seeded sizes, kept off roads/sidewalks.
  const roofKinds = ['flat', 'house', 'tower', 'shop', 'warehouse'];
  for (let by = 0; by < 12; by++) {
    for (let bx = 0; bx < 12; bx++) {
      if (bx >= 11) continue;
      const key = bx + ',' + by;
      if (parks.has(key)) continue;
      const d = district(bx, by);
      const x0 = (bx * BLOCK + ROAD_W + 1) * TILE, y0 = (by * BLOCK + ROAD_W + 1) * TILE;
      const inner = 4 * TILE;
      const count = d === 'downtown' ? rng.range(1, 2) : rng.range(1, 3);
      const brng = rng.child(bx * 31 + by * 7 + 3);
      let placed = 0, guard = 0;
      while (placed < count && guard++ < 12) {
        const w = brng.range(48, d === 'downtown' ? 110 : 80);
        const h = brng.range(48, d === 'downtown' ? 110 : 80);
        const x = x0 + brng.range(0, Math.max(0, inner - w));
        const y = y0 + brng.range(0, Math.max(0, inner - h));
        const rect = { x, y, w, h };
        const overlap = buildings.some(b => rectsOverlap(b, rect, 8));
        if (overlap) continue;
        const roof = d === 'downtown' ? brng.pick(['tower', 'flat', 'tower', 'shop'])
          : d === 'residential' ? brng.pick(['house', 'house', 'flat'])
          : d === 'industrial' ? 'warehouse'
          : brng.pick(roofKinds);
        buildings.push({ ...rect, roof, district: d, tint: brng.pick([0xffffff, 0xf5e6c8, 0xdfe8f5, 0xf5d5c8, 0xd8f5d0]) });
        placed++;
      }
      // Parking lots in industrial / mixed blocks.
      if ((d === 'industrial' || d === 'mixed') && rng.chance(0.5)) {
        const px0 = x0 + rng.range(0, 64), py0 = y0 + rng.range(0, 64);
        for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) {
          const gx = Math.floor(px0 / TILE) + x, gy = Math.floor(py0 / TILE) + y;
          if (gx < 88 && grid[gy * WORLD_W + gx] === T.GRASS) grid[gy * WORLD_W + gx] = T.PARKING;
        }
      }
    }
  }

  // Landmarks (fixed, reachable from roads).
  const landmarks = {
    garage: { x: 2 * BLOCK * TILE + 96, y: 6 * BLOCK * TILE + 96, label: "Rosa's Garage" },
    hospital: { x: 6 * BLOCK * TILE + 96, y: 1 * BLOCK * TILE + 96, label: 'Solmar General' },
    policeHQ: { x: 5 * BLOCK * TILE + 96, y: 5 * BLOCK * TILE + 96, label: 'SBPD HQ' },
    bank: { x: 6 * BLOCK * TILE + 96, y: 6 * BLOCK * TILE + 96, label: 'Bay National Bank' },
    diner: { x: 3 * BLOCK * TILE + 96, y: 4 * BLOCK * TILE + 96, label: "Mama Rosa's Diner" },
    plaza: { x: 47.5 * TILE, y: 47.5 * TILE, label: 'Solmar Plaza' },
    marina: { x: 87 * TILE, y: 48 * TILE, label: 'Solmar Marina' },
    airport: { x: 10 * BLOCK * TILE + 96, y: 10 * BLOCK * TILE + 96, label: 'Solmar Airfield' },
  };

  // Road graph: intersections every 8 tiles (12x12 nodes).
  const nodes = [];
  for (let iy = 0; iy < 12; iy++) {
    for (let ix = 0; ix < 12; ix++) {
      nodes.push({ x: (ix * BLOCK + 1) * TILE, y: (iy * BLOCK + 1) * TILE, ix, iy });
    }
  }

  const city = { seed, grid, buildings, landmarks, nodes, parks: [...parks] };
  validateCity(city);
  return city;
}

function rectsOverlap(a, b, pad) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

// Flood-fill over road cells from the garage: every road cell must connect.
function validateCity(city) {
  const { grid } = city;
  const seen = new Uint8Array(WORLD_W * WORLD_H);
  const start = 1 * WORLD_W + 1;
  const stack = [start];
  seen[start] = 1;
  let reached = 0;
  while (stack.length) {
    const c = stack.pop();
    reached++;
    const x = c % WORLD_W, y = Math.floor(c / WORLD_W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H) continue;
      const n = ny * WORLD_W + nx;
      if (seen[n]) continue;
      const t = grid[n];
      if (t === T.ROAD || t === T.ROAD_H || t === T.ROAD_V || t === T.CROSS) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  let total = 0;
  for (let i = 0; i < grid.length; i++) {
    const t = grid[i];
    if (t === T.ROAD || t === T.ROAD_H || t === T.ROAD_V || t === T.CROSS) total++;
  }
  city.roadReachable = reached;
  city.roadTotal = total;
  city.connected = reached === total;
}

// ---- Queries (all take the city object) ----

export function tileAt(city, px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return T.WATER;
  return city.grid[ty * WORLD_W + tx];
}

export function isRoadTile(t) {
  return t === T.ROAD || t === T.ROAD_H || t === T.ROAD_V || t === T.CROSS;
}

export function isDriveable(city, px, py) {
  return isRoadTile(tileAt(city, px, py));
}

export function isWalkable(city, px, py) {
  const t = tileAt(city, px, py);
  if (t === T.WATER) return false;
  for (const b of city.buildings) {
    if (px > b.x - 4 && px < b.x + b.w + 4 && py > b.y - 4 && py < b.y + b.h + 4) return false;
  }
  return true;
}

export function nearestNode(city, px, py) {
  let best = city.nodes[0], bd = Infinity;
  for (const n of city.nodes) {
    const d = (n.x - px) ** 2 + (n.y - py) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

export function randomRoadPoint(city, rng) {
  const n = rng.pick(city.nodes);
  return { x: n.x + rng.range(-40, 40), y: n.y + rng.range(-40, 40) };
}

// A* over the intersection graph; returns waypoints (px) from start to goal.
export function findPath(city, fromX, fromY, toX, toY) {
  const start = nearestNode(city, fromX, fromY);
  const goal = nearestNode(city, toX, toY);
  const key = n => n.iy * 12 + n.ix;
  const open = [start];
  const came = new Map();
  const g = new Map([[key(start), 0]]);
  const h = n => Math.abs(n.ix - goal.ix) + Math.abs(n.iy - goal.iy);
  const f = new Map([[key(start), h(start)]]);
  const closed = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if ((f.get(key(open[i])) ?? 1e9) < (f.get(key(open[bi])) ?? 1e9)) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === goal) {
      const path = [{ x: goal.x, y: goal.y }];
      let c = goal;
      while (came.has(key(c))) { c = came.get(key(c)); path.unshift({ x: c.x, y: c.y }); }
      path.push({ x: toX, y: toY });
      return path;
    }
    closed.add(key(cur));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.ix + dx, ny = cur.iy + dy;
      if (nx < 0 || ny < 0 || nx > 11 || ny > 11) continue;
      const nb = city.nodes[ny * 12 + nx];
      if (closed.has(key(nb))) continue;
      const ng = (g.get(key(cur)) ?? 1e9) + 1;
      if (ng < (g.get(key(nb)) ?? 1e9)) {
        came.set(key(nb), cur);
        g.set(key(nb), ng);
        f.set(key(nb), ng + h(nb));
        if (!open.includes(nb)) open.push(nb);
      }
    }
  }
  return [{ x: toX, y: toY }];
}
