// =============================================================
//  economy.js — the game state (S) and all money rules
// =============================================================

let S = null; // the whole saved game lives in this one object

function newState(name, cuisine) {
  const s = {
    v: 1, seed: (Math.random() * 1e9) | 0, name, startCuisine: cuisine,
    money: 150, clock: 8 * 60, nextId: 1,
    carts: [], shops: [], workers: [], hirePool: [], hireRefreshAt: 0,
    inventory: {}, plots: {}, buildings: {}, market: {},
    bank: { savings: 0 },
    stats: { served: 0, playerServed: 0, harvested: 0, marketSold: 0, earned: 0, shopServed: 0, shopEarned: 0, cleaned: 0 },
    goalIndex: 0, storyV: 2, chapterShown: -1, player: null, lastSave: Date.now(), created: Date.now(),
  };
  for (const g in GOODS) {
    s.market[g] = { price: GOODS[g].base, hist: Array(40).fill(GOODS[g].base) };
    s.inventory[g] = 0;
  }
  return s;
}

const nextId = () => S.nextId++;

// ---------- Money ----------
// "op" = operating money (sales, wages, ingredients, rent). Used for the $/min number.
function addMoney(amount, op = true) {
  S.money += amount;
  if (amount > 0) S.stats.earned += amount;
  if (op) Game.ledger.push({ t: Game.t, a: amount });
}

function spend(amount, op = false) {
  if (S.money < amount - 1e-9) { toast(`You need ${fmtMoney(amount)} for that`, 'bad'); return false; }
  addMoney(-amount, op);
  return true;
}

function profitPerMinute() {
  let sum = 0;
  for (const e of Game.ledger) if (e.t > Game.t - 60) sum += e.a;
  return sum * 60 / Math.min(60, Math.max(10, Game.t));
}

// ---------- Market ----------
const buyPrice = g => S.market[g].price * 1.03;
const sellPrice = g => S.market[g].price * 0.97;

function marketTick() {
  for (const g in GOODS) {
    const m = S.market[g], base = GOODS[g].base;
    const target = base * shortageMult(g); // shortages push the price way up
    m.price += (target - m.price) * 0.03 + (Math.random() - 0.5) * base * 0.05;
    m.price = clamp(m.price, base * 0.4, base * 2.5);
  }
}
function marketHistoryTick() {
  for (const g in GOODS) {
    const m = S.market[g];
    m.hist.push(m.price);
    if (m.hist.length > 40) m.hist.shift();
  }
}

function marketBuy(g, n, silent = false) {
  if (n <= 0) return 0;
  const cost = buyPrice(g) * n;
  if (S.money < cost) {
    n = Math.floor(S.money / buyPrice(g));
    if (n <= 0) { if (!silent) toast("You don't have enough money for that", 'bad'); return 0; }
  }
  addMoney(-buyPrice(g) * n, true);
  S.inventory[g] += n;
  S.market[g].price = Math.min(GOODS[g].base * 2.5, S.market[g].price + GOODS[g].base * 0.0015 * n);
  return n;
}

function marketSell(g, n) {
  n = Math.min(n, Math.floor(S.inventory[g]));
  if (n <= 0) { toast(`You don't have any ${GOODS[g].name.toLowerCase()}`, 'bad'); return 0; }
  const earned = sellPrice(g) * n;
  S.inventory[g] -= n;
  addMoney(earned, true);
  S.market[g].price = Math.max(GOODS[g].base * 0.4, S.market[g].price - GOODS[g].base * 0.0015 * n);
  S.stats.marketSold += n;
  toast(`Sold ${n} ${GOODS[g].emoji} for ${fmtMoney(earned)}!`, 'good');
  return n;
}

// Takes n units from storage, buying the missing part from the market.
function obtainGoods(g, n, allowBuy = true) {
  const fromInv = Math.min(n, Math.floor(S.inventory[g]));
  S.inventory[g] -= fromInv;
  let got = fromInv;
  if (got < n && allowBuy) {
    const bought = marketBuy(g, n - got, true);
    S.inventory[g] -= bought;
    got += bought;
  }
  return got;
}

