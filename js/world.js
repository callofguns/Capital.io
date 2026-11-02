// =============================================================
//  world.js — builds the city map and finds walking paths
// =============================================================

// Tile types
const T = { GRASS: 0, FIELD: 1, ROAD: 2, DIRT: 3, SIDEWALK: 4, CROSS: 5, BUILDING: 6, TREE: 7, WATER: 8, PATH: 9, PLAZA: 10 };

const World = {
  seed: 0,
  tiles: null,        // one number per tile (see T above)
  plotAt: null,       // which plot id covers each tile (-1 = none)
  buildingAt: null,   // which building id covers each tile (-1 = none)
  buildings: [], plots: [], trees: [], rivals: [], fountains: [],
  pedTiles: [],       // tiles people can walk on (sidewalks etc.)
  lanes: [],          // car lanes
  lamps: [],          // street lamp positions (for night lights)
  spawn: { x: 41, y: 33 },
  starterCart: { x: 43, y: 35 },
  canvas: null,       // pre-drawn picture of the whole map
};

const tIdx = (x, y) => y * MAP_W + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
const tileAt = (x, y) => inMap(x, y) ? World.tiles[tIdx(x, y)] : T.WATER;
const isBlocked = t => t === T.BUILDING || t === T.TREE || t === T.WATER;
const isPed = t => t === T.SIDEWALK || t === T.CROSS || t === T.PATH || t === T.PLAZA;
const isCityBlock = (bx, by) => bx >= CITY.bx0 && bx <= CITY.bx1 && by >= CITY.by0 && by <= CITY.by1;
const inCityArea = (x, y) => x >= CITY.bx0 * BLOCK && x < (CITY.bx1 + 1) * BLOCK + 2 && y >= CITY.by0 * BLOCK && y < (CITY.by1 + 1) * BLOCK + 2;

