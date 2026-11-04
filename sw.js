// =============================================================
//  sw.js: the "service worker"
//  It lets the game be installed as an app on computers and phones,
//  and keeps a copy of the game so it still opens without internet.
//
//  Game files (HTML, CSS, JS) always try the internet first, so you get
//  updates right away. Sounds and icons come from the saved copy first,
//  because they never change and are the biggest files.
// =============================================================

const CACHE = 'capitalio-cache-v2';
const CORE = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg', './icons/icon-180.png',
  './js/data.js', './js/util.js', './js/settings.js', './js/touch.js', './js/sound.js', './js/install.js',
  './js/world.js', './js/economy.js', './js/entities.js', './js/render.js', './js/minigames.js',
  './js/ui.js', './js/shops.js', './js/events.js', './js/rivals.js', './js/bigmap.js',
  './js/exchange.js', './js/main.js',
];
// every sound, so the music and sounds work offline too (about 6 MB, saved in the background)
const AUDIO = ['cash', 'city', 'click', 'coin-soft', 'coin', 'done', 'rain', 'scrub', 'sizzle', 'success', 'switch',
  'music-bossa-nova', 'music-feel-good-island', 'music-lofi-jam'].map(f => new URL(`./audio/${f}.mp3`, self.registration.scope).href);

self.addEventListener('install', e => {
  // save the game files (one missing file shouldn't break the rest)
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.concat(AUDIO).map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const path = new URL(req.url).pathname;
  const keep = res => { if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };

  if (/\/(audio|icons)\//.test(path)) {
    // sounds and icons: saved copy first. Music players ask for files in pieces ("ranges"),
    // so we download the whole file once, save it, and hand out the piece that was asked for.
    e.respondWith(caches.match(req.url).then(hit => hit || fetch(req.url).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.url, copy)); }
      return res;
    })).then(res => sliceRange(req, res)));
  } else {
    // everything else: internet first, saved copy if you're offline
    e.respondWith(fetch(req).then(keep).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
  }
});

// Answer a "give me bytes 1000-2000" request from a full saved file
async function sliceRange(req, res) {
  const range = req.headers.get('range');
  if (!range || !res.ok || res.status !== 200) return res;
  const buf = await res.arrayBuffer(), m = /bytes=(\d*)-(\d*)/.exec(range);
  const start = m && m[1] ? +m[1] : 0, end = m && m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206, statusText: 'Partial Content',
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' },
  });
}