// ---------- Carts ----------
function makeCart(cuisine, x, y) {
  const cart = {
    id: nextId(), cuisine, x, y, price: CUISINES[cuisine].fair,
    upgrades: { grill: 0, recipe: 0, sign: 0, fridge: 0, hygiene: 0, queue: 0 },
    stock: {}, dirt: 0, rating: 3.5, served: 0, earned: 0, lost: 0,
    _queue: [], _cook: 0,
  };
  for (const g of CUISINES[cuisine].recipe) cart.stock[g] = 0;
  return cart;
}

const allCarts = () => S.carts.concat(World.rivals);
const getCart = id => S.carts.find(c => c.id === +id);
const cartCapacity = c => 20 + (c.upgrades ? c.upgrades.fridge * 10 : 0);
const cartQueueMax = c => 3 + (c.upgrades ? c.upgrades.queue : 1);
const cartNotice = c => 6 + (c.upgrades ? c.upgrades.sign * 0.9 : 1);
const cartPortions = c => c.rival ? 99 : Math.min(...CUISINES[c.cuisine].recipe.map(g => c.stock[g] || 0));
const mealCost = c => CUISINES[c.cuisine].recipe.reduce((s, g) => s + buyPrice(g), 0);

// Shops can have several workers, so this returns a list
function workersFor(type, id) {
  return S.workers.filter(w => w.assign && w.assign.type === type && w.assign.id === +id);
}

function workerFor(type, id) {
  return S.workers.find(w => w.assign && w.assign.type === type && w.assign.id === +id) || null;
}

function playerNearTile(x, y, tiles) {
  return dist(Game.player.x / TILE, Game.player.y / TILE, x + 0.5, y + 0.5) <= tiles;
}

function cartOpen(c) {
  const hour = (S.clock / 60) % 24;
  if (c.rival) return hour >= 7 && hour < 22;
  if (cartPortions(c) < 1 && !(workerFor('cart', c.id) && workerFor('cart', c.id).level >= 2)) return false;
  return !!workerFor('cart', c.id) || playerNearTile(c.x, c.y, 7);
}

// Carts selling the same food within this many squares steal customers
const COMPETE_RADIUS = 10, COMPETE_PENALTY = 9;

// How many other carts (yours and rivals') sell the same food near (x, y)
function sameFoodNearby(cuisine, x, y, ignoreId) {
  let n = 0;
  for (const o of allCarts()) if (o.id !== ignoreId && o.cuisine === cuisine && dist(o.x, o.y, x, y) < COMPETE_RADIUS) n++;
  return n;
}

// Everything that makes a cart more or less appealing, one line each,
// so the cart menu can show players exactly why
function cartAppealParts(c) {
  const C = CUISINES[c.cuisine], food = C.name.toLowerCase(), parts = [];
  parts.push({ label: 'Starting point', value: 50 });
  if (c.upgrades.recipe) parts.push({ label: `Recipe upgrades (level ${c.upgrades.recipe})`, value: c.upgrades.recipe * 3 });
  if (c.upgrades.sign) parts.push({ label: `Signage upgrades (level ${c.upgrades.sign})`, value: c.upgrades.sign * 0.8 });
  parts.push({ label: `Price (${fmtMoney(c.price)}, most charge ${fmtMoney(C.fair)})`, value: -(c.price / C.fair - 1) * 60 });
  parts.push({ label: `Dirt (${Math.round(c.dirt)}%)`, value: -c.dirt * 0.35 });
  parts.push({ label: `Reviews (${c.rating.toFixed(1)} stars)`, value: (c.rating - 3) * 6 });
  const n = sameFoodNearby(c.cuisine, c.x, c.y, c.id);
  parts.push({ label: n ? `${n} other ${food} cart${n > 1 ? 's' : ''} nearby` : `No other ${food} carts nearby`, value: -COMPETE_PENALTY * n, competition: n });
  return parts.concat(eventCartParts(c));
}

