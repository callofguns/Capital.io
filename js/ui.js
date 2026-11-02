// =============================================================
//  ui.js — top bar, side panels, buttons, pop-ups, messages
// =============================================================

const UI = {
  panelKey: null, pointerInPanel: false, modalOpen: false,
  placement: null,   // when placing a cart: { mode: 'new'|'move', cuisine, cartId }
  hoverTile: null,
};
const $ = id => document.getElementById(id);

// ---------- Toast messages ----------
function toast(msg, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
  while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
}

// ---------- Modal ----------
function showModal(html, cls = '') {
  $('modal-box').className = cls;
  $('modal-box').innerHTML = html;
  $('modal').classList.remove('hidden');
  UI.modalOpen = true;
}
function closeModal() {
  $('modal').classList.add('hidden');
  $('modal-box').innerHTML = '';
  UI.modalOpen = false;
  UI.editShop = null;
  for (const c of S ? S.carts : []) c._playerCooking = false;
}

// ---------- HUD ----------
function updateHUD() {
  $('money').textContent = fmtMoney(S.money);
  const pnl = profitPerMinute();
  $('pnl').textContent = (pnl >= 0 ? '+' : '') + fmtMoney(pnl) + '/min';
  $('pnl').className = 'pnl ' + (pnl >= 0 ? 'up' : 'down');
  const mins = Math.floor(S.clock) % (24 * 60);
  const day = Math.floor(S.clock / (24 * 60)) + 1;
  const hh = Math.floor(mins / 60), mm = mins % 60;
  const icon = hh >= 6 && hh < 19 ? '☀️' : '🌙';
  $('clock').textContent = `${icon} Day ${day} · ${String(hh).padStart(2, '0')}:${String(mm - mm % 10).padStart(2, '0')}`;
  $('money').classList.toggle('neg', S.money < 0);
  const g = GOALS[S.goalIndex];
  let html;
  if (g) {
    const ch = STORY[g.chapter], first = GOALS.findIndex(x => x.chapter === g.chapter);
    html = `<div class="goal-label">📖 ${ch.title}</div><div>🎯 ${controlText(g.text)}</div>
      <div class="goal-reward">Goal ${S.goalIndex - first + 1}/${ch.goals.length} · Reward ${fmtMoney(g.reward)}</div>`;
  } else html = `<div class="goal-label">🏆 That's the end... for now!</div><div>Net worth: ${fmtMoney(netWorth(S))}</div>`;
  if (html !== $('goal-box')._html) { $('goal-box').innerHTML = html; $('goal-box')._html = html; }
  $('shops-btn').classList.toggle('locked', !shopsUnlocked());
}

// ---------- Story ----------
function showStory(ci) {
  const ch = STORY[ci];
  if (!ch) return;
  const C = CUISINES[S.startCuisine];
  const text = controlText(ch.text).replace(/\{name\}/g, escapeHtml(S.name)).replace(/\{cart\}/g, `${C.emoji} ${C.name}`);
  const controls = ci === 0 ? `<ul class="report small-list">
      ${controlsList()}
      <li>🎯 Your goals live in the top-left. ${IS_TOUCH ? 'Tap' : 'Click'} them any time to read this again</li></ul>` : '';
  showModal(`<div class="story-ch">${ch.title}</div>
    <div class="story-row"><div class="story-face">${ch.who}</div>
      <div class="story-bubble"><b>${ch.speaker}</b><p>${text}</p></div></div>
    ${controls}
    <div class="story-goals"><b>What to do this chapter:</b><ol>${ch.goals.map((g, i) => {
      const gi = GOALS.findIndex(x => x.chapter === ci) + i;
      return `<li class="${gi < S.goalIndex ? 'done' : ''}">${controlText(g.text)} <span class="muted">(${fmtMoney(g.reward)})</span></li>`;
    }).join('')}</ol></div>
    <button class="btn big" onclick="closeModal()">${ci === 0 ? "Let's cook!" : "Let's go!"}</button>`, 'story');
}

// Shows the next chapter's story when you reach it
function maybeShowStory() {
  const ci = currentChapter();
  if (ci > (S.chapterShown ?? -1) && !UI.modalOpen) {
    S.chapterShown = ci;
    showStory(ci);
  }
}

function checkGoals() {
  const g = GOALS[S.goalIndex];
  if (g && g.check(S)) {
    addMoney(g.reward, false);
    toast(`🎯 Goal done! +${fmtMoney(g.reward)}`, 'goal');
    S.goalIndex++;
    const next = GOALS[S.goalIndex];
    if (next && next.chapter !== g.chapter) toast(`📖 You finished "${STORY[g.chapter].title.split('·')[1].trim()}"!`, 'goal');
  }
}

// ---------- Action bar (buttons near you) ----------
function nearestOwnCart(maxTiles = 2.3) {
  let best = null, bd = maxTiles;
  for (const c of S.carts) {
    const d = dist(Game.player.x / TILE, Game.player.y / TILE, c.x + 0.5, c.y + 0.5);
    if (d <= bd) { bd = d; best = c; }
  }
  return best;
}
function nearestPlot(maxTiles = 1.5) {
  const px = Game.player.x / TILE, py = Game.player.y / TILE;
  for (const P of World.plots) {
    if (px > P.x - maxTiles && px < P.x + P.w + maxTiles && py > P.y - maxTiles && py < P.y + P.h + maxTiles) return P;
  }
  return null;
}
function playerNearPlot(pid) {
  const P = World.plots[pid], px = Game.player.x / TILE, py = Game.player.y / TILE, m = 3;
  return px > P.x - m && px < P.x + P.w + m && py > P.y - m && py < P.y + P.h + m;
}

// Your shop's door (or a storefront for rent) right next to you
function nearestShopDoor() {
  const px = Game.player.x / TILE, py = Game.player.y / TILE;
  for (const s of S.shops) {
    const d = shopBuilding(s).door;
    if (dist(px, py, d.x + 0.5, d.y + 0.5) < 2.2) return { s, b: shopBuilding(s) };
  }
  for (const b of World.buildings) {
    if (b.forRent && b.door && !shopAt(b.id) && dist(px, py, b.door.x + 0.5, b.door.y + 0.5) < 1.6) return { s: null, b };
  }
  return null;
}

