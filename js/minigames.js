// =============================================================
//  minigames.js — cooking minigames + the "scrub the cart" game
//  Each game calls done(score) with a score from 0 (bad) to 1 (perfect)
// =============================================================

const Minigame = {
  active: null,

  start(type, cart, done) {
    if (this.active) return;
    const box = document.getElementById('modal-box');
    UI.modalOpen = true;
    document.getElementById('modal').classList.remove('hidden');
    box.className = 'mg';
    const finish = (score, label) => {
      if (!this.active) return;
      this.active.cleanup();
      this.active = null;
      box.insertAdjacentHTML('beforeend', `<div class="mg-result ${score >= 0.85 ? 'great' : score >= 0.45 ? 'ok' : 'bad'}">${label}</div>`);
      setTimeout(() => { closeModal(); done(score); }, 750);
    };
    const labelFor = s => s >= 0.9 ? 'PERFECT! ⭐' : s >= 0.7 ? 'Great!' : s >= 0.45 ? 'Good' : s >= 0.25 ? 'Meh…' : 'Burnt! 🔥';
    const games = { timing: mgTiming, sequence: mgSequence, hold: mgHold, scrub: mgScrub };
    this.active = games[type](box, cart, finish, labelFor);
  },

  cancel() {
    if (!this.active) return;
    this.active.cleanup();
    this.active = null;
    closeModal();
  },
};

// ---------- 1) Timing: stop the needle in the green zone ----------
function mgTiming(box, cart, finish, labelFor) {
  const C = CUISINES[cart.cuisine];
  const zoneW = 0.16 + cart.upgrades.recipe * 0.012;
  const center = rand(0.2 + zoneW / 2, 0.8 - zoneW / 2);
  box.innerHTML = `
    <div class="mg-title">${C.emoji} ${C.verb}</div>
    <div class="mg-sub">Press <b>SPACE</b> or tap when the needle is in the green!</div>
    <div class="mg-bar" id="mg-bar">
      <div class="mg-zone" style="left:${(center - zoneW / 2) * 100}%;width:${zoneW * 100}%"></div>
      <div class="mg-perfect" style="left:${(center - 0.015) * 100}%"></div>
      <div class="mg-needle" id="mg-needle"></div>
    </div>
    <button class="btn big" id="mg-go">STOP!</button>`;
  let pos = 0, dir = 1, raf, last = performance.now(), stopped = false;
  const speed = 1.15 + Math.random() * 0.3;
  const needle = box.querySelector('#mg-needle');
  const loop = now => {
    const dt = (now - last) / 1000; last = now;
    pos += dir * speed * dt;
    if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
    needle.style.left = pos * 100 + '%';
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const stop = () => {
    if (stopped) return; stopped = true;
    cancelAnimationFrame(raf);
    const d = Math.abs(pos - center), half = zoneW / 2;
    const score = d <= half ? 1 - (d / half) * 0.4 : Math.max(0.05, 0.5 - (d - half) * 2.5);
    finish(score, labelFor(score));
  };
  const key = e => { if (e.code === 'Space' || e.key === 'e') { e.preventDefault(); stop(); } };
  box.querySelector('#mg-go').onclick = stop;
  box.querySelector('#mg-bar').onclick = stop;
  window.addEventListener('keydown', key);
  return { cleanup() { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); } };
}