// How attractive a cart is to customers (3-97)
function cartAppeal(c) {
  if (c.rival) return c.appeal;
  return clamp(cartAppealParts(c).reduce((sum, p) => sum + p.value, 0), 3, 97);
}

function cartCookTime(c, worker) {
  let t = CUISINES[c.cuisine].cook * (1 - 0.06 * c.upgrades.grill);
  if (worker) t *= (1.35 - worker.stars * 0.07) * (worker.level >= 5 ? 0.8 : 1);
  return t;
}

function restockCart(c, silent = false) {
  const cap = cartCapacity(c);
  let bought = 0, missing = false;
  for (const g of CUISINES[c.cuisine].recipe) {
    const need = cap - (c.stock[g] || 0);
    if (need <= 0) continue;
    const got = obtainGoods(g, need, true);
    c.stock[g] = (c.stock[g] || 0) + got;
    bought += got;
    if (got < need) missing = true;
  }
  if (!silent) {
    if (bought === 0 && missing) toast("You can't afford to restock right now", 'bad');
    else if (bought === 0) toast('Your cart is already full', 'info');
    else toast(`${CUISINES[c.cuisine].emoji} Cart restocked!`, 'good');
  }
  return bought;
}

function restockCostEstimate(c) {
  const cap = cartCapacity(c);
  let cost = 0;
  for (const g of CUISINES[c.cuisine].recipe) {
    const need = Math.max(0, cap - (c.stock[g] || 0));
    const fromInv = Math.min(need, Math.floor(S.inventory[g]));
    cost += (need - fromInv) * buyPrice(g);
  }
  return cost;
}

// Called when a meal is handed over. quality: 0..1
function serveCustomer(c, quality, worker) {
  const idx = c._queue.findIndex(n => n.arrived);
  if (idx < 0) return false;
  const npc = c._queue[idx];
  if (c.rival) {
    leaveCart(npc, false);
    return true;
  }
  for (const g of CUISINES[c.cuisine].recipe) c.stock[g] -= 1;
  let pay = c.price;
  if (quality < 0.25) pay *= 0.6;                                   // burnt food = discount
  const tip = c.price * Math.max(0, quality - 0.3) * (0.25 + c.upgrades.recipe * 0.03);
  const total = pay + tip;
  addMoney(total);
  c.earned += total; c.served++; S.stats.served++;
  c.dirt = Math.min(100, c.dirt + 1.6 * (1 - 0.08 * c.upgrades.hygiene));
  c.rating = c.rating * 0.92 + (1 + quality * 4) * 0.08;
  if (worker) {
    addMoney(-worker.wage);
    worker.earned += worker.wage;
    giveXp(worker, 1);
  }
  floatText(c.x * TILE + 16, c.y * TILE - 8, '+' + fmtMoney(total), quality > 0.85 ? '#ffd166' : '#7CFC9A');
  if (npc.critic) { npc.criticFed = true; criticResult(c, quality); }
  orderProgress('cart', c.cuisine, 1);
  leaveCart(npc, false);
  return true;
}

// ---------- Workers ----------
function genWorker() {
  const r = Math.random();
  const st = r < 0.3 ? 1 : r < 0.6 ? 2 : r < 0.82 ? 3 : r < 0.94 ? 4 : 5;
  return {
    id: nextId(), name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, stars: st, level: 1, xp: 0,
    wage: Math.round((0.4 + st * 0.5 + rand(0, 0.4)) * 100) / 100,
    hireCost: st * 30, shirt: pick(SHIRT_COLORS), skin: pick(SKIN_COLORS), hair: pick(HAIR_COLORS),
    assign: null, earned: 0,
  };
}

function refreshHirePool() {
  S.hirePool = [genWorker(), genWorker(), genWorker(), genWorker()];
  S.hireRefreshAt = Date.now() + 3 * 60 * 1000;
}

