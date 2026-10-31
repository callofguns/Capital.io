// =============================================================
//  main.js — start screen, keyboard/mouse input and the game loop
// =============================================================

// ---------- Start screen ----------
function setupTitleScreen() {
  const grid = $('title-cuisines');
  let chosen = 'burger';
  grid.innerHTML = Object.entries(CUISINES).map(([k, C]) =>
    `<button class="cuisine-btn ${k === chosen ? 'sel' : ''}" data-c="${k}"><span>${C.emoji}</span>${C.name}<small>${C.game === 'timing' ? 'timing game' : C.game === 'hold' ? 'hold & release' : 'combo game'}</small></button>`).join('');
  grid.onclick = e => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    chosen = b.dataset.c;
    grid.querySelectorAll('.cuisine-btn').forEach(x => x.classList.toggle('sel', x === b));
  };

  const save = loadSave();
  if (save) {
    $('continue-btn').classList.remove('hidden');
    $('continue-btn').innerHTML = `▶ Continue as <b>${escapeHtml(save.name)}</b> <small>(${fmtMoney(save.money)})</small>`;
    $('continue-btn').onclick = () => startGame(save, false);
    $('new-game-label').textContent = 'Or start a new business:';
  }
  $('start-btn').onclick = () => {
    const name = ($('player-name').value || '').trim().slice(0, 16) || 'Tycoon';
    if (save && !confirm('Starting a new game will delete your current save. Continue?')) return;
    startGame(newState(name, chosen), true);
  };
  $('player-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('start-btn').click(); });
}

// ---------- Starting a game ----------
function startGame(state, isNew) {
  S = state;
  generateWorld(S.seed);
  buildWorldCanvas();

  migrateSave(S);

  // Rebuild the non-saved runtime bits
  for (const c of S.carts) { c._queue = []; c._cook = 0; }
  for (const sh of S.shops) { sh._visitors = []; sh._regs = []; }
  if (isNew) {
    const c = makeCart(S.startCuisine, World.starterCart.x, World.starterCart.y);
    for (const g of CUISINES[c.cuisine].recipe) c.stock[g] = cartCapacity(c);
    S.carts.push(c);
  }
  if (!S.hirePool.length) refreshHirePool();

  const p = S.player || { x: World.spawn.x * TILE + 16, y: World.spawn.y * TILE + 16 };
  Object.assign(Game.player, { x: p.x, y: p.y, path: [] });
  Game.cam.x = p.x; Game.cam.y = p.y;
  Game.cam.zoom = window.innerWidth < 700 ? 0.85 : 1.15;
  Game.npcs = []; Game.floats = []; Game.ledger = [];
  initCars();
  for (let i = 0; i < 30; i++) spawnNPC();
  for (const n of Game.npcs) n.alpha = 1;

  $('title-screen').classList.add('hidden');
  ['hud', 'minimap', 'zoom-controls'].forEach(id => $(id).classList.remove('hidden'));

  const rep = isNew ? null : applyOffline();
  if (rep) showOfflineReport(rep);
  else maybeShowStory();

  saveGame();
  updateHUD();
  window.onbeforeunload = () => saveGame();
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  if (!Game.running) { Game.running = true; lastFrame = performance.now(); requestAnimationFrame(frame); }
}

// Older saves (before the story & shops update) get the new fields
function migrateSave(s) {
  s.shops = s.shops || [];
  for (const k of ['shopServed', 'shopEarned', 'cleaned']) s.stats[k] = s.stats[k] || 0;
  if (s.storyV !== 2) {
    // skip goals the player already finished (no double rewards)
    s.storyV = 2; s.goalIndex = 0; s.chapterShown = -1;
    while (GOALS[s.goalIndex] && GOALS[s.goalIndex].check(s)) s.goalIndex++;
  }
}

// ---------- Input ----------
let pointerDown = null;

function screenToWorld(sx, sy) {
  const z = Game.cam.zoom;
  return { x: (sx - viewW / 2) / z + Game.cam.x, y: (sy - viewH / 2) / z + Game.cam.y };
}

