/* Grog Studio — playtest bridge + exporters (single HTML, PWA, Electron, Tauri) + stored ZIP writer. */
(function () {
  'use strict';
  const Studio = window.Studio;
  const el = Studio.el;

  // ---------- playtest ----------
  Studio.playtest = function (startRoom) {
    const overlay = document.getElementById('play-overlay');
    const frame = document.getElementById('play-frame');
    overlay.hidden = false;
    const project = JSON.parse(JSON.stringify(Studio.state.project));
    if (startRoom && project.rooms[startRoom]) {
      project.meta.start = { room: startRoom, x: project.meta.start.x, y: project.meta.start.y };
      const room = project.rooms[startRoom];
      const poly = (room.walk || [])[0];
      if (poly && poly.length >= 2) {
        let sx = 0, sy = 0;
        for (let i = 0; i < poly.length; i += 2) { sx += poly[i]; sy += poly[i + 1]; }
        project.meta.start.x = Math.round(sx / (poly.length / 2));
        project.meta.start.y = Math.round(sy / (poly.length / 2));
      }
    }
    const send = () => frame.contentWindow.postMessage({ type: 'grog:project', project }, '*');
    const onMsg = (e) => { if (e.data && e.data.type === 'grog:ready') send(); };
    window.addEventListener('message', onMsg);
    frame.src = '../play.html?studio=1&t=' + Date.now();
    document.getElementById('btn-play-restart').onclick = () => { frame.src = '../play.html?studio=1&t=' + Date.now(); };
    document.getElementById('btn-play-close').onclick = () => {
      overlay.hidden = true;
      frame.src = 'about:blank';
      window.removeEventListener('message', onMsg);
    };
  };

  // ---------- engine source loading ----------
  const ENGINE_FILES = ['core.js', 'render.js', 'walk.js', 'audio.js', 'script.js', 'ui.js', 'boot.js'];
  let engineSrcCache = null;
  async function engineSource() {
    if (engineSrcCache) return engineSrcCache;
    const parts = [];
    for (const f of ENGINE_FILES) {
      const res = await fetch('../engine/' + f);
      if (!res.ok) throw new Error('Cannot load engine/' + f);
      parts.push('/* ==== engine/' + f + ' ==== */\n' + (await res.text()));
    }
    engineSrcCache = parts.join('\n');
    return engineSrcCache;
  }

  // ---------- single-file HTML ----------
  Studio.buildSingleHTML = async function () {
    const P = Studio.state.project;
    const engine = await engineSource();
    const title = (P.meta.title || 'Grog Game').replace(/</g, '&lt;');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>${title}</title>
<style>html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}#game{width:100vw;height:100vh}</style>
</head>
<body>
<div id="game"></div>
<script>
${engine}
<\/script>
<script>
window.GROG_PROJECT = ${JSON.stringify(P)};
Grog.boot(window.GROG_PROJECT, '#game').then((e) => { window.engine = e; });
<\/script>
</body>
</html>`;
  };

  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const slug = () => (Studio.state.project.meta.title || 'game').replace(/\W+/g, '-').toLowerCase();

  // ---------- stored ZIP ----------
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  // files: [{name, data: string|Uint8Array}] -> Blob (ZIP, no compression: simple & always valid)
  Studio.makeZip = function (files) {
    const enc = new TextEncoder();
    const chunks = [], central = [];
    let offset = 0;
    const u16 = (v) => new Uint8Array([v & 255, (v >> 8) & 255]);
    const u32 = (v) => new Uint8Array([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]);
    for (const f of files) {
      const nameB = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : new Uint8Array(f.data);
      const crc = crc32(data);
      const local = [u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0), nameB, data];
      const localLen = local.reduce((s, a) => s + a.length, 0);
      central.push({ nameB, crc, size: data.length, offset });
      chunks.push(...local);
      offset += localLen;
    }
    const cdStart = offset;
    for (const c of central) {
      chunks.push(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(c.crc), u32(c.size), u32(c.size), u16(c.nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset), c.nameB);
      offset += 46 + c.nameB.length;
    }
    chunks.push(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(offset - cdStart), u32(cdStart), u16(0));
    return new Blob(chunks, { type: 'application/zip' });
  };

  // ---------- PWA icon (canvas-drawn) ----------
  function makeIcon(size) {
    return new Promise((resolve) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d');
      x.fillStyle = '#16141f'; x.fillRect(0, 0, size, size);
      x.fillStyle = '#fbf236';
      x.font = `bold ${Math.floor(size * 0.62)}px monospace`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('G', size / 2, size / 2 + size * 0.04);
      x.strokeStyle = '#639bff'; x.lineWidth = Math.max(2, size / 32);
      x.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
      c.toBlob(async (b) => resolve(new Uint8Array(await b.arrayBuffer())), 'image/png');
    });
  }

  // ---------- export flows ----------
  Studio.exportSingle = async function () {
    const html = await Studio.buildSingleHTML();
    download(slug() + '.html', new Blob([html], { type: 'text/html' }));
    Studio.status('Exported single-file HTML — upload it anywhere (itch.io, a web server) or just double-click it.');
  };

  Studio.exportPWA = async function () {
    const html = await Studio.buildSingleHTML();
    const P = Studio.state.project;
    const withSW = html.replace('</body>', `<script>if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');<\/script></body>`)
      .replace('<title>', `<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#16141f"><title>`);
    const manifest = JSON.stringify({
      name: P.meta.title, short_name: P.meta.title, start_url: './index.html', display: 'fullscreen',
      orientation: 'landscape', background_color: '#000000', theme_color: '#16141f',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
    }, null, 2);
    const sw = `const C='grog-v1';self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(['./index.html','./manifest.webmanifest']))));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));`;
    const [i192, i512] = await Promise.all([makeIcon(192), makeIcon(512)]);
    download(slug() + '-pwa.zip', Studio.makeZip([
      { name: 'index.html', data: withSW },
      { name: 'manifest.webmanifest', data: manifest },
      { name: 'sw.js', data: sw },
      { name: 'icon-192.png', data: i192 },
      { name: 'icon-512.png', data: i512 },
      { name: 'README.txt', data: 'Grog PWA build\n==============\nHost this folder on any HTTPS server. Players can "Add to Home Screen" on\nmobile and play offline. Test locally: python3 -m http.server\n' },
    ]));
    Studio.status('Exported PWA zip — host on HTTPS, installable + offline.');
  };

  Studio.exportElectron = async function () {
    const html = await Studio.buildSingleHTML();
    const P = Studio.state.project;
    const pkg = JSON.stringify({
      name: slug(), productName: P.meta.title, version: P.meta.version || '1.0.0', main: 'main.js',
      scripts: { start: 'electron .', 'dist': 'electron-builder' },
      devDependencies: { electron: '^33.0.0', 'electron-builder': '^25.0.0' },
      build: { appId: 'com.grog.' + slug().replace(/-/g, ''), files: ['main.js', 'index.html'] },
    }, null, 2);
    const main = `const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280, height: 800, useContentSize: true,
    autoHideMenuBar: true, backgroundColor: '#000000',
  });
  win.loadFile('index.html');
});
app.on('window-all-closed', () => app.quit());
`;
    download(slug() + '-electron.zip', Studio.makeZip([
      { name: 'index.html', data: html },
      { name: 'main.js', data: main },
      { name: 'package.json', data: pkg },
      { name: 'README.txt', data: 'Grog desktop build (Electron)\n=============================\n1. Install Node.js\n2. npm install\n3. npm start          (run the game)\n4. npm run dist       (build installers for your OS: Win/macOS/Linux)\n' },
    ]));
    Studio.status('Exported Electron zip — npm install && npm start.');
  };

  Studio.exportTauri = async function () {
    const html = await Studio.buildSingleHTML();
    const P = Studio.state.project;
    const conf = JSON.stringify({
      $schema: 'https://schema.tauri.app/config/2',
      productName: P.meta.title, version: P.meta.version || '1.0.0', identifier: 'com.grog.' + slug().replace(/-/g, ''),
      build: { frontendDist: '../dist' },
      app: { windows: [{ title: P.meta.title, width: 1280, height: 800, resizable: true }], security: { csp: null } },
      bundle: { active: true, targets: 'all', icon: [] },
    }, null, 2);
    const cargo = `[package]
name = "${slug().replace(/-/g, '_')}"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }

[[bin]]
name = "app"
path = "src/main.rs"
`;
    const mainRs = `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() { tauri::Builder::default().run(tauri::generate_context!()).expect("error while running app"); }
`;
    const buildRs = `fn main() { tauri_build::build() }
`;
    download(slug() + '-tauri.zip', Studio.makeZip([
      { name: 'dist/index.html', data: html },
      { name: 'src-tauri/tauri.conf.json', data: conf },
      { name: 'src-tauri/Cargo.toml', data: cargo },
      { name: 'src-tauri/build.rs', data: buildRs },
      { name: 'src-tauri/src/main.rs', data: mainRs },
      { name: 'README.txt', data: 'Grog desktop build (Tauri — tiny native binaries)\n=================================================\n1. Install Rust (rustup.rs) and: cargo install tauri-cli\n2. cd src-tauri\n3. cargo tauri dev      (run the game)\n4. cargo tauri build    (build a ~4MB native app for your OS)\n\nNote: add icons to src-tauri/icons (cargo tauri icon your.png) before release builds.\n' },
    ]));
    Studio.status('Exported Tauri zip — tiny native desktop builds.');
  };

  // ---------- export panel ----------
  Studio.editors.export = function (editor) {
    const pane = el('<div></div>');
    pane.appendChild(el('<h2>Export & publish</h2>'));
    const items = [
      { title: 'Single-file HTML', desc: 'One self-contained .html — engine + game data + art + music inside. Upload to itch.io (as HTML game), any static host, or send it to a friend. Works offline.', btn: 'Export .html', fn: Studio.exportSingle },
      { title: 'Web app (PWA)', desc: 'A zip with index.html, manifest, service worker and icons. Host on HTTPS → installable on phones/tablets, playable offline. This is your mobile port.', btn: 'Export PWA .zip', fn: Studio.exportPWA },
      { title: 'Desktop — Electron', desc: 'A zip with an Electron wrapper. npm install && npm start to run; npm run dist for Windows/macOS/Linux installers.', btn: 'Export Electron .zip', fn: Studio.exportElectron },
      { title: 'Desktop — Tauri', desc: 'A zip with a Tauri 2 wrapper. Produces tiny (~4 MB) native binaries for Windows/macOS/Linux with cargo tauri build.', btn: 'Export Tauri .zip', fn: Studio.exportTauri },
    ];
    for (const it of items) {
      const p = el(`<div class="panel"><h3 style="margin-top:0">${it.title}</h3><p class="hint">${it.desc}</p></div>`);
      const b = el(`<button class="primary">${it.btn}</button>`);
      b.addEventListener('click', () => it.fn().catch((e) => Studio.status('Export failed: ' + e.message)));
      p.appendChild(b);
      pane.appendChild(p);
    }
    const check = el('<div class="panel"><h3 style="margin-top:0">Before you ship</h3></div>');
    const cb = el('<button>Run project check</button>');
    cb.addEventListener('click', Studio.showProblems);
    check.appendChild(cb);
    pane.appendChild(check);
    editor.appendChild(pane);
  };
})();
