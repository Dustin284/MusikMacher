// OBS Overlay Server — HTTP + SSE (Server-Sent Events)
// Serves a self-contained overlay page for OBS Browser Source
// Uses SSE instead of WebSocket for maximum compatibility (no upgrade needed)

const http = require('http')

let server = null
let sseClients = []  // array of { res }
let currentState = {
  title: '',
  artist: '',
  cover: null,     // base64
  bpm: null,
  key: null,
  isPlaying: false,
  position: 0,
  duration: 0,
}
let overlaySettings = {
  theme: 'modern',
  showCover: true,
  showBpm: true,
  showKey: true,
  showProgress: true,
  showTime: true,
  overlayWidth: 400,
  overlayHeight: 120,
}

// --- SSE helpers ---

function sendSSE(res, event, data) {
  try {
    res.write('event: ' + event + '\n')
    res.write('data: ' + JSON.stringify(data) + '\n\n')
  } catch { /* dead connection */ }
}

function broadcast(event, data) {
  const dead = []
  for (let i = 0; i < sseClients.length; i++) {
    try {
      sseClients[i].write('event: ' + event + '\n')
      sseClients[i].write('data: ' + JSON.stringify(data) + '\n\n')
    } catch {
      dead.push(i)
    }
  }
  // Remove dead clients in reverse order
  for (let i = dead.length - 1; i >= 0; i--) {
    sseClients.splice(dead[i], 1)
  }
}

// --- Overlay HTML ---

