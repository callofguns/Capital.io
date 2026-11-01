// =============================================================
//  bigmap.js: the big city map (opens when you click the minimap)
//  Shows labels and a legend. Scroll/pinch to zoom, drag to move.
// =============================================================

const BigMap = { open: false, z: 0.3, x: 0, y: 0, fitZ: 0.3, drag: null, fingers: new Map(), pinch: null };
let bmCanvas, bmCtx, bmDpr = 1;

// What the colors mean (also used to draw the legend)
const BM_KEY = {
  you:      { color: '#ff006e', label: 'You' },
  cart:     { color: '#ffd166', label: 'Your carts' },
  shop:     { color: '#ff8c42', label: 'Your shops' },
  land:     { color: '#52d69a', label: 'Your land' },
  building: { color: '#2ec4b6', label: 'Your buildings' },
  rival:    { color: '#adb5bd', label: "Rivals' carts" },
  sale:     { color: '#e63946', label: 'For sale' },
  rent:     { color: '#4c8dff', label: 'For rent' },
};

function setupBigMap() {
  bmCanvas = $('bm-canvas');
  bmCtx = bmCanvas.getContext('2d');
  $('bm-legend').innerHTML = Object.values(BM_KEY).map(k => `<span><i style="background:${k.color}"></i>${k.label}</span>`).join('');
  $('minimap').addEventListener('click', openBigMap);
  $('bm-close').onclick = closeBigMap;
  $('bm-in').onclick = () => zoomBigMap(1.3);
  $('bm-out').onclick = () => zoomBigMap(1 / 1.3);
  $('bm-fit').onclick = fitBigMap;
  window.addEventListener('resize', () => { if (BigMap.open) sizeBigMap(); });

  // mouse wheel zooms toward the cursor
  bmCanvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = bmCanvas.getBoundingClientRect();
    zoomBigMap(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  // one finger / mouse drags, two fingers pinch
  bmCanvas.addEventListener('pointerdown', e => {
    bmCanvas.setPointerCapture(e.pointerId);
    BigMap.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (BigMap.fingers.size === 2) {
      const [a, b] = [...BigMap.fingers.values()];
      BigMap.pinch = { d: dist(a.x, a.y, b.x, b.y), z: BigMap.z };
      BigMap.drag = null;
    } else BigMap.drag = { x: e.clientX, y: e.clientY };
  });
  bmCanvas.addEventListener('pointermove', e => {
    if (!BigMap.fingers.has(e.pointerId)) return;
    BigMap.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (BigMap.pinch && BigMap.fingers.size === 2) {
      const [a, b] = [...BigMap.fingers.values()];
      setBigMapZoom(BigMap.pinch.z * dist(a.x, a.y, b.x, b.y) / BigMap.pinch.d);
    } else if (BigMap.drag) {
      BigMap.x -= (e.clientX - BigMap.drag.x) / BigMap.z;
      BigMap.y -= (e.clientY - BigMap.drag.y) / BigMap.z;
      BigMap.drag = { x: e.clientX, y: e.clientY };
      clampBigMap();
    }
  });
  const lift = e => {
    BigMap.fingers.delete(e.pointerId);
    if (BigMap.fingers.size < 2) BigMap.pinch = null;
    BigMap.drag = BigMap.fingers.size === 1 ? { ...[...BigMap.fingers.values()][0] } : null;
  };
  bmCanvas.addEventListener('pointerup', lift);
  bmCanvas.addEventListener('pointercancel', lift);
}

function openBigMap() {
  if (!Game.running) return;
  BigMap.open = true; UI.mapOpen = true;
  $('bigmap').classList.remove('hidden');
  $('tooltip').classList.add('hidden');
  sizeBigMap();
  fitBigMap();
}

function closeBigMap() {
  BigMap.open = false; UI.mapOpen = false;
  BigMap.fingers.clear(); BigMap.pinch = null; BigMap.drag = null;
  $('bigmap').classList.add('hidden');
}

function sizeBigMap() {
  bmDpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = bmCanvas.clientWidth, h = bmCanvas.clientHeight;
  bmCanvas.width = w * bmDpr; bmCanvas.height = h * bmDpr;
  BigMap.fitZ = Math.min(w / (MAP_W * TILE), h / (MAP_H * TILE));
}

function fitBigMap() {
  BigMap.z = BigMap.fitZ;
  BigMap.x = MAP_W * TILE / 2; BigMap.y = MAP_H * TILE / 2;
}

function setBigMapZoom(z) {
  BigMap.z = clamp(z, BigMap.fitZ * 0.9, 1.5);
  clampBigMap();
}

// zoom in/out, keeping the point under (sx, sy) in the same place
function zoomBigMap(f, sx, sy) {
  const w = bmCanvas.clientWidth, h = bmCanvas.clientHeight;
  if (sx == null) { sx = w / 2; sy = h / 2; }
  const wx = BigMap.x + (sx - w / 2) / BigMap.z, wy = BigMap.y + (sy - h / 2) / BigMap.z;
  setBigMapZoom(BigMap.z * f);
  BigMap.x = wx - (sx - w / 2) / BigMap.z;
  BigMap.y = wy - (sy - h / 2) / BigMap.z;
  clampBigMap();
}

function clampBigMap() {
  BigMap.x = clamp(BigMap.x, 0, MAP_W * TILE);
  BigMap.y = clamp(BigMap.y, 0, MAP_H * TILE);
}

// ---------- Drawing (runs every frame while the map is open) ----------
function renderBigMap() {
  const g = bmCtx, w = bmCanvas.clientWidth, h = bmCanvas.clientHeight, z = BigMap.z;
  g.setTransform(bmDpr, 0, 0, bmDpr, 0, 0);
  g.fillStyle = '#10121a'; g.fillRect(0, 0, w, h);
  // world -> screen
  const sx = x => (x - BigMap.x) * z + w / 2, sy = y => (y - BigMap.y) * z + h / 2;
  g.imageSmoothingEnabled = true;
  g.drawImage(World.canvas, sx(0), sy(0), MAP_W * TILE * z, MAP_H * TILE * z);

  const box = (x, y, bw, bh, color, fill) => {
    const X = sx(x * TILE), Y = sy(y * TILE), W = bw * TILE * z, H = bh * TILE * z;
    if (fill) { g.globalAlpha = 0.35; g.fillStyle = color; g.fillRect(X, Y, W, H); g.globalAlpha = 1; }
    g.strokeStyle = color; g.lineWidth = 2; g.strokeRect(X + 1, Y + 1, W - 2, H - 2);
  };
  const labels = []; // drawn last so they sit on top
  const label = (x, y, text, color, minZoom = 0) => { if (z >= minZoom) labels.push({ x: sx(x), y: sy(y), text, color }); };
  const detail = BigMap.fitZ * 1.6; // zoom level where the smaller labels appear

  // Things for sale / for rent
  for (const P of World.plots) {
    if (S.plots[P.id]) continue;
    box(P.x, P.y, P.w, P.h, BM_KEY.sale.color, false);
    label((P.x + P.w / 2) * TILE, (P.y + P.h / 2) * TILE, fmtMoney(P.price), BM_KEY.sale.color, detail);
  }
  for (const b of World.buildings) {
    if (S.buildings[b.id] || shopAt(b.id)) continue;
    if (b.forSale) { box(b.x, b.y, b.w, b.h, BM_KEY.sale.color, false); label((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, fmtMoney(b.price), BM_KEY.sale.color, detail); }
    else if (b.forRent) { box(b.x, b.y, b.w, b.h, BM_KEY.rent.color, false); label((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, fmtMoney(b.leasePerMin) + '/min', BM_KEY.rent.color, detail); }
  }

  // Your stuff
  for (const id in S.plots) {
    const P = World.plots[id], st = S.plots[id];
    box(P.x, P.y, P.w, P.h, BM_KEY.land.color, true);
    const name = st.type === 'farm' ? '🌾 Farm' : st.type === 'ranch' ? '🐄 Ranch' : 'Your land';
    label((P.x + P.w / 2) * TILE, (P.y + P.h / 2) * TILE, name, BM_KEY.land.color);
  }
  for (const id in S.buildings) {
    if (shopAt(id)) continue;
    const b = World.buildings[id];
    box(b.x, b.y, b.w, b.h, BM_KEY.building.color, true);
    label((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, '🏢 ' + b.kind, BM_KEY.building.color);
  }
  for (const s of S.shops) {
    const b = shopBuilding(s);
    box(b.x, b.y, b.w, b.h, BM_KEY.shop.color, true);
    label((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, `${SHOP_TYPES[s.type].emoji} ${s.name}`, BM_KEY.shop.color);
  }

  // Carts
  const dot = (x, y, r, color) => {
    g.fillStyle = color; g.beginPath(); g.arc(sx(x), sy(y), r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
  };
  for (const r of World.rivals) {
    dot((r.x + 0.5) * TILE, (r.y + 0.5) * TILE, 6, BM_KEY.rival.color);
    label((r.x + 0.5) * TILE, (r.y + 0.5) * TILE - 14 / z, `${CUISINES[r.cuisine].emoji} ${r.name}`, BM_KEY.rival.color, detail);
  }
  for (const c of S.carts) {
    dot((c.x + 0.5) * TILE, (c.y + 0.5) * TILE, 8, BM_KEY.cart.color);
    label((c.x + 0.5) * TILE, (c.y + 0.5) * TILE - 16 / z, `${CUISINES[c.cuisine].emoji} Your ${CUISINES[c.cuisine].name} cart`, BM_KEY.cart.color);
  }

  // You (with a little pulse so you're easy to spot)
  const p = Game.player, pulse = 10 + Math.sin(Game.t * 4) * 3;
  g.strokeStyle = BM_KEY.you.color; g.lineWidth = 2;
  g.beginPath(); g.arc(sx(p.x), sy(p.y), pulse + 6, 0, Math.PI * 2); g.stroke();
  dot(p.x, p.y, 7, BM_KEY.you.color);
  label(p.x, p.y - 22 / z, '📍 You', BM_KEY.you.color);

  // Labels: small rounded tags that keep the same size at any zoom
  g.font = 'bold 11px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const l of labels) {
    if (l.x < -100 || l.y < -20 || l.x > w + 100 || l.y > h + 20) continue;
    const tw = g.measureText(l.text).width + 10;
    g.fillStyle = 'rgba(16,18,26,0.85)';
    g.beginPath(); g.roundRect(l.x - tw / 2, l.y - 8, tw, 16, 5); g.fill();
    g.strokeStyle = l.color; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#fff'; g.fillText(l.text, l.x, l.y + 0.5);
  }
}