function generateWorld(seed) {
  const rng = mulberry32(seed);
  const R = (a, b) => a + rng() * (b - a);
  const RI = (a, b) => Math.floor(a + rng() * (b - a + 1));
  const P = arr => arr[Math.floor(rng() * arr.length)];

  const N = MAP_W * MAP_H;
  Object.assign(World, {
    seed, tiles: new Uint8Array(N), plotAt: new Int16Array(N).fill(-1), buildingAt: new Int16Array(N).fill(-1),
    buildings: [], plots: [], trees: [], rivals: [], fountains: [], parks: [], pedTiles: [], lanes: [], lamps: [],
  });
  const set = (x, y, t) => { if (inMap(x, y)) World.tiles[tIdx(x, y)] = t; };

  // 1) Roads, sidewalks and plain ground
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const mx = x % BLOCK, my = y % BLOCK;
    if (mx < 2 || my < 2) { set(x, y, inCityArea(x, y) ? T.ROAD : T.DIRT); continue; }
    const bx = Math.floor(x / BLOCK), by = Math.floor(y / BLOCK);
    if (isCityBlock(bx, by)) set(x, y, (mx === 2 || mx === 11 || my === 2 || my === 11) ? T.SIDEWALK : T.GRASS);
    else set(x, y, T.FIELD);
  }

  // 2) Crosswalks connect sidewalks across roads
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (tileAt(x, y) !== T.ROAD) continue;
    const mx = x % BLOCK, my = y % BLOCK;
    if (my < 2 && (mx === 2 || mx === 11)) {
      if (tileAt(x, y - my - 1) === T.SIDEWALK && tileAt(x, y - my + 2) === T.SIDEWALK) set(x, y, T.CROSS);
    } else if (mx < 2 && (my === 2 || my === 11)) {
      if (tileAt(x - mx - 1, y) === T.SIDEWALK && tileAt(x - mx + 2, y) === T.SIDEWALK) set(x, y, T.CROSS);
    }
  }

  const addTree = (x, y) => {
    set(x, y, T.TREE);
    World.trees.push({ x, y, r: R(10, 15), c: P(TREE_COLORS), ox: R(-3, 3), oy: R(-3, 3) });
  };
  const addBuilding = (x, y, w, h) => {
    const id = World.buildings.length;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { set(xx, yy, T.BUILDING); World.buildingAt[tIdx(xx, yy)] = id; }
    const price = Math.round(w * h * R(40, 62) / 10) * 10;
    World.buildings.push({
      id, x, y, w, h, roof: P(ROOF_COLORS), floors: RI(1, 5), kind: P(BUILDING_KINDS),
      forSale: rng() < 0.45, price, rentPerMin: Math.round(price * R(0.011, 0.016) * 10) / 10,
      acs: RI(0, 3), seedV: rng(),
    });
  };
  const addPlot = (x, y, w, h) => {
    const id = World.plots.length;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) World.plotAt[tIdx(xx, yy)] = id;
    World.plots.push({ id, x, y, w, h, price: Math.round(R(280, 420) / 10) * 10 });
  };

  const layouts = [
    [[0, 0, 8, 8]],
    [[0, 0, 8, 4], [0, 4, 8, 4]],
    [[0, 0, 4, 8], [4, 0, 4, 8]],
    [[0, 0, 4, 4], [4, 0, 4, 4], [0, 4, 4, 4], [4, 4, 4, 4]],
    [[0, 0, 4, 8], [4, 0, 4, 4], [4, 4, 4, 4]],
    [[0, 0, 8, 3], [0, 3, 5, 5], [5, 3, 3, 5]],
    [[0, 0, 5, 8], [5, 0, 3, 8]],
    [[0, 0, 3, 3], [3, 0, 5, 3], [0, 3, 3, 5], [3, 3, 5, 5]],
  ];

  // 3) Fill every block
  for (let by = 0; by < BLOCKS_Y; by++) for (let bx = 0; bx < BLOCKS_X; bx++) {
    const x0 = bx * BLOCK + 2, y0 = by * BLOCK + 2;
    if (isCityBlock(bx, by)) {
      const ix = x0 + 1, iy = y0 + 1; // 8x8 inside the sidewalk ring
      const r = rng();
      let kind = r < 0.64 ? 'buildings' : r < 0.86 ? 'park' : 'plaza';
      if (bx === 3 && by === 2) kind = 'plaza'; // central square where you start
      if (kind === 'buildings') {
        for (const [rx, ry, w, h] of P(layouts)) addBuilding(ix + rx, iy + ry, w, h);
      } else if (kind === 'park') {
        World.parks.push({ x: ix + 4, y: iy + 4 });
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++)
          if (xx === 3 || xx === 4 || yy === 3 || yy === 4) set(ix + xx, iy + yy, T.PATH);
        if (rng() < 0.4) { // little pond in one corner
          const qx = rng() < 0.5 ? 0 : 5, qy = rng() < 0.5 ? 0 : 6;
          for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 3; xx++) set(ix + qx + xx, iy + qy + yy, T.WATER);
        }
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++)
          if (tileAt(ix + xx, iy + yy) === T.GRASS && rng() < 0.3) addTree(ix + xx, iy + yy);
      } else {
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) set(ix + xx, iy + yy, T.PLAZA);
        for (let yy = 3; yy < 5; yy++) for (let xx = 3; xx < 5; xx++) set(ix + xx, iy + yy, T.WATER);
        World.fountains.push({ x: (ix + 4) * TILE, y: (iy + 4) * TILE });
        addTree(ix, iy); addTree(ix + 7, iy); addTree(ix, iy + 7); addTree(ix + 7, iy + 7);
      }
    } else {
      // Countryside
      const r = rng();
      let kind = r < 0.62 ? 'plots' : r < 0.82 ? 'forest' : 'lake';
      if ((bx === 3 && by === 0) || (bx === 0 && by === 2) || (bx === 4 && by === 5) || (bx === 7 && by === 3)) kind = 'plots';
      if (kind === 'plots') {
        addPlot(x0, y0, 5, 5); addPlot(x0 + 5, y0, 5, 5); addPlot(x0, y0 + 5, 5, 5); addPlot(x0 + 5, y0 + 5, 5, 5);
      } else if (kind === 'forest') {
        for (let yy = 0; yy < 10; yy++) for (let xx = 0; xx < 10; xx++) if (rng() < 0.42) addTree(x0 + xx, y0 + yy);
      } else {
        const cx = x0 + 4.5, cy = y0 + 4.5, rx = R(3, 4.4), ry = R(3, 4.4);
        for (let yy = 0; yy < 10; yy++) for (let xx = 0; xx < 10; xx++) {
          const dx = (x0 + xx + 0.5 - cx) / rx, dy = (y0 + yy + 0.5 - cy) / ry;
          if (dx * dx + dy * dy < 1) set(x0 + xx, y0 + yy, T.WATER);
          else if (rng() < 0.12) addTree(x0 + xx, y0 + yy);
        }
      }
    }
  }

  // 4) Walkable-for-pedestrians list
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (isPed(tileAt(x, y))) World.pedTiles.push(tIdx(x, y));

  // 5) Street lamps at city intersections
  for (let by = CITY.by0; by <= CITY.by1 + 1; by++) for (let bx = CITY.bx0; bx <= CITY.bx1 + 1; bx++)
    World.lamps.push({ x: bx * BLOCK * TILE + TILE, y: by * BLOCK * TILE + TILE });

  // 6) Car lanes (right-hand traffic)
  const xMin = CITY.bx0 * BLOCK * TILE, xMax = ((CITY.bx1 + 1) * BLOCK + 2) * TILE;
  const yMin = CITY.by0 * BLOCK * TILE, yMax = ((CITY.by1 + 1) * BLOCK + 2) * TILE;
  for (let by = CITY.by0; by <= CITY.by1 + 1; by++) {
    World.lanes.push({ axis: 'x', fixed: by * BLOCK * TILE + TILE / 2, dir: -1, min: xMin, max: xMax });
    World.lanes.push({ axis: 'x', fixed: (by * BLOCK + 1) * TILE + TILE / 2, dir: 1, min: xMin, max: xMax });
  }
  for (let bx = CITY.bx0; bx <= CITY.bx1 + 1; bx++) {
    World.lanes.push({ axis: 'y', fixed: bx * BLOCK * TILE + TILE / 2, dir: 1, min: yMin, max: yMax });
    World.lanes.push({ axis: 'y', fixed: (bx * BLOCK + 1) * TILE + TILE / 2, dir: -1, min: yMin, max: yMax });
  }

  setupStorefronts(seed);

  // 7) Rival carts run by the city's NPCs (your competition!)
  const cands = World.pedTiles.filter(i => World.tiles[i] === T.SIDEWALK);
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  const cuisineKeys = Object.keys(CUISINES);
  for (const ti of cands) {
    if (World.rivals.length >= 7) break;
    const x = ti % MAP_W, y = Math.floor(ti / MAP_W);
    if (dist(x, y, World.spawn.x, World.spawn.y) < 10) continue;
    if (World.rivals.some(r => dist(r.x, r.y, x, y) < 9)) continue;
    const cuisine = P(cuisineKeys), C = CUISINES[cuisine];
    World.rivals.push({
      id: 'r' + World.rivals.length, rival: true, x, y, cuisine,
      name: `${P(RIVAL_OWNERS)}'s ${C.name}`,
      price: Math.round(C.fair * R(0.95, 1.3) * 2) / 2, appeal: RI(38, 60),
      _queue: [], _cook: 0,
    });
  }
}

