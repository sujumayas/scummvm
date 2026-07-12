/* Grog Studio — sprite editor: pixel grid, palette, frames, PNG import. */
(function () {
  'use strict';
  const Studio = window.Studio;
  const Grog = window.Grog;
  const el = Studio.el;

  const ed = { frame: null, color: '0', tool: 'pencil', drag: false, anim: null };

  Studio.editors.sprite = function (editor, insp, id) {
    const P = Studio.state.project;
    const spr = P.sprites[id];
    if (!spr) return;
    const frames = Object.keys(spr.frames);
    if (!ed.frame || !spr.frames[ed.frame]) ed.frame = frames[0];
    const rows = spr.frames[ed.frame] || [];
    const h = rows.length, w = spr.w;

    const pane = el('<div></div>');
    pane.appendChild(el(`<h2>Sprite: ${id} <span class="hint">${w}×${h}</span></h2>`));

    // toolbar
    const tb = el('<div class="toolbar"></div>');
    for (const [tool, label] of [['pencil', '✏ Pencil'], ['eraser', '◻ Eraser'], ['fill', '▨ Fill'], ['pick', '⊙ Pick']]) {
      const b = el(`<button>${label}</button>`);
      if (ed.tool === tool) b.classList.add('active');
      b.addEventListener('click', () => { ed.tool = tool; Studio.renderAll(); });
      tb.appendChild(b);
    }
    tb.appendChild(el('<div class="sep"></div>'));
    const wIn = Studio.num(spr.w, (v) => resize(v, rowsCount()));
    const hIn = Studio.num(h, (v) => resize(spr.w, v));
    tb.appendChild(el('<label>w</label>')); tb.appendChild(wIn);
    tb.appendChild(el('<label>h</label>')); tb.appendChild(hIn);
    tb.appendChild(el('<div class="sep"></div>'));
    const shiftBtns = el('<div class="row" style="margin:0"></div>');
    for (const [lbl, dx, dy] of [['←', -1, 0], ['→', 1, 0], ['↑', 0, -1], ['↓', 0, 1]]) {
      const b = el(`<button class="small" title="shift pixels">${lbl}</button>`);
      b.addEventListener('click', () => shift(dx, dy));
      shiftBtns.appendChild(b);
    }
    tb.appendChild(shiftBtns);
    const mirror = el('<button class="small" title="mirror horizontally">⇋ mirror</button>');
    mirror.addEventListener('click', () => {
      spr.frames[ed.frame] = spr.frames[ed.frame].map((r) => r.split('').reverse().join(''));
      Studio.touch(); Studio.renderAll();
    });
    tb.appendChild(mirror);
    const importBtn = el('<button class="small">Import PNG…</button>');
    const fileIn = el('<input type="file" accept="image/png,image/gif" hidden>');
    importBtn.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', (e) => importPNG(e, spr));
    tb.appendChild(importBtn); tb.appendChild(fileIn);
    pane.appendChild(tb);

    function rowsCount() { return spr.frames[ed.frame].length; }
    function resize(nw, nh) {
      nw = Math.max(1, Math.min(128, nw || 1)); nh = Math.max(1, Math.min(128, nh || 1));
      for (const f of Object.keys(spr.frames)) {
        let rr = spr.frames[f].map((r) => (r + '.'.repeat(Math.max(0, nw - r.length))).slice(0, nw));
        while (rr.length < nh) rr.push('.'.repeat(nw));
        rr = rr.slice(0, nh);
        spr.frames[f] = rr;
      }
      spr.w = nw;
      Studio.touch(); Studio.renderAll();
    }
    function shift(dx, dy) {
      const rr = spr.frames[ed.frame];
      let out = rr.map((r) => {
        if (dx === -1) return r.slice(1) + '.';
        if (dx === 1) return '.' + r.slice(0, -1);
        return r;
      });
      if (dy === -1) { out = out.slice(1); out.push('.'.repeat(spr.w)); }
      if (dy === 1) { out.pop(); out.unshift('.'.repeat(spr.w)); }
      spr.frames[ed.frame] = out;
      Studio.touch(); Studio.renderAll();
    }

    // pixel canvas
    const zoom = Math.max(4, Math.min(24, Math.floor(420 / Math.max(w, h))));
    const cv = el(`<canvas id="sprite-grid" width="${w * zoom}" height="${h * zoom}"></canvas>`);
    pane.appendChild(cv);
    const ctx = cv.getContext('2d');
    function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const rr = spr.frames[ed.frame];
      for (let y = 0; y < rr.length; y++) {
        for (let x = 0; x < rr[y].length; x++) {
          const ch = rr[y][x];
          if (ch === '.' || ch === ' ') continue;
          ctx.fillStyle = Grog.color(Grog.colorIndex(ch));
          ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        }
      }
      if (zoom >= 6) {
        ctx.strokeStyle = '#ffffff10';
        for (let x = 0; x <= w; x++) { ctx.beginPath(); ctx.moveTo(x * zoom + 0.5, 0); ctx.lineTo(x * zoom + 0.5, h * zoom); ctx.stroke(); }
        for (let y = 0; y <= h; y++) { ctx.beginPath(); ctx.moveTo(0, y * zoom + 0.5); ctx.lineTo(w * zoom, y * zoom + 0.5); ctx.stroke(); }
      }
    }
    draw();

    const setPx = (x, y, ch) => {
      const rr = spr.frames[ed.frame];
      if (y < 0 || y >= rr.length || x < 0 || x >= spr.w) return;
      rr[y] = rr[y].substring(0, x) + ch + rr[y].substring(x + 1);
    };
    const getPx = (x, y) => {
      const rr = spr.frames[ed.frame];
      return (rr[y] || '')[x] || '.';
    };
    const floodFill = (x, y, target, repl) => {
      if (target === repl) return;
      const stack = [[x, y]];
      const rr = spr.frames[ed.frame];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cy < 0 || cx >= spr.w || cy >= rr.length) continue;
        if (getPx(cx, cy) !== target) continue;
        setPx(cx, cy, repl);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    };
    const paintAt = (e) => {
      const r = cv.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / zoom), y = Math.floor((e.clientY - r.top) / zoom);
      if (ed.tool === 'pencil') setPx(x, y, ed.color);
      else if (ed.tool === 'eraser') setPx(x, y, '.');
      else if (ed.tool === 'fill') floodFill(x, y, getPx(x, y), ed.color);
      else if (ed.tool === 'pick') { const ch = getPx(x, y); if (ch !== '.') { ed.color = ch; Studio.renderAll(); return; } }
      draw();
    };
    cv.addEventListener('mousedown', (e) => { ed.drag = true; paintAt(e); });
    cv.addEventListener('mousemove', (e) => { if (ed.drag) paintAt(e); });
    window.addEventListener('mouseup', () => { if (ed.drag) { ed.drag = false; Studio.touch(); } });

    // frames strip
    pane.appendChild(el('<h3>Frames</h3>'));
    const strip = el('<div class="frame-strip"></div>');
    for (const f of frames) {
      const th = el(`<div class="frame-thumb${f === ed.frame ? ' sel' : ''}"></div>`);
      const img = Grog.rasterFrame(P, id, f);
      const c = el(`<canvas class="pixelated" width="${w}" height="${spr.frames[f].length}"></canvas>`);
      c.style.width = Math.min(64, w * 4) + 'px';
      if (img) c.getContext('2d').drawImage(img, 0, 0);
      th.appendChild(c);
      th.appendChild(el(`<div class="nm">${f}</div>`));
      th.addEventListener('click', () => { ed.frame = f; Grog.clearSpriteCache(); Studio.renderAll(); });
      th.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        Studio.modal(`Frame “${f}”`, el('<div></div>'), [
          { label: 'Rename', onClick: () => { setTimeout(() => Studio.prompt('New name', f, (v) => { spr.frames[v] = spr.frames[f]; delete spr.frames[f]; if (ed.frame === f) ed.frame = v; Grog.clearSpriteCache(); Studio.touch(); Studio.renderAll(); }, Studio.idValidate(spr.frames, f)), 50); return true; } },
          { label: 'Duplicate', onClick: () => { let n = f + '2'; while (spr.frames[n]) n += '2'; spr.frames[n] = spr.frames[f].slice(); Studio.touch(); Studio.renderAll(); return true; } },
          { label: 'Delete', onClick: () => { if (Object.keys(spr.frames).length > 1) { delete spr.frames[f]; ed.frame = null; Grog.clearSpriteCache(); Studio.touch(); Studio.renderAll(); } return true; } },
          { label: 'Cancel' },
        ]);
      });
      strip.appendChild(th);
    }
    const addF = el('<button class="frame-thumb">+ frame</button>');
    addF.addEventListener('click', () => Studio.prompt('New frame name', '', (v) => {
      spr.frames[v] = Array(spr.frames[ed.frame].length).fill('.'.repeat(spr.w));
      ed.frame = v; Studio.touch(); Studio.renderAll();
    }, Studio.idValidate(spr.frames)));
    strip.appendChild(addF);
    pane.appendChild(strip);
    pane.appendChild(el('<div class="hint">Right-click a frame for rename / duplicate / delete. Colors are the DawnBringer-32 palette; “.” is transparent.</div>'));
    editor.appendChild(pane);

    // inspector: palette + preview
    insp.appendChild(el('<h2>Palette</h2>'));
    const pal = el('<div class="pal" style="grid-template-columns: repeat(8, 26px)"></div>');
    const trans = el('<div class="sw trans" style="width:26px;height:26px" title="transparent (.)"></div>');
    if (ed.color === '.') trans.classList.add('sel');
    trans.addEventListener('click', () => { ed.color = '.'; ed.tool = 'pencil'; Studio.renderAll(); });
    pal.appendChild(trans);
    for (let i = 0; i < 32; i++) {
      const ch = Grog.COLOR_CHARS[i];
      const sw = el(`<div class="sw" style="width:26px;height:26px;background:${Grog.PALETTE[i]}" title="${ch}"></div>`);
      if (ed.color === ch) sw.classList.add('sel');
      sw.addEventListener('click', () => { ed.color = ch; if (ed.tool === 'eraser' || ed.tool === 'pick') ed.tool = 'pencil'; Studio.renderAll(); });
      pal.appendChild(sw);
    }
    insp.appendChild(pal);
    insp.appendChild(el('<h3>Animation preview</h3>'));
    const pcv = el(`<canvas class="pixelated" width="${w}" height="${h}" style="width:${w * 4}px;height:${h * 4}px;background:#111;border:1px solid var(--line)"></canvas>`);
    insp.appendChild(pcv);
    const fpsIn = Studio.num(8, () => { });
    insp.appendChild(Studio.field('fps', fpsIn));
    let pi = 0;
    clearInterval(ed.anim);
    ed.anim = setInterval(() => {
      const fs = Object.keys(spr.frames);
      pi = (pi + 1) % fs.length;
      const c2 = pcv.getContext('2d');
      c2.clearRect(0, 0, w, h);
      Grog.clearSpriteCache();
      const img = Grog.rasterFrame(P, id, fs[pi]);
      if (img) c2.drawImage(img, 0, 0);
    }, 1000 / 8);
    insp.appendChild(el('<div class="hint">Cycles through all frames in order.</div>'));
  };

  function importPNG(e, spr) {
    const f = e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const w = Math.min(128, img.width), h = Math.min(128, img.height);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const data = x.getImageData(0, 0, w, h).data;
      const rows = [];
      for (let yy = 0; yy < h; yy++) {
        let row = '';
        for (let xx = 0; xx < w; xx++) {
          const i = (yy * w + xx) * 4;
          if (data[i + 3] < 128) { row += '.'; continue; }
          // nearest palette color
          let best = 0, bd = Infinity;
          for (let p = 0; p < 32; p++) {
            const hex = Grog.PALETTE[p];
            const pr = parseInt(hex.slice(1, 3), 16), pg = parseInt(hex.slice(3, 5), 16), pb = parseInt(hex.slice(5, 7), 16);
            const d = (pr - data[i]) ** 2 + (pg - data[i + 1]) ** 2 + (pb - data[i + 2]) ** 2;
            if (d < bd) { bd = d; best = p; }
          }
          row += Grog.COLOR_CHARS[best];
        }
        rows.push(row);
      }
      spr.w = w;
      spr.frames['imported'] = rows;
      Grog.clearSpriteCache();
      Studio.touch(); Studio.renderAll();
      Studio.status(`Imported ${w}×${h} PNG as frame "imported" (quantized to palette).`);
    };
    img.src = URL.createObjectURL(f);
    e.target.value = '';
  }
})();