// Runs every frame. The buttons are only rebuilt when they actually change
// (like walking up to a different cart). Things that change a lot, like how
// many people are waiting, are updated in place, so a button never gets
// swapped out while your finger is on it.
function updateActionBar() {
  const bar = $('action-bar');
  let html = '', waiting = null;
  const c = nearestOwnCart();
  if (c) {
    const C = CUISINES[c.cuisine];
    waiting = c._queue.filter(n => n.arrived).length;
    html += `<span class="ab-label">${C.emoji} Your ${C.name} cart</span>`;
    html += `<button class="btn" data-act="cart-cook" data-id="${c.id}">🍳 Cook <kbd>E</kbd> <span class="badge" hidden></span></button>`;
    if (c.dirt > 5) html += `<button class="btn" data-act="cart-clean" data-id="${c.id}">🧽 Clean <kbd>C</kbd></button>`;
    html += `<button class="btn ghost" data-act="open" data-key="cart:${c.id}">📋 Manage</button>`;
  } else if (nearestShopDoor()) {
    const { s, b } = nearestShopDoor();
    if (s) {
      const T_ = SHOP_TYPES[s.type];
      html += `<span class="ab-label">${T_.emoji} ${escapeHtml(s.name)}</span>`;
      html += `<button class="btn" data-act="open" data-key="shop:${s.id}">📋 Manage</button>`;
      html += `<button class="btn ghost" data-act="shop-edit" data-id="${s.id}">🛠️ Edit layout</button>`;
      if (s.dirt > 5) html += `<button class="btn ghost" data-act="shop-clean" data-id="${s.id}">🧽 Clean</button>`;
    } else {
      html += `<span class="ab-label">🏪 Shop for rent</span><button class="btn" data-act="open" data-key="building:${b.id}">🔎 Take a look (${fmtMoney(b.leasePerMin)}/min)</button>`;
    }
  } else {
    const P = nearestPlot();
    if (P) {
      const st = S.plots[P.id];
      html += `<span class="ab-label">${st ? (st.type === 'farm' ? '🌾 Your farm' : st.type === 'ranch' ? '🐄 Your ranch' : '🟫 Your land') : '🏷️ Land for sale'}</span>`;
      html += `<button class="btn" data-act="open" data-key="plot:${P.id}">${st ? '📋 Manage' : '🔎 Take a look (' + fmtMoney(P.price) + ')'}</button>`;
    }
  }
  if (html !== bar._html) { bar.innerHTML = html; bar._html = html; bar._waiting = null; }
  if (waiting !== null && waiting !== bar._waiting) {
    const cook = bar.querySelector('[data-act="cart-cook"]'), badge = cook.querySelector('.badge');
    badge.textContent = waiting;
    badge.hidden = !waiting;
    cook.classList.toggle('pulse', waiting > 0);
    bar._waiting = waiting;
  }
  const hide = !html;
  if (hide !== bar._hide) { bar.classList.toggle('hidden', hide); bar._hide = hide; }
}

// ---------- Panels ----------
function openPanel(key) {
  UI.panelKey = key;
  $('panel').classList.remove('hidden');
  renderPanel();
  $('panel-body').scrollTop = 0;
}
function closePanel() {
  UI.panelKey = null;
  $('panel').classList.add('hidden');
}
function renderPanel(force = true) {
  if (!UI.panelKey) return;
  if (!force && (UI.pointerInPanel)) return;
  const [type, id] = UI.panelKey.split(':');
  const fn = PANELS[type];
  if (!fn) return closePanel();
  const r = fn(id);
  if (!r) return closePanel();
  $('panel-title').innerHTML = r.title;
  const body = $('panel-body'), st = body.scrollTop;
  body.innerHTML = r.html;
  body.scrollTop = st;
}

