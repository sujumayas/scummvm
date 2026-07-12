/* Grog Studio — asset library: import PNGs as data URIs, preview, resize,
   set-as-background, slice into sprite sheets. */
(function () {
  'use strict';
  const Studio = window.Studio;
  const Grog = window.Grog;
  const { el, field, num, select } = { el: Studio.el, field: Studio.field, num: Studio.num, select: Studio.select };

  const ed = { fw: 32, fh: 48 };

  // ---------- import ----------
  Studio.importAssets = function () {
    const input = el('<input type="file" accept="image/png,image/gif,image/jpeg,image/webp" multiple hidden>');
    document.body.appendChild(input);
    input.addEventListener('change', async (e) => {
      const P = Studio.state.project;
      P.assets = P.assets || {};
      let lastId = null;
      for (const f of e.target.files) {
        const src = await new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(f);
        });
        const img = await loadImg(src);
        let id = f.name.replace(/\.[^.]+$/, '').replace(/\W+/g, '_').replace(/^(\d)/, 'a$1').toLowerCase() || 'asset';
        while (P.assets[id]) id += '2';
        P.assets[id] = { src, w: img.width, h: img.height };
        lastId = id;
      }
      input.remove();
      if (lastId) {
        await Grog.loadAssets(Studio.state.project);
        Studio.touch();
        Studio.selectEntity('asset', lastId);
        Studio.status('Imported. Tip: room backgrounds want to be ~320×144; use Resize if your art is bigger.');
      }
    });
    input.click();
  };

  function loadImg(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  function kb(src) { return Math.round((src.length * 3) / 4 / 1024); }

  // nearest-neighbor resize -> new data URI
  function resizeAsset(asset, nw, nh) {
    const img = Grog.asset ? null : null;
    return loadImg(asset.src).then((im) => {
      const c = document.createElement('canvas');
      c.width = nw; c.height = nh;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(im, 0, 0, nw, nh);
      return { src: c.toDataURL('image/png'), w: nw, h: nh };
    });
  }

  // ---------- editor panel ----------
  Studio.editors.asset = function (editor, insp, id) {
    const P = Studio.state.project;
    const asset = (P.assets || {})[id];
    if (!asset) return;

    const pane = el('<div></div>');
    pane.appendChild(el(`<h2>Asset: ${id} <span class="hint">${asset.w}×${asset.h} · ~${kb(asset.src)} KB</span></h2>`));

    // preview with grid overlay for slicing
    const zoom = Math.max(1, Math.min(4, Math.floor(640 / asset.w)));
    const wrap = el('<div style="overflow:auto;max-width:100%;border:1px solid var(--line);border-radius:4px;background:repeating-conic-gradient(#2a2734 0 25%, #211e2b 0 50%) 0 0/16px 16px;display:inline-block"></div>');
    const cv = el(`<canvas class="pixelated" width="${asset.w}" height="${asset.h}" style="display:block;width:${asset.w * zoom}px;height:${asset.h * zoom}px"></canvas>`);
    wrap.appendChild(cv);
    pane.appendChild(wrap);

    const drawPreview = async () => {
      await Grog.loadAssets(P);
      const img = Grog.asset(id);
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, asset.w, asset.h);
      if (img) ctx.drawImage(img, 0, 0);
      // slicer grid
      if (ed.showGrid) {
        ctx.strokeStyle = '#fbf23688';
        for (let x = 0; x <= asset.w; x += ed.fw) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, asset.h); ctx.stroke(); }
        for (let y = 0; y <= asset.h; y += ed.fh) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(asset.w, y + 0.5); ctx.stroke(); }
        ctx.fillStyle = '#fbf236';
        ctx.font = '9px monospace';
        const cols = Math.floor(asset.w / ed.fw);
        const rows = Math.floor(asset.h / ed.fh);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) ctx.fillText(String(r * cols + c), c * ed.fw + 2, r * ed.fh + 10);
      }
    };
    drawPreview();

    // ---- use as background ----
    const bgPanel = el('<div class="panel"><h3 style="margin-top:0">Use as room background</h3><p class="hint">Inserts an <b>image</b> paint op at the bottom of the room’s paint stack (replaces a previous full-bleed image op if it’s first). Backgrounds should be 320×144 — or wider for scrolling rooms (height 144).</p></div>');
    const bgRow = el('<div class="row"></div>');
    const roomSel = select(Object.keys(P.rooms), Object.keys(P.rooms)[0], () => { });
    bgRow.appendChild(roomSel);
    const bgBtn = el('<button class="primary">Set as background</button>');
    bgBtn.addEventListener('click', () => {
      const room = P.rooms[roomSel.value];
      room.paint = room.paint || [];
      if (room.paint[0] && room.paint[0].op === 'image') room.paint[0] = { op: 'image', id, x: 0, y: 0 };
      else room.paint.unshift({ op: 'image', id, x: 0, y: 0 });
      if (asset.w > 320) room.w = asset.w;
      Studio.touch();
      Studio.status(`“${id}” set as background of ${roomSel.value}${asset.w > 320 ? ' (room widened to ' + asset.w + 'px — scrolling)' : ''}.`);
    });
    bgRow.appendChild(bgBtn);
    bgPanel.appendChild(bgRow);
    pane.appendChild(bgPanel);

    // ---- slicer ----
    const slicePanel = el('<div class="panel"><h3 style="margin-top:0">Slice into a sprite sheet</h3><p class="hint">Set the frame cell size to overlay a numbered grid, then create a <b>sheet sprite</b> whose frames are cells of this image. Use it for characters (walk cycles), items, anything animated. Frames are referenced by name in actor animations, exactly like drawn sprites.</p></div>');
    const sRow = el('<div class="row"></div>');
    sRow.appendChild(el('<label>frame w</label>'));
    const fwIn = num(ed.fw, (v) => { ed.fw = Math.max(1, v || 1); ed.showGrid = true; drawPreview(); });
    sRow.appendChild(fwIn);
    sRow.appendChild(el('<label>frame h</label>'));
    const fhIn = num(ed.fh, (v) => { ed.fh = Math.max(1, v || 1); ed.showGrid = true; drawPreview(); });
    sRow.appendChild(fhIn);
    const gridBtn = el('<button class="small">Toggle grid</button>');
    gridBtn.addEventListener('click', () => { ed.showGrid = !ed.showGrid; drawPreview(); });
    sRow.appendChild(gridBtn);
    slicePanel.appendChild(sRow);
    const makeBtn = el('<button class="primary">Create sheet sprite…</button>');
    makeBtn.addEventListener('click', () => {
      Studio.prompt('New sprite id', id + '_sheet', (v) => {
        const cols = Math.max(1, Math.floor(asset.w / ed.fw));
        const rows = Math.max(1, Math.floor(asset.h / ed.fh));
        const frames = {};
        for (let i = 0; i < cols * rows; i++) frames['f' + i] = i;
        P.sprites[v] = { sheet: { asset: id, fw: ed.fw, fh: ed.fh }, frames };
        Grog.clearSpriteCache();
        Studio.touch();
        Studio.selectEntity('sprite', v);
      }, Studio.idValidate(P.sprites));
    });
    slicePanel.appendChild(makeBtn);
    pane.appendChild(slicePanel);

    // ---- resize ----
    const rzPanel = el('<div class="panel"><h3 style="margin-top:0">Resize (nearest-neighbor)</h3></div>');
    const rzRow = el('<div class="row"></div>');
    const nwIn = num(asset.w, () => { });
    const nhIn = num(asset.h, () => { });
    rzRow.appendChild(el('<label>w</label>')); rzRow.appendChild(nwIn);
    rzRow.appendChild(el('<label>h</label>')); rzRow.appendChild(nhIn);
    const fitBtn = el('<button class="small">fit 320×144</button>');
    fitBtn.addEventListener('click', () => {
      const s = Math.min(320 / asset.w, 144 / asset.h);
      nwIn.value = Math.round(asset.w * s);
      nhIn.value = Math.round(asset.h * s);
    });
    rzRow.appendChild(fitBtn);
    const rzBtn = el('<button>Resize</button>');
    rzBtn.addEventListener('click', async () => {
      const nw = parseInt(nwIn.value, 10), nh = parseInt(nhIn.value, 10);
      if (!nw || !nh) return;
      const next = await resizeAsset(asset, nw, nh);
      P.assets[id] = next;
      delete Grog._assetCache[id];
      Grog.clearSpriteCache();
      Studio.touch(); Studio.renderAll();
    });
    rzRow.appendChild(rzBtn);
    rzPanel.appendChild(rzRow);
    pane.appendChild(rzPanel);
    editor.appendChild(pane);

    // inspector
    insp.appendChild(el('<h2>Asset pipeline</h2>'));
    insp.appendChild(el(`<div class="hint">Assets are stored inside the project JSON as data URIs, so single-file export keeps working — no loose files, no broken paths, ever.<br><br>
      <b>Backgrounds:</b> “Set as background”, then draw walk areas and hotspots over the image as usual. Add more <b>image</b> ops (with a <b>z</b>) for walk-behind foreground cutouts.<br><br>
      <b>Interactive elements:</b> a hotspot state’s paint can be an <b>image</b> op — e.g. a door_open.png overlay.<br><br>
      <b>Characters:</b> slice a sheet → sheet sprite → point an actor at it and name the frames in its animations.<br><br>
      Total project size: ~${Math.round(JSON.stringify(P).length / 1024)} KB.</div>`));
  };
})();
