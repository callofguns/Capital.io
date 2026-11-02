// =============================================================
//  events.js: daily orders + city events
//  Every morning: a few orders show up on the 📋 Orders board, and the day
//  might bring rain, a festival, an ingredient shortage or a food critic.
// =============================================================

const ORDER_CLIENTS = [
  ['🏢', 'The office tower'], ['👷', 'A construction crew'], ['🚌', 'A school trip'], ['💒', 'A wedding party'],
  ['🎬', 'A film crew'], ['🏥', 'The hospital night shift'], ['🏋️', 'The gym'], ['📚', 'The book club'],
  ['🚒', 'The fire station'], ['🎸', 'A band on tour'], ['⚽', 'The football team'], ['🏛️', 'City Hall'],
];
const ORDER_DUE = [14, 18, 21];           // orders are due at one of these hours
const FESTIVAL_HOURS = [10, 22];          // festival runs 10:00 to 22:00
const FESTIVAL_RADIUS = 11;               // carts this close to the festival get the crowd
const RAIN_HOURS = [7, 21];

const hourNow = () => Math.floor(S.clock % 1440 / 60);

// ---------- Setup (new games and old saves) ----------
function setupEvents(s) {
  s.orders = s.orders || { day: 0, list: [] };
  s.events = s.events || { day: 0 };
  s.ordersDone = s.ordersDone || 0;
  // festival spot: the park closest to the middle of the city (or the main square)
  const mid = { x: MAP_W / 2, y: MAP_H / 2 };
  const spots = World.parks.length ? World.parks : [World.spawn];
  World.festival = spots.slice().sort((a, b) => dist(a.x, a.y, mid.x, mid.y) - dist(b.x, b.y, mid.x, mid.y))[0];
}

// ---------- What's happening today ----------
const ev = () => S.events || {};
const isRaining = () => ev().rain && hourNow() >= RAIN_HOURS[0] && hourNow() < RAIN_HOURS[1];
const festivalOn = () => ev().festival && hourNow() >= FESTIVAL_HOURS[0] && hourNow() < FESTIVAL_HOURS[1];
const nearFestival = (x, y) => festivalOn() && World.festival && dist(x, y, World.festival.x, World.festival.y) < FESTIVAL_RADIUS;

// more or fewer people walk around
function eventCrowdMult() {
  let m = 1;
  if (isRaining()) m *= 0.6;
  if (festivalOn()) m *= 1.6;
  return m;
}
// how much an ingredient costs compared to normal (shortages make it pricey)
const shortageMult = g => (ev().shortage === g ? 2.2 : 1);

// extra lines for "What's affecting your appeal"
function eventCartParts(c) {
  const parts = [];
  if (isRaining()) parts.push({ label: '🌧️ Rainy day (fewer people want street food)', value: -8 });
  if (nearFestival(c.x, c.y)) parts.push({ label: '🎉 Festival crowd nearby', value: 12 });
  return parts;
}
function eventShopParts() {
  return isRaining() ? [{ label: '🌧️ Rainy day (people want to be indoors)', value: 6 }] : [];
}

// ---------- Every game second ----------
function eventsTick() {
  const day = gameDay();
  if (S.events.day !== day) newDayEvents(day);
  if (S.orders.day !== day && hourNow() >= 6) newDayOrders(day);
  expireOrders();
  // the critic shows up at their hour
  const cr = S.events.critic;
  if (cr && !cr.sent && hourNow() >= cr.hour) { cr.sent = true; sendCritic(cr); }
}

function newDayEvents(day) {
  const e = S.events;
  const hadShortage = e.shortage;
  e.day = day; e.rain = false; e.festival = false; e.shortage = null; e.critic = null;
  if (day < 2) return; // the first day is calm
  // festival every weekend (day 6 and 7 of each week)
  e.festival = day % 7 === 6 || day % 7 === 0;
  if (!e.festival && Math.random() < 0.25) e.rain = true;
  if (Math.random() < 0.2) {
    e.shortage = pick(Object.keys(GOODS).filter(g => g !== hadShortage));
    S.market[e.shortage].price = Math.max(S.market[e.shortage].price, GOODS[e.shortage].base * 1.8); // the price jumps right away
  }
  if (S.carts.length && Math.random() < 0.3) e.critic = { cartId: pick(S.carts).id, hour: randInt(11, 18), sent: false, done: false };
  const news = todayNews();
  if (news.length) setTimeout(() => toast(`📰 Today: ${news.map(n => n.short).join(' · ')}`, 'info'), 600);
}