function giveXp(w, n) {
  if (w.level >= WORKER_MAX_LEVEL) return;
  w.xp += n;
  while (w.level < WORKER_MAX_LEVEL && w.xp >= xpForLevel(w.level)) {
    w.xp -= xpForLevel(w.level);
    w.level++;
    if (Game.running) toast(`⭐ ${w.name} hit level ${w.level}! New skill: ${WORKER_PERKS[w.level - 1].toLowerCase()}`, 'good');
  }
}

function assignWorker(w, type, id) {
  if (type !== 'shop') { // carts and plots have one worker; shops can have several
    const prev = workerFor(type, id);
    if (prev) prev.assign = null;
  }
  w.assign = { type, id: +id };
}

// ---------- Plots (farms & ranches) ----------
function getPlotState(id) { return S.plots[id] || null; }

function plotCounts(pid) {
  const p = S.plots[pid], now = Date.now();
  let empty = 0, growing = 0, ready = 0;
  for (const t of p.crops) {
    if (!t) empty++;
    else if (now - t.t >= GOODS[t.c].grow * 1000) ready++;
    else growing++;
  }
  return { empty, growing, ready };
}

function plantPlot(pid, silent = false) {
  const p = S.plots[pid];
  const cost = GOODS[p.seed].base * SEED_COST_MULT;
  let n = 0;
  for (let i = 0; i < p.crops.length; i++) {
    if (p.crops[i]) continue;
    if (S.money < cost) { if (!silent && n === 0) toast("You can't afford seeds right now", 'bad'); break; }
    addMoney(-cost);
    p.crops[i] = { c: p.seed, t: Date.now() };
    n++;
  }
  if (n && !silent) toast(`Planted ${n} ${GOODS[p.seed].emoji} for ${fmtMoney(n * cost)}`, 'good');
  return n;
}

function harvestPlot(pid, silent = false, max = 999) {
  const p = S.plots[pid], now = Date.now();
  let n = 0;
  const got = {};
  for (let i = 0; i < p.crops.length && n < max; i++) {
    const t = p.crops[i];
    if (t && now - t.t >= GOODS[t.c].grow * 1000) {
      S.inventory[t.c] += CROP_YIELD;
      got[t.c] = (got[t.c] || 0) + CROP_YIELD;
      p.crops[i] = null;
      n++;
    }
  }
  S.stats.harvested += n;
  if (n && !silent) toast('You harvested ' + Object.entries(got).map(([g, q]) => `${q} ${GOODS[g].emoji}`).join(' '), 'good');
  return n;
}

function ranchCollect(pid, silent = false) {
  const p = S.plots[pid];
  let n = 0;
  for (const g in p.output) { S.inventory[g] += p.output[g]; n += p.output[g]; p.output[g] = 0; }
  if (!silent) toast(n ? `Collected ${n} goods!` : 'Nothing to collect yet', n ? 'good' : 'info');
  return n;
}

function ranchFill(pid, silent = false) {
  const p = S.plots[pid];
  const need = Math.floor(TROUGH_MAX - p.trough);
  if (need <= 0) { if (!silent) toast('The trough is already full', 'info'); return 0; }
  const got = obtainGoods('corn', need, true);
  p.trough += got;
  if (!silent) toast(got ? `Added ${got} 🌽 to the trough` : "You're out of corn and can't afford more", got ? 'good' : 'bad');
  return got;
}

// ---------- Worth ----------
function netWorth(s) {
  let w = s.money + s.bank.savings;
  for (const g in GOODS) w += (s.inventory[g] || 0) * s.market[g].price;
  w += s.carts.length * CART_BASE_COST * 0.5;
  if (World.plots.length) {
    for (const id in s.plots) w += World.plots[id].price;
    for (const id in s.buildings) w += World.buildings[id].price;
    for (const sh of s.shops || []) for (const f of sh.furniture) if (f) w += FURNITURE[f.k].cost * 0.5;
  }
  return w;
}

