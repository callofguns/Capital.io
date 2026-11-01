// =============================================================
//  entities.js — everything that moves: you, customers, cars,
//  workers cooking, crops growing, animals...
// =============================================================

const Game = {
  running: false, t: 0,
  player: { x: 0, y: 0, path: [], moving: false, face: 1, anim: 0 },
  npcs: [], cars: [], floats: [], ledger: [],
  cam: { x: 0, y: 0, zoom: 1 },
  keys: {},
  timers: { market: 0, hist: 0, sec: 0, save: 0, spawn: 0, hud: 0, panel: 0, mini: 0, action: 0, workers: 0 },
};

// ---------------- Player ----------------
const PLAYER_R = 7;

function blockedAt(px, py, r) {
  const pts = [[px - r, py - r], [px + r, py - r], [px - r, py + r], [px + r, py + r]];
  return pts.some(([x, y]) => isBlocked(tileAt(Math.floor(x / TILE), Math.floor(y / TILE))));
}

function updatePlayer(dt) {
  const p = Game.player, k = Game.keys;
  const run = Settings.alwaysRun ? !k.shift : k.shift; // Shift flips walking/running
  const speed = run ? 190 : 120;
  let vx = 0, vy = 0;
  if (!UI.modalOpen && !UI.mapOpen) {
    if (k.w || k.arrowup) vy -= 1;
    if (k.s || k.arrowdown) vy += 1;
    if (k.a || k.arrowleft) vx -= 1;
    if (k.d || k.arrowright) vx += 1;
  }
  // On-screen joystick (phones): push it all the way to run
  const joy = Math.hypot(Joy.dx, Joy.dy);
  let joySpeed = 0;
  if (!UI.modalOpen && !UI.mapOpen && joy > 0.2) { vx = Joy.dx; vy = Joy.dy; joySpeed = joy > 0.9 ? 190 : 120; }
  p.moving = false;
  if (vx || vy) {
    p.path = [];
    const l = Math.hypot(vx, vy), sp = joySpeed || speed;
    const dx = vx / l * sp * dt, dy = vy / l * sp * dt;
    const nx = p.x + dx; if (!blockedAt(nx, p.y, PLAYER_R)) p.x = nx;
    const ny = p.y + dy; if (!blockedAt(p.x, ny, PLAYER_R)) p.y = ny;
    if (vx) p.face = Math.sign(vx);
    p.moving = true;
  } else if (p.path.length) {
    followPath(p, speed, dt);
    p.moving = true;
  }
  if (p.moving) p.anim += dt;
  p.x = clamp(p.x, 8, MAP_W * TILE - 8);
  p.y = clamp(p.y, 8, MAP_H * TILE - 8);
}

// Moves an entity along its list of tiles. Returns true when it reached the end.
function followPath(e, speed, dt) {
  let move = speed * dt;
  while (move > 0 && e.path.length) {
    const wp = e.path[0];
    const tx = wp.x * TILE + TILE / 2 + (wp.ox || 0), ty = wp.y * TILE + TILE / 2 + (wp.oy || 0);
    const d = dist(e.x, e.y, tx, ty);
    if (d <= move) { e.x = tx; e.y = ty; e.path.shift(); move -= d; }
    else {
      e.x += (tx - e.x) / d * move; e.y += (ty - e.y) / d * move;
      if (Math.abs(tx - e.x) > 0.5) e.face = Math.sign(tx - e.x);
      move = 0;
    }
  }
  return e.path.length === 0;
}