// the list shown on the Orders board (and in the clock chip)
function todayNews() {
  const e = S.events || {}, out = [];
  if (e.festival) out.push({ icon: '🎉', short: 'Festival weekend', text: `Festival in the park from ${fmtHour(FESTIVAL_HOURS[0])} to ${fmtHour(FESTIVAL_HOURS[1])}! Way more people around, and carts near the festival get a big crowd.` });
  if (e.rain) out.push({ icon: '🌧️', short: 'Rainy day', text: `Rain from ${fmtHour(RAIN_HOURS[0])} to ${fmtHour(RAIN_HOURS[1])}. Fewer people out and carts get fewer customers, but shops do a bit better.` });
  if (e.shortage) out.push({ icon: GOODS[e.shortage].emoji, short: `${GOODS[e.shortage].name} shortage`, text: `There's a ${GOODS[e.shortage].name.toLowerCase()} shortage today, so it costs a lot more at the market. Got some in storage? Now's a good time to sell!` });
  if (e.critic && !e.critic.done) {
    const c = getCart(e.critic.cartId);
    if (c) out.push({ icon: '📝', short: `Food critic at ${fmtHour(e.critic.hour)}`, text: `A food critic is visiting your ${CUISINES[c.cuisine].name} cart around ${fmtHour(e.critic.hour)}. Make sure it's open and clean! Cook it yourself for the best review.` });
  }
  return out;
}

// ---------- Food critic ----------
function sendCritic(cr) {
  const c = getCart(cr.cartId);
  if (!c) { cr.done = true; return; }
  const spot = randomPedTileNear(c.x, c.y, 8);
  const n = {
    x: spot.x * TILE + TILE / 2, y: spot.y * TILE + TILE / 2, path: [], speed: 50, face: 1, anim: 0, alpha: 0,
    hunger: 1, shopWant: 0, life: 9999, think: 1, rej: {},
    shirt: '#2b2d42', skin: pick(SKIN_COLORS), hair: '#1b1b1b', critic: true,
    state: 'walk', cart: null, arrived: false, patience: 0, bubble: '📝', bubbleT: 999,
  };
  Game.npcs.push(n);
  goToCart(n, c);
  if (n.state !== 'toCart') { leaveCart(n, false, '🤷'); criticResult(c, null); return; }
  n.patience = 45;
  toast(`📝 The food critic is on the way to your ${CUISINES[c.cuisine].name} cart!`, 'info');
}

// quality: 0..1 if they got food, null if they didn't
function criticResult(c, quality) {
  const cr = S.events.critic;
  if (!cr || cr.done) return;
  cr.done = true;
  const name = `${CUISINES[c.cuisine].name} cart`;
  if (quality != null && quality >= 0.7) {
    c.rating = Math.min(5, c.rating + 0.8);
    toast(`📝⭐ The critic LOVED your ${name}! Reviews went way up.`, 'good');
  } else if (quality != null && quality >= 0.45) {
    c.rating = Math.min(5, c.rating + 0.2);
    toast(`📝 The critic thought your ${name} was pretty good. Reviews went up a little.`, 'good');
  } else {
    c.rating = Math.max(1, c.rating - 0.7);
    toast(quality == null ? `📝 The critic gave up on your ${name}. Reviews went down.` : `📝 The critic didn't like the food at your ${name}. Reviews went down.`, 'bad');
  }
}

// ---------- Orders ----------
function newDayOrders(day) {
  S.orders.day = day;
  S.orders.list = S.orders.list.filter(o => o.status === 'active' && o.day === day);
  const choices = [];
  for (const c of S.carts) choices.push({ kind: 'cart', item: c.cuisine });
  for (const s of S.shops) for (const p of SHOP_TYPES[s.type].products) choices.push({ kind: 'shop', item: p });
  if (!choices.length) return;
  const used = new Set(), clients = shuffle(ORDER_CLIENTS.slice());
  const scale = 1 + Math.min(3, (S.carts.length + S.shops.length - 1) * 0.35);
  for (let i = 0; i < 3; i++) {
    const ch = pick(choices), due = ORDER_DUE[i];
    if (due <= hourNow()) continue;
    const key = ch.kind + ch.item + due;
    if (used.has(key)) continue;
    used.add(key);
    const [emoji, who] = clients[i];
    let qty, reward;
    if (ch.kind === 'cart') {
      qty = Math.round(randInt(6, 14) * scale * (due === 21 ? 1.4 : due === 18 ? 1.15 : 1));
      reward = Math.round(qty * CUISINES[ch.item].fair * 0.6 + 30);
    } else {
      qty = Math.round(randInt(8, 18) * scale * (due === 21 ? 1.4 : 1));
      reward = Math.round(qty * productInfo(ch.item).price * 0.5 + 40);
    }
    S.orders.list.push({ id: nextId(), day, kind: ch.kind, item: ch.item, qty, got: 0, reward, due, emoji, who, status: 'offer' });
  }
  if (S.orders.list.some(o => o.status === 'offer')) toast('📋 New orders are on the board! Tap 📋 Orders to see them.', 'info');
}

const orderItemName = o => o.kind === 'cart' ? `${CUISINES[o.item].emoji} ${CUISINES[o.item].name}` : `${productInfo(o.item).emoji} ${productInfo(o.item).name}`;