const bar = (v, color) => `<div class="bar"><div style="width:${clamp(v, 0, 100)}%;background:${color}"></div></div>`;
const btn = (label, act, data = {}, cls = '', disabled = false) =>
  `<button class="btn ${cls}" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${v}"`).join(' ')} ${disabled ? 'disabled' : ''}>${label}</button>`;

const PANELS = {
  // ----- list of your carts -----
  carts() {
    const cost = cartCost(S.carts.length);
    let html = `<p class="muted">All your food carts. ${IS_TOUCH ? 'Tap' : 'Click'} one to manage it. A cart is only open when <b>you</b> or a <b>worker</b> is standing at it.</p>`;
    for (const c of S.carts) {
      const C = CUISINES[c.cuisine], w = workerFor('cart', c.id);
      html += `<div class="card row clickable" data-act="open" data-key="cart:${c.id}">
        <div class="big-emoji">${C.emoji}</div>
        <div class="grow"><b>${C.name}</b> <span class="stars">${stars(c.rating)}</span>
        <div class="muted small">${w ? '👷 ' + escapeHtml(w.name) : '⚠️ Nobody working here'} · Served ${c.served} · Earned ${fmtMoney(c.earned)}</div></div>
        <div class="tag ${cartOpen(c) ? 'green' : 'gray'}">${cartOpen(c) ? 'OPEN' : 'CLOSED'}</div></div>`;
    }
    html += `<h3>Buy a new cart: ${fmtMoney(cost)}</h3><p class="muted small">Pick a food, then ${IS_TOUCH ? 'tap' : 'click'} any sidewalk to put it there. Heads up: if the same food is parked nearby, you'll be fighting over customers.</p><div class="cuisine-grid">`;
    for (const k in CUISINES) {
      const C = CUISINES[k];
      html += `<button class="cuisine-btn" data-act="buy-cart" data-cuisine="${k}" ${S.money < cost ? 'disabled' : ''}><span>${C.emoji}</span>${C.name}<small>usually ${fmtMoney(C.fair)}</small></button>`;
    }
    html += `</div>`;
    return { title: '🛒 Food Carts', html };
  },

  // ----- one cart -----
  cart(id) {
    const c = getCart(id);
    if (!c) return null;
    const C = CUISINES[c.cuisine], w = workerFor('cart', c.id);
    const appeal = cartAppeal(c), portions = cartPortions(c), cap = cartCapacity(c);
    const near = !!nearestOwnCart() && nearestOwnCart().id === c.id;
    let html = `<div class="card">
      <div class="row"><div class="big-emoji">${C.emoji}</div><div class="grow"><b>${C.name} cart</b><div class="stars">${stars(c.rating)} <span class="muted small">${c.rating.toFixed(1)}</span></div></div>
      <div class="tag ${cartOpen(c) ? 'green' : 'gray'}">${cartOpen(c) ? 'OPEN' : 'CLOSED'}</div></div>
      <div class="stat-grid">
        <div><span>Served</span><b>${c.served}</b></div><div><span>Earned</span><b>${fmtMoney(c.earned)}</b></div>
        <div><span>Waiting</span><b>${c._queue.length}/${cartQueueMax(c)}</b></div><div><span>Gave up waiting</span><b>${c.lost}</b></div>
      </div>
      <div class="label-row"><span>Appeal</span><span>${Math.round(appeal)}%</span></div>${bar(appeal, appeal > 55 ? '#2a9d8f' : appeal > 30 ? '#e9c46a' : '#e63946')}
      ${appealBreakdown(cartAppealParts(c))}
      <div class="label-row"><span>Dirt</span><span>${Math.round(c.dirt)}%</span></div>${bar(c.dirt, '#8b5e34')}
      <div class="label-row"><span>Ingredients</span><span>enough for ${portions}/${cap} meals</span></div>${bar(portions / cap * 100, '#4cc9f0')}
    </div>`;

    html += `<div class="card"><div class="row"><div class="grow"><b>Price</b><div class="muted small">Most people charge ${fmtMoney(C.fair)}. Ingredients cost you about ${fmtMoney(mealCost(c))}.</div></div>
      ${btn('−', 'cart-price', { id: c.id, d: -0.5 }, 'sq')}<div class="price">${fmtMoney(c.price)}</div>${btn('+', 'cart-price', { id: c.id, d: 0.5 }, 'sq')}</div>
      <p class="muted small">Go cheaper and more people stop by. Go pricier and you make more per meal.</p>
      ${autoPriceRow('cart', c, workersFor('cart', c.id))}</div>`;

    html += `<div class="card"><b>What to do</b><div class="btn-row">
      ${near ? btn('🍳 Cook', 'cart-cook', { id: c.id }) + (c.dirt > 5 ? btn('🧽 Clean', 'cart-clean', { id: c.id }) : '') : btn('🚀 Go there', 'cart-travel', { id: c.id })}
      ${btn(`📦 Restock (~${fmtMoney(restockCostEstimate(c))})`, 'cart-restock', { id: c.id })}
      ${btn('↔️ Move', 'cart-move', { id: c.id }, 'ghost')}
      ${S.carts.length > 1 ? btn('💲 Sell ($100)', 'cart-sell', { id: c.id }, 'ghost danger') : ''}
      </div><div class="chips">${C.recipe.map(g => `<span class="chip">${GOODS[g].emoji} ${c.stock[g] || 0}</span>`).join('')}</div>
      <p class="muted small">Restocking grabs what you have in storage first, then buys the rest at the market.</p></div>`;

    html += `<div class="card"><b>Worker</b>`;
    if (w) {
      html += `<div class="row">${workerFace(w)}<div class="grow"><b>${escapeHtml(w.name)}</b> <span class="stars">${stars(w.stars)}</span>
        <div class="muted small">Level ${w.level} · ${fmtMoney(w.wage)} per meal</div></div>${btn('Remove', 'unassign', { w: w.id }, 'ghost')}</div>`;
    } else {
      const free = S.workers.filter(x => !x.assign);
      if (free.length) html += `<p class="muted small">Pick someone to run this cart for you:</p>` + free.map(x => `<div class="row">${workerFace(x)}<div class="grow">${escapeHtml(x.name)} <span class="stars">${stars(x.stars)}</span> <span class="muted small">Level ${x.level}</span></div>${btn('Put to work', 'assign', { w: x.id, type: 'cart', id: c.id })}</div>`).join('');
      else html += `<p class="muted small">Everyone's busy right now. ${btn('👷 Hire someone', 'open', { key: 'workers' }, 'ghost')}</p>`;
    }
    html += `</div>`;

    html += `<div class="card"><b>Upgrades</b>`;
    for (const k in UPGRADES) {
      const U = UPGRADES[k], lvl = c.upgrades[k], max = lvl >= UPGRADE_MAX, cost = upgradeCost(k, lvl);
      html += `<div class="row upg"><div class="big-emoji sm">${U.icon}</div><div class="grow"><b>${U.name}</b> <span class="muted small">Level ${lvl}/${UPGRADE_MAX}</span><div class="muted small">${U.desc}</div>
        <div class="pips">${Array.from({ length: UPGRADE_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        ${max ? '<span class="tag green">MAX</span>' : btn(fmtMoney(cost), 'cart-upgrade', { id: c.id, up: k }, '', S.money < cost)}</div>`;
    }
    html += `</div>`;
    return { title: `${C.emoji} ${C.name} Cart`, html };
  },

  // ----- workers -----
  workers() {
    let html = `<p class="muted">Workers run your carts, shops and farms for you, even when you're offline. You only pay them when they actually get something done, and they get better the more they work.</p>`;
    html += `<div class="card"><b>What they learn as they level up</b><ol class="perks">${WORKER_PERKS.map(p => `<li>${p}</li>`).join('')}</ol></div>`;
    html += `<h3>Your staff (${S.workers.length})</h3>`;
    if (!S.workers.length) html += `<p class="muted small">Nobody yet. Hire someone below!</p>`;
    for (const w of S.workers) {
      const where = !w.assign ? 'Waiting for a job'
        : w.assign.type === 'cart' ? (() => { const c = getCart(w.assign.id); return c ? `${CUISINES[c.cuisine].emoji} ${CUISINES[c.cuisine].name} cart` : '?'; })()
        : w.assign.type === 'shop' ? (() => { const sh = getShop(w.assign.id); return sh ? `${SHOP_TYPES[sh.type].emoji} Working the register at ${escapeHtml(sh.name)}` : '?'; })()
        : `🌾 Plot #${w.assign.id + 1}`;
      const xpNeed = xpForLevel(w.level);
      html += `<div class="card"><div class="row">${workerFace(w)}<div class="grow"><b>${escapeHtml(w.name)}</b> <span class="stars">${stars(w.stars)}</span>
        <div class="muted small">Level ${w.level} · ${fmtMoney(w.wage)} per job · paid ${fmtMoney(w.earned)} so far</div><div class="muted small">📍 ${where}</div></div>
        <div class="col">${w.assign ? btn('Remove', 'unassign', { w: w.id }, 'ghost') : ''}${btn('Fire', 'fire', { w: w.id }, 'ghost danger')}</div></div>
        ${w.level < WORKER_MAX_LEVEL ? `<div class="label-row small"><span>XP to level ${w.level + 1}</span><span>${w.xp}/${xpNeed}</span></div>${bar(w.xp / xpNeed * 100, '#8338ec')}` : '<div class="muted small">⭐ Fully trained!</div>'}
        ${!w.assign ? assignOptions(w) : ''}</div>`;
    }
    html += `<h3>People looking for work</h3>`;
    for (let i = 0; i < S.hirePool.length; i++) {
      const w = S.hirePool[i];
      html += `<div class="card row">${workerFace(w)}<div class="grow"><b>${escapeHtml(w.name)}</b> <span class="stars">${stars(w.stars)}</span>
        <div class="muted small">Asks for ${fmtMoney(w.wage)} per job</div></div>${btn('Hire ' + fmtMoney(w.hireCost), 'hire', { i }, '', S.money < w.hireCost)}</div>`;
    }
    html += `<p class="muted small">New people show up in ${fmtTime((S.hireRefreshAt - Date.now()) / 1000)}. ${btn('🔄 Look for others now ($15)', 'refresh-hires', {}, 'ghost')}</p>`;
    return { title: '👷 Workers', html };
  },

  // ----- land -----
  land() {
    let html = `<p class="muted">Buy plots out in the countryside, past the edge of the city. Turn one into a <b>farm</b> to grow crops, or a <b>ranch</b> to raise animals. You can also ${IS_TOUCH ? 'tap' : 'click'} any <b>FOR SALE</b> sign on the map.</p>`;
    const owned = Object.keys(S.plots);
    html += `<h3>Your land (${owned.length})</h3>`;
    for (const id of owned) {
      const st = S.plots[id], P = World.plots[id];
      const label = st.type === 'farm' ? `🌾 Farm (${GOODS[st.seed].emoji})` : st.type === 'ranch' ? `🐄 Ranch (${st.animals.length} animals)` : '🟫 Empty land';
      const extra = st.type === 'farm' ? (() => { const k = plotCounts(id); return `${k.ready} ready · ${k.growing} growing · ${k.empty} empty`; })() : '';
      html += `<div class="card row clickable" data-act="open" data-key="plot:${id}"><div class="grow"><b>Plot #${+id + 1}</b>: ${label}<div class="muted small">${P.w}×${P.h} tiles ${extra ? '· ' + extra : ''} ${workerFor('plot', id) ? '· 👷 has a worker' : ''}</div></div><span>›</span></div>`;
    }
    const px = Game.player.x / TILE, py = Game.player.y / TILE;
    const forSale = World.plots.filter(P => !S.plots[P.id]).sort((a, b) => dist(px, py, a.x, a.y) - dist(px, py, b.x, b.y)).slice(0, 6);
    html += `<h3>Plots for sale near you</h3>`;
    for (const P of forSale) {
      html += `<div class="card row"><div class="grow"><b>Plot #${P.id + 1}</b> <span class="muted small">${P.w}×${P.h} · ${Math.round(dist(px, py, P.x, P.y))} tiles away</span></div>
        ${btn('🔎', 'open', { key: 'plot:' + P.id }, 'ghost sq')}${btn('Buy ' + fmtMoney(P.price), 'plot-buy', { id: P.id }, '', S.money < P.price)}</div>`;
    }
    return { title: '🌾 Land', html };
  },

  plot(id) {
    const P = World.plots[id];
    if (!P) return null;
    const st = S.plots[id];
    const near = playerNearPlot(id);
    let html = '';
    if (!st) {
      html += `<div class="card"><b>Plot #${P.id + 1}</b> (${P.w}×${P.h} tiles)<div class="stat-grid"><div><span>Price</span><b>${fmtMoney(P.price)}</b></div><div><span>Spots to plant</span><b>${P.w * P.h}</b></div></div>
        <div class="btn-row">${btn('Buy for ' + fmtMoney(P.price), 'plot-buy', { id }, '', S.money < P.price)}${near ? '' : btn('🚕 Taxi here ($5)', 'plot-travel', { id }, 'ghost')}</div></div>`;
      return { title: '🏷️ Land for sale', html };
    }
    if (!near) html += `<div class="card warn">You'll need to be here in person to plant, harvest or feed the animals. ${btn('🚀 Go there', 'plot-travel', { id })}</div>`;
    const w = workerFor('plot', id);
    if (!st.type) {
      html += `<div class="card"><b>So, what's this land going to be?</b>
        <div class="choice">${btn('🌾 Make a farm<br><small>free · grow crops</small>', 'plot-make', { id, type: 'farm' })}
        ${btn(`🐄 Make a ranch<br><small>${fmtMoney(RANCH_FENCE_COST)} fence · raise animals</small>`, 'plot-make', { id, type: 'ranch' }, '', S.money < RANCH_FENCE_COST)}</div></div>`;
    } else if (st.type === 'farm') {
      const k = plotCounts(id);
      html += `<div class="card"><div class="stat-grid"><div><span>Ready</span><b>${k.ready}</b></div><div><span>Growing</span><b>${k.growing}</b></div><div><span>Empty</span><b>${k.empty}</b></div><div><span>Each spot gives</span><b>${CROP_YIELD}</b></div></div>
        <div class="btn-row">${btn(`🌱 Plant ${k.empty} (${fmtMoney(k.empty * GOODS[st.seed].base * SEED_COST_MULT)})`, 'plot-plant', { id }, '', !near || !k.empty)}${btn(`🧺 Harvest ${k.ready}`, 'plot-harvest', { id }, '', !near || !k.ready)}</div></div>`;
      html += `<div class="card"><b>What to plant</b><div class="seed-grid">${CROPS.map(g => `<button class="seed ${st.seed === g ? 'sel' : ''}" data-act="plot-seed" data-id="${id}" data-g="${g}"><span>${GOODS[g].emoji}</span>${GOODS[g].name}<small>${GOODS[g].grow}s · sells ${fmtMoney(sellPrice(g))}</small></button>`).join('')}</div></div>`;
    } else {
      const out = Object.entries(st.output).filter(([, v]) => v > 0);
      html += `<div class="card"><div class="label-row"><span>🌽 Trough (your animals eat corn)</span><span>${Math.floor(st.trough)}/${TROUGH_MAX}</span></div>${bar(st.trough / TROUGH_MAX * 100, '#ffd166')}
        <div class="btn-row">${btn(`🌽 Fill trough`, 'ranch-fill', { id }, '', !near)}${btn(`🧺 Collect ${out.reduce((s, [, v]) => s + v, 0)}`, 'ranch-collect', { id }, '', !near || !out.length)}</div>
        <div class="chips">${out.map(([g, v]) => `<span class="chip">${GOODS[g].emoji} ${v}</span>`).join('') || '<span class="muted small">Nothing to collect yet</span>'}</div>
        <p class="muted small">You've got ${Math.floor(S.inventory.corn)} 🌽 in storage. If that's not enough, the rest gets bought at the market.</p></div>`;
      html += `<div class="card"><b>Animals (${st.animals.length}/${RANCH_MAX_ANIMALS})</b>`;
      for (const k in ANIMALS) {
        const A = ANIMALS[k], count = st.animals.filter(a => a.kind === k).length;
        html += `<div class="row"><div class="big-emoji sm">${A.emoji}</div><div class="grow"><b>${A.name}</b> × ${count}<div class="muted small">1 ${GOODS[A.product].emoji} every ${A.every}s · eats ${A.feed} 🌽</div></div>
          ${btn('Buy ' + fmtMoney(A.cost), 'ranch-buy', { id, a: k }, '', S.money < A.cost || st.animals.length >= RANCH_MAX_ANIMALS)}</div>`;
      }
      html += `</div>`;
    }
    if (st.type) {
      html += `<div class="card"><b>${st.type === 'farm' ? 'Farm hand' : 'Rancher'}</b><p class="muted small">${st.type === 'farm' ? 'Harvests and replants for you. Seeds come out of your cash.' : 'Keeps the trough full and brings everything back to your storage.'}</p>`;
      if (w) html += `<div class="row">${workerFace(w)}<div class="grow"><b>${escapeHtml(w.name)}</b> <span class="stars">${stars(w.stars)}</span></div>${btn('Take off this job', 'unassign', { w: w.id }, 'ghost')}</div>`;
      else {
        const free = S.workers.filter(x => !x.assign);
        html += free.length ? free.map(x => `<div class="row">${workerFace(x)}<div class="grow">${escapeHtml(x.name)} <span class="stars">${stars(x.stars)}</span></div>${btn('Put to work', 'assign', { w: x.id, type: 'plot', id })}</div>`).join('')
          : `<p class="muted small">Everyone's busy right now. ${btn('👷 Hire someone', 'open', { key: 'workers' }, 'ghost')}</p>`;
      }
      html += `</div>`;
    }
    return { title: `${st.type === 'farm' ? '🌾 Farm' : st.type === 'ranch' ? '🐄 Ranch' : '🟫 Land'}: Plot #${P.id + 1}`, html };
  },

  // ----- buildings -----
  property() {
    let html = `<p class="muted">Buy buildings around the city and your tenants pay you rent every minute, even while you're offline.</p>`;
    const owned = Object.keys(S.buildings).map(id => World.buildings[id]);
    const rent = owned.reduce((s, b) => s + b.rentPerMin, 0);
    html += `<h3>Your buildings (${owned.length}): ${fmtMoney(rent)}/min</h3>`;
    for (const b of owned) html += `<div class="card row clickable" data-act="open" data-key="building:${b.id}"><div class="grow"><b>🏢 ${b.kind}</b><div class="muted small">${b.w}×${b.h} · ${b.floors} floors · ${fmtMoney(b.rentPerMin)}/min</div></div><span>›</span></div>`;
    const sale = World.buildings.filter(b => b.forSale && !S.buildings[b.id]).sort((a, b) => a.price - b.price).slice(0, 12);
    html += `<h3>For sale</h3>`;
    for (const b of sale) {
      html += `<div class="card row"><div class="grow"><b>${b.kind}</b> <span class="muted small">${b.w}×${b.h} · ${b.floors}F</span>
        <div class="muted small">Rent ${fmtMoney(b.rentPerMin)}/min · pays for itself in about ${Math.round(b.price / b.rentPerMin)} min</div></div>
        ${btn('🔎', 'bld-travel', { id: b.id }, 'ghost sq')}${btn(fmtMoney(b.price), 'bld-buy', { id: b.id }, '', S.money < b.price)}</div>`;
    }
    return { title: '🏢 Property', html };
  },

  building(id) {
    const b = World.buildings[id];
    if (!b) return null;
    const owned = !!S.buildings[id];
    let html = `<div class="card"><b>${b.kind}</b><div class="stat-grid">
      <div><span>Size</span><b>${b.w}×${b.h}</b></div><div><span>Floors</span><b>${b.floors}</b></div>
      <div><span>Value</span><b>${fmtMoney(b.price)}</b></div><div><span>Rent</span><b>${fmtMoney(b.rentPerMin)}/min</b></div></div>`;
    if (owned) html += `<p class="muted small">It's yours! Rent comes in on its own.</p>${btn('Sell for ' + fmtMoney(b.price * 0.8), 'bld-sell', { id }, 'ghost danger')}`;
    else if (b.forSale) html += `${btn('Buy for ' + fmtMoney(b.price), 'bld-buy', { id }, '', S.money < b.price)}`;
    else html += `<p class="muted small">The owner isn't selling this one, sorry.</p>`;
    html += `</div>`;
    return { title: '🏢 Building', html };
  },

  // ----- storage -----
  inventory() {
    let html = `<p class="muted">Everything you've harvested or bought. Your carts restock from here first.</p><div class="card">`;
    let total = 0;
    for (const g in GOODS) {
      const n = Math.floor(S.inventory[g]); total += n * sellPrice(g);
      html += `<div class="row"><div class="big-emoji sm">${GOODS[g].emoji}</div><div class="grow"><b>${GOODS[g].name}</b> × ${n}<div class="muted small">worth about ${fmtMoney(n * sellPrice(g))}</div></div>
        ${btn('Sell 10', 'mkt-sell', { g, n: 10 }, 'ghost', n < 1)}${btn('Sell all', 'mkt-sell', { g, n: 'all' }, 'ghost', n < 1)}</div>`;
    }
    html += `</div><p><b>All together it's worth about</b> ${fmtMoney(total)}</p>`;
    return { title: '📦 Storage', html };
  },

  // ----- market -----
  market() {
    let html = `<p class="muted">The whole city shares one market, and prices change all the time. Buy when it's cheap and sell when it's high! Heads up: buying or selling a lot at once moves the price.</p>`;
    for (const g in GOODS) {
      const m = S.market[g], first = m.hist[0], ch = (m.price - first) / first * 100;
      html += `<div class="card mkt"><div class="row"><div class="big-emoji sm">${GOODS[g].emoji}</div>
        <div class="grow"><b>${GOODS[g].name}</b> <span class="${ch >= 0 ? 'up' : 'down'} small">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}%</span>
        <div class="muted small">Buy ${fmtMoney(buyPrice(g))} · Sell ${fmtMoney(sellPrice(g))} · You have ${Math.floor(S.inventory[g])}</div></div>
        ${sparkline(m.hist.concat([m.price]), 80, 26, ch >= 0 ? '#2a9d8f' : '#e63946')}</div>
        <div class="btn-row">${btn('Buy 10', 'mkt-buy', { g, n: 10 }, 'ghost')}${btn('Buy 50', 'mkt-buy', { g, n: 50 }, 'ghost')}${btn('Sell 10', 'mkt-sell', { g, n: 10 }, 'ghost', S.inventory[g] < 1)}${btn('Sell all', 'mkt-sell', { g, n: 'all' }, 'ghost', S.inventory[g] < 1)}</div></div>`;
    }
    return { title: '📈 Market', html };
  },

  // ----- bank -----
  bank() {
    const nw = netWorth(S);
    let html = `<div class="card"><div class="stat-grid">
      <div><span>Cash</span><b>${fmtMoney(S.money)}</b></div><div><span>Savings</span><b>${fmtMoney(S.bank.savings)}</b></div>
      <div><span>Interest</span><b>${(BANK_RATE_PER_MIN * 100).toFixed(2)}%/min</b></div><div><span>Net worth</span><b>${fmtMoney(nw)}</b></div></div>
      <p class="muted small">Money in savings grows a little every second, even when you're offline. You can't spend it until you take it back out, though.</p>
      <div class="btn-row">${btn('Put in $100', 'bank-dep', { a: 100 })}${btn('Put it all in', 'bank-dep', { a: 'all' })}</div>
      <div class="btn-row">${btn('Take out $100', 'bank-wd', { a: 100 }, 'ghost')}${btn('Take it all out', 'bank-wd', { a: 'all' }, 'ghost')}</div></div>`;
    html += `<div class="card"><b>Your story so far</b><div class="stat-grid">
      <div><span>Meals served</span><b>${S.stats.served}</b></div><div><span>Cooked by you</span><b>${S.stats.playerServed}</b></div>
      <div><span>Shop customers</span><b>${S.stats.shopServed}</b></div><div><span>Shop sales</span><b>${fmtMoney(S.stats.shopEarned)}</b></div>
      <div><span>Crops harvested</span><b>${S.stats.harvested}</b></div><div><span>Money made in total</span><b>${fmtMoney(S.stats.earned)}</b></div></div></div>`;
    return { title: '🏦 Bank', html };
  },

  // ----- help + settings -----
  help(tab) {
    tab = tab || UI.helpTab || 'howto';
    UI.helpTab = tab;
    const tabs = `<div class="tabs">${[['howto', '📖 How to play'], ['settings', '⚙️ Settings']].map(([k, l]) =>
      `<button class="tab ${tab === k ? 'sel' : ''}" data-act="help-tab" data-t="${k}">${l}</button>`).join('')}</div>`;
    const title = `❓ Help <span class="version">${GAME_VERSION}</span>`;
    if (tab === 'settings') return { title, html: tabs + settingsHtml() };
    return {
      title, html: tabs + `
      <div class="card"><b>Controls</b><ul>
        ${controlsList()}
        <li>${IS_TOUCH ? 'Tap' : 'Click'} the minimap to open the big city map</li>
        <li>${IS_TOUCH ? 'Tap' : 'Click'} carts, shops, plots and buildings to open them${IS_TOUCH ? '. Swipe a menu down to close it' : '. <kbd>Esc</kbd> closes things'}</li></ul></div>
      <div class="card"><b>How to get rich</b><ol>
        <li>Follow the story. Your goals are in the top-left, and you can ${IS_TOUCH ? 'tap' : 'click'} them to read the chapter again.</li>
        <li>Hang out by your cart. When people line up, ${IS_TOUCH ? 'tap <b>Cook</b>' : 'press <kbd>E</kbd>'} and play the cooking game. Cook well and you'll get bigger tips and better reviews.</li>
        <li>Keep your cart clean and stocked. Nobody wants food from a dirty or overpriced cart.</li>
        <li>Buy some upgrades, then <b>hire a worker</b> so the cart keeps going without you.</li>
        <li>Once you reach Chapter 3, rent a <b>shop</b>. Add counters and shelves, stock it up, and hire cashiers.</li>
        <li>Buy land outside the city to farm and raise animals, buy buildings to rent out, and stash spare cash in the bank.</li></ol>
        <p class="muted small">Lunch (11 to 2) and dinner (5 to 8) are the busiest times. At night the streets go quiet.</p></div>` };
  },
};

