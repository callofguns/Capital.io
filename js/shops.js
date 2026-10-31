// =============================================================
//  shops.js — everything about shops (unlocks in Chapter 3)
//  Rent a storefront → place counters & shelves → stock products
//  → customers walk in, browse, and pay at the counter.
// =============================================================

// ---------- Small helpers ----------
function productInfo(p) {
  if (GOODS[p]) return { name: GOODS[p].name, emoji: GOODS[p].emoji, cost: buyPrice(p), price: Math.round(GOODS[p].base * FARM_MARKUP * 2) / 2, farm: true };
  return PRODUCTS[p];
}
const getShop = id => S.shops.find(s => s.id === +id);
const shopBuilding = s => World.buildings[s.bid];
const shopAt = bid => S.shops.find(s => s.bid === +bid) || null;
const countFurn = (s, k) => s.furniture.filter(f => f && f.k === k).length;
const shelfCap = (s, p) => s.furniture.filter(f => f && f.k === 'shelf' && f.p === p).length * SHELF_CAP;
const shopStockTotal = s => Object.values(s.stock).reduce((a, b) => a + b, 0);
const shopDecor = s => Math.min(30, s.furniture.reduce((a, f) => a + (f && FURNITURE[f.k].appeal || 0), 0));
const shopMaxInside = s => 3 + countFurn(s, 'counter') * 3;
const shopNotice = s => 8 + shopDecor(s) * 0.1;
const currentChapter = () => GOALS[S.goalIndex] ? GOALS[S.goalIndex].chapter : STORY.length - 1;
const shopsUnlocked = () => currentChapter() >= SHOPS_CHAPTER || S.shops.length > 0;

function playerNearShop(s, r = 3) {
  const d = shopBuilding(s).door;
  return dist(Game.player.x / TILE, Game.player.y / TILE, d.x + 0.5, d.y + 0.5) <= r;
}

// Who is working the registers right now (workers, plus you if you're at the door)
function shopCashiers(s) {
  const list = workersFor('shop', s.id).map(w => ({ w }));
  if (playerNearShop(s, 4)) list.push({ player: true });
  return list.slice(0, countFurn(s, 'counter'));
}

function shopOpen(s) {
  return countFurn(s, 'counter') > 0 && shopStockTotal(s) > 0 && shopCashiers(s).length > 0;
}

function shopAppeal(s) {
  let a = 45 + shopDecor(s) + (s.rating - 3) * 6 - s.dirt * 0.3;
  let ratio = 0, n = 0;
  for (const p of SHOP_TYPES[s.type].products) {
    if (!s.stock[p]) continue;
    ratio += s.prices[p] / productInfo(p).price; n++;
  }
  if (n) a -= (ratio / n - 1) * 60;   // expensive = less appealing
  a += n * 2;                          // more choice = more appealing
  const d = shopBuilding(s).door;
  for (const o of S.shops) {           // the same kind of shop nearby = competition
    const od = shopBuilding(o).door;
    if (o !== s && o.type === s.type && dist(d.x, d.y, od.x, od.y) < 12) a -= 8;
  }
  return clamp(a, 3, 97);
}

// Interior cell -> pixel position on the map
function cellPos(b, i) {
  return { x: (b.x + (i % b.w) + 0.5) * TILE, y: (b.y + Math.floor(i / b.w) + 0.5) * TILE };
}
const doorCell = b => b.door.iy * b.w + b.door.ix;

// ---------- Renting / closing ----------
function makeShop(bid, type) {
  const b = World.buildings[bid];
  const s = {
    id: nextId(), bid: +bid, type, name: `${S.name}'s ${SHOP_TYPES[type].name}`,
    owned: !!S.buildings[bid], furniture: Array(b.w * b.h).fill(null),
    stock: {}, prices: {}, dirt: 0, rating: 3.5, served: 0, earned: 0, lost: 0,
    _visitors: [], _regs: [],
  };
  for (const p of SHOP_TYPES[type].products) { s.stock[p] = 0; s.prices[p] = productInfo(p).price; }
  return s;
}

function rentStorefront(bid, type) {
  const b = World.buildings[bid];
  if (!shopsUnlocked()) { toast(`Shops unlock in Chapter ${SHOPS_CHAPTER + 1}`, 'bad'); return; }
  if (shopAt(bid)) return;
  const owned = !!S.buildings[bid];
  if (!owned && !b.forRent) return;
  if (!owned && !spend(b.leasePerMin * LEASE_DEPOSIT_MIN)) return;
  const s = makeShop(bid, type);
  S.shops.push(s);
  toast(`🏪 You opened ${s.name}! Now place a counter and shelves.`, 'good');
  openPanel('shop:' + s.id);
}

