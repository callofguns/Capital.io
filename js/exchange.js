// =============================================================
//  exchange.js: the big Market window (City Exchange)
//  Goods list on the left, a price chart (line or candles), an order book,
//  today's stats, and a Buy / Sell box. Opens from the 📈 Market button.
// =============================================================

const Ex = { open: false, g: 'wheat', mode: 'candles', hover: -1, refresh: 0 };
const CANDLE_MAX = 60;        // how many candles the chart keeps (one every 15 seconds)
let exCanvas, exCtx, exDpr = 1;

// ---------- Price data (candles) ----------
// Each good keeps a list of candles: o = open, h = high, l = low, c = close, v = volume (how much got traded)
function gameDay() { return Math.floor(S.clock / (24 * 60)) + 1; }

function setupMarketData(s) {
  for (const g in GOODS) {
    const m = s.market[g];
    if (!m.candles) {
      // new games and old saves: make up some past prices (same rules as the real market) so the chart isn't empty
      m.candles = [];
      const base = GOODS[g].base;
      let p = base;
      for (let i = 0; i < 40; i++) {
        const c = { o: p, h: p, l: p, c: p, v: 0 };
        for (let t = 0; t < 7; t++) {
          p = clamp(p + (base - p) * 0.03 + (Math.random() - 0.5) * base * 0.05, base * 0.4, base * 2.5);
          c.h = Math.max(c.h, p); c.l = Math.min(c.l, p); c.v += Math.round(rand(5, 40));
        }
        c.c = p; m.candles.push(c);
      }
      // the last candle ends at today's real price
      const last = m.candles[m.candles.length - 1];
      last.c = m.price; last.h = Math.max(last.h, m.price); last.l = Math.min(last.l, m.price);
    }
    if (!m.now) m.now = { o: m.price, h: m.price, l: m.price, c: m.price, v: 0 };
    if (m.day == null) { m.day = 0; }
  }
}

// called every 2 seconds after prices move
function exTick() {
  const day = gameDay();
  for (const g in GOODS) {
    const m = S.market[g], n = m.now, p = m.price;
    n.c = p; n.h = Math.max(n.h, p); n.l = Math.min(n.l, p);
    const v = Math.round(rand(5, 40)); // other people trading
    n.v += v;
    if (m.day !== day) { m.day = day; m.dayOpen = p; m.dayHi = p; m.dayLo = p; m.dayVol = 0; }
    m.dayHi = Math.max(m.dayHi, p); m.dayLo = Math.min(m.dayLo, p); m.dayVol += v;
    m._book = null; // the order book gets rebuilt
  }
  if (Ex.open) exRender();
}

// called every 15 seconds: the current candle is done, start a new one
function exCloseCandle() {
  for (const g in GOODS) {
    const m = S.market[g];
    m.candles.push(m.now);
    if (m.candles.length > CANDLE_MAX) m.candles.shift();
    m.now = { o: m.price, h: m.price, l: m.price, c: m.price, v: 0 };
  }
}

// your own trades show up in the volume too
function exTraded(g, n) {
  const m = S.market[g];
  if (!m.now) return;
  m.now.v += n; m.dayVol = (m.dayVol || 0) + n;
  m.now.c = m.price; m.now.h = Math.max(m.now.h, m.price); m.now.l = Math.min(m.now.l, m.price);
  m.dayHi = Math.max(m.dayHi, m.price); m.dayLo = Math.min(m.dayLo, m.price);
  m._book = null;
}

const tickerOf = g => GOODS[g].tick || g.slice(0, 3).toUpperCase();
const dayChange = g => { const m = S.market[g], o = m.dayOpen || m.candles[0]?.o || m.price; return (m.price - o) / o * 100; };
const exMoney = v => '$' + v.toFixed(2);