function settingsHtml() {
  const toggle = (k, label, desc) => `<div class="row setting"><div class="grow"><b>${label}</b><div class="muted small">${desc}</div></div>
    <button class="switch ${Settings[k] ? 'on' : ''}" data-act="setting" data-k="${k}" data-v="${!Settings[k]}"><i></i></button></div>`;
  const choice = (k, label, desc, opts) => `<div class="row setting"><div class="grow"><b>${label}</b><div class="muted small">${desc}</div></div>
    <div class="seg">${opts.map(([v, l]) => `<button class="${String(Settings[k]) === String(v) ? 'sel' : ''}" data-act="setting" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  return `
    <div class="card"><b>Display</b>
      ${toggle('minimap', 'Minimap', 'The little map in the corner')}
      ${toggle('night', 'Night lighting', 'Darker nights with glowing street lights')}
      ${toggle('floats', 'Money pop-ups', 'The little "+$9" that floats up when you sell something')}
      ${IS_TOUCH ? '' : toggle('tooltips', 'Hover info', 'Shows details when your mouse is over something')}
      ${IS_TOUCH ? toggle('joystick', 'Joystick', 'A joystick for walking around. You can always tap the map instead') : ''}
      ${document.fullscreenEnabled ? `<div class="row setting"><div class="grow"><b>Full screen</b><div class="muted small">Hides the browser bars so you get more screen</div></div>${btn(document.fullscreenElement ? 'Exit' : '⛶ Go', 'fullscreen', {}, 'ghost')}</div>` : ''}
    </div>
    <div class="card"><b>Gameplay</b>
      ${IS_TOUCH ? '' : toggle('alwaysRun', 'Always run', "Run without holding Shift. Holding Shift makes you walk instead")}
      ${choice('crowd', 'Crowds', 'Fewer people can help if the game feels slow', [['calm', 'Calm'], ['normal', 'Normal'], ['busy', 'Busy']])}
      ${choice('autosave', 'Autosave', 'How often the game saves on its own', [[10, '10s'], [15, '15s'], [30, '30s'], [60, '1 min']])}
    </div>
    <div class="card"><b>Your save</b><p class="muted small">Your game is saved in this browser. Download a backup to keep it safe, or to move it to another device.</p>
      <div class="btn-row">${btn('💾 Save now', 'save')}${btn('📥 Download backup', 'export-save', {}, 'ghost')}${btn('📤 Load backup', 'import-save', {}, 'ghost')}</div>
      <div class="btn-row">${btn('↩️ Reset settings', 'reset-settings', {}, 'ghost')}${btn('🗑️ Start over', 'reset', {}, 'ghost danger')}</div></div>
    <div class="card about"><b>Capital.io</b> <span class="version">${GAME_VERSION}</span>
      <p class="muted small">A 2D city business game inspired by Capital Rift and Big Ambitions. It's still in beta, so things might change and some prices might feel off.</p></div>`;
}