function overlayHTML() {
  const settingsJson = JSON.stringify(overlaySettings)
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Lorus OBS Overlay</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #fff;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
  }

  .overlay { position: absolute; bottom: 20px; left: 20px; transition: opacity 0.4s, transform 0.4s; }
  .overlay.hidden { opacity: 0; transform: translateY(20px); }
  .bg-blur { display: none; }
  .theme-banner .bg-blur { display: block; }

  /* ---------- MODERN ---------- */
  .theme-modern .card {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(15, 15, 20, 0.85);
    backdrop-filter: blur(16px);
    border-radius: 14px;
    padding: 14px 18px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.08);
    animation: slideIn 0.5s ease-out;
  }
  .theme-modern .cover {
    width: 64px; height: 64px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }
  .theme-modern .info { flex: 1; min-width: 0; }
  .theme-modern .title {
    font-size: 16px; font-weight: 700;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .theme-modern .artist {
    font-size: 13px; color: rgba(255,255,255,0.6);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-top: 2px;
  }
  .theme-modern .badges {
    display: flex; gap: 8px; margin-top: 6px;
  }
  .theme-modern .badge {
    font-size: 11px; font-weight: 600;
    background: rgba(255,255,255,0.1);
    padding: 2px 8px;
    border-radius: 6px;
    color: rgba(255,255,255,0.7);
  }
  .theme-modern .time {
    font-size: 11px; color: rgba(255,255,255,0.5);
    font-variant-numeric: tabular-nums;
    margin-top: 4px; display: block;
  }
  .theme-modern .progress-bar {
    height: 3px; background: rgba(255,255,255,0.1);
    border-radius: 2px; margin-top: 8px; overflow: hidden;
  }
  .theme-modern .progress-fill {
    height: 100%; background: #7c3aed;
    border-radius: 2px; transition: width 1s linear;
  }

  /* ---------- MINIMAL ---------- */
  .theme-minimal .card {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 8px 14px;
    animation: slideIn 0.4s ease-out;
  }
  .theme-minimal .cover {
    width: 32px; height: 32px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .theme-minimal .info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }
  .theme-minimal .title {
    font-size: 13px; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .theme-minimal .artist {
    font-size: 12px; color: rgba(255,255,255,0.5);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .theme-minimal .artist::before { content: '\\2014'; margin-right: 6px; }
  .theme-minimal .badges {
    display: flex; gap: 6px; margin-left: auto; flex-shrink: 0;
  }
  .theme-minimal .badge {
    font-size: 10px; font-weight: 600;
    color: rgba(255,255,255,0.5);
  }
  .theme-minimal .time {
    font-size: 10px; color: rgba(255,255,255,0.4);
    font-variant-numeric: tabular-nums;
    margin-left: 8px; flex-shrink: 0;
  }
  .theme-minimal .progress-bar { display: none; }

  /* ---------- TICKER ---------- */
  .theme-ticker { bottom: 0; left: 0; right: 0; }
  .theme-ticker .card {
    display: flex;
    align-items: center;
    background: rgba(10, 10, 15, 0.9);
    padding: 6px 16px;
    animation: slideUp 0.4s ease-out;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .theme-ticker .cover {
    width: 28px; height: 28px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
    margin-right: 12px;
  }
  .theme-ticker .info {
    flex: 1; min-width: 0; overflow: hidden;
  }
  .theme-ticker .marquee-wrap {
    display: flex; white-space: nowrap;
    animation: marquee 20s linear infinite;
  }
  .theme-ticker .title { font-size: 13px; font-weight: 600; }
  .theme-ticker .artist {
    font-size: 13px; color: rgba(255,255,255,0.5);
    margin-left: 8px;
  }
  .theme-ticker .badges {
    display: flex; gap: 8px; margin-left: 16px; flex-shrink: 0;
  }
  .theme-ticker .badge {
    font-size: 10px; font-weight: 600;
    color: rgba(255,255,255,0.5);
  }
  .theme-ticker .time {
    font-size: 10px; color: rgba(255,255,255,0.4);
    font-variant-numeric: tabular-nums;
    margin-left: 12px; flex-shrink: 0;
  }
  .theme-ticker .progress-bar {
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 2px; background: rgba(255,255,255,0.06);
  }
  .theme-ticker .progress-fill {
    height: 100%; background: #7c3aed;
    transition: width 1s linear;
  }

  /* ---------- BANNER ---------- */
  .theme-banner { bottom: 20px; left: 20px; }
  .theme-banner .card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 20px;
    height: 100%;
    overflow: hidden;
    border-radius: 14px;
    animation: fadeIn 0.6s ease-out;
  }
  .theme-banner .bg-blur {
    position: absolute;
    inset: -20px;
    background-size: cover;
    background-position: center;
    filter: blur(50px) brightness(0.35) saturate(1.4);
    transform: scale(1.2);
  }
  .theme-banner .cover {
    width: 90px; height: 90px;
    border-radius: 10px;
    object-fit: cover;
    flex-shrink: 0;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    z-index: 1;
  }
  .theme-banner .info {
    flex: 1; min-width: 0; z-index: 1;
    display: flex; flex-direction: column; justify-content: center;
  }
  .theme-banner #marquee-wrap {
    display: flex; flex-direction: column;
  }
  .theme-banner .artist {
    order: -1;
    font-size: 11px; font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: rgba(255,255,255,0.65);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-bottom: 4px;
  }
  .theme-banner .title {
    font-size: 22px; font-weight: 800;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    line-height: 1.2;
  }
  .theme-banner .badges {
    display: flex; gap: 10px; margin-top: 8px;
  }
  .theme-banner .badge {
    font-size: 11px; font-weight: 600;
    background: rgba(255,255,255,0.12);
    padding: 3px 10px;
    border-radius: 20px;
    color: rgba(255,255,255,0.75);
  }
  .theme-banner .time {
    font-size: 11px; color: rgba(255,255,255,0.45);
    font-variant-numeric: tabular-nums;
    margin-top: 6px; display: block;
  }
  .theme-banner .progress-bar {
    height: 3px; background: rgba(255,255,255,0.1);
    border-radius: 2px; margin-top: 10px; overflow: hidden;
  }
  .theme-banner .progress-fill {
    height: 100%; background: #7c3aed;
    border-radius: 2px; transition: width 1s linear;
  }

  /* ---------- Animations ---------- */
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(100%); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes marquee {
    0%   { transform: translateX(100%); }
    100% { transform: translateX(-100%); }
  }
</style>
</head>
<body>
<div id="overlay" class="overlay theme-modern hidden">
  <div class="card">
    <div id="bg-blur" class="bg-blur"></div>
    <img id="cover" class="cover" src="" alt="" style="display:none">
    <div class="info">
      <div id="marquee-wrap">
        <div id="title" class="title"></div>
        <div id="artist" class="artist"></div>
      </div>
      <div id="badges" class="badges"></div>
      <span id="time" class="time"></span>
      <div id="progress" class="progress-bar">
        <div id="progress-fill" class="progress-fill" style="width:0%"></div>
      </div>
    </div>
  </div>
</div>

<script>
(function() {
  var settings = ${settingsJson};
  var overlay = document.getElementById('overlay');
  var coverEl = document.getElementById('cover');
  var titleEl = document.getElementById('title');
  var artistEl = document.getElementById('artist');
  var badgesEl = document.getElementById('badges');
  var timeEl = document.getElementById('time');
  var progressEl = document.getElementById('progress');
  var progressFill = document.getElementById('progress-fill');
  var marqueeWrap = document.getElementById('marquee-wrap');
  var bgBlur = document.getElementById('bg-blur');

  function formatTime(sec) {
    if (!sec || sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function applySize() {
    var w = settings.overlayWidth || 400;
    var h = settings.overlayHeight || 120;
    overlay.style.width = w + 'px';
    overlay.style.minHeight = h + 'px';
  }

  // Apply theme
  overlay.className = 'overlay theme-' + (settings.theme || 'modern');
  applySize();

  // Ticker theme uses marquee wrapper
  if (settings.theme === 'ticker') {
    marqueeWrap.className = 'marquee-wrap';
  }

  var currentTitle = '';

  function applyState(state) {
    if (!state.title && !state.artist) {
      overlay.classList.add('hidden');
      return;
    }

    // Detect track change for re-animation
    if (state.title !== currentTitle) {
      currentTitle = state.title;
      overlay.classList.add('hidden');
      setTimeout(function() {
        updateDOM(state);
        overlay.classList.remove('hidden');
      }, 100);
    } else {
      updateDOM(state);
      overlay.classList.remove('hidden');
    }
  }

  function updateDOM(state) {
    titleEl.textContent = state.title || '';
    artistEl.textContent = state.artist || '';
    artistEl.style.display = state.artist ? '' : 'none';

    // Cover
    if (settings.showCover && state.cover) {
      coverEl.src = 'data:image/jpeg;base64,' + state.cover;
      coverEl.style.display = '';
    } else {
      coverEl.style.display = 'none';
    }

    // Banner theme blurred background
    if (state.cover) {
      bgBlur.style.backgroundImage = 'url(data:image/jpeg;base64,' + state.cover + ')';
    } else {
      bgBlur.style.backgroundImage = 'none';
      bgBlur.style.background = 'rgba(15, 15, 20, 0.95)';
    }

    // Badges
    var parts = [];
    if (settings.showBpm && state.bpm) parts.push(state.bpm + ' BPM');
    if (settings.showKey && state.key) parts.push(state.key);
    badgesEl.innerHTML = parts.map(function(p) { return '<span class="badge">' + p + '</span>'; }).join('');

    // Time
    if (settings.showTime !== false && state.duration > 0) {
      var elapsed = formatTime(state.position);
      var total = formatTime(state.duration);
      var remaining = formatTime(state.duration - state.position);
      timeEl.textContent = elapsed + ' / ' + total + '  (-' + remaining + ')';
      timeEl.style.display = '';
    } else {
      timeEl.style.display = 'none';
    }

    // Progress
    if (settings.showProgress && state.duration > 0) {
      progressEl.style.display = '';
      var pct = Math.min(100, (state.position / state.duration) * 100);
      progressFill.style.width = pct + '%';
    } else {
      progressEl.style.display = 'none';
    }
  }

  // SSE connection (auto-reconnects by default via EventSource)
  function connect() {
    var es = new EventSource('/events');

    es.addEventListener('state', function(e) {
      try { applyState(JSON.parse(e.data)); } catch(ex) {}
    });

    es.addEventListener('settings', function(e) {
      try {
        Object.assign(settings, JSON.parse(e.data));
        overlay.className = 'overlay theme-' + (settings.theme || 'modern');
        if (settings.theme === 'ticker') marqueeWrap.className = 'marquee-wrap';
        else marqueeWrap.className = '';
        applySize();
      } catch(ex) {}
    });

    es.onerror = function() {
      // EventSource auto-reconnects, no manual reconnect needed
    };
  }

  connect();
})();
</script>
</body>
</html>`
}

// --- HTTP Server ---

function start(port) {
  return new Promise((resolve, reject) => {
    if (server) stop()

    server = http.createServer((req, res) => {
      if (req.url === '/overlay' || req.url === '/') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        })
        res.end(overlayHTML())
      } else if (req.url === '/events') {
        // SSE endpoint
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        })
        // Send current state immediately
        sendSSE(res, 'state', currentState)
        sendSSE(res, 'settings', overlaySettings)

        sseClients.push(res)

        req.on('close', () => {
          sseClients = sseClients.filter(c => c !== res)
        })
      } else if (req.url === '/state') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        })
        res.end(JSON.stringify(currentState))
      } else if (req.url === '/cover') {
        if (currentState.cover) {
          const buf = Buffer.from(currentState.cover, 'base64')
          res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': buf.length,
            'Cache-Control': 'no-cache',
          })
          res.end(buf)
        } else {
          res.writeHead(204)
          res.end()
        }
      } else if (req.url === '/favicon.ico') {
        res.writeHead(204)
        res.end()
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    server.on('error', (err) => {
      server = null
      reject(err)
    })

    server.listen(port, '0.0.0.0', () => {
      resolve()
    })
  })
}

function stop() {
  for (const client of sseClients) {
    try { client.end() } catch { /* ok */ }
  }
  sseClients = []
  if (server) {
    try { server.close() } catch { /* ok */ }
    server = null
  }
}

function updateNowPlaying(data) {
  currentState = {
    title: data.title || '',
    artist: data.artist || '',
    cover: data.cover !== undefined && data.cover !== null ? data.cover : currentState.cover,
    bpm: data.bpm || null,
    key: data.key || null,
    isPlaying: data.isPlaying !== false,
    position: data.position || 0,
    duration: data.duration || 0,
  }
  broadcast('state', currentState)
}

function updateSettings(settings) {
  if (settings.obsOverlayTheme) overlaySettings.theme = settings.obsOverlayTheme
  if (settings.obsShowCover !== undefined) overlaySettings.showCover = settings.obsShowCover
  if (settings.obsShowBpm !== undefined) overlaySettings.showBpm = settings.obsShowBpm
  if (settings.obsShowKey !== undefined) overlaySettings.showKey = settings.obsShowKey
  if (settings.obsShowProgress !== undefined) overlaySettings.showProgress = settings.obsShowProgress
  if (settings.obsShowTime !== undefined) overlaySettings.showTime = settings.obsShowTime
  if (settings.obsOverlayWidth !== undefined) overlaySettings.overlayWidth = settings.obsOverlayWidth
  if (settings.obsOverlayHeight !== undefined) overlaySettings.overlayHeight = settings.obsOverlayHeight
  broadcast('settings', overlaySettings)
}

module.exports = { start, stop, updateNowPlaying, updateSettings }