// The order book: pretend buyers and sellers waiting around the current price
function orderBook(g) {
  const m = S.market[g];
  if (m._book) return m._book;
  const step = Math.max(0.01, Math.round(m.price * 0.004 * 100) / 100);
  const asks = [], bids = [];
  for (let i = 7; i >= 0; i--) asks.push({ p: buyPrice(g) + step * i, s: Math.round(rand(60, 450)) });
  for (let i = 0; i < 8; i++) bids.push({ p: sellPrice(g) - step * i, s: Math.round(rand(60, 450)) });
  return (m._book = { asks, bids });
}

// ---------- Opening and closing ----------
function setupExchange() {
  exCanvas = $('ex-chart');
  exCtx = exCanvas.getContext('2d');
  $('ex-close').onclick = closeExchange;
  const win = $('exchange');
  win.addEventListener('click', e => {
    const t = e.target.closest('[data-ex]');
    if (!t) return;
    const a = t.dataset.ex;
    if (a === 'good') { Ex.g = t.dataset.g; Ex.hover = -1; exRender(true); }
    else if (a === 'mode') { Ex.mode = t.dataset.m; exRender(); }
    else if (a === 'qty') { $('ex-qty').value = t.dataset.n === 'max' ? exMaxQty() : t.dataset.n; exRender(); }
    else if (a === 'buy') exTrade('buy');
    else if (a === 'sell') exTrade('sell');
  });
  $('ex-qty').addEventListener('input', () => exRender());
  $('ex-qty').addEventListener('keydown', e => {
    e.stopPropagation(); // typing here shouldn't walk or cook
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') { e.target.blur(); closeExchange(); }
  });
  window.addEventListener('resize', () => { if (Ex.open) exRender(true); });
  // hover the chart to see one candle's numbers
  exCanvas.addEventListener('pointermove', e => {
    const r = exCanvas.getBoundingClientRect(), list = exCandles();
    const i = Math.floor((e.clientX - r.left - 8) / ((r.width - 64) / list.length));
    Ex.hover = i >= 0 && i < list.length ? i : -1;
    exDrawChart();
  });
  exCanvas.addEventListener('pointerleave', () => { Ex.hover = -1; exDrawChart(); });
}

function openExchange() {
  if (!Game.running) return;
  if (UI.panelKey) closePanel();
  Ex.open = true; UI.mapOpen = true; // UI.mapOpen also stops you from walking around
  $('exchange').classList.remove('hidden');
  $('tooltip').classList.add('hidden');
  exRender(true);
}

function closeExchange() {
  Ex.open = false; UI.mapOpen = false;
  $('exchange').classList.add('hidden');
}

// ---------- Buying and selling ----------
const exQty = () => Math.max(0, Math.floor(+$('ex-qty').value || 0));
const exMaxQty = () => Math.max(0, Math.floor(S.money / buyPrice(Ex.g)));

function exTrade(side) {
  const g = Ex.g, n = exQty();
  if (n <= 0) { toast('Type how many you want first', 'bad'); return; }
  if (side === 'buy') {
    const got = marketBuy(g, n);
    if (got) { exTraded(g, got); toast(`Bought ${got} ${GOODS[g].emoji} ${GOODS[g].name.toLowerCase()}!`, 'good'); }
  } else {
    const sold = marketSell(g, n);
    if (sold) exTraded(g, sold);
  }
  updateHUD();
  exRender();
}