// The list under the appeal bar: what's helping (+) and what's hurting (−)
function appealBreakdown(parts) {
  const raw = parts.reduce((sum, p) => sum + p.value, 0);
  const rows = parts.map(p => {
    const v = Math.round(p.value);
    const num = v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';
    const icon = p.competition != null ? (p.competition ? '⚠️ ' : '✅ ') : '';
    return `<div class="why-row ${p.competition ? 'warn' : ''}"><span>${icon}${p.label}</span><b class="${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${num}</b></div>`;
  }).join('');
  const capped = raw < 3 || raw > 97 ? `<div class="muted small">Appeal can't go below 3% or above 97%.</div>` : '';
  return `<div class="why"><div class="why-title">What's affecting your appeal</div>${rows}${capped}</div>`;
}

function assignOptions(w) {
  const carts = S.carts.filter(c => !workerFor('cart', c.id));
  const plots = Object.keys(S.plots).filter(id => S.plots[id].type && !workerFor('plot', id));
  const shops = S.shops.filter(sh => workersFor('shop', sh.id).length < Math.max(1, countFurn(sh, 'counter')));
  if (!carts.length && !plots.length && !shops.length) return '<p class="muted small">There\'s nothing free to put them on right now.</p>';
  return `<div class="btn-row">` +
    shops.map(sh => btn(`→ ${SHOP_TYPES[sh.type].emoji} shop`, 'assign', { w: w.id, type: 'shop', id: sh.id }, 'ghost small')).join('') +
    carts.map(c => btn(`→ ${CUISINES[c.cuisine].emoji} cart`, 'assign', { w: w.id, type: 'cart', id: c.id }, 'ghost small')).join('') +
    plots.map(id => btn(`→ ${S.plots[id].type === 'farm' ? '🌾' : '🐄'} plot #${+id + 1}`, 'assign', { w: w.id, type: 'plot', id }, 'ghost small')).join('') + `</div>`;
}