function closeShop(s) {
  for (const n of s._visitors.slice()) shopLeave(s, n, '🚪');
  let refund = 0;
  for (const f of s.furniture) if (f) refund += FURNITURE[f.k].cost * 0.5;
  for (const p in s.stock) if (GOODS[p]) S.inventory[p] += s.stock[p]; else refund += s.stock[p] * PRODUCTS[p].cost;
  for (const w of workersFor('shop', s.id)) w.assign = null;
  S.shops = S.shops.filter(x => x !== s);
  addMoney(refund, false);
  toast(`Shop closed. Furniture and stock sold back for ${fmtMoney(refund)}.`, 'info');
}

// ---------- Stock ----------
function orderStock(s, only, silent = false) {
  let got = 0, noShelf = 0, short = false;
  for (const p of only ? [only] : SHOP_TYPES[s.type].products) {
    const cap = shelfCap(s, p);
    if (!cap) { noShelf++; continue; }
    const need = cap - s.stock[p];
    if (need <= 0) continue;
    let n;
    if (GOODS[p]) n = obtainGoods(p, need, true);           // your storage first, then the market
    else {
      const c = PRODUCTS[p].cost;
      n = Math.min(need, Math.floor(Math.max(0, S.money) / c));
      if (n > 0) addMoney(-n * c);
    }
    s.stock[p] += n; got += n;
    if (n < need) short = true;
  }
  if (!silent) {
    if (got) toast(`📦 Stocked ${got} items`, 'good');
    else if (short) toast('Not enough money to buy stock', 'bad');
    else if (noShelf) toast('Place shelves for these products first (🛠️ Edit layout)', 'bad');
    else toast('Shelves are already full', 'info');
  }
  return got;
}

function orderCost(s) {
  let cost = 0;
  for (const p of SHOP_TYPES[s.type].products) {
    const need = Math.max(0, shelfCap(s, p) - s.stock[p]);
    if (GOODS[p]) cost += Math.max(0, need - Math.floor(S.inventory[p])) * buyPrice(p);
    else cost += need * PRODUCTS[p].cost;
  }
  return cost;
}