// called whenever you sell something
function orderProgress(kind, item, n) {
  if (!S.orders) return;
  for (const o of S.orders.list) {
    if (o.status !== 'active' || o.kind !== kind || o.item !== item) continue;
    o.got = Math.min(o.qty, o.got + n);
    if (o.got >= o.qty) {
      o.status = 'done';
      addMoney(o.reward);
      S.ordersDone++;
      toast(`📋✅ ${o.who}'s order is done! Bonus: +${fmtMoney(o.reward)}`, 'good');
    }
    break; // one sale counts toward one order
  }
}

function expireOrders() {
  const day = gameDay(), h = hourNow();
  for (const o of S.orders.list) {
    if ((o.status === 'active' || o.status === 'offer') && (o.day !== day || h >= o.due)) {
      if (o.status === 'active') toast(`📋 Missed ${o.who.toLowerCase()}'s order (${o.got}/${o.qty}). No bonus this time.`, 'bad');
      o.status = o.status === 'active' ? 'missed' : 'gone';
    }
  }
  S.orders.list = S.orders.list.filter(o => o.status !== 'gone' && o.day === day);
}

const activeOrders = () => (S.orders ? S.orders.list.filter(o => o.status === 'offer').length : 0);

PANELS.orders = function () {
  let html = '';
  const news = todayNews();
  html += `<div class="card"><b>📰 Today in the city</b>${news.length
    ? news.map(n => `<div class="row news"><div class="big-emoji sm">${n.icon}</div><div class="grow small">${n.text}</div></div>`).join('')
    : '<p class="muted small">A normal day. Nothing special going on.</p>'}</div>`;
  html += `<p class="muted">Customers who want a lot of food at once. Accept an order, then sell that many before it's due. Every meal or item you sell counts, whoever sells it. Finish it in time for a <b>bonus</b> on top of the normal price. If you miss it, you just don't get the bonus.</p>`;
  const list = S.orders.list;
  if (!list.length) html += `<div class="card"><p class="muted small">No orders right now. New ones show up every morning at 06:00.</p></div>`;
  for (const o of list) {
    const pct = o.got / o.qty * 100;
    const status = o.status === 'offer' ? btn('✅ Accept', 'order-accept', { id: o.id })
      : o.status === 'active' ? '<span class="tag gold">Working on it</span>'
      : o.status === 'done' ? '<span class="tag green">Done!</span>' : '<span class="tag gray">Missed</span>';
    html += `<div class="card order ${o.status}"><div class="row"><div class="big-emoji sm">${o.emoji}</div>
      <div class="grow"><b>${o.who}</b><div class="small">wants <b>${o.qty} × ${orderItemName(o)}</b> by <b>${fmtHour(o.due)}</b></div>
      <div class="muted small">Bonus: <b class="up">+${fmtMoney(o.reward)}</b></div></div>${status}</div>
      ${o.status === 'active' || o.status === 'done' ? `<div class="label-row"><span>Sold</span><span>${o.got}/${o.qty}</span></div>${bar(pct, '#52d69a')}` : ''}</div>`;
  }
  html += `<p class="muted small">Orders finished so far: ${S.ordersDone}</p>`;
  return { title: '📋 Orders', html };
};

ACTIONS['order-accept'] = d => {
  const o = S.orders.list.find(x => x.id === +d.id);
  if (!o || o.status !== 'offer') return;
  o.status = 'active';
  toast(`📋 Accepted! Sell ${o.qty} ${orderItemName(o)} by ${fmtHour(o.due)}.`, 'good');
};

// ---------- Drawing ----------
// Festival: tents and bunting in the park (drawn on the map)
function drawFestival() {
  if (!festivalOn() || !World.festival) return;
  const cx = (World.festival.x + 0.5) * TILE, cy = (World.festival.y + 0.5) * TILE, r = 3.2 * TILE;
  const cols = ['#ff006e', '#ffd166', '#06d6a0', '#4cc9f0', '#ff8c42'];
  // string of flags in a ring
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2 + Math.sin(Game.t * 2 + i) * 0.01, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 8); ctx.fill();
  }
  // little tents
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4, x = cx + Math.cos(a) * r * 0.55, y = cy + Math.sin(a) * r * 0.55;
    ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(x - 13, y + 8); ctx.lineTo(x, y - 12); ctx.lineTo(x + 13, y + 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y, 6, 8);
  }
  ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - 44, cy - r - 26, 88, 18);
  ctx.fillStyle = '#ffd166'; ctx.fillText('🎉 FESTIVAL', cx, cy - r - 17);
}

// Rain: streaks over the whole screen (drawn in screen space)
const RainDrops = [];
function drawRain(w, h) {
  if (!isRaining()) return;
  if (!RainDrops.length) for (let i = 0; i < 160; i++) RainDrops.push({ x: Math.random(), y: Math.random(), s: rand(0.6, 1.2) });
  ctx.fillStyle = 'rgba(40,60,90,0.18)'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(190,210,255,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (const d of RainDrops) {
    const y = ((d.y + Game.t * 0.9 * d.s) % 1) * h, x = ((d.x + Game.t * 0.15 * d.s) % 1) * w;
    ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12 * d.s);
  }
  ctx.stroke();
}