function workerFace(w) {
  return `<div class="face" style="--shirt:${w.shirt};--skin:${w.skin};--hair:${w.hair}"><i></i></div>`;
}

// ---------- Button actions ----------
function validCartSpot(x, y, ignoreId) {
  const t = tileAt(x, y);
  if (t !== T.SIDEWALK && t !== T.PLAZA) return false;
  return !allCarts().some(c => c.id !== ignoreId && Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) < 2);
}

function startPlacement(p) {
  UI.placement = p;
  closePanel();
  updatePlacementHint();
  $('placement-hint').classList.remove('hidden');
}
function endPlacement() {
  UI.placement = null;
  $('placement-hint').classList.add('hidden');
}

// The spot being looked at: where your mouse is, or (on phones) the spot you tapped
function placementSpot() {
  const p = UI.placement;
  return IS_TOUCH ? p.preview || null : UI.hoverTile;
}

// The hint at the top while placing a cart. It warns you about same-food carts
// near the spot before you pay for it.
function updatePlacementHint() {
  const p = UI.placement;
  if (!p) return;
  const C = CUISINES[p.cuisine], food = C.name.toLowerCase(), spot = placementSpot();
  const price = p.mode === 'new' ? ` (${fmtMoney(cartCost(S.carts.length))})` : '';
  let info = '', confirm = '';
  if (spot) {
    if (!validCartSpot(spot.x, spot.y, p.cartId)) info = `🚫 You can't park a cart here`;
    else {
      const n = sameFoodNearby(p.cuisine, spot.x, spot.y, p.cartId);
      info = n ? `⚠️ ${n} other ${food} cart${n > 1 ? 's' : ''} nearby (−${n * COMPETE_PENALTY} appeal)` : `✅ No other ${food} carts nearby. Nice spot!`;
      if (IS_TOUCH) confirm = `<button class="btn small" data-act="place-confirm">✅ Place here${price}</button>`;
    }
  }
  const key = p.cuisine + '|' + info;
  if ($('placement-hint')._key === key) return; // nothing changed, don't rebuild the buttons
  $('placement-hint')._key = key;
  $('placement-hint').innerHTML = `<div>${C.emoji} ${IS_TOUCH ? 'Tap' : 'Click'} an empty <b>sidewalk</b> or <b>plaza</b> spot for your cart${IS_TOUCH ? '' : price}</div>
    ${info ? `<div class="ph-info">${info}</div>` : ''}
    <div class="ph-buttons">${confirm}<button class="btn small ghost" data-act="cancel-place">✕ Cancel</button></div>`;
}

