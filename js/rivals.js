// =============================================================
//  rivals.js: rivals that fight back + the rival boss
//  From Chapter 2, Victor Vance (owner of the Vance's chain) shows up.
//  Rival carts cut their prices when you open near them, and Victor
//  opens new Vance's carts next to your best ones. Beat them by keeping
//  your cart a lot more appealing than theirs for a few hours.
// =============================================================

const BOSS = { name: 'Victor Vance', who: '😏', brand: "Vance's" };
const BOSS_CHAPTER = 1;          // Chapter 2 (counting from 0)
const BOSS_MAX_CARTS = 5;
const BOSS_BEAT_MARGIN = 8;      // your appeal has to be this much higher than theirs...
const BOSS_BEAT_HOURS = 4;       // ...for this many game hours in a row
const BOSS_BEAT_REWARD = 150;
const RIVAL_CUT = 0.88;          // rivals drop their price by 12% when you open nearby

const BOSS_LINES = {
  open: [
    "Nice little {food} cart. Shame if someone opened a {brand} {food} right next to it.",
    "Your {food} cart is doing well. Let's fix that.",
    "Another {brand} is open for business. Right next to yours. Oops.",
  ],
  beaten: [
    "Fine, keep that corner. This isn't over!",
    "Enjoy it while it lasts. I've got more carts than you've got customers.",
    "You got lucky. That's all.",
  ],
};

function setupRivals(s) {
  s.rivals = s.rivals || { met: false, carts: [], cuts: {}, beaten: 0, nextOpen: 0, lastHour: -1, nextId: 1 };
  // put Victor's carts back on the map
  for (const b of s.rivals.carts) World.rivals.push(bossCartObj(b));
  // rivals that already cut their prices keep them cut
  for (const r of World.rivals) {
    const cut = s.rivals.cuts[r.id];
    if (cut) { r.price = cut.price; r.appeal = cut.appeal; r.cut = true; }
  }
}

function bossCartObj(b) {
  return { id: b.id, rival: true, boss: true, x: b.x, y: b.y, cuisine: b.cuisine, name: `${BOSS.brand} ${CUISINES[b.cuisine].name}`, price: b.price, appeal: b.appeal, _queue: [], _cook: 0 };
}
const bossData = id => S.rivals.carts.find(b => b.id === id);
const bossSays = (key, food) => `😏 ${BOSS.name}: "${pick(BOSS_LINES[key]).replace(/\{food\}/g, food).replace(/\{brand\}/g, BOSS.brand)}"`;

// ---------- Meeting Victor ----------
function showBossIntro() {
  showModal(`<div class="story-ch">A new rival</div>
    <div class="story-row"><div class="story-face">${BOSS.who}</div>
      <div class="story-bubble"><b>${BOSS.name}, owner of the ${BOSS.brand} food chain</b>
      <p>So you're the new kid with the little cart. Cute. I own half the food carts in this city, and I'm about to own the other half.</p>
      <p>Here's how this goes: every time you open a cart, my people cut their prices. And whenever you start doing well, I open a ${BOSS.brand} right next to you. Good luck, kid.</p></div></div>
    <ul class="report small-list">
      <li>💸 Rival carts cut their prices when you open one near them</li>
      <li>🏪 Victor opens <b>${BOSS.brand}</b> carts (the dark umbrellas) next to your best carts</li>
      <li>🏆 To beat one, keep your cart's appeal <b>${BOSS_BEAT_MARGIN}+ higher</b> than theirs for <b>${BOSS_BEAT_HOURS} hours</b>. They'll close up, and you get ${fmtMoney(BOSS_BEAT_REWARD)}</li>
    </ul>
    <button class="btn big" onclick="closeModal()">Bring it on!</button>`, 'story');
}

// ---------- Every game second ----------
function rivalsTick() {
  const R = S.rivals;
  if (!R.met) {
    if (currentChapter() >= BOSS_CHAPTER && (S.chapterShown ?? -1) >= BOSS_CHAPTER && !UI.modalOpen && !Minigame.active) {
      R.met = true;
      R.nextOpen = S.clock + 3 * 60; // first Vance's cart opens a few hours later
      showBossIntro();
    }
    return;
  }
  priceWar();
  if (S.clock >= R.nextOpen) bossOpenCart();
  const h = Math.floor(S.clock / 60);
  if (h !== R.lastHour) { R.lastHour = h; bossHourly(); }
}

