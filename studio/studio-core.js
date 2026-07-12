/* Grog Studio — core: state, persistence, sidebar, panels, form helpers, validation. */
(function () {
  'use strict';
  const Studio = (window.Studio = window.Studio || {});
  const LS_KEY = 'grog_studio_project';

  Studio.state = { project: null, sel: { type: null, id: null }, dirtyTimer: null };
  Studio.editors = {};   // type -> render(editorEl, inspectorEl, id)

  // ---------- tiny DOM helpers ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  Studio.$ = $; Studio.el = el;

  Studio.field = function (labelText, inputEl) {
    const row = el('<div class="row"></div>');
    row.appendChild(el(`<label>${labelText}</label>`));
    row.appendChild(inputEl);
    return row;
  };
  Studio.text = function (value, onChange, opts = {}) {
    const i = el(`<input type="text" ${opts.wide ? 'style="flex:1"' : ''}>`);
    i.value = value === undefined || value === null ? '' : value;
    if (opts.placeholder) i.placeholder = opts.placeholder;
    i.addEventListener('change', () => onChange(i.value));
    return i;
  };
  Studio.num = function (value, onChange) {
    const i = el('<input type="number" step="1">');
    i.value = value === undefined ? '' : value;
    i.addEventListener('change', () => onChange(i.value === '' ? undefined : parseFloat(i.value)));
    return i;
  };
  Studio.check = function (value, onChange) {
    const i = el('<input type="checkbox">');
    i.checked = !!value;
    i.addEventListener('change', () => onChange(i.checked));
    return i;
  };
  Studio.select = function (options, value, onChange) {
    const s = el('<select></select>');
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = typeof o === 'string' ? o : o.value;
      opt.textContent = typeof o === 'string' ? o : o.label;
      s.appendChild(opt);
    }
    s.value = value === undefined ? '' : value;
    s.addEventListener('change', () => onChange(s.value));
    return s;
  };

  Studio.modal = function (title, bodyEl, buttons) {
    const root = $('#modal-root');
    const m = el(`<div class="modal"><h2>${title}</h2></div>`);
    m.appendChild(bodyEl);
    const btns = el('<div class="buttons"></div>');
    for (const b of buttons || [{ label: 'Close' }]) {
      const btn = el(`<button ${b.primary ? 'class="primary"' : ''}>${b.label}</button>`);
      btn.addEventListener('click', () => { if (!b.onClick || b.onClick() !== false) Studio.closeModal(); });
      btns.appendChild(btn);
    }
    m.appendChild(btns);
    root.innerHTML = '';
    root.appendChild(m);
    return m;
  };
  Studio.closeModal = function () { $('#modal-root').innerHTML = ''; };

  Studio.jsonModal = function (title, value, onSave) {
    const ta = el('<textarea class="code" style="width:70vw;height:56vh"></textarea>');
    ta.value = JSON.stringify(value, null, 2);
    const err = el('<div class="hint" style="color:var(--danger)"></div>');
    const body = el('<div></div>');
    body.appendChild(ta); body.appendChild(err);
    Studio.modal(title, body, [
      { label: 'Cancel' },
      {
        label: 'Save', primary: true, onClick: () => {
          try { onSave(JSON.parse(ta.value)); Studio.touch(); return true; }
          catch (e) { err.textContent = e.message; return false; }
        },
      },
    ]);
  };

  Studio.prompt = function (title, initial, onOk, validate) {
    const i = el('<input type="text" style="width:100%">');
    i.value = initial || '';
    const err = el('<div class="hint" style="color:var(--danger)"></div>');
    const body = el('<div></div>');
    body.appendChild(i); body.appendChild(err);
    Studio.modal(title, body, [
      { label: 'Cancel' },
      {
        label: 'OK', primary: true, onClick: () => {
          const v = i.value.trim();
          const problem = validate ? validate(v) : (v ? null : 'Required');
          if (problem) { err.textContent = problem; return false; }
          onOk(v);
          return true;
        },
      },
    ]);
    setTimeout(() => i.focus(), 30);
  };

  Studio.confirm = function (title, text, onOk) {
    Studio.modal(title, el(`<div>${text}</div>`), [
      { label: 'Cancel' },
      { label: 'OK', primary: true, onClick: () => { onOk(); return true; } },
    ]);
  };

  Studio.status = function (msg) { $('#statusbar').textContent = msg; };

  // ---------- ids ----------
  Studio.idValidate = function (collection, current) {
    return (v) => {
      if (!/^[a-z][a-z0-9_]*$/i.test(v)) return 'Use letters, digits, underscore; start with a letter.';
      if (v !== current && collection[v]) return 'Already exists.';
      return null;
    };
  };

  // ---------- persistence ----------
  Studio.touch = function () {
    clearTimeout(Studio.state.dirtyTimer);
    Studio.state.dirtyTimer = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(Studio.state.project));
        Studio.status('Autosaved to browser at ' + new Date().toLocaleTimeString());
      } catch (e) { Studio.status('Autosave failed: ' + e.message); }
    }, 400);
  };

  Studio.blankProject = function (pipeline) {
    return {
      meta: { title: 'My Adventure', author: '', version: '0.1', textSpeed: 15, pipeline: pipeline || 'paint', start: { room: 'room1', x: 160, y: 120 } },
      player: 'hero',
      flags: {}, vars: {},
      actors: {
        hero: {
          name: 'Hero', color: 'l', speed: 55, sprite: 'hero',
          anims: { idle: { frames: ['idle'], fps: 2 }, talk: { frames: ['idle', 'talk'], fps: 7 }, walkR: { frames: ['idle'], fps: 8 }, walkL: { ref: 'walkR', flip: true } },
        },
      },
      items: {},
      sprites: {
        hero: {
          w: 10,
          frames: {
            idle: ['...0000...', '..077770..', '..071710..', '..077770..', '...0770...', '..0jjjj0..', '.0jjjjjj0.', '..0j00j0..', '..011110..', '..01.010..', '..01.010..', '..00.000..'],
            talk: ['...0000...', '..077770..', '..071710..', '..072270..', '...0770...', '..0jjjj0..', '.0jjjjjj0.', '..0j00j0..', '..011110..', '..01.010..', '..01.010..', '..00.000..'],
          },
        },
      },
      rooms: {
        room1: {
          name: 'First Room',
          paint: [
            { op: 'grad', x: 0, y: 0, w: 320, h: 90, from: '1', to: 'f' },
            { op: 'rect', x: 0, y: 90, w: 320, h: 54, c: '3' },
          ],
          walk: [[10, 96, 310, 96, 310, 140, 10, 140]],
          scale: { y1: 92, s1: 0.85, y2: 140, s2: 1.0 },
          hotspots: [],
          enter: [],
        },
      },
      assets: {},
      dialogs: {}, scripts: {}, music: {}, sounds: {}, defaults: {},
    };
  };

  // ---------- sidebar ----------
  const GROUPS = [
    { key: 'rooms', label: 'Rooms', type: 'room' },
    { key: 'assets', label: 'Assets', type: 'asset' },
    { key: 'sprites', label: 'Sprites', type: 'sprite' },
    { key: 'actors', label: 'Actors', type: 'actor' },
    { key: 'items', label: 'Items', type: 'item' },
    { key: 'dialogs', label: 'Dialogs', type: 'dialog' },
    { key: 'scripts', label: 'Scripts', type: 'script' },
    { key: 'music', label: 'Music', type: 'music' },
  ];
  Studio.GROUPS = GROUPS;

  Studio.renderSidebar = function () {
    const P = Studio.state.project;
    const side = $('#sidebar');
    side.innerHTML = '';
    for (const g of GROUPS) {
      const grp = el('<div class="side-group"></div>');
      const head = el(`<div class="side-head">${g.label}</div>`);
      const add = el('<button class="small" title="Add">+</button>');
      add.addEventListener('click', (e) => { e.stopPropagation(); Studio.addEntity(g); });
      head.appendChild(add);
      grp.appendChild(head);
      const coll = P[g.key] || {};
      for (const id of Object.keys(coll)) {
        const it = el(`<div class="side-item" title="${id}">${id}</div>`);
        if (Studio.state.sel.type === g.type && Studio.state.sel.id === id) it.classList.add('sel');
        it.addEventListener('click', () => Studio.selectEntity(g.type, id));
        it.addEventListener('contextmenu', (e) => { e.preventDefault(); Studio.entityMenu(g, id); });
        grp.appendChild(it);
      }
      side.appendChild(grp);
    }
    for (const [type, label] of [['settings', '⚙ Project settings'], ['export', '⇪ Export & publish']]) {
      const it = el(`<div class="side-item" style="margin-top:6px;font-weight:600">${label}</div>`);
      if (Studio.state.sel.type === type) it.classList.add('sel');
      it.addEventListener('click', () => Studio.selectEntity(type, null));
      side.appendChild(it);
    }
  };

  Studio.entityMenu = function (g, id) {
    const P = Studio.state.project;
    const body = el('<div class="row"></div>');
    Studio.modal(`${g.label.slice(0, -1)} “${id}”`, body, [
      { label: 'Rename', onClick: () => { setTimeout(() => Studio.renameEntity(g, id), 50); return true; } },
      { label: 'Duplicate', onClick: () => { const c = JSON.parse(JSON.stringify(P[g.key][id])); let n = id + '_copy'; while (P[g.key][n]) n += '2'; P[g.key][n] = c; Studio.touch(); Studio.renderSidebar(); return true; } },
      { label: 'Delete', onClick: () => { delete P[g.key][id]; if (Studio.state.sel.id === id) Studio.state.sel = { type: null, id: null }; Studio.touch(); Studio.renderAll(); return true; } },
      { label: 'Cancel' },
    ]);
  };

  Studio.renameEntity = function (g, id) {
    const P = Studio.state.project;
    Studio.prompt(`Rename ${id}`, id, (v) => {
      if (v === id) return;
      P[g.key][v] = P[g.key][id];
      delete P[g.key][id];
      // best-effort reference update via string replace on serialized project
      const patterns = {
        rooms: [`"room": "${id}"`, `"room":"${id}"`], sprites: [`"sprite": "${id}"`, `"icon": "${id}"`, `"id": "${id}"`],
        actors: [`"actor": "${id}"`], items: [`"item": "${id}"`], dialogs: [`"id": "${id}"`], scripts: [`"script": "${id}"`], music: [`"music": "${id}"`],
      };
      let s = JSON.stringify(P);
      for (const pat of patterns[g.key] || []) s = s.split(pat).join(pat.replace(id, v));
      Studio.state.project = JSON.parse(s);
      if (Studio.state.sel.id === id) Studio.state.sel.id = v;
      Studio.touch(); Studio.renderAll();
    }, Studio.idValidate(P[g.key], id));
  };

  Studio.addEntity = function (g) {
    const P = Studio.state.project;
    if (g.key === 'assets') { Studio.importAssets(); return; }
    Studio.prompt(`New ${g.label.slice(0, -1).toLowerCase()} id`, '', (v) => {
      const T = {
        rooms: () => ({ name: v, paint: [{ op: 'fill', c: '1' }], walk: [[10, 100, 310, 100, 310, 140, 10, 140]], hotspots: [], enter: [] }),
        sprites: () => ({ w: 12, frames: { f1: Array(12).fill('............') } }),
        actors: () => ({ name: v, color: 'l', speed: 50, sprite: Object.keys(P.sprites)[0] || '', anims: { idle: { frames: [Object.keys((P.sprites[Object.keys(P.sprites)[0]] || { frames: {} }).frames)[0] || 'f1'], fps: 2 } } }),
        items: () => ({ name: v, icon: '', verbs: { look: [{ do: 'say', text: 'A brand new ' + v + '.' }] } }),
        dialogs: () => ({ start: 'root', nodes: { root: { options: [{ text: 'Hello!', end: true, actions: [] }] } } }),
        scripts: () => ([]),
        music: () => ({ bpm: 110, steps: 2, tracks: [{ wave: 'square', vol: 0.12, notes: 'C4 . E4 . G4 . E4 .' }] }),
      };
      P[g.key][v] = T[g.key]();
      Studio.touch();
      Studio.selectEntity(g.type, v);
    }, Studio.idValidate(P[g.key]));
  };

  Studio.selectEntity = function (type, id) {
    Studio.state.sel = { type, id };
    Studio.renderAll();
  };

  Studio.renderAll = function () {
    Studio.renderSidebar();
    const editor = $('#editor'), insp = $('#inspector');
    editor.innerHTML = ''; insp.innerHTML = '';
    const { type, id } = Studio.state.sel;
    if (!type) {
      editor.appendChild(el(`<div class="panel"><h2>Welcome to Grog Studio</h2>
        <p>Pick something in the sidebar, or:</p>
        <div class="row" style="margin-top:8px">
          <button id="btn-load-demo" class="primary">Load demo: Escape from the Engine Room (drawn pixels)</button>
          <button id="btn-load-demo2" class="primary">Load demo: The Case of the Missing Pixel (imported assets)</button>
          <button id="btn-load-demo3" class="primary">Load demo: The Song of the Bearded Whalephant (full asset game)</button>
          <button id="btn-start-blank">Start a blank project</button>
        </div>
        <h3>What is this?</h3>
        <p class="hint">Grog Studio is a complete authoring tool for classic point-and-click adventures.
        Edit rooms, pixel art, scripts, dialogs and music — then play instantly and export a single HTML file that runs anywhere.</p></div>`));
      $('#btn-load-demo', editor).addEventListener('click', () => Studio.loadDemo());
      $('#btn-load-demo2', editor).addEventListener('click', () => Studio.loadDemo('../demo/missing-pixel.grog.json'));
      $('#btn-load-demo3', editor).addEventListener('click', () => Studio.loadDemo('../demo/whalephant.grog.json'));
      $('#btn-start-blank', editor).addEventListener('click', () => { Studio.state.project = Studio.blankProject(); Studio.touch(); Studio.renderAll(); });
      return;
    }
    const fn = Studio.editors[type];
    if (fn) fn(editor, insp, id);
    else editor.appendChild(el(`<div class="panel">No editor for ${type}</div>`));
  };

  Studio.loadDemo = async function (url) {
    try {
      const res = await fetch(url || '../demo/engine-room.grog.json');
      Studio.state.project = await res.json();
      Studio.state.sel = { type: 'room', id: Object.keys(Studio.state.project.rooms)[0] };
      Studio.touch();
      Studio.renderAll();
    } catch (e) { Studio.status('Could not load demo: ' + e.message); }
  };

  // ---------- validation ----------
  Studio.validate = function () {
    const P = Studio.state.project;
    const problems = [];
    const err = (m) => problems.push({ level: 'err', m });
    const warn = (m) => problems.push({ level: 'warn', m });
    const COLORS = '0123456789abcdefghijklmnopstuvqr. ';
    for (const [sid, spr] of Object.entries(P.sprites || {})) {
      if (spr.sheet) {
        if (!(P.assets || {})[spr.sheet.asset]) err(`sprite ${sid}: sheet asset '${spr.sheet.asset}' missing`);
        continue;
      }
      for (const [fid, rows] of Object.entries(spr.frames || {})) {
        if (!Array.isArray(rows)) { err(`sprite ${sid}.${fid}: not a pixel grid (did you mean a sheet sprite?)`); continue; }
        rows.forEach((row, i) => { if (row.length !== spr.w) err(`sprite ${sid}.${fid} row ${i}: length ${row.length} ≠ w ${spr.w}`); });
      }
    }
    const checkPaint = (ops, where) => {
      for (const op of ops || []) {
        if (op.op === 'image' && !(P.assets || {})[op.id]) err(`${where}: image op references missing asset '${op.id}'`);
        if (op.op === 'sprite' && !(P.sprites || {})[op.id]) err(`${where}: sprite op references missing sprite '${op.id}'`);
      }
    };
    for (const [rid, room] of Object.entries(P.rooms || {})) {
      checkPaint(room.paint, `room ${rid}.paint`);
      for (const h of room.hotspots || []) {
        checkPaint(h.paint, `room ${rid}.${h.id}.paint`);
        for (const [st, sd] of Object.entries(h.states || {})) checkPaint(sd.paint, `room ${rid}.${h.id}[${st}].paint`);
      }
    }
    for (const [aid, a] of Object.entries(P.actors || {})) {
      const spr = (P.sprites || {})[a.sprite];
      if (!spr) { err(`actor ${aid}: sprite '${a.sprite}' missing`); continue; }
      for (const [an, d] of Object.entries(a.anims || {})) {
        if (d.ref) { if (!a.anims[d.ref]) err(`actor ${aid} anim ${an}: ref '${d.ref}' missing`); continue; }
        for (const f of d.frames || []) if ((spr.frames || {})[f] === undefined) err(`actor ${aid} anim ${an}: frame '${f}' missing`);
      }
    }
    for (const [iid, it] of Object.entries(P.items || {})) {
      if (it.icon && !(P.sprites || {})[it.icon]) err(`item ${iid}: icon sprite '${it.icon}' missing`);
    }
    const roomIds = new Set(Object.keys(P.rooms || {}));
    const scan = (list, where) => {
      if (!Array.isArray(list)) return;
      for (const op of list) {
        if (!op || typeof op !== 'object') continue;
        if (op.cond !== undefined && op.actions) { scan(op.actions, where); continue; }
        if (op.do === 'goto' && !roomIds.has(op.room)) err(`${where}: goto unknown room '${op.room}'`);
        if ((op.do === 'give' || op.do === 'lose') && !(P.items || {})[op.item]) err(`${where}: unknown item '${op.item}'`);
        if (op.do === 'dialog' && !(P.dialogs || {})[op.id]) err(`${where}: unknown dialog '${op.id}'`);
        if (op.do === 'call' && !(P.scripts || {})[op.script]) err(`${where}: unknown script '${op.script}'`);
        if (op.do === 'music' && op.id && !(P.music || {})[op.id]) err(`${where}: unknown music '${op.id}'`);
        if (op.do === 'if') { scan(op.then, where); scan(op.else, where); }
        if (op.do === 'random') (op.of || []).forEach((l) => scan(l, where));
      }
    };
    const scanVerbs = (verbs, where) => {
      for (const [v, val] of Object.entries(verbs || {})) {
        if (Array.isArray(val) && val.length && val[0] && val[0].cond !== undefined && val[0].actions) val.forEach((x, i) => scan(x.actions, `${where}.${v}[${i}]`));
        else scan(val, `${where}.${v}`);
      }
    };
    for (const [rid, room] of Object.entries(P.rooms || {})) {
      if (room.music && !(P.music || {})[room.music]) err(`room ${rid}: unknown music '${room.music}'`);
      if (!(room.walk || []).length) warn(`room ${rid}: no walkable area`);
      scan(room.enter, `room ${rid}.enter`);
      for (const h of room.hotspots || []) {
        if (!h.rect && !h.poly) warn(`room ${rid}/${h.id}: no rect or poly`);
        scanVerbs(h.verbs, `room ${rid}.${h.id}`);
        for (const [st, sd] of Object.entries(h.states || {})) scanVerbs(sd.verbs, `room ${rid}.${h.id}[${st}]`);
      }
      for (const aid of Object.keys(room.actors || {})) if (!(P.actors || {})[aid]) err(`room ${rid}: unknown actor '${aid}'`);
    }
    for (const [aid, a] of Object.entries(P.actors || {})) scanVerbs(a.verbs, `actor ${aid}`);
    for (const [iid, it] of Object.entries(P.items || {})) scanVerbs(it.verbs, `item ${iid}`);
    for (const [did, d] of Object.entries(P.dialogs || {})) {
      for (const [nid, n] of Object.entries(d.nodes || {})) {
        scan(n.actions, `dialog ${did}.${nid}`);
        (n.options || []).forEach((o, i) => {
          scan(o.actions, `dialog ${did}.${nid}[${i}]`);
          if (o.next && !d.nodes[o.next]) err(`dialog ${did}.${nid}[${i}]: next '${o.next}' missing`);
        });
      }
    }
    for (const [sid, s] of Object.entries(P.scripts || {})) scan(s, `script ${sid}`);
    if (!P.rooms[(P.meta.start || {}).room]) err('meta.start.room is not a valid room');
    if (!(P.actors || {})[P.player]) err(`player '${P.player}' is not an actor`);
    return problems;
  };

  Studio.showProblems = function () {
    const problems = Studio.validate();
    const body = el('<div class="problems"></div>');
    if (!problems.length) body.appendChild(el('<div class="ok">✓ No problems found. Ship it!</div>'));
    for (const p of problems) body.appendChild(el(`<div class="${p.level}">${p.level === 'err' ? '✗' : '⚠'} ${p.m}</div>`));
    Studio.modal(`Project check — ${problems.filter((p) => p.level === 'err').length} error(s), ${problems.filter((p) => p.level === 'warn').length} warning(s)`, body);
  };

  // ---------- boot ----------
  Studio.boot = function () {
    let restored = null;
    try { restored = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { }
    Studio.state.project = restored || null;
    if (!Studio.state.project) {
      Studio.state.project = Studio.blankProject();
    }
    $('#btn-new').addEventListener('click', () => {
      const body = el(`<div>
        <p>Pick the art pipeline for the new project. This just sets defaults — every project can freely mix both.</p>
        <div class="row" style="margin-top:10px"><button id="np-paint" class="primary">Classic paint — draw everything in Studio (paint ops + pixel sprites)</button></div>
        <div class="row"><button id="np-assets" class="primary">Imported assets — PNG backgrounds & sprite sheets from your art tools</button></div>
        <p class="hint">The current project's browser autosave will be replaced (use “Save file” first to keep it).</p>
      </div>`);
      Studio.modal('New project', body, [{ label: 'Cancel' }]);
      const start = (pipeline) => {
        Studio.state.project = Studio.blankProject(pipeline);
        Studio.state.sel = { type: null, id: null };
        Studio.closeModal(); Studio.touch(); Studio.renderAll();
        if (pipeline === 'assets') Studio.status('Asset project created — click “+” next to ASSETS to import your PNGs.');
      };
      body.querySelector('#np-paint').addEventListener('click', () => start('paint'));
      body.querySelector('#np-assets').addEventListener('click', () => start('assets'));
    });
    $('#btn-open').addEventListener('click', () => $('#file-open').click());
    $('#file-open').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        Studio.state.project = JSON.parse(await f.text());
        Studio.state.sel = { type: null, id: null };
        Studio.touch(); Studio.renderAll();
        Studio.status('Opened ' + f.name);
      } catch (err2) { Studio.status('Open failed: ' + err2.message); }
      e.target.value = '';
    });
    $('#btn-save').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(Studio.state.project, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (Studio.state.project.meta.title || 'game').replace(/\W+/g, '-').toLowerCase() + '.grog.json';
      a.click();
    });
    $('#btn-check').addEventListener('click', Studio.showProblems);
    $('#btn-play').addEventListener('click', () => Studio.playtest());
    const titleEl = $('#project-title');
    const syncTitle = () => { titleEl.textContent = Studio.state.project.meta.title || 'untitled'; };
    titleEl.addEventListener('click', () => Studio.prompt('Project title', Studio.state.project.meta.title, (v) => { Studio.state.project.meta.title = v; Studio.touch(); syncTitle(); }));
    syncTitle();
    const origTouch = Studio.touch;
    Studio.touch = function () { origTouch(); syncTitle(); };
    Studio.renderAll();
  };
})();