// What tapping/clicking the map does while placing a cart
function placementTap(x, y) {
  if (!IS_TOUCH) { tryPlace(x, y); return; }
  UI.placement.preview = { x, y }; // phones: preview first, then press "Place here"
  updatePlacementHint();
}
function tryPlace(x, y) {
  const p = UI.placement;
  if (!validCartSpot(x, y, p.cartId)) { toast("You can't park a cart there. Try an empty sidewalk!", 'bad'); return; }
  if (p.mode === 'new') {
    if (!spend(cartCost(S.carts.length))) return;
    const c = makeCart(p.cuisine, x, y);
    S.carts.push(c);
    restockCart(c, true);
    toast(`Your new ${CUISINES[p.cuisine].name} cart is ready! Hire someone to run it.`, 'good');
    endPlacement();
    openPanel('cart:' + c.id);
  } else {
    const c = getCart(p.cartId);
    if (c) {
      for (const n of c._queue.slice()) leaveCart(n, false, '🤷');
      c.x = x; c.y = y;
      toast('Cart moved!', 'good');
    }
    endPlacement();
    if (c) openPanel('cart:' + c.id);
  }
}

function startCooking(c) {
  if (!c) return;
  if (!nearestOwnCart() || nearestOwnCart().id !== c.id) { toast('Walk up to your cart first', 'bad'); return; }
  if (cartPortions(c) < 1) { toast("You're out of ingredients. Restock first!", 'bad'); return; }
  if (!c._queue.some(n => n.arrived)) { toast("Nobody's waiting yet. Hang tight!", 'info'); return; }
  c._playerCooking = true;
  Minigame.start(CUISINES[c.cuisine].game, c, score => {
    c._playerCooking = false;
    if (serveCustomer(c, score, null)) S.stats.playerServed++;
    else toast('Oops, they got tired of waiting and left.', 'bad');
  });
}

function startCleaning(c) {
  if (!c) return;
  if (!nearestOwnCart() || nearestOwnCart().id !== c.id) { toast('Walk up to your cart first', 'bad'); return; }
  if (c.dirt < 1) { toast("It's already spotless!", 'info'); return; }
  Minigame.start('scrub', c, () => { c.dirt = 0; S.stats.cleaned++; toast('Squeaky clean! ✨', 'good'); });
}

// ---------- Auto-price (Level 3 workers change prices by themselves) ----------
// autoPrice is on unless it's been set to false. Changing a price yourself turns it off.
function autoPriceRow(kind, x, ws) {
  const on = x.autoPrice !== false, pro = ws.some(w => w.level >= 3);
  const desc = !pro ? 'Needs a Level 3 worker here. They raise prices when it\'s busy and lower them when it\'s quiet.'
    : on ? 'Your worker changes prices based on how busy it is. Change a price yourself to turn this off.'
    : "Off, so your prices stay exactly where you put them.";
  return `<div class="row setting"><div class="grow"><b>🤖 Auto-price</b><div class="muted small">${desc}</div></div>
    <button class="switch ${on ? 'on' : ''}" data-act="auto-price" data-kind="${kind}" data-id="${x.id}"><i></i></button></div>`;
}
function manualPrice(x, ws) {
  if (x.autoPrice === false) return;
  x.autoPrice = false;
  if (ws.some(w => w.level >= 3)) toast("✋ Auto-price is off now, so your worker won't change your prices.", 'info');
}