function walkPlayerTo(tx, ty) {
  const p = Game.player;
  const start = { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
  let target = { x: tx, y: ty };
  if (isBlocked(tileAt(tx, ty))) target = nearestWalkable(tx, ty);
  if (!target) return;
  const path = findPath(start.x, start.y, target.x, target.y, t => !isBlocked(t));
  if (path) p.path = path;
}

function teleportPlayer(tx, ty) {
  const t = isBlocked(tileAt(tx, ty)) ? nearestWalkable(tx, ty) : { x: tx, y: ty };
  if (!t) return;
  Game.player.x = t.x * TILE + TILE / 2;
  Game.player.y = t.y * TILE + TILE / 2;
  Game.player.path = [];
  Game.cam.x = Game.player.x; Game.cam.y = Game.player.y;
}

// ---------------- Customers (NPCs) ----------------
function demandAt(hour) {
  if (hour < 6) return 0.12;
  if (hour < 8) return 0.35;
  if (hour < 11) return 0.55;
  if (hour < 14) return 1.0;
  if (hour < 17) return 0.6;
  if (hour < 20) return 0.9;
  if (hour < 23) return 0.45;
  return 0.2;
}

function randomPedTileNear(cx, cy, radius) {
  for (let i = 0; i < 40; i++) {
    const ti = pick(World.pedTiles);
    const x = ti % MAP_W, y = Math.floor(ti / MAP_W);
    if (radius == null || dist(x, y, cx, cy) <= radius) return { x, y };
  }
  const ti = pick(World.pedTiles);
  return { x: ti % MAP_W, y: Math.floor(ti / MAP_W) };
}

function spawnNPC() {
  let spot;
  // more people walk around near your businesses
  const hubs = S.carts.map(c => ({ x: c.x, y: c.y })).concat(S.shops.map(sh => shopBuilding(sh).door));
  if (hubs.length && Math.random() < 0.6) {
    const c = pick(hubs);
    spot = randomPedTileNear(c.x, c.y, 12);
  } else spot = randomPedTileNear(0, 0, null);
  if (!inCityArea(spot.x, spot.y)) return;
  const n = {
    x: spot.x * TILE + TILE / 2 + rand(-6, 6), y: spot.y * TILE + TILE / 2 + rand(-6, 6),
    path: [], speed: rand(38, 62), face: 1, anim: Math.random() * 5, alpha: 0,
    hunger: rand(0.15, 1), shopWant: Math.random(), life: rand(80, 200), think: rand(0.5, 2), rej: {},
    shirt: pick(SHIRT_COLORS), skin: pick(SKIN_COLORS), hair: pick(HAIR_COLORS),
    state: 'walk', cart: null, arrived: false, patience: 0, bubble: null, bubbleT: 0,
  };
  Game.npcs.push(n);
}

function npcNewWander(n) {
  const cx = Math.floor(n.x / TILE), cy = Math.floor(n.y / TILE);
  const t = randomPedTileNear(cx, cy, 14);
  n.path = findPath(cx, cy, t.x, t.y, isPed) || [];
  if (n.path.length > 0) {
    const last = n.path[n.path.length - 1];
    last.ox = rand(-8, 8); last.oy = rand(-8, 8);
  }
}

function considerCarts(n) {
  const tx = n.x / TILE, ty = n.y / TILE;
  let best = null, bestScore = -1e9;
  for (const c of allCarts()) {
    if (n.rej[c.id] && n.rej[c.id] > Game.t) continue;
    const d = dist(tx, ty, c.x + 0.5, c.y + 0.5);
    if (d > cartNotice(c)) continue;
    if (!cartOpen(c) || c._queue.length >= cartQueueMax(c)) continue;
    const score = cartAppeal(c) - d * 1.5 + Math.random() * 12;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (!best) return;
  const a = cartAppeal(best);
  const chance = (a / 100) * (0.6 + n.hunger * 0.6) * 1.2;
  if (Math.random() < chance) goToCart(n, best);
  else n.rej[best.id] = Game.t + 15;
}

function goToCart(n, c) {
  const path = findPath(Math.floor(n.x / TILE), Math.floor(n.y / TILE), c.x, c.y, isPed);
  if (!path) { n.rej[c.id] = Game.t + 30; return; }
  n.path = path; n.state = 'toCart'; n.cart = c; n.arrived = false;
  c._queue.push(n);
}

function leaveCart(n, angry, emoji) {
  const c = n.cart;
  if (c) {
    const i = c._queue.indexOf(n);
    if (i >= 0) c._queue.splice(i, 1);
    if (angry && !c.rival) { c.rating = c.rating * 0.95 + 1 * 0.05; c.lost++; }
  }
  n.cart = null; n.arrived = false; n.state = 'walk';
  if (angry) { n.bubble = '😠'; n.bubbleT = 3; }
  else { n.bubble = emoji || (c ? CUISINES[c.cuisine].emoji : null); n.bubbleT = 3.5; n.hunger = 0; }
  n.rej = {};
  npcNewWander(n);
}

function queueSlot(c, i) {
  const slots = [[0, 1.05], [-1, 1], [1, 1], [-1.1, 0.1], [1.1, 0.1], [0, 1.9], [-1, 1.9], [1, 1.9], [-1.1, -0.9], [1.1, -0.9], [-2, 1], [2, 1], [0, 2.8], [-2, 0]];
  const s = slots[Math.min(i, slots.length - 1)];
  return { x: (c.x + 0.5 + s[0]) * TILE, y: (c.y + 0.5 + s[1]) * TILE };
}

function updateNPC(n, dt) {
  n.bubbleT -= dt;
  if (n.state === 'despawn') { n.alpha -= dt * 1.5; return; }
  if (n.state === 'inShop') return; // shops.js moves them while inside
  n.alpha = Math.min(1, n.alpha + dt * 1.5);
  n.life -= dt;
  let moving = false;

  if (n.state === 'walk') {
    n.hunger = Math.min(1, n.hunger + dt * 0.004);
    n.shopWant = Math.min(1, n.shopWant + dt * 0.003);
    if (!n.path.length) {
      if (n.life <= 0) { n.state = 'despawn'; return; }
      npcNewWander(n);
    } else { followPath(n, n.speed, dt); moving = true; }
    n.think -= dt;
    if (n.think <= 0) {
      n.think = rand(1, 1.6);
      if (n.hunger > 0.4) considerCarts(n);
      if (n.state === 'walk' && n.shopWant > 0.4) considerShops(n);
    }
  } else if (n.state === 'toShop') {
    if (!n.shop || !S.shops.includes(n.shop)) { n.shop = null; n.state = 'walk'; npcNewWander(n); return; }
    if (followPath(n, n.speed * 1.1, dt)) enterShop(n);
    moving = true;
  } else if (n.state === 'toCart') {
    const c = n.cart;
    if (!c || (!c.rival && !S.carts.includes(c))) { leaveCart(n, false, '🤷'); return; }
    if (followPath(n, n.speed * 1.1, dt)) { n.arrived = true; n.state = 'queue'; n.patience = rand(24, 34); }
    moving = true;
  } else if (n.state === 'queue') {
    const c = n.cart;
    if (!c) { n.state = 'walk'; return; }
    const slot = queueSlot(c, c._queue.indexOf(n));
    const d = dist(n.x, n.y, slot.x, slot.y);
    if (d > 1.5) {
      const step = Math.min(d, n.speed * dt);
      n.x += (slot.x - n.x) / d * step; n.y += (slot.y - n.y) / d * step;
      moving = true;
    }
    n.face = (c.x + 0.5) * TILE > n.x ? 1 : -1;
    if (!c._playerCooking) n.patience -= dt;
    if (n.patience <= 0) leaveCart(n, true);
    else if (!cartOpen(c) && !c._playerCooking) leaveCart(n, false, '🚪');
  }
  if (moving) n.anim += dt;
}

function updateNPCs(dt) {
  const hour = (S.clock / 60) % 24;
  const target = Math.min(160, Math.round((20 + 45 * demandAt(hour) + 4 * (S.carts.length + S.shops.length)) * CROWD_LEVELS[Settings.crowd]));
  Game.timers.spawn -= dt;
  if (Game.timers.spawn <= 0) {
    Game.timers.spawn = 0.35;
    if (Game.npcs.length < target) spawnNPC();
    else if (Game.npcs.length > target + 10) {
      const n = Game.npcs.find(n => n.state === 'walk');
      if (n) n.life = 0;
    }
  }
  for (const n of Game.npcs) updateNPC(n, dt);
  Game.npcs = Game.npcs.filter(n => !(n.state === 'despawn' && n.alpha <= 0));
}

// ---------------- Carts ----------------
function updateCarts(dt) {
  for (const c of S.carts) {
    const w = workerFor('cart', c.id);
    if (!w) { c._cook = 0; c._cleaning = 0; continue; }

    // Level 2: buys ingredients by itself
    if (w.level >= 2 && cartPortions(c) <= 2 && (c._restockCd || 0) <= Game.t) {
      c._restockCd = Game.t + 5;
      restockCart(c, true);
    }
    // Level 3: adjusts the price every so often
    if (w.level >= 3 && (c._priceCd || 0) <= Game.t) {
      c._priceCd = Game.t + 12;
      const C = CUISINES[c.cuisine];
      const q = c._queue.length / cartQueueMax(c);
      let target = c.price;
      if (q > 0.7) target += 0.5; else if (q < 0.15) target -= 0.5;
      c.price = clamp(Math.round(target * 2) / 2, Math.ceil(mealCost(c) + w.wage + 1), C.fair * 1.6);
    }
    // Level 4: cleans by itself
    if (w.level >= 4 && c.dirt >= 45 && !c._cleaning) c._cleaning = 5;
    if (c._cleaning) {
      c._cleaning -= dt;
      if (c._cleaning <= 0) { c._cleaning = 0; c.dirt = 0; addMoney(-w.wage); w.earned += w.wage; }
      continue;
    }
    // Cooking
    if (c._queue.length && cartPortions(c) >= 1) {
      c._cook = Math.min(1, c._cook + dt / cartCookTime(c, w));
      if (c._cook >= 1 && c._queue.some(n => n.arrived)) {
        c._cook = 0;
        const quality = clamp(0.35 + w.stars * 0.09 + w.level * 0.04 + c.upgrades.recipe * 0.02 + rand(-0.1, 0.1), 0.1, 1);
        serveCustomer(c, quality, w);
      }
    } else c._cook = 0;
  }

  for (const r of World.rivals) {
    if (r._queue.length) {
      r._cook = Math.min(1, r._cook + dt / (CUISINES[r.cuisine].cook * 1.2));
      if (r._cook >= 1 && r._queue.some(n => n.arrived)) { r._cook = 0; serveCustomer(r, 0.6, null); }
    } else r._cook = 0;
  }
}

// ---------------- Farms & ranches ----------------
function updatePlots(dt) {
  Game.timers.workers -= dt;
  const workerTick = Game.timers.workers <= 0;
  if (workerTick) Game.timers.workers = 2;

  for (const pid in S.plots) {
    const p = S.plots[pid];
    const w = workerFor('plot', pid);
    if (p.type === 'ranch') {
      for (const a of p.animals) {
        const A = ANIMALS[a.kind];
        a._t = (a._t || Math.random() * A.every) + dt;
        if (a._t >= A.every && p.trough >= A.feed) {
          a._t = 0; p.trough -= A.feed;
          p.output[A.product] = (p.output[A.product] || 0) + 1;
        } else if (a._t >= A.every) a._t = A.every;
        // wander around the pen
        const P = World.plots[pid];
        if (a._x == null) { a._x = (P.x + 0.5 + Math.random() * (P.w - 1)) * TILE; a._y = (P.y + 0.8 + Math.random() * (P.h - 1.3)) * TILE; }
        if (!a._tx || Math.random() < dt * 0.15) {
          a._tx = (P.x + 0.5 + Math.random() * (P.w - 1)) * TILE; a._ty = (P.y + 1 + Math.random() * (P.h - 1.5)) * TILE;
        }
        const d = dist(a._x, a._y, a._tx, a._ty);
        if (d > 1) { const s = Math.min(d, 14 * dt); a._x += (a._tx - a._x) / d * s; a._y += (a._ty - a._y) / d * s; a._face = a._tx > a._x ? 1 : -1; }
      }
      if (w && workerTick) {
        let did = 0;
        if (p.trough < TROUGH_MAX * 0.3 && S.money > 5) did += ranchFill(pid, true) > 0 ? 1 : 0;
        const out = Object.values(p.output).reduce((s, v) => s + v, 0);
        if (out >= 3) { ranchCollect(pid, true); did++; }
        if (did) { addMoney(-w.wage * 0.5 * did); w.earned += w.wage * 0.5 * did; giveXp(w, did); }
      }
    } else if (p.type === 'farm' && w && workerTick) {
      const per = w.stars + w.level; // tiles handled per tick
      const h = harvestPlot(pid, true, per);
      const pl = plantPlot(pid, true);
      const jobs = h + pl;
      if (jobs) {
        const pay = w.wage * 0.3 * h;
        if (pay) { addMoney(-pay); w.earned += pay; }
        w._jobs = (w._jobs || 0) + jobs;
        if (w._jobs >= 4) { giveXp(w, Math.floor(w._jobs / 4)); w._jobs %= 4; }
      }
    }
  }
}

// ---------------- Cars (just for looks) ----------------
function initCars() {
  Game.cars = [];
  for (let i = 0; i < 26; i++) {
    const lane = pick(World.lanes);
    Game.cars.push({ lane, pos: rand(lane.min, lane.max), speed: rand(55, 95), color: pick(CAR_COLORS), len: rand(24, 30) });
  }
}

function updateCars(dt) {
  for (const c of Game.cars) {
    c.pos += c.speed * c.lane.dir * dt;
    if (c.pos > c.lane.max + 40) c.pos = c.lane.min - 40;
    if (c.pos < c.lane.min - 40) c.pos = c.lane.max + 40;
  }
}

// ---------------- Floating "+$9" texts ----------------
function floatText(x, y, text, color = '#fff') {
  if (!Settings.floats) return;
  Game.floats.push({ x, y, text, color, t: 0 });
}
function updateFloats(dt) {
  for (const f of Game.floats) { f.t += dt; f.y -= 22 * dt; }
  Game.floats = Game.floats.filter(f => f.t < 1.6);
}