// ---------- Drawing the window ----------
function exRender(full = false) {
  if (!Ex.open) return;
  const g = Ex.g, m = S.market[g], G = GOODS[g], ch = dayChange(g);

  // header clock
  const mins = Math.floor(S.clock) % 1440, hh = Math.floor(mins / 60), mm = mins % 60;
  $('ex-live').innerHTML = `<i></i>LIVE <b>Day ${gameDay()}</b> ${String(hh).padStart(2, '0')}:${String(mm - mm % 10).padStart(2, '0')}`;

  // the goods list
  $('ex-goods').innerHTML = Object.keys(GOODS).map(k => {
    const c = dayChange(k);
    return `<button class="ex-good ${k === g ? 'sel' : ''}" data-ex="good" data-g="${k}">
      <span class="ex-em">${GOODS[k].emoji}</span><b>${tickerOf(k)}</b><span class="ex-p">${exMoney(S.market[k].price)}</span>
      <span class="${c >= 0 ? 'up' : 'down'}">${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(2)}%</span></button>`;
  }).join('');

  // the selected good
  const where = G.grow ? 'Crop: you can grow it on a farm' : ['eggs', 'meat', 'cheese'].includes(g) ? 'From animals on a ranch' : 'Only from the market';
  const used = Object.values(CUISINES).filter(C => C.recipe.includes(g)).map(C => C.emoji).join(' ');
  $('ex-title').innerHTML = `<span class="ex-big">${G.emoji}</span><div><b>${G.name}</b><div class="muted small">${tickerOf(g)} · ${where}${used ? ` · used in ${used}` : ''}</div></div>`;
  $('ex-price').innerHTML = `<b>${exMoney(m.price)}</b><span class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}% today</span>`;
  document.querySelectorAll('#ex-mode button').forEach(b => b.classList.toggle('sel', b.dataset.m === Ex.mode));

  // order book
  const book = orderBook(g), maxS = Math.max(...book.asks.concat(book.bids).map(o => o.s));
  const row = (o, cls) => `<div class="ex-ob ${cls}"><i style="width:${o.s / maxS * 100}%"></i><span>${o.p.toFixed(2)}</span><span>${o.s}</span></div>`;
  const spread = buyPrice(g) - sellPrice(g);
  $('ex-book').innerHTML = `<div class="ex-ob head"><span>PRICE</span><span>AMOUNT</span></div>`
    + book.asks.map(o => row(o, 'ask')).join('')
    + `<div class="ex-spread">gap ${spread.toFixed(2)} (${(spread / m.price * 100).toFixed(1)}%)</div>`
    + book.bids.map(o => row(o, 'bid')).join('');

  // stats row
  const own = Math.floor(S.inventory[g]);
  $('ex-stats').innerHTML = [
    ['Sell / Buy', `${exMoney(sellPrice(g))} / ${exMoney(buyPrice(g))}`],
    ["Today's high", exMoney(m.dayHi ?? m.price)],
    ["Today's low", exMoney(m.dayLo ?? m.price)],
    ['Traded today', (m.dayVol || 0).toLocaleString('en-US')],
    ['You own', own.toLocaleString('en-US')],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');

  // trade box
  const q = exQty();
  $('ex-buy').innerHTML = `BUY<small>@ ${exMoney(buyPrice(g))}</small>`;
  $('ex-sell').innerHTML = `SELL<small>@ ${exMoney(sellPrice(g))}</small>`;
  $('ex-sell').disabled = own < 1;
  $('ex-est').innerHTML = `Buy ≈ <b>${fmtMoney(buyPrice(g) * q)}</b> · Sell ≈ <b>${fmtMoney(sellPrice(g) * Math.min(q, own))}</b> · Cash <b>${fmtMoney(S.money)}</b>`;

  if (full) exSizeChart();
  exDrawChart();
}

function exSizeChart() {
  exDpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = exCanvas.clientWidth, h = exCanvas.clientHeight;
  exCanvas.width = w * exDpr; exCanvas.height = h * exDpr;
}

// all finished candles plus the one that's still going
const exCandles = () => S.market[Ex.g].candles.concat([S.market[Ex.g].now]);

function exDrawChart() {
  if (!Ex.open) return;
  if (exCanvas.width !== Math.round(exCanvas.clientWidth * exDpr)) exSizeChart();
  const g = exCtx, W = exCanvas.clientWidth, H = exCanvas.clientHeight;
  const list = exCandles(), m = S.market[Ex.g];
  g.setTransform(exDpr, 0, 0, exDpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const padL = 8, padR = 56, top = 26, volH = Math.round(H * 0.16), bottom = H - volH - 8;
  let hi = Math.max(...list.map(c => c.h)), lo = Math.min(...list.map(c => c.l));
  const extra = (hi - lo) * 0.12 || m.price * 0.02; hi += extra; lo -= extra;
  const y = p => top + (hi - p) / (hi - lo) * (bottom - top);
  const cw = (W - padL - padR) / list.length;
  const x = i => padL + cw * i + cw / 2;
  g.font = '11px "JetBrains Mono", ui-monospace, monospace'; g.textBaseline = 'middle';

  // grid + price labels on the right
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; g.fillStyle = '#7d869a'; g.textAlign = 'left';
  for (let i = 0; i <= 4; i++) {
    const p = lo + (hi - lo) * (i / 4), yy = y(p);
    g.beginPath(); g.moveTo(padL, yy); g.lineTo(W - padR, yy); g.stroke();
    g.fillText(p.toFixed(2), W - padR + 6, yy);
  }

  // highest and lowest price on the chart
  const rHi = Math.max(...list.map(c => c.h)), rLo = Math.min(...list.map(c => c.l));
  const level = (p, color, text) => {
    g.strokeStyle = color; g.setLineDash([]); g.beginPath(); g.moveTo(padL, y(p)); g.lineTo(W - padR, y(p)); g.stroke();
    g.fillStyle = color; g.font = 'bold 10px Nunito, sans-serif'; g.fillText(text, padL + 4, y(p) + (color === '#ff6b6b' ? -8 : 8));
    g.font = '11px "JetBrains Mono", ui-monospace, monospace';
  };
  level(rHi, '#ff6b6b', `HIGHEST ${rHi.toFixed(2)}`);
  level(rLo, '#52d69a', `LOWEST ${rLo.toFixed(2)}`);

  // volume bars along the bottom
  const maxV = Math.max(1, ...list.map(c => c.v));
  list.forEach((c, i) => {
    const vh = c.v / maxV * volH;
    g.fillStyle = c.c >= c.o ? 'rgba(82,214,154,0.35)' : 'rgba(255,107,107,0.35)';
    g.fillRect(x(i) - Math.max(1, cw * 0.35), H - vh, Math.max(2, cw * 0.7), vh);
  });

  // the price itself
  if (Ex.mode === 'line') {
    g.strokeStyle = '#4cc9f0'; g.lineWidth = 2; g.beginPath();
    list.forEach((c, i) => (i ? g.lineTo(x(i), y(c.c)) : g.moveTo(x(i), y(c.c))));
    g.stroke();
    g.lineTo(x(list.length - 1), bottom); g.lineTo(x(0), bottom); g.closePath();
    g.fillStyle = 'rgba(76,201,240,0.1)'; g.fill();
  } else {
    list.forEach((c, i) => {
      const up = c.c >= c.o, col = up ? '#52d69a' : '#ff6b6b';
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x(i), y(c.h)); g.lineTo(x(i), y(c.l)); g.stroke();
      const bt = y(Math.max(c.o, c.c)), bb = y(Math.min(c.o, c.c));
      g.fillRect(x(i) - Math.max(1, cw * 0.3), bt, Math.max(2, cw * 0.6), Math.max(1, bb - bt));
    });
  }

  // current price line + tag
  const py = y(m.price);
  g.strokeStyle = '#4c8dff'; g.lineWidth = 1; g.setLineDash([4, 3]);
  g.beginPath(); g.moveTo(padL, py); g.lineTo(W - padR, py); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#4c8dff'; g.fillRect(W - padR + 1, py - 9, padR - 2, 18);
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(m.price.toFixed(2), W - padR + 6, py);

  // the numbers for the candle under your mouse (or the newest one)
  const hc = list[Ex.hover >= 0 ? Ex.hover : list.length - 1];
  if (Ex.hover >= 0) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x(Ex.hover) - cw / 2, top, cw, H - top); }
  g.fillStyle = '#9aa3b5'; g.textAlign = 'left';
  g.fillText(W < 520 ? `O ${hc.o.toFixed(2)}  H ${hc.h.toFixed(2)}  L ${hc.l.toFixed(2)}  C ${hc.c.toFixed(2)}  Vol ${hc.v}`
    : `Open ${hc.o.toFixed(2)}  High ${hc.h.toFixed(2)}  Low ${hc.l.toFixed(2)}  Close ${hc.c.toFixed(2)}  Traded ${hc.v}`, padL + 2, 11);
}