const ACTIONS = {
  open: d => openPanel(d.key),
  'cart-price': d => { const c = getCart(d.id); c.price = clamp(Math.round((c.price + +d.d) * 2) / 2, 0.5, 99); manualPrice(c, workersFor('cart', c.id)); },
  'auto-price': d => {
    const x = d.kind === 'shop' ? getShop(d.id) : getCart(d.id);
    x.autoPrice = x.autoPrice === false;
    toast(x.autoPrice ? '🤖 Auto-price is on. Your Level 3+ worker will set prices.' : "✋ Auto-price is off. Your prices won't change.", 'info');
  },
  'cart-upgrade': d => {
    const c = getCart(d.id), lvl = c.upgrades[d.up];
    if (lvl >= UPGRADE_MAX) return;
    if (spend(upgradeCost(d.up, lvl))) { c.upgrades[d.up]++; toast(`${UPGRADES[d.up].icon} ${UPGRADES[d.up].name} is now level ${lvl + 1}!`, 'good'); }
  },
  'cart-restock': d => restockCart(getCart(d.id)),
  'cart-cook': d => startCooking(getCart(d.id)),
  'cart-clean': d => startCleaning(getCart(d.id)),
  'cart-move': d => { const c = getCart(d.id); startPlacement({ mode: 'move', cuisine: c.cuisine, cartId: c.id }); },
  'cart-travel': d => { const c = getCart(d.id); teleportPlayer(c.x, c.y + 1); },
  'cart-sell': d => {
    const c = getCart(d.id);
    if (!confirm('Sell this cart for $100? You can\'t undo this.')) return;
    for (const n of c._queue.slice()) leaveCart(n, false, '🤷');
    const w = workerFor('cart', c.id); if (w) w.assign = null;
    S.carts = S.carts.filter(x => x !== c);
    addMoney(100, false);
    closePanel();
  },
  'buy-cart': d => {
    if (S.money < cartCost(S.carts.length)) { toast("You don't have enough money for that yet", 'bad'); return; }
    startPlacement({ mode: 'new', cuisine: d.cuisine, cartId: null });
  },
  hire: d => {
    const w = S.hirePool[+d.i];
    if (!w || !spend(w.hireCost)) return;
    S.hirePool.splice(+d.i, 1);
    S.workers.push(w);
    if (S.hirePool.length < 2) S.hirePool.push(genWorker());
    toast(`You hired ${w.name}! Now give them a job.`, 'good');
  },
  'refresh-hires': () => { if (spend(15)) refreshHirePool(); },
  fire: d => {
    const w = S.workers.find(x => x.id === +d.w);
    if (w && confirm(`Let ${w.name} go? They won't come back.`)) S.workers = S.workers.filter(x => x !== w);
  },
  assign: d => {
    const w = S.workers.find(x => x.id === +d.w);
    if (!w) return;
    assignWorker(w, d.type, d.id);
    toast(`${w.name} is on the job!`, 'good');
  },
  unassign: d => { const w = S.workers.find(x => x.id === +d.w); if (w) w.assign = null; },
  'plot-buy': d => {
    const P = World.plots[d.id];
    if (S.plots[d.id] || !spend(P.price)) return;
    S.plots[d.id] = { type: null, crops: Array(P.w * P.h).fill(null), animals: [], trough: 0, output: {}, seed: 'wheat' };
    toast(`Plot #${P.id + 1} is yours!`, 'good');
    openPanel('plot:' + d.id);
  },
  'plot-make': d => {
    const st = S.plots[d.id];
    if (d.type === 'ranch' && !spend(RANCH_FENCE_COST)) return;
    st.type = d.type;
  },
  'plot-seed': d => { S.plots[d.id].seed = d.g; },
  'plot-plant': d => { if (playerNearPlot(d.id)) plantPlot(d.id); },
  'plot-harvest': d => { if (playerNearPlot(d.id)) harvestPlot(d.id); },
  'plot-travel': d => {
    const P = World.plots[d.id];
    if (!S.plots[d.id] && !spend(5)) return;
    teleportPlayer(P.x + Math.floor(P.w / 2), P.y + P.h);
  },
  'ranch-buy': d => {
    const st = S.plots[d.id], A = ANIMALS[d.a];
    if (st.animals.length >= RANCH_MAX_ANIMALS || !spend(A.cost)) return;
    st.animals.push({ kind: d.a });
    toast(`${A.emoji} Say hi to your new ${A.name.toLowerCase()}! Keep the trough full of corn.`, 'good');
  },
  'ranch-fill': d => { if (playerNearPlot(d.id)) ranchFill(d.id); },
  'ranch-collect': d => { if (playerNearPlot(d.id)) ranchCollect(d.id); },
  'bld-buy': d => {
    const b = World.buildings[d.id];
    if (!b.forSale || S.buildings[d.id] || !spend(b.price)) return;
    S.buildings[d.id] = { since: Date.now() };
    toast(`🏢 The ${b.kind} is yours! It pays ${fmtMoney(b.rentPerMin)}/min in rent.`, 'good');
  },
  'bld-sell': d => {
    const b = World.buildings[d.id];
    if (shopAt(d.id)) { toast("You've got a shop in there. Close it first!", 'bad'); return; }
    if (!confirm(`Sell the ${b.kind} for ${fmtMoney(b.price * 0.8)}?`)) return;
    delete S.buildings[d.id];
    addMoney(b.price * 0.8, false);
  },
  'bld-travel': d => { const b = World.buildings[d.id]; teleportPlayer(b.x + Math.floor(b.w / 2), b.y + b.h); openPanel('building:' + d.id); },
  'mkt-buy': d => { const n = marketBuy(d.g, +d.n); if (n) toast(`Bought ${n} ${GOODS[d.g].emoji}!`, 'good'); },
  'mkt-sell': d => marketSell(d.g, d.n === 'all' ? Math.floor(S.inventory[d.g]) : +d.n),
  'bank-dep': d => {
    const a = d.a === 'all' ? S.money : Math.min(+d.a, S.money);
    if (a <= 0) return;
    S.money -= a; S.bank.savings += a;
  },
  'bank-wd': d => {
    const a = d.a === 'all' ? S.bank.savings : Math.min(+d.a, S.bank.savings);
    if (a <= 0) return;
    S.bank.savings -= a; S.money += a;
  },
  save: () => { saveGame(); toast('Saved! 💾', 'good'); },
  'help-tab': d => openPanel('help:' + d.t),
  'cancel-place': () => endPlacement(),
  'place-confirm': () => { const s = UI.placement && UI.placement.preview; if (s) tryPlace(s.x, s.y); },
  fullscreen: () => toggleFullscreen(),
  setting: d => {
    const v = d.v === 'true' ? true : d.v === 'false' ? false : isNaN(+d.v) ? d.v : +d.v;
    Settings[d.k] = v;
    saveSettings();
    if (d.k === 'autosave') Game.timers.save = Math.min(Game.timers.save, v);
  },
  'reset-settings': () => { Settings = { ...SETTINGS_DEFAULT }; saveSettings(); toast('Settings are back to normal', 'info'); },
  'export-save': () => exportSave(),
  'import-save': () => $('import-file').click(),
  reset: () => {
    if (!confirm("Delete your save and start over? You can't undo this.")) return;
    Game.running = false;
    Game.noSave = true; // otherwise the game saves itself again while reloading
    deleteSave();
    window.onbeforeunload = null;
    location.reload();
  },
};

function handleAction(el) {
  const act = el.dataset.act;
  if (!ACTIONS[act]) return;
  ACTIONS[act](el.dataset);
  if (UI.panelKey && act !== 'open') renderPanel();
  updateHUD();
}

// ---------- Welcome-back pop-up ----------
function showOfflineReport(rep) {
  const rows = [];
  if (rep.meals) rows.push(`🍽️ Your workers served <b>${rep.meals}</b> meals and made ${fmtMoney(rep.sales)} after ingredients`);
  if (rep.wages) rows.push(`👷 You paid <b>${fmtMoney(rep.wages)}</b> in wages`);
  if (rep.goods) rows.push(`🌾 Your farms and ranches made <b>${rep.goods}</b> goods`);
  if (rep.shopSales) rows.push(`🏪 Your shops made <b>${fmtMoney(rep.shopSales)}</b> after restocking`);
  if (rep.leasePaid) rows.push(`🔑 You paid <b>${fmtMoney(rep.leasePaid)}</b> in shop rent`);
  if (rep.rent) rows.push(`🏢 Your tenants paid you <b>${fmtMoney(rep.rent)}</b>`);
  if (rep.interest) rows.push(`🏦 Your savings grew by <b>${fmtMoney(rep.interest)}</b>`);
  if (!rows.length) rows.push("Not much happened. Hire some workers and your business will keep going while you're away!");
  showModal(`<h2>Welcome back, ${escapeHtml(S.name)}!</h2><p class="muted">You were gone for ${fmtTime(rep.secs)}. Here's what happened:</p>
    <ul class="report">${rows.map(r => `<li>${r}</li>`).join('')}</ul>
    <button class="btn big" onclick="closeModal()">Let's go!</button>`, 'report');
}