function hitTest(wx, wy) {
  for (const c of allCarts()) {
    if (Math.abs(wx - (c.x * TILE + 16)) < 18 && wy > c.y * TILE - 26 && wy < c.y * TILE + 30) return { kind: 'cart', c };
  }
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  if (!inMap(tx, ty)) return null;
  const bi = World.buildingAt[tIdx(tx, ty)];
  if (bi >= 0) return { kind: 'building', b: World.buildings[bi] };
  const pi = World.plotAt[tIdx(tx, ty)];
  if (pi >= 0) return { kind: 'plot', P: World.plots[pi] };
  return null;
}

function setupInput() {
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (Minigame.active) Minigame.cancel();
      else if (UI.modalOpen && !Minigame.active) closeModal();
      else if (UI.placement) endPlacement();
      else closePanel();
      return;
    }
    if (UI.modalOpen || !Game.running) return;
    Game.keys[k] = true;
    if (e.shiftKey) Game.keys.shift = true;
    if (k === 'e') startCooking(nearestOwnCart());
    if (k === 'c') startCleaning(nearestOwnCart());
    if (k === '+' || k === '=') zoomBy(1.15);
    if (k === '-') zoomBy(1 / 1.15);
    if (k.startsWith('arrow') || k === ' ') e.preventDefault();
  });
  window.addEventListener('keyup', e => {
    Game.keys[e.key.toLowerCase()] = false;
    if (!e.shiftKey) Game.keys.shift = false;
  });
  window.addEventListener('blur', () => { Game.keys = {}; });

  canvas.addEventListener('pointerdown', e => { pointerDown = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', e => {
    const w = screenToWorld(e.clientX, e.clientY);
    UI.hoverTile = { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
    const h = hitTest(w.x, w.y);
    canvas.style.cursor = UI.placement ? 'crosshair' : h ? 'pointer' : 'default';
    const tip = $('tooltip');
    if (h && !UI.placement) {
      tip.innerHTML = tooltipText(h);
      tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 14 + 'px';
      tip.classList.remove('hidden');
    } else tip.classList.add('hidden');
  });
  canvas.addEventListener('pointerleave', () => $('tooltip').classList.add('hidden'));
  canvas.addEventListener('pointerup', e => {
    if (!pointerDown || dist(pointerDown.x, pointerDown.y, e.clientX, e.clientY) > 8) { pointerDown = null; return; }
    pointerDown = null;
    if (!Game.running || UI.modalOpen) return;
    const w = screenToWorld(e.clientX, e.clientY);
    const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
    if (UI.placement) { tryPlace(tx, ty); return; }
    const h = hitTest(w.x, w.y);
    if (h && h.kind === 'cart') {
      if (h.c.rival) toast(`${CUISINES[h.c.cuisine].emoji} ${h.c.name} — a rival! Sells for ${fmtMoney(h.c.price)}.`, 'info');
      else openPanel('cart:' + h.c.id);
      walkPlayerTo(h.c.x, h.c.y + 1);
      return;
    }
    if (h && h.kind === 'building') openPanel('building:' + h.b.id);
    if (h && h.kind === 'plot') openPanel('plot:' + h.P.id);
    walkPlayerTo(tx, ty);
  });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });

  $('zoom-in').onclick = () => zoomBy(1.2);
  $('zoom-out').onclick = () => zoomBy(1 / 1.2);
  $('minimap').addEventListener('click', e => {
    const r = e.target.getBoundingClientRect();
    const tx = Math.floor((e.clientX - r.left) / r.width * MAP_W), ty = Math.floor((e.clientY - r.top) / r.height * MAP_H);
    walkPlayerTo(tx, ty);
  });

  // Buttons everywhere use data-act="..." (see ACTIONS in ui.js)
  document.addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if (open) { UI.panelKey === open.dataset.open ? closePanel() : openPanel(open.dataset.open); return; }
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled) handleAction(el);
  });
  $('panel-close').onclick = closePanel;
  $('panel').addEventListener('pointerdown', () => { UI.pointerInPanel = true; });
  window.addEventListener('pointerup', () => { setTimeout(() => { UI.pointerInPanel = false; }, 50); });
}