// ---------- 2) Sequence: add ingredients in the right order ----------
function mgSequence(box, cart, finish, labelFor) {
  const C = CUISINES[cart.cuisine];
  const order = C.recipe.map(g => GOODS[g].emoji).concat(shuffle(C.extras.slice()).slice(0, 2));
  const decoys = shuffle(['🍌', '🍩', '🧁', '🍇', '🥕', '🍪']).slice(0, 2);
  const buttons = shuffle(order.concat(decoys));
  const limit = 8 + cart.upgrades.recipe * 0.3;
  box.innerHTML = `
    <div class="mg-title">${C.emoji} ${C.verb}</div>
    <div class="mg-sub">Tap the ingredients in this order:</div>
    <div class="mg-order">${order.map((e, i) => `<span data-i="${i}">${e}</span>`).join('')}</div>
    <div class="mg-timer"><div id="mg-time"></div></div>
    <div class="mg-grid">${buttons.map(e => `<button class="mg-ing">${e}</button>`).join('')}</div>`;
  let step = 0, mistakes = 0, raf;
  const t0 = performance.now();
  const timeBar = box.querySelector('#mg-time');
  const loop = now => {
    const el = (now - t0) / 1000;
    timeBar.style.width = Math.max(0, 1 - el / limit) * 100 + '%';
    if (el >= limit) { const s = Math.max(0.05, step / order.length * 0.5 - mistakes * 0.1); finish(s, 'Too slow!'); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  box.querySelectorAll('.mg-ing').forEach(b => b.onclick = () => {
    if (b.textContent === order[step]) {
      box.querySelector(`.mg-order span[data-i="${step}"]`).classList.add('done');
      b.classList.add('used'); b.disabled = true;
      step++;
      if (step === order.length) {
        cancelAnimationFrame(raf);
        const el = (performance.now() - t0) / 1000;
        const s = clamp(1 - mistakes * 0.22 - Math.max(0, el - 3) / (limit * 1.6), 0.05, 1);
        finish(s, labelFor(s));
      }
    } else {
      mistakes++;
      b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 300);
    }
  });
  return { cleanup() { cancelAnimationFrame(raf); } };
}

// ---------- 3) Hold: hold the button, release when golden ----------
function mgHold(box, cart, finish, labelFor) {
  const C = CUISINES[cart.cuisine];
  const lo = rand(0.58, 0.7), hi = lo + 0.13 + cart.upgrades.recipe * 0.008;
  box.innerHTML = `
    <div class="mg-title">${C.emoji} ${C.verb}</div>
    <div class="mg-sub"><b>Hold</b> SPACE or the button, let go when it's in the golden zone.</div>
    <div class="mg-vbar"><div class="mg-gold" style="bottom:${lo * 100}%;height:${(hi - lo) * 100}%"></div><div class="mg-fill" id="mg-fill"></div></div>
    <button class="btn big" id="mg-hold">HOLD</button>`;
  let v = 0, holding = false, raf, last = performance.now(), done = false;
  const fill = box.querySelector('#mg-fill');
  const release = () => {
    if (!holding || done) return;
    done = true; holding = false;
    const mid = (lo + hi) / 2, half = (hi - lo) / 2;
    const d = Math.abs(v - mid);
    const s = d <= half ? 1 - (d / half) * 0.35 : Math.max(0.05, 0.55 - (d - half) * 2.2);
    finish(s, labelFor(s));
  };
  const loop = now => {
    const dt = (now - last) / 1000; last = now;
    if (holding) {
      v += dt * (0.25 + v * 0.9);
      if (v >= 1) { v = 1; holding = false; done = true; fill.style.height = '100%'; finish(0.05, 'Burnt! 🔥'); return; }
    }
    fill.style.height = v * 100 + '%';
    fill.style.background = v < lo ? '#f6bd60' : v <= hi ? '#e9a23b' : '#6f4518';
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const btn = box.querySelector('#mg-hold');
  const down = e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); if (!done) holding = true; };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointerleave', release);
  const kd = e => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat && !done) holding = true; } };
  const ku = e => { if (e.code === 'Space') { e.preventDefault(); release(); } };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  return { cleanup() { cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); } };
}

// ---------- 4) Scrub: rub the dirt spots off the cart ----------
function mgScrub(box, cart, finish) {
  const n = 4 + Math.floor(cart.dirt / 12);
  box.innerHTML = `
    <div class="mg-title">🧽 Scrub your cart clean!</div>
    <div class="mg-sub">Click and drag over the dirt spots.</div>
    <div class="mg-cart" id="mg-cart"><div class="mg-cart-top" style="background:${cart.color || CUISINES[cart.cuisine].color}"></div></div>`;
  const area = box.querySelector('#mg-cart');
  const spots = [];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'mg-dirt';
    s.style.left = rand(5, 82) + '%'; s.style.top = rand(22, 78) + '%';
    const size = rand(26, 46); s.style.width = s.style.height = size + 'px';
    s.dataset.hp = 3;
    area.appendChild(s); spots.push(s);
  }
  let down = false, left = n;
  const rub = e => {
    const el = document.elementFromPoint(e.clientX, e.clientY); // works for touch-drag too
    const s = el && el.closest('.mg-dirt');
    if (!s || !(down || e.type === 'pointerdown')) return;
    const now = performance.now();
    if (s._last && now - s._last < 90) return;
    s._last = now;
    s.dataset.hp--;
    s.style.opacity = s.dataset.hp / 3;
    if (+s.dataset.hp <= 0) {
      s.remove(); left--;
      if (left === 0) finish(1, 'Sparkling! ✨');
    }
  };
  area.addEventListener('pointerdown', e => { down = true; rub(e); });
  area.addEventListener('pointermove', rub);
  area.addEventListener('pointerover', rub);
  const up = () => { down = false; };
  window.addEventListener('pointerup', up);
  return { cleanup() { window.removeEventListener('pointerup', up); } };
}
