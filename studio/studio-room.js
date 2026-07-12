/* Grog Studio — room editor: canvas with paint preview, hotspots, walk polygons, scale band. */
(function () {
  'use strict';
  const Studio = window.Studio;
  const Grog = window.Grog;
  const { el, field, text, num, select, check } = { el: Studio.el, field: Studio.field, text: Studio.text, num: Studio.num, select: Studio.select, check: Studio.check };

  const ed = { zoom: 3, tool: 'select', selH: -1, selOp: -1, selPoly: 0, drag: null, showWalk: true, showHot: true, showScale: false };

  const OP_DEFS = {
    fill: { c: 'color' },
    rect: { x: 'n', y: 'n', w: 'n', h: 'n', c: 'color' },
    poly: { pts: 'pts', c: 'color' },
    ellipse: { x: 'n', y: 'n', rx: 'n', ry: 'n', c: 'color' },
    line: { x1: 'n', y1: 'n', x2: 'n', y2: 'n', c: 'color', w: 'n?' },
    grad: { x: 'n', y: 'n', w: 'n', h: 'n', from: 'color', to: 'color' },
    scatter: { x: 'n', y: 'n', w: 'n', h: 'n', c: 'color', n: 'n', seed: 'n', size: 'n?' },
    sprite: { id: 'sprite', x: 'n', y: 'n', frame: 't?', scale: 'n?', flip: 'b?' },
    image: { id: 'asset', x: 'n', y: 'n', w: 'n?', h: 'n?', flip: 'b?' },
  };

  Studio.editors.room = function (editor, insp, id) {
    const P = Studio.state.project;
    const room = P.rooms[id];
    if (!room) return;
    ed.selH = Math.min(ed.selH, (room.hotspots || []).length - 1);

    // ---------- editor pane ----------
    const pane = el('<div></div>');
    const tb = el('<div class="toolbar"></div>');
    for (const [tool, label, title] of [['select', '⬚ Select', 'Move hotspots, walk-to points, resize'], ['hotspot', '+ Hotspot', 'Drag to draw a new hotspot rectangle'], ['walk', '▦ Walk', 'Click to add polygon points; drag points; right-click a point to delete'], ['start', '⚑ Start', 'Click to set the game start / room entry position']]) {
      const b = el(`<button title="${title}">${label}</button>`);
      if (ed.tool === tool) b.classList.add('active');
      b.addEventListener('click', () => { ed.tool = tool; Studio.renderAll(); });
      tb.appendChild(b);
    }
    tb.appendChild(el('<div class="sep"></div>'));
    for (const z of [2, 3, 4]) {
      const b = el(`<button class="small">${z}×</button>`);
      if (ed.zoom === z) b.classList.add('active');
      b.addEventListener('click', () => { ed.zoom = z; Studio.renderAll(); });
      tb.appendChild(b);
    }
    tb.appendChild(el('<div class="sep"></div>'));
    const mkToggle = (label, key) => {
      const b = el(`<button class="small">${label}</button>`);
      if (ed[key]) b.classList.add('active');
      b.addEventListener('click', () => { ed[key] = !ed[key]; Studio.renderAll(); });
      return b;
    };
    tb.appendChild(mkToggle('walk overlay', 'showWalk'));
    tb.appendChild(mkToggle('hotspots', 'showHot'));
    tb.appendChild(mkToggle('scale band', 'showScale'));
    tb.appendChild(el('<div class="sep"></div>'));
    const playHere = el('<button class="small" title="Playtest starting in this room">▶ from this room</button>');
    playHere.addEventListener('click', () => Studio.playtest(id));
    tb.appendChild(playHere);
    pane.appendChild(tb);

    const w = room.w || Grog.W;
    const wrap = el('<div id="room-canvas-wrap"></div>');
    const cv = el(`<canvas id="room-canvas" class="pixelated" width="${w}" height="${Grog.VIEW_H}"></canvas>`);
    cv.style.width = w * ed.zoom + 'px';
    cv.style.height = Grog.VIEW_H * ed.zoom + 'px';
    wrap.appendChild(cv);
    pane.appendChild(wrap);
    const posHint = el('<div class="hint">x: 0 y: 0</div>');
    pane.appendChild(posHint);

    // hotspot list
    pane.appendChild(el('<h3>Hotspots</h3>'));
    const hl = el('<div class="list"></div>');
    (room.hotspots || []).forEach((h, i) => {
      const row = el(`<div class="list-row${i === ed.selH ? ' sel' : ''}"><span class="grow">${h.id}</span><span class="dim">${h.name || ''}${h.states ? ' · ' + Object.keys(h.states).length + ' states' : ''}</span></div>`);
      const del = el('<button class="small danger">✕</button>');
      del.addEventListener('click', (e) => { e.stopPropagation(); room.hotspots.splice(i, 1); ed.selH = -1; Studio.touch(); Studio.renderAll(); });
      row.appendChild(del);
      row.addEventListener('click', () => { ed.selH = i; ed.selOp = -1; Studio.renderAll(); });
      hl.appendChild(row);
    });
    pane.appendChild(hl);

    // paint ops list
    pane.appendChild(el('<h3>Background paint ops <span class="hint">(drawn top to bottom; give an op a “z” to make it a walk-behind)</span></h3>'));
    const pl = el('<div class="list"></div>');
    (room.paint || []).forEach((op, i) => {
      const desc = Object.entries(op).filter(([k]) => k !== 'op').map(([k, v]) => `${k}:${Array.isArray(v) ? '[…]' : v}`).join(' ');
      const row = el(`<div class="list-row${i === ed.selOp ? ' sel' : ''}"><span class="grow"><b>${op.op}</b> <span class="dim">${desc}</span></span></div>`);
      const up = el('<button class="small">↑</button>');
      up.addEventListener('click', (e) => { e.stopPropagation(); if (i > 0) { [room.paint[i - 1], room.paint[i]] = [room.paint[i], room.paint[i - 1]]; ed.selOp = i - 1; Studio.touch(); Studio.renderAll(); } });
      const dn = el('<button class="small">↓</button>');
      dn.addEventListener('click', (e) => { e.stopPropagation(); if (i < room.paint.length - 1) { [room.paint[i + 1], room.paint[i]] = [room.paint[i], room.paint[i + 1]]; ed.selOp = i + 1; Studio.touch(); Studio.renderAll(); } });
      const del = el('<button class="small danger">✕</button>');
      del.addEventListener('click', (e) => { e.stopPropagation(); room.paint.splice(i, 1); ed.selOp = -1; Studio.touch(); Studio.renderAll(); });
      row.appendChild(up); row.appendChild(dn); row.appendChild(del);
      row.addEventListener('click', () => { ed.selOp = i; ed.selH = -1; Studio.renderAll(); });
      pl.appendChild(row);
    });
    pane.appendChild(pl);
    const addOp = el('<div class="row"></div>');
    const opSel = select(Object.keys(OP_DEFS), 'rect', () => { });
    addOp.appendChild(opSel);
    const addOpBtn = el('<button>+ Add paint op</button>');
    addOpBtn.addEventListener('click', () => {
      const defaults = { fill: { op: 'fill', c: '1' }, rect: { op: 'rect', x: 40, y: 40, w: 60, h: 40, c: '4' }, poly: { op: 'poly', pts: [60, 60, 120, 60, 90, 100], c: '4' }, ellipse: { op: 'ellipse', x: 80, y: 60, rx: 20, ry: 12, c: '4' }, line: { op: 'line', x1: 20, y1: 20, x2: 90, y2: 40, c: 'l' }, grad: { op: 'grad', x: 0, y: 0, w: 320, h: 60, from: '1', to: 'f' }, scatter: { op: 'scatter', x: 0, y: 0, w: 320, h: 40, c: 'l', n: 30, seed: 7 }, sprite: { op: 'sprite', id: Object.keys(P.sprites)[0] || '', x: 60, y: 60 }, image: { op: 'image', id: Object.keys(P.assets || {})[0] || '', x: 0, y: 0 } };
      room.paint = room.paint || [];
      room.paint.push(defaults[opSel.value]);
      ed.selOp = room.paint.length - 1; ed.selH = -1;
      Studio.touch(); Studio.renderAll();
    });
    addOp.appendChild(addOpBtn);
    const rawBtn = el('<button>Edit paint as JSON</button>');
    rawBtn.addEventListener('click', () => Studio.jsonModal('Paint ops', room.paint || [], (v) => { room.paint = v; Studio.renderAll(); }));
    addOp.appendChild(rawBtn);
    pane.appendChild(addOp);
    editor.appendChild(pane);

    // ---------- inspector ----------
    insp.appendChild(el(`<h2>Room: ${id}</h2>`));
    const props = el('<div class="panel"></div>');
    props.appendChild(field('Name', text(room.name, (v) => { room.name = v; Studio.touch(); })));
    props.appendChild(field('Width px', num(room.w || 320, (v) => { if (v && v > 320) room.w = v; else delete room.w; Studio.touch(); Studio.renderAll(); })));
    props.appendChild(field('Music', select([''].concat(Object.keys(P.music || {})), room.music || '', (v) => { if (v) room.music = v; else delete room.music; Studio.touch(); })));
    const sc = room.scale || {};
    const scaleRow = el('<div class="row"><label>Scale band</label></div>');
    const mkS = (key, ph) => { const i = num(sc[key], (v) => { room.scale = room.scale || { y1: 60, s1: 0.5, y2: 140, s2: 1 }; room.scale[key] = v; Studio.touch(); Studio.renderAll(); }); i.placeholder = ph; i.step = '0.05'; return i; };
    scaleRow.appendChild(mkS('y1', 'y1')); scaleRow.appendChild(mkS('s1', 's1'));
    scaleRow.appendChild(mkS('y2', 'y2')); scaleRow.appendChild(mkS('s2', 's2'));
    props.appendChild(scaleRow);
    const enterBtn = el('<button>Edit enter script…</button>');
    enterBtn.addEventListener('click', () => Studio.actionModal(`Enter script — ${id}`, room.enter || [], (v) => { room.enter = v; }));
    props.appendChild(enterBtn);
    const actorsBtn = el('<button style="margin-left:6px">Actors in room…</button>');
    actorsBtn.addEventListener('click', () => Studio.jsonModal(`Actors placed in ${id} — {"actorId": {"x":…, "y":…, "dir":"D", "hidden":false}}`, room.actors || {}, (v) => { room.actors = v; Studio.renderAll(); }));
    props.appendChild(actorsBtn);
    insp.appendChild(props);

    if (ed.selH >= 0 && room.hotspots[ed.selH]) Studio.hotspotInspector(insp, room, room.hotspots[ed.selH]);
    else if (ed.selOp >= 0 && room.paint[ed.selOp]) opInspector(insp, room, room.paint[ed.selOp]);
    else if (ed.tool === 'walk') {
      const wp = el('<div class="panel"></div>');
      wp.appendChild(el('<h3>Walk polygons</h3>'));
      (room.walk || []).forEach((poly, i) => {
        const row = el(`<div class="row"><button class="small ${i === ed.selPoly ? 'active' : ''}">poly ${i + 1} (${poly.length / 2} pts)</button></div>`);
        row.querySelector('button').addEventListener('click', () => { ed.selPoly = i; Studio.renderAll(); });
        const del = el('<button class="small danger">✕</button>');
        del.addEventListener('click', () => { room.walk.splice(i, 1); ed.selPoly = 0; Studio.touch(); Studio.renderAll(); });
        row.appendChild(del);
        wp.appendChild(row);
      });
      const add = el('<button>+ New polygon</button>');
      add.addEventListener('click', () => { room.walk = room.walk || []; room.walk.push([]); ed.selPoly = room.walk.length - 1; Studio.touch(); Studio.renderAll(); });
      wp.appendChild(add);
      wp.appendChild(el('<div class="hint">Click on the canvas to append points to the selected polygon. Drag points to move them. Right-click a point to delete it.</div>'));
      insp.appendChild(wp);
    } else {
      insp.appendChild(el('<div class="hint">Select a hotspot or a paint op to edit it here.<br><br><span class="kbd">Select</span> drag hotspots / their ⊕ walk-to markers.<br><span class="kbd">Hotspot</span> drag on canvas to add one.<br><span class="kbd">Walk</span> edit walkable polygons.<br><span class="kbd">Start</span> click to set entry point.</div>'));
    }

    // ---------- canvas rendering & interaction ----------
    const ctx = cv.getContext('2d');
    if (Object.keys(P.assets || {}).length) Grog.loadAssets(P).then(() => draw());
    function draw() {
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, Grog.VIEW_H);
      Grog.paint(ctx, room.paint, P);
      for (const h of room.hotspots || []) {
        if (h.hidden) continue;
        let ops = h.paint;
        if (h.states) { const sd = h.states[h.state]; ops = sd && sd.paint; }
        if (ops) Grog.paint(ctx, ops, P);
      }
      // z ops after (approx: all on top for preview)
      Grog.paint(ctx, (room.paint || []).filter((o) => o.z !== undefined), P, { includeZ: true, onlyZ: true });
      // actor markers
      for (const [aid, place] of Object.entries(room.actors || {})) {
        const a = P.actors[aid];
        if (a) {
          const spr = P.sprites[a.sprite];
          const frame = spr && Object.keys(spr.frames)[0];
          if (frame) {
            const img = Grog.rasterFrame(P, a.sprite, frame);
            if (img) { ctx.globalAlpha = place.hidden ? 0.35 : 1; ctx.drawImage(img, Math.round(place.x - img.width / 2), Math.round(place.y - img.height)); ctx.globalAlpha = 1; }
          }
        }
      }
      // start marker
      const st = P.meta.start || {};
      if (st.room === id && ed.tool === 'start' || (st.room === id && ed.showHot)) {
        ctx.strokeStyle = '#99e550'; ctx.beginPath(); ctx.moveTo(st.x - 4, st.y); ctx.lineTo(st.x + 4, st.y); ctx.moveTo(st.x, st.y - 4); ctx.lineTo(st.x, st.y + 4); ctx.stroke();
      }
      if (ed.showWalk) {
        ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#2f2';
        for (const poly of room.walk || []) {
          if (poly.length < 6) continue;
          ctx.beginPath(); ctx.moveTo(poly[0], poly[1]);
          for (let i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i], poly[i + 1]);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        if (ed.tool === 'walk') {
          (room.walk || []).forEach((poly, pi) => {
            ctx.fillStyle = pi === ed.selPoly ? '#fff' : '#7f7';
            for (let i = 0; i < poly.length; i += 2) ctx.fillRect(poly[i] - 1, poly[i + 1] - 1, 3, 3);
          });
        }
      }
      if (ed.showHot) {
        (room.hotspots || []).forEach((h, i) => {
          ctx.strokeStyle = i === ed.selH ? '#fbf236' : '#639bff88';
          ctx.lineWidth = 1;
          if (h.rect) ctx.strokeRect(h.rect[0] + 0.5, h.rect[1] + 0.5, h.rect[2], h.rect[3]);
          else if (h.poly) {
            ctx.beginPath(); ctx.moveTo(h.poly[0], h.poly[1]);
            for (let k = 2; k < h.poly.length; k += 2) ctx.lineTo(h.poly[k], h.poly[k + 1]);
            ctx.closePath(); ctx.stroke();
          }
          if (i === ed.selH && h.rect) { ctx.fillStyle = '#fbf236'; ctx.fillRect(h.rect[0] + h.rect[2] - 2, h.rect[1] + h.rect[3] - 2, 3, 3); }
          const at = h.at || (h.rect ? [h.rect[0] + h.rect[2] / 2, h.rect[1] + h.rect[3] + 2] : null);
          if (at && i === ed.selH) {
            ctx.strokeStyle = '#5fcde4'; ctx.beginPath();
            ctx.moveTo(at[0] - 3, at[1]); ctx.lineTo(at[0] + 3, at[1]); ctx.moveTo(at[0], at[1] - 3); ctx.lineTo(at[0], at[1] + 3); ctx.stroke();
          }
        });
      }
      if (ed.showScale && room.scale) {
        ctx.strokeStyle = '#d77bba'; ctx.setLineDash([3, 3]);
        for (const [yy, ss] of [[room.scale.y1, room.scale.s1], [room.scale.y2, room.scale.s2]]) {
          ctx.beginPath(); ctx.moveTo(0, yy + 0.5); ctx.lineTo(w, yy + 0.5); ctx.stroke();
          ctx.fillStyle = '#d77bba'; ctx.font = '8px monospace'; ctx.fillText('scale ' + ss, 4, yy - 2);
        }
        ctx.setLineDash([]);
      }
    }
    draw();

    const toRoom = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: Math.round((e.clientX - r.left) / ed.zoom), y: Math.round((e.clientY - r.top) / ed.zoom) };
    };
    const hitHotspot = (p) => {
      const hs = room.hotspots || [];
      for (let i = hs.length - 1; i >= 0; i--) {
        const h = hs[i];
        if (h.rect && p.x >= h.rect[0] && p.x <= h.rect[0] + h.rect[2] && p.y >= h.rect[1] && p.y <= h.rect[1] + h.rect[3]) return i;
        if (h.poly && Grog.pointInPoly(p.x, p.y, h.poly)) return i;
      }
      return -1;
    };
    cv.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const p = toRoom(e);
      if (ed.tool === 'select') {
        const h = ed.selH >= 0 ? room.hotspots[ed.selH] : null;
        if (h) {
          const at = h.at || (h.rect ? [h.rect[0] + h.rect[2] / 2, h.rect[1] + h.rect[3] + 2] : [0, 0]);
          if (Math.abs(p.x - at[0]) <= 3 && Math.abs(p.y - at[1]) <= 3) { ed.drag = { kind: 'at', h }; return; }
          if (h.rect && Math.abs(p.x - (h.rect[0] + h.rect[2])) <= 3 && Math.abs(p.y - (h.rect[1] + h.rect[3])) <= 3) { ed.drag = { kind: 'resize', h }; return; }
        }
        const hi = hitHotspot(p);
        if (hi >= 0) {
          ed.selH = hi; ed.selOp = -1;
          const hh = room.hotspots[hi];
          if (hh.rect) ed.drag = { kind: 'move', h: hh, dx: p.x - hh.rect[0], dy: p.y - hh.rect[1] };
          Studio.renderAll();
          return;
        }
        ed.selH = -1; Studio.renderAll();
      } else if (ed.tool === 'hotspot') {
        ed.drag = { kind: 'new', x0: p.x, y0: p.y, rect: [p.x, p.y, 1, 1] };
      } else if (ed.tool === 'walk') {
        room.walk = room.walk || [];
        if (!room.walk.length) room.walk.push([]);
        const poly = room.walk[Math.min(ed.selPoly, room.walk.length - 1)];
        // near existing vertex?
        for (let pi = 0; pi < (room.walk || []).length; pi++) {
          const pp = room.walk[pi];
          for (let i = 0; i < pp.length; i += 2) {
            if (Math.abs(pp[i] - p.x) <= 3 && Math.abs(pp[i + 1] - p.y) <= 3) {
              if (e.button === 2) { pp.splice(i, 2); Studio.touch(); draw(); return; }
              ed.drag = { kind: 'vertex', poly: pp, i };
              ed.selPoly = pi;
              return;
            }
          }
        }
        if (e.button === 2) return;
        poly.push(p.x, p.y);
        Studio.touch(); draw();
      } else if (ed.tool === 'start') {
        P.meta.start = { room: id, x: p.x, y: p.y };
        Studio.touch(); draw();
        Studio.status(`Start position set to ${id} (${p.x}, ${p.y})`);
      }
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('mousemove', (e) => {
      const p = toRoom(e);
      posHint.textContent = `x: ${p.x}  y: ${p.y}` + (ed.tool === 'walk' ? '  (right-click a vertex to delete)' : '');
      if (!ed.drag) return;
      const d = ed.drag;
      if (d.kind === 'move') { d.h.rect[0] = p.x - d.dx; d.h.rect[1] = p.y - d.dy; }
      else if (d.kind === 'resize') { d.h.rect[2] = Math.max(2, p.x - d.h.rect[0]); d.h.rect[3] = Math.max(2, p.y - d.h.rect[1]); }
      else if (d.kind === 'at') { d.h.at = [p.x, p.y]; }
      else if (d.kind === 'new') { d.rect = [Math.min(d.x0, p.x), Math.min(d.y0, p.y), Math.abs(p.x - d.x0) || 1, Math.abs(p.y - d.y0) || 1]; draw(); const c = cv.getContext('2d'); c.strokeStyle = '#fbf236'; c.strokeRect(d.rect[0] + 0.5, d.rect[1] + 0.5, d.rect[2], d.rect[3]); return; }
      else if (d.kind === 'vertex') { d.poly[d.i] = p.x; d.poly[d.i + 1] = p.y; }
      draw();
    });
    window.addEventListener('mouseup', function onUp() {
      window.removeEventListener('mouseup', onUp);
      const d = ed.drag;
      ed.drag = null;
      if (!d) return;
      if (d.kind === 'new' && d.rect[2] > 2 && d.rect[3] > 2) {
        Studio.prompt('New hotspot id', '', (v) => {
          room.hotspots = room.hotspots || [];
          room.hotspots.push({ id: v, name: v.replace(/_/g, ' '), rect: d.rect.map(Math.round), verbs: { look: [{ do: 'say', text: 'It looks like a ' + v.replace(/_/g, ' ') + '.' }] } });
          ed.selH = room.hotspots.length - 1;
          Studio.touch(); Studio.renderAll();
        }, (v) => !/^[a-z][a-z0-9_]*$/i.test(v) ? 'Bad id' : (room.hotspots || []).some((h) => h.id === v) ? 'Exists' : null);
      } else if (d.kind !== 'new') Studio.touch();
      draw();
    });
  };

  // ---------- paint-op inspector ----------
  function opInspector(insp, room, op) {
    const panel = el('<div class="panel"></div>');
    panel.appendChild(el(`<h3>Paint op: ${op.op}</h3>`));
    const defs = OP_DEFS[op.op] || {};
    for (const [key, kind] of Object.entries(defs)) {
      if (kind === 'color') panel.appendChild(field(key, Studio.colorPicker(op[key], (v) => { op[key] = v; Studio.touch(); Studio.renderAll(); })));
      else if (kind === 'pts') {
        const btn = el(`<button>Edit ${op.pts ? op.pts.length / 2 : 0} points…</button>`);
        btn.addEventListener('click', () => Studio.jsonModal('Polygon points [x,y,x,y,…]', op.pts || [], (v) => { op.pts = v; Studio.renderAll(); }));
        panel.appendChild(field(key, btn));
      } else if (kind === 'sprite') panel.appendChild(field(key, Studio.select(Object.keys(Studio.state.project.sprites), op[key], (v) => { op[key] = v; Studio.touch(); Studio.renderAll(); })));
      else if (kind === 'asset') panel.appendChild(field(key, Studio.select(Object.keys(Studio.state.project.assets || {}), op[key], (v) => { op[key] = v; Studio.touch(); Studio.renderAll(); })));
      else if (kind === 'b?') panel.appendChild(field(key, check(op[key], (v) => { if (v) op[key] = true; else delete op[key]; Studio.touch(); Studio.renderAll(); })));
      else if (kind === 't?') panel.appendChild(field(key, text(op[key], (v) => { if (v) op[key] = v; else delete op[key]; Studio.touch(); Studio.renderAll(); })));
      else panel.appendChild(field(key, num(op[key], (v) => { if (v === undefined && kind.endsWith('?')) delete op[key]; else op[key] = v; Studio.touch(); Studio.renderAll(); })));
    }
    panel.appendChild(field('z (walk-behind)', num(op.z, (v) => { if (v === undefined) delete op.z; else op.z = v; Studio.touch(); Studio.renderAll(); })));
    panel.appendChild(el('<div class="hint">z = the baseline y. Actors whose feet are above this line are drawn behind this op.</div>'));
    insp.appendChild(panel);
  }

  // ---------- color picker ----------
  Studio.colorPicker = function (value, onChange) {
    const wrapEl = el('<div></div>');
    const pal = el('<div class="pal" style="grid-template-columns: repeat(11, 18px)"></div>');
    const chars = Grog.COLOR_CHARS;
    for (let i = 0; i < 32; i++) {
      const ch = chars[i];
      const sw = el(`<div class="sw" title="${ch} ${Grog.PALETTE[i]}" style="background:${Grog.PALETTE[i]}"></div>`);
      if (value === ch) sw.classList.add('sel');
      sw.addEventListener('click', () => { onChange(ch); });
      pal.appendChild(sw);
    }
    wrapEl.appendChild(pal);
    return wrapEl;
  };
})();