function tooltipText(h) {
  if (h.kind === 'cart') {
    const c = h.c, C = CUISINES[c.cuisine];
    return c.rival ? `<b>${C.emoji} ${escapeHtml(c.name)}</b><br>Rival · ${fmtMoney(c.price)}` : `<b>${C.emoji} Your ${C.name} cart</b><br>${fmtMoney(c.price)} · ${stars(c.rating)}`;
  }
  if (h.kind === 'building') {
    const b = h.b, sh = shopAt(b.id);
    if (sh) return `<b>${SHOP_TYPES[sh.type].emoji} ${escapeHtml(sh.name)}</b><br>${shopOpen(sh) ? 'Open' : 'Closed'} · ${stars(sh.rating)}`;
    if (b.forRent && !S.buildings[b.id]) return `<b>🏪 Storefront for rent</b><br>${fmtMoney(b.leasePerMin)}/min`;
    if (S.buildings[b.id]) return `<b>🏢 Your ${b.kind}</b><br>+${fmtMoney(b.rentPerMin)}/min rent`;
    return b.forSale ? `<b>🏢 ${b.kind}</b><br>For sale: ${fmtMoney(b.price)}` : `<b>🏢 ${b.kind}</b><br>Not for sale`;
  }
  const st = S.plots[h.P.id];
  return st ? `<b>Your plot #${h.P.id + 1}</b><br>${st.type || 'empty land'}` : `<b>Land for sale</b><br>${fmtMoney(h.P.price)}`;
}

function zoomBy(f) { Game.cam.zoom = clamp(Game.cam.zoom * f, 0.45, 2.2); }

// ---------- The game loop (runs ~60 times per second) ----------
let lastFrame = 0;

function update(dt) {
  Game.t += dt;
  S.clock += dt * GAME_MINUTES_PER_SEC;
  const tm = Game.timers;

  updatePlayer(dt);
  // camera smoothly follows you
  Game.cam.x = lerp(Game.cam.x, Game.player.x, Math.min(1, dt * 6));
  Game.cam.y = lerp(Game.cam.y, Game.player.y, Math.min(1, dt * 6));

  updateNPCs(dt);
  updateCarts(dt);
  updateShops(dt);
  updatePlots(dt);
  updateCars(dt);
  updateFloats(dt);

  if ((tm.market -= dt) <= 0) { tm.market = 2; marketTick(); }
  if ((tm.hist -= dt) <= 0) { tm.hist = 15; marketHistoryTick(); }
  if ((tm.sec -= dt) <= 0) {
    tm.sec = 1;
    let rent = 0;
    for (const id in S.buildings) if (!shopAt(id)) rent += World.buildings[id].rentPerMin / 60;
    if (rent) addMoney(rent);
    shopsSecondTick();
    S.bank.savings *= 1 + BANK_RATE_PER_MIN / 60;
    Game.ledger = Game.ledger.filter(e => e.t > Game.t - 60);
    if (Date.now() > S.hireRefreshAt) refreshHirePool();
    checkGoals();
    maybeShowStory();
  }
  if ((tm.save -= dt) <= 0) { tm.save = 15; saveGame(); }
  if ((tm.hud -= dt) <= 0) { tm.hud = 0.25; updateHUD(); updateActionBar(); }
  if ((tm.panel -= dt) <= 0) { tm.panel = 1; renderPanel(false); }
}

function frame(now) {
  if (!Game.running) return;
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  render();
  if ((Game.timers.mini -= dt) <= 0) { Game.timers.mini = 0.2; renderMinimap(); }
  requestAnimationFrame(frame);
}

// ---------- Boot ----------
window.addEventListener('DOMContentLoaded', () => {
  initRenderer();
  setupInput();
  setupTitleScreen();
});