// Rivals cut their price once when one of your carts with the same food is close
function priceWar() {
  for (const r of World.rivals) {
    if (r.cut) continue;
    const mine = S.carts.find(c => c.cuisine === r.cuisine && dist(c.x, c.y, r.x, r.y) < COMPETE_RADIUS);
    if (!mine) continue;
    const C = CUISINES[r.cuisine];
    r.price = Math.max(Math.round(C.fair * 0.8 * 2) / 2, Math.round(r.price * RIVAL_CUT * 2) / 2);
    r.appeal = Math.min(75, r.appeal + 6);
    r.cut = true;
    S.rivals.cuts[r.id] = { price: r.price, appeal: r.appeal };
    if (r.boss) { const b = bossData(r.id); if (b) { b.price = r.price; b.appeal = r.appeal; } }
    toast(`💸 ${r.name} cut their price to ${fmtMoney(r.price)} to fight your ${C.name} cart!`, 'bad');
  }
}

// Victor opens a new cart next to your best-earning cart
function bossOpenCart() {
  const R = S.rivals;
  R.nextOpen = S.clock + randInt(16, 28) * 60;
  if (R.carts.length >= BOSS_MAX_CARTS || !S.carts.length) return;
  const targets = S.carts.slice().sort((a, b) => b.earned - a.earned);
  for (const t of targets) {
    if (R.carts.some(b => b.cuisine === t.cuisine && dist(b.x, b.y, t.x, t.y) < COMPETE_RADIUS)) continue; // already has one
    const spots = [];
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      const x = t.x + dx, y = t.y + dy, d = Math.hypot(dx, dy);
      if (d < 4 || d > 8 || !validCartSpot(x, y, null)) continue;
      spots.push({ x, y });
    }
    if (!spots.length) continue;
    const s = pick(spots), C = CUISINES[t.cuisine];
    const b = { id: 'v' + R.nextId++, x: s.x, y: s.y, cuisine: t.cuisine, price: Math.round(C.fair * 0.92 * 2) / 2, appeal: 55, strikes: 0 };
    R.carts.push(b);
    World.rivals.push(Object.assign(bossCartObj(b), { cut: true })); // it opens with low prices already
    R.cuts[b.id] = { price: b.price, appeal: b.appeal };
    toast(`🏪 ${BOSS.brand} ${C.name} just opened near your cart! ` + bossSays('open', C.name.toLowerCase()), 'bad');
    return;
  }
}

// Once a game hour: are you beating any of Victor's carts?
function bossHourly() {
  const R = S.rivals;
  for (const b of R.carts.slice()) {
    const r = World.rivals.find(x => x.id === b.id);
    if (!r) continue;
    const mine = S.carts.filter(c => c.cuisine === b.cuisine && dist(c.x, c.y, b.x, b.y) < COMPETE_RADIUS && cartOpen(c));
    const winning = mine.some(c => cartAppeal(c) >= r.appeal + BOSS_BEAT_MARGIN);
    b.strikes = winning ? (b.strikes || 0) + 1 : 0;
    if (b.strikes >= BOSS_BEAT_HOURS) bossCartBeaten(b, r);
  }
}

function bossCartBeaten(b, r) {
  const R = S.rivals;
  for (const n of r._queue.slice()) leaveCart(n, false, '🤷');
  R.carts = R.carts.filter(x => x !== b);
  delete R.cuts[b.id];
  World.rivals = World.rivals.filter(x => x !== r);
  R.beaten++;
  addMoney(BOSS_BEAT_REWARD);
  playSound('success');
  toast(`🏆 You ran ${r.name} out of business! +${fmtMoney(BOSS_BEAT_REWARD)}. ` + bossSays('beaten', CUISINES[b.cuisine].name.toLowerCase()), 'good');
}

// ---------- In the cart menu: how you're doing against nearby Vance's carts ----------
function bossHint(c) {
  if (!S.rivals || !S.rivals.met) return '';
  const near = S.rivals.carts.filter(b => b.cuisine === c.cuisine && dist(b.x, b.y, c.x, c.y) < COMPETE_RADIUS);
  if (!near.length) return '';
  return near.map(b => {
    const r = World.rivals.find(x => x.id === b.id);
    if (!r) return '';
    const mine = cartAppeal(c), need = r.appeal + BOSS_BEAT_MARGIN, ok = mine >= need;
    return `<div class="card warn"><span>😏 <b>${r.name}</b> is nearby (appeal ${Math.round(r.appeal)}, charges ${fmtMoney(r.price)}).
      ${ok ? `You're beating them! Stay open and keep it up: <b>${b.strikes || 0}/${BOSS_BEAT_HOURS} hours</b>.`
           : `Get your appeal to <b>${Math.round(need)}</b> (now ${Math.round(mine)}) and keep it there for ${BOSS_BEAT_HOURS} hours to run them out of town.`}</span></div>`;
  }).join('');
}

const _cartPanel = PANELS.cart;
PANELS.cart = function (id) {
  const r = _cartPanel(id);
  const c = getCart(id);
  if (r && c) r.html = bossHint(c) + r.html;
  return r;
};