// Front doors + storefronts for rent. Uses its own random generator so
// older saves keep exactly the same city.
function setupStorefronts(seed) {
  const rng = mulberry32(seed ^ 0x51ed27);
  for (const b of World.buildings) {
    b.door = findDoor(b);
    b.forRent = !!b.door && !b.forSale && rng() < 0.75;
    b.leasePerMin = Math.round(b.w * b.h * (0.16 + rng() * 0.1) * 10) / 10;
  }
}

// The sidewalk tile in front of a building (prefers the bottom side)
function findDoor(b) {
  const sides = [
    { side: 'bottom', tiles: Array.from({ length: b.w }, (_, i) => ({ x: b.x + i, y: b.y + b.h })) },
    { side: 'left', tiles: Array.from({ length: b.h }, (_, i) => ({ x: b.x - 1, y: b.y + i })) },
    { side: 'right', tiles: Array.from({ length: b.h }, (_, i) => ({ x: b.x + b.w, y: b.y + i })) },
    { side: 'top', tiles: Array.from({ length: b.w }, (_, i) => ({ x: b.x + i, y: b.y - 1 })) },
  ];
  for (const s of sides) {
    const ok = s.tiles.filter(t => tileAt(t.x, t.y) === T.SIDEWALK);
    if (ok.length) {
      const mid = ok[Math.floor(ok.length / 2)];
      // the building tile just inside the door
      const inside = s.side === 'bottom' ? { x: mid.x, y: mid.y - 1 } : s.side === 'top' ? { x: mid.x, y: mid.y + 1 } : s.side === 'left' ? { x: mid.x + 1, y: mid.y } : { x: mid.x - 1, y: mid.y };
      return { x: mid.x, y: mid.y, side: s.side, ix: inside.x - b.x, iy: inside.y - b.y };
    }
  }
  return null;
}

// ---------- Path finding (Breadth-First Search on the tile grid) ----------
const _bfsPrev = new Int32Array(MAP_W * MAP_H);
const _bfsQueue = new Int32Array(MAP_W * MAP_H);

function findPath(sx, sy, tx, ty, canWalk) {
  if (!inMap(tx, ty) || !canWalk(tileAt(tx, ty))) return null;
  if (sx === tx && sy === ty) return [];
  _bfsPrev.fill(-2);
  const start = tIdx(sx, sy), goal = tIdx(tx, ty);
  let head = 0, tail = 0;
  _bfsQueue[tail++] = start; _bfsPrev[start] = -1;
  while (head < tail) {
    const cur = _bfsQueue[head++];
    if (cur === goal) break;
    const cx = cur % MAP_W, cy = (cur - cx) / MAP_W;
    const ns = [cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1];
    for (let k = 0; k < 8; k += 2) {
      const nx = ns[k], ny = ns[k + 1];
      if (!inMap(nx, ny)) continue;
      const ni = tIdx(nx, ny);
      if (_bfsPrev[ni] !== -2 || !canWalk(World.tiles[ni])) continue;
      _bfsPrev[ni] = cur; _bfsQueue[tail++] = ni;
    }
  }
  if (_bfsPrev[goal] === -2) return null;
  const path = [];
  for (let c = goal; c !== start; c = _bfsPrev[c]) path.push({ x: c % MAP_W, y: Math.floor(c / MAP_W) });
  return path.reverse();
}

// Nearest walkable tile to (x, y) — used when you click on a building etc.
function nearestWalkable(x, y, canWalk = t => !isBlocked(t)) {
  for (let r = 0; r < 12; r++) {
    let best = null, bestD = 1e9;
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
      if (Math.max(Math.abs(xx - x), Math.abs(yy - y)) !== r) continue;
      if (inMap(xx, yy) && canWalk(tileAt(xx, yy))) {
        const d = dist(xx, yy, x, y);
        if (d < bestD) { bestD = d; best = { x: xx, y: yy }; }
      }
    }
    if (best) return best;
  }
  return null;
}
