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
  const g = GOALS[S.goalIndex];
  $('goal-box').innerHTML = g
    ? `<div class="goal-label">🎯 Goal ${S.goalIndex + 1}/${GOALS.length}</div><div>${g.text}</div><div class="goal-reward">Reward: ${fmtMoney(g.reward)}</div>`
    : `<div class="goal-label">🏆 All goals done!</div><div>Net worth: ${fmtMoney(netWorth(S))}</div>`;
}

function checkGoals() {
  const g = GOALS[S.goalIndex];
  if (g && g.check(S)) {
    addMoney(g.reward, false);
    toast(`🎯 Goal complete! +${fmtMoney(g.reward)}`, 'goal');
    S.goalIndex++;
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

function updateActionBar() {
  const bar = $('action-bar');
  let html = '';
  const c = nearestOwnCart();
  if (c) {
    const C = CUISINES[c.cuisine];
    const waiting = c._queue.filter(n => n.arrived).length;
    html += `<span class="ab-label">${C.emoji} Your ${C.name} cart</span>`;
    html += `<button class="btn ${waiting ? 'pulse' : ''}" data-act="cart-cook" data-id="${c.id}">🍳 Cook <kbd>E</kbd>${waiting ? ` <span class="badge">${waiting}</span>` : ''}</button>`;
    if (c.dirt > 5) html += `<button class="btn" data-act="cart-clean" data-id="${c.id}">🧽 Clean <kbd>C</kbd></button>`;
    html += `<button class="btn ghost" data-act="open" data-key="cart:${c.id}">📋 Manage</button>`;
  } else {
    const P = nearestPlot();
    if (P) {
      const st = S.plots[P.id];
      html += `<span class="ab-label">${st ? (st.type === 'farm' ? '🌾 Your farm' : st.type === 'ranch' ? '🐄 Your ranch' : '🟫 Your land') : '🏷️ Land for sale'}</span>`;
      html += `<button class="btn" data-act="open" data-key="plot:${P.id}">${st ? '📋 Manage' : '🔎 View ' + fmtMoney(P.price)}</button>`;
    }
  }
  if (html !== bar._html) { bar.innerHTML = html; bar._html = html; }
  bar.classList.toggle('hidden', !html);
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
    let html = `<p class="muted">Your food cart business. Click a cart to manage it. Carts only open when <b>you</b> or a <b>worker</b> is there.</p>`;
    for (const c of S.carts) {
      const C = CUISINES[c.cuisine], w = workerFor('cart', c.id);
      html += `<div class="card row clickable" data-act="open" data-key="cart:${c.id}">
        <div class="big-emoji">${C.emoji}</div>
        <div class="grow"><b>${C.name}</b> <span class="stars">${stars(c.rating)}</span>
        <div class="muted small">${w ? '👷 ' + escapeHtml(w.name) : '⚠️ No worker'} · Served ${c.served} · Earned ${fmtMoney(c.earned)}</div></div>
        <div class="tag ${cartOpen(c) ? 'green' : 'gray'}">${cartOpen(c) ? 'OPEN' : 'CLOSED'}</div></div>`;
    }
    html += `<h3>Buy a new cart — ${fmtMoney(cost)}</h3><p class="muted small">Pick a food, then click any sidewalk to place it. The same food parked close by is competition!</p><div class="cuisine-grid">`;
    for (const k in CUISINES) {
      const C = CUISINES[k];
      html += `<button class="cuisine-btn" data-act="buy-cart" data-cuisine="${k}" ${S.money < cost ? 'disabled' : ''}><span>${C.emoji}</span>${C.name}<small>fair ${fmtMoney(C.fair)}</small></button>`;
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
        <div><span>In line</span><b>${c._queue.length}/${cartQueueMax(c)}</b></div><div><span>Walked away</span><b>${c.lost}</b></div>
      </div>
      <div class="label-row"><span>Appeal</span><span>${Math.round(appeal)}%</span></div>${bar(appeal, appeal > 55 ? '#2a9d8f' : appeal > 30 ? '#e9c46a' : '#e63946')}
      <div class="label-row"><span>Dirt</span><span>${Math.round(c.dirt)}%</span></div>${bar(c.dirt, '#8b5e34')}
      <div class="label-row"><span>Ingredients</span><span>${portions}/${cap} meals</span></div>${bar(portions / cap * 100, '#4cc9f0')}
    </div>`;

    html += `<div class="card"><div class="row"><div class="grow"><b>Price</b><div class="muted small">Fair price ${fmtMoney(C.fair)} · ingredients cost ~${fmtMoney(mealCost(c))}</div></div>
      ${btn('−', 'cart-price', { id: c.id, d: -0.5 }, 'sq')}<div class="price">${fmtMoney(c.price)}</div>${btn('+', 'cart-price', { id: c.id, d: 0.5 }, 'sq')}</div>
      <p class="muted small">Cheaper = more customers. Pricier = more money per meal.</p></div>`;

    html += `<div class="card"><b>Actions</b><div class="btn-row">
      ${near ? btn('🍳 Cook', 'cart-cook', { id: c.id }) + (c.dirt > 5 ? btn('🧽 Clean', 'cart-clean', { id: c.id }) : '') : btn('🚀 Travel here', 'cart-travel', { id: c.id })}
      ${btn(`📦 Restock (~${fmtMoney(restockCostEstimate(c))})`, 'cart-restock', { id: c.id })}
      ${btn('↔️ Move', 'cart-move', { id: c.id }, 'ghost')}
      ${S.carts.length > 1 ? btn('💲 Sell ($100)', 'cart-sell', { id: c.id }, 'ghost danger') : ''}
      </div><div class="chips">${C.recipe.map(g => `<span class="chip">${GOODS[g].emoji} ${c.stock[g] || 0}</span>`).join('')}</div>
      <p class="muted small">Restocking uses your storage first, then buys the rest from the market.</p></div>`;

    html += `<div class="card"><b>Worker</b>`;
    if (w) {
      html += `<div class="row">${workerFace(w)}<div class="grow"><b>${escapeHtml(w.name)}</b> <span class="stars">${stars(w.stars)}</span>
        <div class="muted small">Lv ${w.level} · ${fmtMoney(w.wage)}/meal</div></div>${btn('Remove', 'unassign', { w: w.id }, 'ghost')}</div>`;
    } else {
      const free = S.workers.filter(x => !x.assign);
      if (free.length) html += `<p class="muted small">Pick a worker to run this cart for you:</p>` + free.map(x => `<div class="row">${workerFace(x)}<div class="grow">${escapeHtml(x.name)} <span class="stars">${stars(x.stars)}</span> <span class="muted small">Lv ${x.level}</span></div>${btn('Assign', 'assign', { w: x.id, type: 'cart', id: c.id })}</div>`).join('');
      else html += `<p class="muted small">No free workers. ${btn('👷 Hire someone', 'open', { key: 'workers' }, 'ghost')}</p>`;
    }
    html += `</div>`;

    html += `<div class="card"><b>Upgrades</b>`;
    for (const k in UPGRADES) {
      const U = UPGRADES[k], lvl = c.upgrades[k], max = lvl >= UPGRADE_MAX, cost = upgradeCost(k, lvl);
      html += `<div class="row upg"><div class="big-emoji sm">${U.icon}</div><div class="grow"><b>${U.name}</b> <span class="muted small">Lv ${lvl}/${UPGRADE_MAX}</span><div class="muted small">${U.desc}</div>
        <div class="pips">${Array.from({ length: UPGRADE_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        ${max ? '<span class="tag green">MAX</span>' : btn(fmtMoney(cost), 'cart-upgrade', { id: c.id, up: k }, '', S.money < cost)}</div>`;
    }
    html += `</div>`;
    return { title: `${C.emoji} ${C.name} Cart`, html };
  },

  // ----- workers -----
  workers() {
    let html = `<p class="muted">Workers run your carts and farms, even while you're offline. They are only paid when they actually make something, and they level up as they work.</p>`;
    html += `<div class="card"><b>Level perks</b><ol class="perks">${WORKER_PERKS.map(p => `<li>${p}</li>`).join('')}</ol></div>`;
    html += `<h3>Your staff (${S.workers.length})</h3>`;
    if (!S.workers.length) html += `<p class="muted small">Nobody yet — hire someone below.</p>`;
    for (const w of S.workers) {
      const where = w.assign ? (w.assign.type === 'cart' ? (() => { const c = getCart(w.assign.id); return c ? `${CUISINES[c.cuisine].emoji} ${CUISINES[c.cuisine].name} cart` : '?'; })() : `🌾 Plot #${w.assign.id + 1}`) : 'Not working';
      const xpNeed = xpForLevel(w.level);
      html += `<div class="card"><div class="row">${workerFace(w)}<div class="grow"><b>${escapeHtml(w.name)}</b> <span class="stars">${stars(w.stars)}</span>
        <div class="muted small">Lv ${w.level} · ${fmtMoney(w.wage)} per job · earned ${fmtMoney(w.earned)}</div><div class="muted small">📍 ${where}</div></div>
        <div class="col">${w.assign ? btn('Remove', 'unassign', { w: w.id }, 'ghost') : ''}${btn('Fire', 'fire', { w: w.id }, 'ghost danger')}</div></div>
        ${w.level < WORKER_MAX_LEVEL ? `<div class="label-row small"><span>XP to Lv ${w.level + 1}</span><span>${w.xp}/${xpNeed}</span></div>${bar(w.xp / xpNeed * 100, '#8338ec')}` : '<div class="muted small">⭐ Max level</div>'}
        ${!w.assign ? assignOptions(w) : ''}</div>`;
    }
    html += `<h3>People looking for work</h3>`;
    for (let i = 0; i < S.hirePool.length; i++) {
      const w = S.hirePool[i];
      html += `<div class="card row">${workerFace(w)}<div class="grow"><b>${escapeHtml(w.name)}</b> <span class="stars">${stars(w.stars)}</span>
        <div class="muted small">Wants ${fmtMoney(w.wage)} per job</div></div>${btn('Hire ' + fmtMoney(w.hireCost), 'hire', { i }, '', S.money < w.hireCost)}</div>`;
    }
    html += `<p class="muted small">New people arrive in ${fmtTime((S.hireRefreshAt - Date.now()) / 1000)}. ${btn('🔄 Find others now ($15)', 'refresh-hires', {}, 'ghost')}</p>`;
    return { title: '👷 Workers', html };
  },

  // ----- land -----
  land() {
    let html = `<p class="muted">Buy plots in the countryside (outside the city). Turn them into a <b>farm</b> to grow crops or a <b>ranch</b> for animals. You can also click any <b>FOR SALE</b> sign on the map.</p>`;
    const owned = Object.keys(S.plots);
    html += `<h3>Your land (${owned.length})</h3>`;
    for (const id of owned) {
      const st = S.plots[id], P = World.plots[id];
      const label = st.type === 'farm' ? `🌾 Farm (${GOODS[st.seed].emoji})` : st.type === 'ranch' ? `🐄 Ranch (${st.animals.length} animals)` : '🟫 Empty land';
      const extra = st.type === 'farm' ? (() => { const k = plotCounts(id); return `${k.ready} ready · ${k.growing} growing · ${k.empty} empty`; })() : '';
      html += `<div class="card row clickable" data-act="open" data-key="plot:${id}"><div class="grow"><b>Plot #${+id + 1}</b> — ${label}<div class="muted small">${P.w}×${P.h} tiles ${extra ? '· ' + extra : ''} ${workerFor('plot', id) ? '· 👷 worker' : ''}</div></div><span>›</span></div>`;
    }
    const px = Game.player.x / TILE, py = Game.player.y / TILE;
    const forSale = World.plots.filter(P => !S.plots[P.id]).sort((a, b) => dist(px, py, a.x, a.y) - dist(px, py, b.x, b.y)).slice(0, 6);
    html += `<h3>Closest plots for sale</h3>`;
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
      html += `<div class="card"><b>Plot #${P.id + 1}</b> — ${P.w}×${P.h} tiles<div class="stat-grid"><div><span>Price</span><b>${fmtMoney(P.price)}</b></div><div><span>Crop tiles</span><b>${P.w * P.h}</b></div></div>
        <div class="btn-row">${btn('Buy for ' + fmtMoney(P.price), 'plot-buy', { id }, '', S.money < P.price)}${near ? '' : btn('🚕 Taxi here ($5)', 'plot-travel', { id }, 'ghost')}</div></div>`;
      return { title: '🏷️ Land for sale', html };
    }
    if (!near) html += `<div class="card warn">You need to be at this plot to plant, harvest or feed. ${btn('🚀 Travel here', 'plot-travel', { id })}</div>`;
    const w = workerFor('plot', id);
    if (!st.type) {
      html += `<div class="card"><b>What do you want to do with this land?</b>
        <div class="choice">${btn('🌾 Make a farm<br><small>free · grow crops</small>', 'plot-make', { id, type: 'farm' })}
        ${btn(`🐄 Make a ranch<br><small>${fmtMoney(RANCH_FENCE_COST)} fence · raise animals</small>`, 'plot-make', { id, type: 'ranch' }, '', S.money < RANCH_FENCE_COST)}</div></div>`;
    } else if (st.type === 'farm') {
      const k = plotCounts(id);
      html += `<div class="card"><div class="stat-grid"><div><span>Ready</span><b>${k.ready}</b></div><div><span>Growing</span><b>${k.growing}</b></div><div><span>Empty</span><b>${k.empty}</b></div><div><span>Yield</span><b>${CROP_YIELD}/tile</b></div></div>
        <div class="btn-row">${btn(`🌱 Plant ${k.empty} (${fmtMoney(k.empty * GOODS[st.seed].base * SEED_COST_MULT)})`, 'plot-plant', { id }, '', !near || !k.empty)}${btn(`🧺 Harvest ${k.ready}`, 'plot-harvest', { id }, '', !near || !k.ready)}</div></div>`;
      html += `<div class="card"><b>Seed to plant</b><div class="seed-grid">${CROPS.map(g => `<button class="seed ${st.seed === g ? 'sel' : ''}" data-act="plot-seed" data-id="${id}" data-g="${g}"><span>${GOODS[g].emoji}</span>${GOODS[g].name}<small>${GOODS[g].grow}s · sells ${fmtMoney(sellPrice(g))}</small></button>`).join('')}</div></div>`;
    } else {
      const out = Object.entries(st.output).filter(([, v]) => v > 0);
      html += `<div class="card"><div class="label-row"><span>🌽 Trough (animals eat corn)</span><span>${Math.floor(st.trough)}/${TROUGH_MAX}</span></div>${bar(st.trough / TROUGH_MAX * 100, '#ffd166')}
        <div class="btn-row">${btn(`🌽 Fill trough`, 'ranch-fill', { id }, '', !near)}${btn(`🧺 Collect ${out.reduce((s, [, v]) => s + v, 0)}`, 'ranch-collect', { id }, '', !near || !out.length)}</div>
        <div class="chips">${out.map(([g, v]) => `<span class="chip">${GOODS[g].emoji} ${v}</span>`).join('') || '<span class="muted small">Nothing produced yet</span>'}</div>
        <p class="muted small">You have ${Math.floor(S.inventory.corn)} 🌽 in storage. Missing corn is bought from the market.</p></div>`;
      html += `<div class="card"><b>Animals (${st.animals.length}/${RANCH_MAX_ANIMALS})</b>`;
      for (const k in ANIMALS) {
        const A = ANIMALS[k], count = st.animals.filter(a => a.kind === k).length;
        html += `<div class="row"><div class="big-emoji sm">${A.emoji}</div><div class="grow"><b>${A.name}</b> × ${count}<div class="muted small">1 ${GOODS[A.product].emoji} every ${A.every}s · eats ${A.feed} 🌽</div></div>
          ${btn('Buy ' + fmtMoney(A.cost), 'ranch-buy', { id, a: k }, '', S.money < A.cost || st.animals.length >= RANCH_MAX_ANIMALS)}</div>`;
      }
      html += `</div>`;
    }
    if (st.type) {
      html += `<div class="card"><b>${st.type === 'farm' ? 'Farm hand' : 'Rancher'}</b><p class="muted small">${st.type === 'farm' ? 'Harvests and replants automatically (pays seeds from your cash).' : 'Refills the trough and collects products into storage.'}</p>`;
      if (w) html += `<div class="row">${workerFace(w)}<div class="grow"><b>${escapeHtml(w.name)}</b> <span class="stars">${stars(w.stars)}</span></div>${btn('Remove', 'unassign', { w: w.id }, 'ghost')}</div>`;
      else {
        const free = S.workers.filter(x => !x.assign);
        html += free.length ? free.map(x => `<div class="row">${workerFace(x)}<div class="grow">${escapeHtml(x.name)} <span class="stars">${stars(x.stars)}</span></div>${btn('Assign', 'assign', { w: x.id, type: 'plot', id })}</div>`).join('')
          : `<p class="muted small">No free workers. ${btn('👷 Hire someone', 'open', { key: 'workers' }, 'ghost')}</p>`;
      }
      html += `</div>`;
    }
    return { title: `${st.type === 'farm' ? '🌾 Farm' : st.type === 'ranch' ? '🐄 Ranch' : '🟫 Land'} — Plot #${P.id + 1}`, html };
  },

  // ----- buildings -----
  property() {
    let html = `<p class="muted">Buy buildings in the city. Tenants pay you rent every minute — even while you're offline.</p>`;
    const owned = Object.keys(S.buildings).map(id => World.buildings[id]);
    const rent = owned.reduce((s, b) => s + b.rentPerMin, 0);
    html += `<h3>Your buildings (${owned.length}) — ${fmtMoney(rent)}/min</h3>`;
    for (const b of owned) html += `<div class="card row clickable" data-act="open" data-key="building:${b.id}"><div class="grow"><b>🏢 ${b.kind}</b><div class="muted small">${b.w}×${b.h} · ${b.floors} floors · ${fmtMoney(b.rentPerMin)}/min</div></div><span>›</span></div>`;
    const sale = World.buildings.filter(b => b.forSale && !S.buildings[b.id]).sort((a, b) => a.price - b.price).slice(0, 12);
    html += `<h3>For sale</h3>`;
    for (const b of sale) {
      html += `<div class="card row"><div class="grow"><b>${b.kind}</b> <span class="muted small">${b.w}×${b.h} · ${b.floors}F</span>
        <div class="muted small">Rent ${fmtMoney(b.rentPerMin)}/min · pays back in ~${Math.round(b.price / b.rentPerMin)} min</div></div>
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
    if (owned) html += `<p class="muted small">You own this. Rent comes in automatically.</p>${btn('Sell for ' + fmtMoney(b.price * 0.8), 'bld-sell', { id }, 'ghost danger')}`;
    else if (b.forSale) html += `${btn('Buy for ' + fmtMoney(b.price), 'bld-buy', { id }, '', S.money < b.price)}`;
    else html += `<p class="muted small">The owner isn't selling this one.</p>`;
    html += `</div>`;
    return { title: '🏢 Building', html };
  },

  // ----- storage -----
  inventory() {
    let html = `<p class="muted">Goods you've harvested or bought. Carts restock from here first.</p><div class="card">`;
    let total = 0;
    for (const g in GOODS) {
      const n = Math.floor(S.inventory[g]); total += n * sellPrice(g);
      html += `<div class="row"><div class="big-emoji sm">${GOODS[g].emoji}</div><div class="grow"><b>${GOODS[g].name}</b> × ${n}<div class="muted small">worth ${fmtMoney(n * sellPrice(g))}</div></div>
        ${btn('Sell 10', 'mkt-sell', { g, n: 10 }, 'ghost', n < 1)}${btn('Sell all', 'mkt-sell', { g, n: 'all' }, 'ghost', n < 1)}</div>`;
    }
    html += `</div><p><b>Total value:</b> ${fmtMoney(total)}</p>`;
    return { title: '📦 Storage', html };
  },

  // ----- market -----
  market() {
    let html = `<p class="muted">One market for the whole city. Prices move all the time — buy low, sell high! Big orders move the price.</p>`;
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
      <p class="muted small">Savings earn interest every second, even offline. Cash in savings can't be spent until you withdraw it.</p>
      <div class="btn-row">${btn('Deposit $100', 'bank-dep', { a: 100 })}${btn('Deposit all', 'bank-dep', { a: 'all' })}</div>
      <div class="btn-row">${btn('Withdraw $100', 'bank-wd', { a: 100 }, 'ghost')}${btn('Withdraw all', 'bank-wd', { a: 'all' }, 'ghost')}</div></div>`;
    html += `<div class="card"><b>Lifetime stats</b><div class="stat-grid">
      <div><span>Meals served</span><b>${S.stats.served}</b></div><div><span>Cooked by you</span><b>${S.stats.playerServed}</b></div>
      <div><span>Crops harvested</span><b>${S.stats.harvested}</b></div><div><span>Total earned</span><b>${fmtMoney(S.stats.earned)}</b></div></div></div>`;
    return { title: '🏦 Bank', html };
  },

  // ----- help -----
  help() {
    return {
      title: '❓ How to play', html: `
      <div class="card"><b>Controls</b><ul>
        <li><kbd>WASD</kbd> / arrows or <b>click</b> the map to walk (<kbd>Shift</kbd> = run)</li>
        <li><kbd>E</kbd> cook at your cart · <kbd>C</kbd> clean it</li>
        <li>Mouse wheel or +/− to zoom · click the minimap to walk there</li>
        <li>Click carts, plots and buildings to open them · <kbd>Esc</kbd> closes things</li></ul></div>
      <div class="card"><b>How to get rich</b><ol>
        <li>Stand by your cart. Customers line up — press <kbd>E</kbd> and play the cooking minigame. Better cooking = bigger tips and better reviews.</li>
        <li>Keep it clean and stocked. Dirty or expensive carts scare customers away.</li>
        <li>Buy upgrades, then <b>hire a worker</b> so the cart runs without you.</li>
        <li>Buy more carts and spread them out. The same food close by is competition.</li>
        <li>Buy land outside the city: farm crops or raise animals to make your own cheap ingredients, or sell them on the market.</li>
        <li>Buy buildings for rent, and park spare cash in the bank.</li></ol>
        <p class="muted small">Lunch (11–14) and dinner (17–20) are the busiest times. At night the streets are quiet.</p></div>
      <div class="card"><b>Game</b><p class="muted small">Your game saves automatically in this browser.</p>
        <div class="btn-row">${btn('💾 Save now', 'save')}${btn('🗑️ Start over', 'reset', {}, 'ghost danger')}</div></div>` };
  },
};

function assignOptions(w) {
  const carts = S.carts.filter(c => !workerFor('cart', c.id));
  const plots = Object.keys(S.plots).filter(id => S.plots[id].type && !workerFor('plot', id));
  if (!carts.length && !plots.length) return '<p class="muted small">Nothing free to assign to.</p>';
  return `<div class="btn-row">` +
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
  $('placement-hint').innerHTML = `${CUISINES[p.cuisine].emoji} Click a <b>sidewalk</b> or <b>plaza</b> tile to place your cart ${p.mode === 'new' ? `(${fmtMoney(cartCost(S.carts.length))})` : ''} · <kbd>Esc</kbd> to cancel`;
  $('placement-hint').classList.remove('hidden');
}
function endPlacement() {
  UI.placement = null;
  $('placement-hint').classList.add('hidden');
}
function tryPlace(x, y) {
  const p = UI.placement;
  if (!validCartSpot(x, y, p.cartId)) { toast("Can't put a cart there — use an empty sidewalk", 'bad'); return; }
  if (p.mode === 'new') {
    if (!spend(cartCost(S.carts.length))) return;
    const c = makeCart(p.cuisine, x, y);
    S.carts.push(c);
    restockCart(c, true);
    toast(`New ${CUISINES[p.cuisine].name} cart placed! Hire a worker to run it.`, 'good');
    endPlacement();
    openPanel('cart:' + c.id);
  } else {
    const c = getCart(p.cartId);
    if (c) {
      for (const n of c._queue.slice()) leaveCart(n, false, '🤷');
      c.x = x; c.y = y;
      toast('Cart moved', 'good');
    }
    endPlacement();
    if (c) openPanel('cart:' + c.id);
  }
}

function startCooking(c) {
  if (!c) return;
  if (!nearestOwnCart() || nearestOwnCart().id !== c.id) { toast('Walk up to your cart first', 'bad'); return; }
  if (cartPortions(c) < 1) { toast('Out of ingredients — restock first!', 'bad'); return; }
  if (!c._queue.some(n => n.arrived)) { toast('No customers waiting yet', 'info'); return; }
  c._playerCooking = true;
  Minigame.start(CUISINES[c.cuisine].game, c, score => {
    c._playerCooking = false;
    if (serveCustomer(c, score, null)) S.stats.playerServed++;
    else toast('The customer already left…', 'bad');
  });
}

function startCleaning(c) {
  if (!c) return;
  if (!nearestOwnCart() || nearestOwnCart().id !== c.id) { toast('Walk up to your cart first', 'bad'); return; }
  if (c.dirt < 1) { toast('Already spotless!', 'info'); return; }
  Minigame.start('scrub', c, () => { c.dirt = 0; toast('Cart is sparkling clean ✨', 'good'); });
}

const ACTIONS = {
  open: d => openPanel(d.key),
  'cart-price': d => { const c = getCart(d.id); c.price = clamp(Math.round((c.price + +d.d) * 2) / 2, 0.5, 99); },
  'cart-upgrade': d => {
    const c = getCart(d.id), lvl = c.upgrades[d.up];
    if (lvl >= UPGRADE_MAX) return;
    if (spend(upgradeCost(d.up, lvl))) { c.upgrades[d.up]++; toast(`${UPGRADES[d.up].icon} ${UPGRADES[d.up].name} → level ${lvl + 1}`, 'good'); }
  },
  'cart-restock': d => restockCart(getCart(d.id)),
  'cart-cook': d => startCooking(getCart(d.id)),
  'cart-clean': d => startCleaning(getCart(d.id)),
  'cart-move': d => { const c = getCart(d.id); startPlacement({ mode: 'move', cuisine: c.cuisine, cartId: c.id }); },
  'cart-travel': d => { const c = getCart(d.id); teleportPlayer(c.x, c.y + 1); },
  'cart-sell': d => {
    const c = getCart(d.id);
    if (!confirm('Sell this cart for $100?')) return;
    for (const n of c._queue.slice()) leaveCart(n, false, '🤷');
    const w = workerFor('cart', c.id); if (w) w.assign = null;
    S.carts = S.carts.filter(x => x !== c);
    addMoney(100, false);
    closePanel();
  },
  'buy-cart': d => {
    if (S.money < cartCost(S.carts.length)) { toast('Not enough money', 'bad'); return; }
    startPlacement({ mode: 'new', cuisine: d.cuisine, cartId: null });
  },
  hire: d => {
    const w = S.hirePool[+d.i];
    if (!w || !spend(w.hireCost)) return;
    S.hirePool.splice(+d.i, 1);
    S.workers.push(w);
    if (S.hirePool.length < 2) S.hirePool.push(genWorker());
    toast(`Hired ${w.name}! Now assign them to a cart or farm.`, 'good');
  },
  'refresh-hires': () => { if (spend(15)) refreshHirePool(); },
  fire: d => {
    const w = S.workers.find(x => x.id === +d.w);
    if (w && confirm(`Fire ${w.name}?`)) S.workers = S.workers.filter(x => x !== w);
  },
  assign: d => {
    const w = S.workers.find(x => x.id === +d.w);
    if (!w) return;
    assignWorker(w, d.type, d.id);
    toast(`${w.name} is now working`, 'good');
  },
  unassign: d => { const w = S.workers.find(x => x.id === +d.w); if (w) w.assign = null; },
  'plot-buy': d => {
    const P = World.plots[d.id];
    if (S.plots[d.id] || !spend(P.price)) return;
    S.plots[d.id] = { type: null, crops: Array(P.w * P.h).fill(null), animals: [], trough: 0, output: {}, seed: 'wheat' };
    toast(`You bought Plot #${P.id + 1}!`, 'good');
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
    toast(`${A.emoji} A new ${A.name.toLowerCase()} joined your ranch! Keep the trough full of corn.`, 'good');
  },
  'ranch-fill': d => { if (playerNearPlot(d.id)) ranchFill(d.id); },
  'ranch-collect': d => { if (playerNearPlot(d.id)) ranchCollect(d.id); },
  'bld-buy': d => {
    const b = World.buildings[d.id];
    if (!b.forSale || S.buildings[d.id] || !spend(b.price)) return;
    S.buildings[d.id] = { since: Date.now() };
    toast(`🏢 You bought the ${b.kind}! Rent: ${fmtMoney(b.rentPerMin)}/min`, 'good');
  },
  'bld-sell': d => {
    const b = World.buildings[d.id];
    if (!confirm(`Sell the ${b.kind} for ${fmtMoney(b.price * 0.8)}?`)) return;
    delete S.buildings[d.id];
    addMoney(b.price * 0.8, false);
  },
  'bld-travel': d => { const b = World.buildings[d.id]; teleportPlayer(b.x + Math.floor(b.w / 2), b.y + b.h); openPanel('building:' + d.id); },
  'mkt-buy': d => { const n = marketBuy(d.g, +d.n); if (n) toast(`Bought ${n} ${GOODS[d.g].emoji}`, 'good'); },
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
  save: () => { saveGame(); toast('Game saved 💾', 'good'); },
  reset: () => {
    if (!confirm('Delete your save and start over? This cannot be undone.')) return;
    Game.running = false;
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
  if (rep.meals) rows.push(`🍽️ Your workers served <b>${rep.meals}</b> meals (${fmtMoney(rep.sales)} after ingredients)`);
  if (rep.wages) rows.push(`👷 Wages paid: <b>${fmtMoney(rep.wages)}</b>`);
  if (rep.goods) rows.push(`🌾 Farms & ranches produced <b>${rep.goods}</b> goods`);
  if (rep.rent) rows.push(`🏢 Rent collected: <b>${fmtMoney(rep.rent)}</b>`);
  if (rep.interest) rows.push(`🏦 Bank interest: <b>${fmtMoney(rep.interest)}</b>`);
  if (!rows.length) rows.push('Nothing happened — hire workers so your business runs while you are away!');
  showModal(`<h2>Welcome back, ${escapeHtml(S.name)}!</h2><p class="muted">You were away for ${fmtTime(rep.secs)}.</p>
    <ul class="report">${rows.map(r => `<li>${r}</li>`).join('')}</ul>
    <button class="btn big" onclick="closeModal()">Let's go!</button>`, 'report');
}