// ---------- Customers ----------
function considerShops(n) {
  const tx = n.x / TILE, ty = n.y / TILE;
  let best = null, bestScore = -1e9;
  for (const s of S.shops) {
    if (n.rej[s.id] && n.rej[s.id] > Game.t) continue;
    const d0 = shopBuilding(s).door, d = dist(tx, ty, d0.x + 0.5, d0.y + 0.5);
    if (d > shopNotice(s) || !shopOpen(s) || s._visitors.length >= shopMaxInside(s)) continue;
    const score = shopAppeal(s) - d * 1.5 + Math.random() * 12;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  if (!best) return;
  const chance = shopAppeal(best) / 100 * (0.5 + n.shopWant * 0.6) * 1.1;
  if (Math.random() >= chance) { n.rej[best.id] = Game.t + 15; return; }
  const d = shopBuilding(best).door;
  const path = findPath(Math.floor(n.x / TILE), Math.floor(n.y / TILE), d.x, d.y, isPed);
  if (!path) { n.rej[best.id] = Game.t + 30; return; }
  n.path = path; n.state = 'toShop'; n.shop = best;
  best._visitors.push(n);
}

// Called by updateNPC when the customer reaches the door
function enterShop(n) {
  const s = n.shop, b = shopBuilding(s);
  n.state = 'inShop'; n.phase = 'browse'; n.timer = rand(3, 6);
  const p = cellPos(b, doorCell(b));
  n.ix = p.x; n.iy = p.y;
  const shelves = s.furniture.map((f, i) => (f && f.k === 'shelf' ? i : -1)).filter(i => i >= 0);
  const t = cellPos(b, shelves.length ? pick(shelves) : doorCell(b));
  n.tx = t.x + rand(-6, 6); n.ty = t.y + 12;
}

function pickBasket(s, n) {
  const appeal = shopAppeal(s);
  n.basket = [];
  for (const p of SHOP_TYPES[s.type].products) {
    if (s.stock[p] <= 0) continue;
    const ratio = s.prices[p] / productInfo(p).price;
    const prob = clamp(0.5 - (ratio - 1) * 0.9, 0.03, 0.85) * (0.4 + appeal / 100);
    if (Math.random() < prob) {
      const q = Math.min(s.stock[p], Math.random() < 0.3 ? 2 : 1);
      s.stock[p] -= q;
      n.basket.push({ p, q, price: s.prices[p] });
    }
  }
  if (!n.basket.length) { shopLeave(s, n, '😕'); return; }
  n.phase = 'queue'; n.patience = rand(22, 32);
}

function shopLeave(s, n, emoji, angry = false, bought = false) {
  if (!bought && n.basket) for (const it of n.basket) s.stock[it.p] += it.q; // put things back on the shelf
  const i = s._visitors.indexOf(n);
  if (i >= 0) s._visitors.splice(i, 1);
  for (const r of s._regs) if (r.n === n) r.n = null;
  if (angry) { s.rating = s.rating * 0.95 + 0.05; s.lost++; }
  const d = shopBuilding(s).door;
  if (n.state === 'inShop') { n.x = d.x * TILE + TILE / 2; n.y = d.y * TILE + TILE / 2; }
  n.state = 'walk'; n.shop = null; n.basket = null; n.phase = null; n.rej = {};
  n.bubble = emoji; n.bubbleT = 3.5;
  if (bought) n.shopWant = 0;
  npcNewWander(n);
}

function checkout(s, n, cashier) {
  let total = 0;
  for (const it of n.basket) total += it.q * it.price;
  addMoney(total);
  s.earned += total; s.served++;
  S.stats.shopServed++; S.stats.shopEarned += total;
  const w = cashier.w;
  const quality = w ? 0.55 + w.stars * 0.07 + w.level * 0.03 : 0.8;
  s.rating = s.rating * 0.93 + (1 + clamp(quality, 0, 1) * 4) * 0.07;
  s.dirt = Math.min(100, s.dirt + 1.2);
  if (w) { addMoney(-w.wage); w.earned += w.wage; giveXp(w, 1); }
  const d = shopBuilding(s).door;
  floatText(d.x * TILE + 16, d.y * TILE - 8, '+' + fmtMoney(total), '#7CFC9A');
  shopLeave(s, n, '🛍️', false, true);
}

// ---------- Every frame ----------
function updateShops(dt) {
  for (const s of S.shops) {
    const b = shopBuilding(s), ws = workersFor('shop', s.id);
    const lead = ws.reduce((a, w) => (!a || w.level > a.level ? w : a), null);

    // Worker perks (the best worker in the shop decides)
    if (lead && lead.level >= 2 && (s._orderCd || 0) <= Game.t) {
      s._orderCd = Game.t + 8;
      for (const p of SHOP_TYPES[s.type].products) if (shelfCap(s, p) && s.stock[p] < shelfCap(s, p) * 0.3) orderStock(s, p, true);
    }
    if (lead && lead.level >= 3 && (s._priceCd || 0) <= Game.t) {
      s._priceCd = Game.t + 15;
      const busy = s._visitors.length / shopMaxInside(s);
      for (const p of SHOP_TYPES[s.type].products) {
        const def = productInfo(p).price;
        let v = s.prices[p] + (busy > 0.7 ? 0.5 : busy < 0.15 ? -0.5 : 0);
        s.prices[p] = clamp(Math.round(v * 2) / 2, Math.max(0.5, def * 0.8), def * 1.6);
      }
    }
    if (lead && lead.level >= 4 && s.dirt >= 45) { s.dirt = 0; addMoney(-lead.wage); lead.earned += lead.wage; }

    const open = shopOpen(s);
    const counters = s.furniture.map((f, i) => (f && f.k === 'counter' ? i : -1)).filter(i => i >= 0);

    // Customers inside
    let qi = 0;
    for (const n of s._visitors.slice()) {
      if (n.state !== 'inShop') continue;
      if (!open) { shopLeave(s, n, '🚪'); continue; }
      if (n.phase === 'browse') {
        n.timer -= dt;
        if (n.timer <= 0) pickBasket(s, n);
      } else if (n.phase === 'queue') {
        n.patience -= dt;
        if (n.patience <= 0) { shopLeave(s, n, '😠', true); continue; }
        if (counters.length) {
          const c = cellPos(b, counters[qi % counters.length]);
          n.tx = c.x; n.ty = c.y + 22 + (1 + Math.floor(qi / counters.length)) * 11;
        }
        qi++;
      }
      // walk around inside
      n.tx = clamp(n.tx, b.x * TILE + 8, (b.x + b.w) * TILE - 8);
      n.ty = clamp(n.ty, b.y * TILE + 8, (b.y + b.h) * TILE - 8);
      const d = dist(n.ix, n.iy, n.tx, n.ty);
      n._moving = d > 1;
      if (d > 1) { const st = Math.min(d, 45 * dt); n.ix += (n.tx - n.ix) / d * st; n.iy += (n.ty - n.iy) / d * st; n.face = n.tx > n.ix ? 1 : -1; n.anim += dt; }
    }

    // Registers: each cashier serves one customer at a time
    const cashiers = open ? shopCashiers(s) : [];
    while (s._regs.length > cashiers.length) {
      const r = s._regs.pop();
      if (r.n) r.n.phase = 'queue';
    }
    for (let i = 0; i < cashiers.length; i++) {
      const reg = s._regs[i] || (s._regs[i] = { n: null, t: 0 });
      if (!reg.n) {
        const next = s._visitors.find(v => v.state === 'inShop' && v.phase === 'queue');
        if (next) { reg.n = next; reg.t = 0; next.phase = 'paying'; }
      }
      if (reg.n) {
        const c = cellPos(b, counters[i]);
        reg.n.tx = c.x; reg.n.ty = c.y + 20;
        const w = cashiers[i].w;
        const time = w ? 2.6 * (1.3 - w.stars * 0.07) * (w.level >= 5 ? 0.8 : 1) : 1.8;
        reg.t += dt / time;
        if (reg.t >= 1) { const n = reg.n; reg.n = null; checkout(s, n, cashiers[i]); }
      }
    }
  }
}

// Once a second: pay rent for storefronts you lease
function shopsSecondTick() {
  for (const s of S.shops) if (!s.owned) addMoney(-shopBuilding(s).leasePerMin / 60);
}

// While you were away…
function shopsOffline(secs, rep) {
  for (const s of S.shops) {
    if (!s.owned) { const r = shopBuilding(s).leasePerMin * secs / 60; addMoney(-r, false); rep.leasePaid += r; }
    const ws = workersFor('shop', s.id);
    const regs = Math.min(ws.length, countFurn(s, 'counter'));
    const prods = SHOP_TYPES[s.type].products.filter(p => shelfCap(s, p) > 0);
    if (!regs || !prods.length) continue;
    const lead = ws.reduce((a, w) => (!a || w.level > a.level ? w : a), null);
    const customers = Math.floor(secs * Math.min(regs / 2.6, shopAppeal(s) / 100 * 0.08) * 0.55);
    let items = customers * 1.3;
    const avgPrice = prods.reduce((a, p) => a + s.prices[p], 0) / prods.length;
    const avgCost = prods.reduce((a, p) => a + productInfo(p).cost, 0) / prods.length;
    const stockNow = prods.reduce((a, p) => a + s.stock[p], 0);
    let restockCost = 0;
    if (lead.level >= 2 && avgPrice > avgCost) restockCost = Math.max(0, items - stockNow) * avgCost;
    else items = Math.min(items, stockNow);
    for (const p of prods) s.stock[p] = Math.max(0, Math.round(s.stock[p] - items / prods.length));
    const sales = items * avgPrice, served = Math.round(items / 1.3), wages = served * lead.wage;
    addMoney(sales - restockCost - wages, false);
    s.served += served; s.earned += sales;
    S.stats.shopServed += served; S.stats.shopEarned += sales;
    for (const w of ws) giveXp(w, Math.floor(served / ws.length));
    rep.shopSales += sales - restockCost; rep.wages += wages;
  }
}

// ---------- Drawing ----------
function shopRoofCut(s) {
  const b = shopBuilding(s), px = Game.player.x / TILE, py = Game.player.y / TILE, m = 3;
  return UI.editShop === s.id || (px > b.x - m && px < b.x + b.w + m && py > b.y - m && py < b.y + b.h + m);
}

function drawShop(s) {
  const b = shopBuilding(s), T_ = SHOP_TYPES[s.type];
  const px = b.x * TILE + 3, py = b.y * TILE + 3, w = b.w * TILE - 6, h = b.h * TILE - 6;
  const open = shopOpen(s);
  if (shopRoofCut(s)) {
    // Roof is cut away so you can see inside
    ctx.fillStyle = '#c8a27a'; ctx.fillRect(px, py, w, h);
    ctx.fillStyle = 'rgba(90,60,30,0.15)';
    for (let y = py + 8; y < py + h; y += 10) ctx.fillRect(px, y, w, 1);
    ctx.strokeStyle = '#4a3b2f'; ctx.lineWidth = 5; ctx.strokeRect(px + 2.5, py + 2.5, w - 5, h - 5);
    const dc = cellPos(b, doorCell(b));
    ctx.fillStyle = '#c8a27a';
    if (b.door.side === 'bottom' || b.door.side === 'top') ctx.fillRect(dc.x - 10, b.door.side === 'bottom' ? py + h - 6 : py, 20, 6);
    else ctx.fillRect(b.door.side === 'left' ? px : px + w - 6, dc.y - 10, 6, 20);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    s.furniture.forEach((f, i) => {
      if (!f) return;
      const c = cellPos(b, i);
      if (f.k === 'counter') {
        ctx.fillStyle = '#6f4518'; ctx.fillRect(c.x - 14, c.y - 6, 28, 14);
        ctx.fillStyle = '#8b5e34'; ctx.fillRect(c.x - 14, c.y - 6, 28, 4);
        ctx.font = `12px ${EMOJI_FONT}`; ctx.fillText('🧾', c.x + 7, c.y + 1);
      } else if (f.k === 'shelf') {
        ctx.fillStyle = '#6c757d'; ctx.fillRect(c.x - 14, c.y - 12, 28, 18);
        ctx.fillStyle = '#adb5bd'; ctx.fillRect(c.x - 13, c.y - 4, 26, 2);
        ctx.globalAlpha = s.stock[f.p] > 0 ? 1 : 0.25;
        ctx.font = `10px ${EMOJI_FONT}`;
        const e = productInfo(f.p).emoji;
        ctx.fillText(e, c.x - 6, c.y - 8); ctx.fillText(e, c.x + 6, c.y - 8); ctx.fillText(e, c.x, c.y + 2);
        ctx.globalAlpha = 1;
      } else if (f.k === 'table') {
        ctx.fillStyle = '#a47148'; ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6f4518';
        for (const [dx, dy] of [[-12, 0], [12, 0], [0, -12], [0, 12]]) { ctx.beginPath(); ctx.arc(c.x + dx, c.y + dy, 3.5, 0, Math.PI * 2); ctx.fill(); }
      } else {
        ctx.font = `20px ${EMOJI_FONT}`; ctx.fillText(FURNITURE[f.k].emoji, c.x, c.y);
      }
    });
    // cashiers stand behind the counters
    const counters = s.furniture.map((f, i) => (f && f.k === 'counter' ? i : -1)).filter(i => i >= 0);
    workersFor('shop', s.id).slice(0, counters.length).forEach((wk, i) => {
      const c = cellPos(b, counters[i]);
      drawPerson(c.x, c.y - 12, { shirt: wk.shirt, skin: wk.skin, hair: wk.hair, apron: true, moving: false, anim: 0 });
    });
    for (const n of s._visitors) {
      if (n.state !== 'inShop') continue;
      drawPerson(n.ix, n.iy, { ...n, alpha: 1, moving: n._moving });
      if (n.phase === 'paying') drawBubble(n.ix, n.iy - 24, '💳');
    }
  } else {
    // Shop front: a striped awning above the door
    const d = b.door, ax = d.x * TILE + TILE / 2;
    if (d.side === 'bottom') {
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff' : T_.color; ctx.fillRect(ax - 24 + i * 8, py + h - 10, 8, 10); }
    }
  }
  const ty = shopRoofCut(s) ? py - 26 : py + 14; // above the roof line when you can see inside
  tag(px + w / 2, ty, `${T_.emoji} ${s.name}`, T_.color);
  tag(px + w / 2, ty + 14, open ? `OPEN · ${s._visitors.length} inside` : 'CLOSED', open ? '#2a9d8f' : '#495057');
}

// ---------- Shop menus ----------
PANELS.shops = function () {
  if (!shopsUnlocked()) {
    return {
      title: '🏪 Shops', html: `<div class="card lock"><div class="big-emoji">🔒</div><b>Shops unlock in Chapter ${SHOPS_CHAPTER + 1}</b>
      <p class="muted small">Grow your cart business first! Finish the goals in the top-left to move the story forward.</p></div>` };
  }
  let html = `<p class="muted">Rent a storefront, fill it with counters and shelves, stock products, and customers will walk in to buy. Shops are open when you or a cashier is there.</p>`;
  html += `<h3>Your shops (${S.shops.length})</h3>`;
  if (!S.shops.length) html += `<p class="muted small">No shops yet — rent one below.</p>`;
  for (const s of S.shops) {
    const T_ = SHOP_TYPES[s.type], b = shopBuilding(s);
    html += `<div class="card row clickable" data-act="open" data-key="shop:${s.id}"><div class="big-emoji">${T_.emoji}</div>
      <div class="grow"><b>${escapeHtml(s.name)}</b> <span class="stars">${stars(s.rating)}</span>
      <div class="muted small">${s.owned ? 'Your building' : `Rent ${fmtMoney(b.leasePerMin)}/min`} · ${s.served} customers · earned ${fmtMoney(s.earned)}</div></div>
      <div class="tag ${shopOpen(s) ? 'green' : 'gray'}">${shopOpen(s) ? 'OPEN' : 'CLOSED'}</div></div>`;
  }
  const px = Game.player.x / TILE, py = Game.player.y / TILE;
  const free = World.buildings.filter(b => b.forRent && !shopAt(b.id)).sort((a, b) => dist(px, py, a.x, a.y) - dist(px, py, b.x, b.y)).slice(0, 8);
  html += `<h3>Storefronts for rent nearby</h3><p class="muted small">Bigger shops fit more shelves but cost more rent. You also pay ${LEASE_DEPOSIT_MIN} minutes of rent up front.</p>`;
  for (const b of free) {
    html += `<div class="card row"><div class="grow"><b>${b.w}×${b.h} storefront</b> <span class="muted small">${Math.round(dist(px, py, b.x, b.y))} tiles away</span>
      <div class="muted small">${fmtMoney(b.leasePerMin)}/min · ${b.w * b.h - 1} spaces for furniture</div></div>
      ${btn('🔎 View', 'bld-travel', { id: b.id }, 'ghost')}</div>`;
  }
  return { title: '🏪 Shops', html };
};

PANELS.shop = function (id) {
  const s = getShop(id);
  if (!s) return null;
  const T_ = SHOP_TYPES[s.type], b = shopBuilding(s);
  const near = playerNearShop(s, 5), appeal = shopAppeal(s);
  const ws = workersFor('shop', s.id), counters = countFurn(s, 'counter');
  let html = '';
  if (!counters || !countFurn(s, 'shelf')) html += `<div class="card warn"><span>👉 Your shop needs a <b>checkout counter</b> and <b>shelves</b>.</span>${near ? btn('🛠️ Edit layout', 'shop-edit', { id: s.id }) : btn('🚀 Travel here', 'shop-travel', { id: s.id })}</div>`;
  html += `<div class="card"><div class="row"><div class="big-emoji">${T_.emoji}</div><div class="grow"><b>${escapeHtml(s.name)}</b>
      <div class="stars">${stars(s.rating)} <span class="muted small">${s.rating.toFixed(1)}</span></div></div>
      <div class="tag ${shopOpen(s) ? 'green' : 'gray'}">${shopOpen(s) ? 'OPEN' : 'CLOSED'}</div></div>
    <div class="stat-grid">
      <div><span>Customers</span><b>${s.served}</b></div><div><span>Earned</span><b>${fmtMoney(s.earned)}</b></div>
      <div><span>Inside now</span><b>${s._visitors.filter(v => v.state === 'inShop').length}/${shopMaxInside(s)}</b></div>
      <div><span>${s.owned ? 'Building' : 'Rent'}</span><b>${s.owned ? 'Yours' : fmtMoney(b.leasePerMin) + '/min'}</b></div></div>
    <div class="label-row"><span>Appeal</span><span>${Math.round(appeal)}%</span></div>${bar(appeal, appeal > 55 ? '#2a9d8f' : appeal > 30 ? '#e9c46a' : '#e63946')}
    <div class="label-row"><span>Dirt</span><span>${Math.round(s.dirt)}%</span></div>${bar(s.dirt, '#8b5e34')}
    <div class="btn-row">${near ? btn('🛠️ Edit layout', 'shop-edit', { id: s.id }) + (s.dirt > 5 ? btn('🧽 Clean', 'shop-clean', { id: s.id }) : '') : btn('🚀 Travel here', 'shop-travel', { id: s.id })}
      ${btn('✏️ Rename', 'shop-rename', { id: s.id }, 'ghost')}</div></div>`;

  html += `<div class="card"><div class="row"><div class="grow"><b>Products</b><div class="muted small">Each shelf holds ${SHELF_CAP} of one product.${s.type === 'grocery' ? ' Grocery uses your farm storage first!' : ''}</div></div>
    ${btn(`📦 Restock all (~${fmtMoney(orderCost(s))})`, 'shop-order', { id: s.id })}</div>`;
  for (const p of T_.products) {
    const info = productInfo(p), cap = shelfCap(s, p);
    html += `<div class="row upg"><div class="big-emoji sm">${info.emoji}</div><div class="grow"><b>${info.name}</b> <span class="muted small">${s.stock[p]}/${cap}</span>
        <div class="muted small">Costs you ${fmtMoney(info.cost)} · normal price ${fmtMoney(info.price)}</div>
        ${cap ? bar(s.stock[p] / cap * 100, '#4cc9f0') : '<div class="muted small">⚠️ No shelf for this yet</div>'}</div>
      ${btn('−', 'shop-price', { id: s.id, p, d: -0.5 }, 'sq')}<div class="price sm">${fmtMoney(s.prices[p])}</div>${btn('+', 'shop-price', { id: s.id, p, d: 0.5 }, 'sq')}</div>`;
  }
  html += `</div>`;

  html += `<div class="card"><b>Cashiers (${ws.length}/${counters})</b><p class="muted small">Each cashier needs a counter. You count as a cashier while you stand by the door.</p>`;
  for (const w of ws) html += `<div class="row">${workerFace(w)}<div class="grow"><b>${escapeHtml(w.name)}</b> <span class="stars">${stars(w.stars)}</span> <span class="muted small">Lv ${w.level}</span></div>${btn('Remove', 'unassign', { w: w.id }, 'ghost')}</div>`;
  const free = S.workers.filter(x => !x.assign);
  if (ws.length < Math.max(1, counters)) {
    html += free.length ? free.map(x => `<div class="row">${workerFace(x)}<div class="grow">${escapeHtml(x.name)} <span class="stars">${stars(x.stars)}</span></div>${btn('Assign', 'assign', { w: x.id, type: 'shop', id: s.id })}</div>`).join('')
      : `<p class="muted small">No free workers. ${btn('👷 Hire someone', 'open', { key: 'workers' }, 'ghost')}</p>`;
  }
  html += `</div><div class="card"><div class="btn-row">${btn(s.owned ? '🚪 Close shop' : '🚪 End lease & close', 'shop-close', { id: s.id }, 'ghost danger')}</div>
    <p class="muted small">Furniture and stock are sold back at a discount.</p></div>`;
  return { title: `${T_.emoji} ${T_.name}`, html };
};

// Building panel: show the shop if there is one, or offer to rent it
const _buildingPanel = PANELS.building;
PANELS.building = function (id) {
  const sh = shopAt(id);
  if (sh) return PANELS.shop(sh.id);
  const b = World.buildings[id];
  if (!b || !(b.forRent || S.buildings[id])) return _buildingPanel(id);
  const owned = !!S.buildings[id];
  const r = owned ? _buildingPanel(id) : { title: '🏪 Storefront for rent', html: '' };
  let html = r.html;
  if (!owned) html += `<div class="card"><b>Empty ${b.w}×${b.h} storefront</b><div class="stat-grid">
      <div><span>Rent</span><b>${fmtMoney(b.leasePerMin)}/min</b></div><div><span>Up front</span><b>${fmtMoney(b.leasePerMin * LEASE_DEPOSIT_MIN)}</b></div>
      <div><span>Furniture spaces</span><b>${b.w * b.h - 1}</b></div><div><span>Floors</span><b>${b.floors}</b></div></div></div>`;
  if (!shopsUnlocked()) html += `<div class="card lock">🔒 Shops unlock in <b>Chapter ${SHOPS_CHAPTER + 1}</b>. Keep growing your carts!</div>`;
  else {
    html += `<div class="card"><b>${owned ? 'Open a shop in your building' : 'Rent it as a…'}</b>${owned ? '<p class="muted small">You stop getting rent from tenants while your shop is here.</p>' : ''}<div class="shop-types">`;
    for (const k in SHOP_TYPES) {
      const T_ = SHOP_TYPES[k];
      html += `<button class="cuisine-btn" data-act="shop-rent" data-id="${id}" data-type="${k}"><span>${T_.emoji}</span>${T_.name}<small>${T_.products.map(p => productInfo(p).emoji).join('')}</small></button>`;
    }
    html += `</div></div>`;
  }
  return { title: r.title, html };
};

// ---------- Layout editor ----------
function openShopEditor(s) {
  if (!playerNearShop(s, 5)) { toast('Walk to your shop first (or use 🚀 Travel)', 'bad'); return; }
  UI.editShop = s.id;
  UI.editTool = UI.editTool || 'counter';
  renderShopEditor();
}

function renderShopEditor() {
  const s = getShop(UI.editShop);
  if (!s) return closeModal();
  const b = shopBuilding(s), T_ = SHOP_TYPES[s.type];
  const size = Math.max(30, Math.min(52, Math.floor(Math.min(400, window.innerWidth - 70) / b.w), Math.floor((window.innerHeight - 420) / b.h)));
  const dc = doorCell(b);
  const tools = [['counter', FURNITURE.counter]]
    .concat(T_.products.map(p => ['shelf:' + p, { name: productInfo(p).name + ' shelf', emoji: productInfo(p).emoji, cost: FURNITURE.shelf.cost }]))
    .concat([['decor', FURNITURE.decor], ['table', FURNITURE.table], ['erase', { name: 'Remove', emoji: '❌', cost: 0 }]]);
  let grid = '';
  for (let i = 0; i < b.w * b.h; i++) {
    const f = s.furniture[i];
    const label = i === dc ? '🚪' : f ? (f.k === 'shelf' ? `🗄️<small>${productInfo(f.p).emoji}</small>` : FURNITURE[f.k].emoji) : '';
    grid += `<button class="ed-cell ${i === dc ? 'door' : ''} ${f ? 'full' : ''}" data-act="ed-cell" data-i="${i}" style="width:${size}px;height:${size}px">${label}</button>`;
  }
  const html = `<div class="mg-title">🛠️ ${T_.emoji} ${escapeHtml(s.name)}</div>
    <div class="mg-sub">Pick something below, then tap an empty square to place it. You have ${fmtMoney(S.money)}.</div>
    <div class="ed-tools">${tools.map(([k, f]) => `<button class="ed-tool ${UI.editTool === k ? 'sel' : ''}" data-act="ed-tool" data-t="${k}"><span>${f.emoji}</span>${f.name}<small>${f.cost ? fmtMoney(f.cost) : 'refund 50%'}</small></button>`).join('')}</div>
    <div class="ed-grid" style="grid-template-columns:repeat(${b.w},${size}px)">${grid}</div>
    <div class="muted small">🧾 ${countFurn(s, 'counter')} counters · 🗄️ ${countFurn(s, 'shelf')} shelves · ✨ +${shopDecor(s)} appeal from decorations</div>
    <button class="btn big" data-act="ed-done">Done</button>`;
  showModal(html, 'editor');
}

function placeFurniture(i) {
  const s = getShop(UI.editShop), b = shopBuilding(s);
  if (i === doorCell(b)) { toast('Keep the doorway free!', 'bad'); return; }
  const tool = UI.editTool, cur = s.furniture[i];
  if (tool === 'erase') {
    if (!cur) return;
    s.furniture[i] = null;
    addMoney(FURNITURE[cur.k].cost * 0.5, false);
    if (cur.k === 'shelf') { // items that no longer fit are sold back at cost
      const extra = Math.max(0, s.stock[cur.p] - shelfCap(s, cur.p));
      s.stock[cur.p] -= extra;
      addMoney(extra * productInfo(cur.p).cost, false);
    }
    return;
  }
  if (cur) { toast('That square is taken — use ❌ Remove first', 'bad'); return; }
  const [k, p] = tool.split(':');
  if (!spend(FURNITURE[k].cost)) return;
  s.furniture[i] = p ? { k, p } : { k };
}

// ---------- Button actions ----------
Object.assign(ACTIONS, {
  'shop-rent': d => rentStorefront(+d.id, d.type),
  'shop-edit': d => openShopEditor(getShop(d.id)),
  'shop-travel': d => { const b = shopBuilding(getShop(d.id)); teleportPlayer(b.door.x, b.door.y); },
  'shop-order': d => orderStock(getShop(d.id)),
  'shop-price': d => { const s = getShop(d.id); s.prices[d.p] = clamp(Math.round((s.prices[d.p] + +d.d) * 2) / 2, 0.5, 999); },
  'shop-rename': d => {
    const s = getShop(d.id), name = prompt('Name your shop:', s.name);
    if (name && name.trim()) s.name = name.trim().slice(0, 28);
  },
  'shop-clean': d => {
    const s = getShop(d.id);
    if (!playerNearShop(s, 5)) { toast('Walk to your shop first', 'bad'); return; }
    if (s.dirt < 1) { toast('Already spotless!', 'info'); return; }
    Minigame.start('scrub', { dirt: s.dirt, color: SHOP_TYPES[s.type].color }, () => { s.dirt = 0; S.stats.cleaned++; toast('Shop is sparkling clean ✨', 'good'); });
  },
  'shop-close': d => {
    const s = getShop(d.id);
    if (confirm(`Close ${s.name}? Furniture and stock are sold back at a discount.`)) { closeShop(s); closePanel(); }
  },
  'ed-tool': d => { UI.editTool = d.t; renderShopEditor(); },
  'ed-cell': d => { placeFurniture(+d.i); renderShopEditor(); },
  'ed-done': () => { const id = UI.editShop; closeModal(); openPanel('shop:' + id); },
  story: () => showStory(currentChapter()),
});