// ---------- Offline progress ("keeps running while you're away") ----------
function applyOffline() {
  const secs = Math.min((Date.now() - S.lastSave) / 1000, OFFLINE_CAP_SEC);
  if (secs < 60) return null;
  const rep = { secs, meals: 0, sales: 0, wages: 0, rent: 0, interest: 0, goods: 0, shopSales: 0, leasePaid: 0 };
  S.clock += secs * GAME_MINUTES_PER_SEC;

  for (const c of S.carts) {
    const w = workerFor('cart', c.id);
    if (!w) continue;
    const rate = Math.min(1 / cartCookTime(c, w), cartAppeal(c) / 100 * 0.1); // meals per second
    let meals = Math.floor(secs * rate * 0.55); // ~45% of the day is quiet/night
    const profitable = c.price > mealCost(c) + w.wage;
    if (!(w.level >= 2 && profitable)) meals = Math.min(meals, cartPortions(c));
    const fromStock = Math.min(meals, cartPortions(c));
    for (const g of CUISINES[c.cuisine].recipe) c.stock[g] -= fromStock;
    const bought = meals - fromStock;
    const ingredientCost = bought * mealCost(c);
    const sales = meals * c.price * 1.08, wages = meals * w.wage;
    addMoney(sales - ingredientCost - wages, false);
    c.served += meals; c.earned += sales; S.stats.served += meals; w.earned += wages;
    giveXp(w, meals);
    c.dirt = Math.min(100, c.dirt + meals * 1.6 * (1 - 0.08 * c.upgrades.hygiene));
    if (w.level >= 4) c.dirt = Math.min(c.dirt, 30);
    rep.meals += meals; rep.sales += sales - ingredientCost; rep.wages += wages;
  }

  for (const pid in S.plots) {
    const p = S.plots[pid], w = workerFor('plot', pid);
    if (p.type === 'farm' && w) {
      const cycles = Math.floor(secs / GOODS[p.seed].grow);
      const tiles = p.crops.length;
      const harvested = cycles * tiles;
      const seedCost = harvested * GOODS[p.seed].base * SEED_COST_MULT;
      S.inventory[p.seed] += harvested * CROP_YIELD;
      S.stats.harvested += harvested;
      addMoney(-seedCost - harvested * w.wage * 0.3, false);
      rep.goods += harvested * CROP_YIELD; rep.wages += harvested * w.wage * 0.3;
      giveXp(w, Math.floor(harvested / 4));
      const now = Date.now();
      p.crops = p.crops.map(() => ({ c: p.seed, t: now - Math.random() * GOODS[p.seed].grow * 1000 }));
    } else if (p.type === 'ranch') {
      for (const a of p.animals) {
        const A = ANIMALS[a.kind];
        let n = Math.floor(secs / A.every);
        if (w) { const corn = obtainGoods('corn', n * A.feed, true); n = Math.floor(corn / A.feed); }
        else { n = Math.min(n, Math.floor(p.trough / A.feed)); p.trough -= n * A.feed; }
        if (w) S.inventory[A.product] += n; else p.output[A.product] = (p.output[A.product] || 0) + n;
        rep.goods += n;
      }
    }
  }

  let rentPerMin = 0;
  for (const id in S.buildings) if (!shopAt(id)) rentPerMin += World.buildings[id].rentPerMin;
  shopsOffline(secs, rep);
  rep.rent = rentPerMin * secs / 60;
  addMoney(rep.rent, false);

  const before = S.bank.savings;
  S.bank.savings *= Math.pow(1 + BANK_RATE_PER_MIN, secs / 60);
  rep.interest = S.bank.savings - before;
  return rep;
}

const BANK_RATE_PER_MIN = 0.0005; // 0.05% per minute

// ---------- Save / load ----------
function saveGame() {
  if (!S || Game.noSave) return;
  S.lastSave = Date.now();
  S.gameVersion = GAME_VERSION;
  S.player = { x: Game.player.x, y: Game.player.y };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S, (k, v) => (k[0] === '_' ? undefined : v)));
  } catch (e) { console.warn('Save failed', e); }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    return s;
  } catch (e) { return null; }
}

function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
