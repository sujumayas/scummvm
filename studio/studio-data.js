/* Grog Studio — data editors: action lists, verbs, hotspot inspector,
   actors, items, dialogs, scripts, music, settings. */
(function () {
  'use strict';
  const Studio = window.Studio;
  const Grog = window.Grog;
  const { el, field, text, num, select, check } = { el: Studio.el, field: Studio.field, text: Studio.text, num: Studio.num, select: Studio.select, check: Studio.check };

  const DIRS = ['', 'L', 'R', 'U', 'D'];
  const CMDS = ['say', 'walk', 'face', 'anim', 'wait', 'goto', 'set', 'var', 'give', 'lose', 'show', 'hide', 'state', 'actor', 'sound', 'music', 'dialog', 'call', 'if', 'random', 'shake', 'fade', 'title', 'end', 'stop'];
  const SOUNDS = ['pickup', 'open', 'close', 'error', 'ding', 'splash', 'thunk', 'teleport', 'step', 'laugh', 'fanfare'];

  function actorOptions() {
    const P = Studio.state.project;
    return ['', 'narrator'].concat(Object.keys(P.actors || {}));
  }

  // ---------- action editor ----------
  // Renders an editable list UI bound directly to `list` (mutates in place).
  Studio.actionEditor = function (list, onChange) {
    const P = Studio.state.project;
    const box = el('<div class="actions"></div>');
    const changed = () => { onChange && onChange(); Studio.touch(); };

    const render = () => {
      box.innerHTML = '';
      list.forEach((op, i) => {
        const row = el('<div class="act-row"></div>');
        const doSel = select(CMDS, op.do || 'say', (v) => {
          const keep = { do: v };
          if (v === 'say') keep.text = op.text || '';
          list[i] = keep;
          changed(); render();
        });
        doSel.className = 'do';
        row.appendChild(doSel);
        const F = {
          t: (key, ph) => { const iEl = text(op[key], (v) => { if (v) op[key] = v; else delete op[key]; changed(); }); iEl.placeholder = ph || key; iEl.style.width = '86px'; return iEl; },
          wide: (key, ph) => { const iEl = text(op[key], (v) => { op[key] = v; changed(); }, { wide: true }); iEl.className = 'wide'; iEl.placeholder = ph || key; return iEl; },
          n: (key, ph) => { const iEl = num(op[key], (v) => { if (v === undefined) delete op[key]; else op[key] = v; changed(); }); iEl.placeholder = ph || key; iEl.title = key; return iEl; },
          b: (key, label) => { const wrapEl = el(`<label style="display:flex;align-items:center;gap:3px;min-width:0">${label || key}</label>`); wrapEl.prepend(check(op[key], (v) => { if (v) op[key] = true; else delete op[key]; changed(); })); return wrapEl; },
          sel: (key, options) => { const s = select(options, op[key] === undefined ? '' : op[key], (v) => { if (v === '') delete op[key]; else op[key] = v; changed(); }); s.title = key; return s; },
          sub: (key, label) => {
            const b = el(`<button class="small">${label || key} (${(op[key] || []).length})…</button>`);
            b.addEventListener('click', () => Studio.actionModal(`${op.do} → ${key}`, op[key] || [], (v) => { op[key] = v; changed(); render(); }));
            return b;
          },
        };
        switch (op.do) {
          case 'say': row.appendChild(F.sel('actor', actorOptions())); row.appendChild(F.wide('text', 'What to say')); break;
          case 'walk': row.appendChild(F.sel('actor', actorOptions())); row.appendChild(F.n('x')); row.appendChild(F.n('y')); row.appendChild(F.t('to', 'hotspot id')); row.appendChild(F.sel('dir', DIRS)); break;
          case 'face': row.appendChild(F.sel('actor', actorOptions())); row.appendChild(F.sel('dir', DIRS)); break;
          case 'anim': row.appendChild(F.sel('actor', actorOptions())); row.appendChild(F.t('name', 'anim name')); row.appendChild(F.b('wait')); row.appendChild(F.b('once')); break;
          case 'wait': row.appendChild(F.n('ms')); break;
          case 'goto': row.appendChild(F.sel('room', Object.keys(P.rooms))); row.appendChild(F.n('x')); row.appendChild(F.n('y')); row.appendChild(F.sel('dir', DIRS)); break;
          case 'set': row.appendChild(F.t('flag')); row.appendChild(F.b('value', 'true (unchecked = clear)')); break;
          case 'var': row.appendChild(F.t('name')); row.appendChild(F.n('set')); row.appendChild(F.n('add')); break;
          case 'give': case 'lose': row.appendChild(F.sel('item', Object.keys(P.items || {}))); break;
          case 'show': case 'hide': row.appendChild(F.t('hotspot')); row.appendChild(F.sel('room', [''].concat(Object.keys(P.rooms)))); break;
          case 'state': row.appendChild(F.t('hotspot')); row.appendChild(F.t('state')); row.appendChild(F.sel('room', [''].concat(Object.keys(P.rooms)))); break;
          case 'actor': row.appendChild(F.sel('id', Object.keys(P.actors || {}))); row.appendChild(F.sel('room', [''].concat(Object.keys(P.rooms)))); row.appendChild(F.n('x')); row.appendChild(F.n('y')); row.appendChild(F.b('hidden')); break;
          case 'sound': row.appendChild(F.sel('id', SOUNDS)); break;
          case 'music': row.appendChild(F.sel('id', [''].concat(Object.keys(P.music || {})))); break;
          case 'dialog': row.appendChild(F.sel('id', Object.keys(P.dialogs || {}))); break;
          case 'call': row.appendChild(F.sel('script', Object.keys(P.scripts || {}))); break;
          case 'if': row.appendChild(F.wide('cond', 'e.g. door_open && !has(rope)')); row.appendChild(F.sub('then')); row.appendChild(F.sub('else')); break;
          case 'random': {
            const b = el(`<button class="small">variants (${(op.of || []).length})… </button>`);
            b.addEventListener('click', () => Studio.jsonModal('random → of (array of action lists)', op.of || [[]], (v) => { op.of = v; changed(); render(); }));
            row.appendChild(b);
            break;
          }
          case 'shake': row.appendChild(F.n('ms')); break;
          case 'fade': row.appendChild(F.b('out')); row.appendChild(F.n('speed')); break;
          case 'title': row.appendChild(F.wide('text')); row.appendChild(F.t('sub')); row.appendChild(F.n('ms')); break;
          case 'end': row.appendChild(F.wide('text')); row.appendChild(F.t('sub')); break;
        }
        const mini = el('<div class="mini"></div>');
        const up = el('<button class="small">↑</button>');
        up.addEventListener('click', () => { if (i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; changed(); render(); } });
        const dn = el('<button class="small">↓</button>');
        dn.addEventListener('click', () => { if (i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; changed(); render(); } });
        const del = el('<button class="small danger">✕</button>');
        del.addEventListener('click', () => { list.splice(i, 1); changed(); render(); });
        mini.appendChild(up); mini.appendChild(dn); mini.appendChild(del);
        row.appendChild(mini);
        box.appendChild(row);
      });
      const addRow = el('<div class="act-add"></div>');
      const add = el('<button class="small">+ Add command</button>');
      add.addEventListener('click', () => { list.push({ do: 'say', text: '' }); changed(); render(); });
      addRow.appendChild(add);
      const raw = el('<button class="small" style="margin-left:6px">JSON</button>');
      raw.addEventListener('click', () => Studio.jsonModal('Actions', list, (v) => { list.length = 0; list.push(...v); changed(); render(); }));
      addRow.appendChild(raw);
      box.appendChild(addRow);
    };
    render();
    return box;
  };

  Studio.actionModal = function (title, actions, onSave) {
    const copy = JSON.parse(JSON.stringify(actions || []));
    const body = el('<div style="min-width:640px"></div>');
    body.appendChild(Studio.actionEditor(copy, null));
    Studio.modal(title, body, [
      { label: 'Cancel' },
      { label: 'Save', primary: true, onClick: () => { onSave(copy); Studio.touch(); Studio.renderAll(); return true; } },
    ]);
  };

  // ---------- verbs editor ----------
  // holder[key] is the verbs object; supports "use itemId" keys and conditional variants (JSON fallback).
  Studio.verbsEditor = function (holder, key, contextLabel) {
    const box = el('<div></div>');
    const render = () => {
      box.innerHTML = '';
      const verbs = holder[key] || {};
      const listEl = el('<div class="list"></div>');
      for (const [vk, val] of Object.entries(verbs)) {
        const isVariants = Array.isArray(val) && val.length && val[0] && val[0].cond !== undefined && val[0].actions;
        const row = el(`<div class="list-row"><span class="grow"><b>${vk}</b> <span class="dim">${isVariants ? val.length + ' conditional variants' : (val.length || 0) + ' actions'}</span></span></div>`);
        const edit = el('<button class="small">edit</button>');
        edit.addEventListener('click', () => {
          if (isVariants) Studio.jsonModal(`${contextLabel} — ${vk} (conditional variants)`, val, (v) => { verbs[vk] = v; render(); });
          else Studio.actionModal(`${contextLabel} — on “${vk}”`, val, (v) => { holder[key] = verbs; verbs[vk] = v; render(); });
        });
        const del = el('<button class="small danger">✕</button>');
        del.addEventListener('click', () => { delete verbs[vk]; Studio.touch(); render(); });
        row.appendChild(edit); row.appendChild(del);
        listEl.appendChild(row);
      }
      box.appendChild(listEl);
      const addRow = el('<div class="row"></div>');
      const verbIds = (Studio.state.project.verbs || Grog.DEFAULT_VERBS).map((v) => v.id).concat(['walkto']);
      const vSel = select(verbIds, 'look', () => { });
      const withIn = text('', () => { }, { placeholder: 'with item id (optional)' });
      withIn.placeholder = '+ item id (optional)';
      withIn.style.width = '130px';
      const addBtn = el('<button class="small">+ Add verb handler</button>');
      addBtn.addEventListener('click', () => {
        const k = withIn.value.trim() ? vSel.value + ' ' + withIn.value.trim() : vSel.value;
        holder[key] = holder[key] || {};
        if (!holder[key][k]) holder[key][k] = [{ do: 'say', text: '...' }];
        Studio.touch(); render();
      });
      addRow.appendChild(vSel); addRow.appendChild(withIn); addRow.appendChild(addBtn);
      box.appendChild(addRow);
    };
    render();
    return box;
  };

  // ---------- hotspot inspector (used by room editor) ----------
  Studio.hotspotInspector = function (insp, room, h) {
    const panel = el('<div class="panel"></div>');
    panel.appendChild(el(`<h3>Hotspot: ${h.id}</h3>`));
    panel.appendChild(field('Name', text(h.name, (v) => { h.name = v; Studio.touch(); })));
    panel.appendChild(field('Default verb', select((Studio.state.project.verbs || Grog.DEFAULT_VERBS).map((v) => v.id), h.default || 'look', (v) => { h.default = v; Studio.touch(); })));
    const atRow = el('<div class="row"><label>Walk-to at</label></div>');
    atRow.appendChild(num((h.at || [])[0], (v) => { h.at = h.at || [0, 0]; h.at[0] = v; Studio.touch(); Studio.renderAll(); }));
    atRow.appendChild(num((h.at || [])[1], (v) => { h.at = h.at || [0, 0]; h.at[1] = v; Studio.touch(); Studio.renderAll(); }));
    atRow.appendChild(select(DIRS, h.dir || '', (v) => { if (v) h.dir = v; else delete h.dir; Studio.touch(); }));
    panel.appendChild(atRow);
    const flags = el('<div class="row"></div>');
    flags.appendChild(el('<label>Options</label>'));
    const noWalkL = el('<label style="min-width:0">no walk</label>');
    noWalkL.prepend(check(h.noWalk, (v) => { if (v) h.noWalk = true; else delete h.noWalk; Studio.touch(); }));
    const hiddenL = el('<label style="min-width:0">start hidden</label>');
    hiddenL.prepend(check(h.hidden, (v) => { if (v) h.hidden = true; else delete h.hidden; Studio.touch(); }));
    flags.appendChild(noWalkL); flags.appendChild(hiddenL);
    panel.appendChild(flags);
    if (h.poly) {
      const pb = el('<button class="small">Edit polygon…</button>');
      pb.addEventListener('click', () => Studio.jsonModal('Hotspot polygon', h.poly, (v) => { h.poly = v; Studio.renderAll(); }));
      panel.appendChild(field('Shape', pb));
    }
    panel.appendChild(el('<h3>Verb scripts</h3>'));
    panel.appendChild(Studio.verbsEditor(h, 'verbs', h.id));
    panel.appendChild(el('<h3>States</h3>'));
    const statesBox = el('<div></div>');
    const renderStates = () => {
      statesBox.innerHTML = '';
      if (h.states) {
        statesBox.appendChild(field('Initial', select(Object.keys(h.states), h.state, (v) => { h.state = v; Studio.touch(); Studio.renderAll(); })));
        for (const [sn, sd] of Object.entries(h.states)) {
          const row = el(`<div class="list-row"><span class="grow"><b>${sn}</b> <span class="dim">${(sd.paint || []).length} paint, ${Object.keys(sd.verbs || {}).length} verbs</span></span></div>`);
          const paintB = el('<button class="small">paint</button>');
          paintB.addEventListener('click', () => Studio.jsonModal(`${h.id}[${sn}] paint ops`, sd.paint || [], (v) => { sd.paint = v; Studio.renderAll(); }));
          const verbsB = el('<button class="small">verbs</button>');
          verbsB.addEventListener('click', () => {
            const body = el('<div style="min-width:560px"></div>');
            body.appendChild(Studio.verbsEditor(sd, 'verbs', `${h.id}[${sn}]`));
            Studio.modal(`State “${sn}” verb scripts`, body);
          });
          const del = el('<button class="small danger">✕</button>');
          del.addEventListener('click', () => { delete h.states[sn]; if (!Object.keys(h.states).length) { delete h.states; delete h.state; } Studio.touch(); Studio.renderAll(); });
          row.appendChild(paintB); row.appendChild(verbsB); row.appendChild(del);
          statesBox.appendChild(row);
        }
      }
      const addS = el('<button class="small">+ Add state</button>');
      addS.addEventListener('click', () => Studio.prompt('State name', '', (v) => {
        h.states = h.states || {};
        h.states[v] = { paint: [], verbs: {} };
        if (!h.state) h.state = v;
        Studio.touch(); Studio.renderAll();
      }, Studio.idValidate(h.states || {})));
      statesBox.appendChild(addS);
    };
    renderStates();
    panel.appendChild(statesBox);
    panel.appendChild(el('<div class="hint">States switch a hotspot’s look, name and verbs at runtime with the <b>state</b> command (door open/closed, item taken…).</div>'));
    insp.appendChild(panel);
  };

  // ---------- actor editor ----------
  Studio.editors.actor = function (editor, insp, id) {
    const P = Studio.state.project;
    const a = P.actors[id];
    if (!a) return;
    const pane = el('<div></div>');
    pane.appendChild(el(`<h2>Actor: ${id}${P.player === id ? ' <span class="hint">(player character)</span>' : ''}</h2>`));
    const props = el('<div class="panel"></div>');
    props.appendChild(field('Name', text(a.name, (v) => { a.name = v; Studio.touch(); })));
    props.appendChild(field('Sprite', select(Object.keys(P.sprites), a.sprite, (v) => { a.sprite = v; Studio.touch(); Studio.renderAll(); })));
    props.appendChild(field('Speed px/s', num(a.speed, (v) => { a.speed = v; Studio.touch(); })));
    props.appendChild(field('Talk color', Studio.colorPicker(a.color, (v) => { a.color = v; Studio.touch(); Studio.renderAll(); })));
    props.appendChild(field('Default verb', select(['talk', 'look', 'use'], a.default || 'talk', (v) => { a.default = v; Studio.touch(); })));
    const mkPlayer = el('<button class="small">Make this the player character</button>');
    mkPlayer.addEventListener('click', () => { P.player = id; Studio.touch(); Studio.renderAll(); });
    props.appendChild(field('', mkPlayer));
    pane.appendChild(props);

    pane.appendChild(el('<h3>Animations</h3>'));
    pane.appendChild(el('<div class="hint">Standard names: <b>idle idleR idleL idleU idleD walkR walkL walkU walkD talk</b>. Use ref+flip to mirror (walkL = flipped walkR).</div>'));
    const anims = el('<div class="list"></div>');
    const spr = P.sprites[a.sprite] || { frames: {} };
    const frameNames = Object.keys(spr.frames);
    const renderAnims = () => {
      anims.innerHTML = '';
      for (const [an, d] of Object.entries(a.anims || {})) {
        const row = el(`<div class="list-row"><b style="width:56px">${an}</b></div>`);
        if (d.ref !== undefined) {
          row.appendChild(el(`<span class="dim grow">mirror of ${d.ref}</span>`));
        } else {
          const fIn = text((d.frames || []).join(' '), (v) => { d.frames = v.split(/\s+/).filter(Boolean); Studio.touch(); });
          fIn.style.flex = '1';
          fIn.title = 'space-separated frame names: ' + frameNames.join(', ');
          row.appendChild(fIn);
          const fps = num(d.fps, (v) => { d.fps = v; Studio.touch(); });
          fps.style.width = '52px'; fps.title = 'fps';
          row.appendChild(fps);
        }
        const del = el('<button class="small danger">✕</button>');
        del.addEventListener('click', () => { delete a.anims[an]; Studio.touch(); renderAnims(); });
        row.appendChild(del);
        anims.appendChild(row);
      }
    };
    renderAnims();
    pane.appendChild(anims);
    const addA = el('<div class="row"></div>');
    const nameIn = text('', () => { });
    nameIn.placeholder = 'anim name (e.g. walkR)';
    const addBtn = el('<button class="small">+ Add animation</button>');
    addBtn.addEventListener('click', () => { const n = nameIn.value.trim(); if (!n) return; a.anims[n] = { frames: [frameNames[0] || ''], fps: 8 }; Studio.touch(); renderAnims(); });
    const addMir = el('<button class="small">+ Add mirrored (ref)</button>');
    addMir.addEventListener('click', () => { const n = nameIn.value.trim(); if (!n) return; a.anims[n] = { ref: Object.keys(a.anims)[0] || 'idle', flip: true }; Studio.touch(); Studio.renderAll(); });
    addA.appendChild(nameIn); addA.appendChild(addBtn); addA.appendChild(addMir);
    pane.appendChild(addA);

    pane.appendChild(el('<h3>Verb scripts (talk to, look at, give X…)</h3>'));
    pane.appendChild(Studio.verbsEditor(a, 'verbs', 'actor ' + id));
    editor.appendChild(pane);

    // preview
    insp.appendChild(el('<h2>Preview</h2>'));
    const img = frameNames.length ? Grog.rasterFrame(P, a.sprite, frameNames[0]) : null;
    if (img) {
      const c = el(`<canvas class="pixelated" width="${img.width}" height="${img.height}" style="width:${img.width * 5}px;background:#111;border:1px solid var(--line)"></canvas>`);
      c.getContext('2d').drawImage(img, 0, 0);
      insp.appendChild(c);
    }
    insp.appendChild(el(`<div class="hint" style="margin-top:8px">Speech preview: <span style="color:${Grog.color(Grog.colorIndex(a.color))}">“${a.name || id} says things in this color.”</span></div>`));
  };

  // ---------- item editor ----------
  Studio.editors.item = function (editor, insp, id) {
    const P = Studio.state.project;
    const it = P.items[id];
    if (!it) return;
    const pane = el('<div></div>');
    pane.appendChild(el(`<h2>Item: ${id}</h2>`));
    const props = el('<div class="panel"></div>');
    props.appendChild(field('Name', text(it.name, (v) => { it.name = v; Studio.touch(); })));
    props.appendChild(field('Icon sprite', select([''].concat(Object.keys(P.sprites)), it.icon || '', (v) => { it.icon = v; Studio.touch(); Studio.renderAll(); })));
    pane.appendChild(props);
    pane.appendChild(el('<h3>Verb scripts</h3>'));
    pane.appendChild(el('<div class="hint">“look” runs when the player examines it. “use otherItem” handles combining. To handle “use THIS on a hotspot”, add a “use ' + id + '” handler on that hotspot.</div>'));
    pane.appendChild(Studio.verbsEditor(it, 'verbs', 'item ' + id));
    editor.appendChild(pane);
    if (it.icon && P.sprites[it.icon]) {
      insp.appendChild(el('<h2>Icon</h2>'));
      const f = Object.keys(P.sprites[it.icon].frames)[0];
      const img = Grog.rasterFrame(P, it.icon, f);
      if (img) {
        const c = el(`<canvas class="pixelated" width="${img.width}" height="${img.height}" style="width:${img.width * 6}px;background:#222;border:1px solid var(--line)"></canvas>`);
        c.getContext('2d').drawImage(img, 0, 0);
        insp.appendChild(c);
      }
    }
  };

  // ---------- dialog editor ----------
  Studio.editors.dialog = function (editor, insp, id) {
    const P = Studio.state.project;
    const d = P.dialogs[id];
    if (!d) return;
    const pane = el('<div></div>');
    pane.appendChild(el(`<h2>Dialog: ${id}</h2>`));
    const props = el('<div class="panel"></div>');
    props.appendChild(field('Start node', select(Object.keys(d.nodes), d.start, (v) => { d.start = v; Studio.touch(); })));
    pane.appendChild(props);
    for (const [nid, node] of Object.entries(d.nodes)) {
      const np = el(`<div class="panel"><h3>Node: ${nid}</h3></div>`);
      const entryBtn = el(`<button class="small">node entry actions (${(node.actions || []).length})…</button>`);
      entryBtn.addEventListener('click', () => Studio.actionModal(`${id}.${nid} entry actions`, node.actions || [], (v) => { node.actions = v; }));
      np.appendChild(entryBtn);
      const delNode = el('<button class="small danger" style="margin-left:6px">delete node</button>');
      delNode.addEventListener('click', () => { delete d.nodes[nid]; Studio.touch(); Studio.renderAll(); });
      np.appendChild(delNode);
      np.appendChild(el('<h3 style="margin-top:10px">Options</h3>'));
      (node.options || []).forEach((o, i) => {
        const row = el('<div class="act-row"></div>');
        const t = text(o.text, (v) => { o.text = v; Studio.touch(); }, { wide: true });
        t.className = 'wide';
        row.appendChild(t);
        row.appendChild(el('<label style="min-width:0">→</label>'));
        row.appendChild(select([''].concat(Object.keys(d.nodes)), o.next || '', (v) => { if (v) o.next = v; else delete o.next; Studio.touch(); }));
        const onceL = el('<label style="min-width:0">once</label>');
        onceL.prepend(check(o.once, (v) => { if (v) o.once = true; else delete o.once; Studio.touch(); }));
        row.appendChild(onceL);
        const endL = el('<label style="min-width:0">end</label>');
        endL.prepend(check(o.end, (v) => { if (v) o.end = true; else delete o.end; Studio.touch(); }));
        row.appendChild(endL);
        const condIn = text(o.cond, (v) => { if (v) o.cond = v; else delete o.cond; Studio.touch(); });
        condIn.placeholder = 'condition';
        condIn.style.width = '110px';
        row.appendChild(condIn);
        const actBtn = el(`<button class="small">actions (${(o.actions || []).length})…</button>`);
        actBtn.addEventListener('click', () => Studio.actionModal(`option “${(o.text || '').slice(0, 40)}”`, o.actions || [], (v) => { o.actions = v; }));
        row.appendChild(actBtn);
        const mini = el('<div class="mini"></div>');
        const del = el('<button class="small danger">✕</button>');
        del.addEventListener('click', () => { node.options.splice(i, 1); Studio.touch(); Studio.renderAll(); });
        mini.appendChild(del);
        row.appendChild(mini);
        np.appendChild(row);
      });
      const addO = el('<button class="small">+ Add option</button>');
      addO.addEventListener('click', () => { node.options = node.options || []; node.options.push({ text: 'New option', actions: [] }); Studio.touch(); Studio.renderAll(); });
      np.appendChild(addO);
      pane.appendChild(np);
    }
    const addN = el('<button>+ Add node</button>');
    addN.addEventListener('click', () => Studio.prompt('Node id', '', (v) => { d.nodes[v] = { options: [] }; Studio.touch(); Studio.renderAll(); }, Studio.idValidate(d.nodes)));
    pane.appendChild(addN);
    editor.appendChild(pane);
    insp.appendChild(el('<div class="hint">Options show in the SCUMM-style chooser. The player says the option text (uncheck by adding <b>"silent": true</b> via JSON). <b>once</b> hides an option after use; <b>cond</b> gates it on flags; <b>end</b> closes the dialog; <b>→</b> jumps to another node.</div>'));
  };

  // ---------- script editor ----------
  Studio.editors.script = function (editor, insp, id) {
    const P = Studio.state.project;
    const s = P.scripts[id];
    if (!s) return;
    const pane = el('<div></div>');
    pane.appendChild(el(`<h2>Script: ${id}</h2>`));
    pane.appendChild(el('<div class="hint">Reusable action list. Run it from any other script with <b>call</b>. A script named <b>$intro</b> runs at game start.</div>'));
    pane.appendChild(Studio.actionEditor(s, null));
    editor.appendChild(pane);
  };

  // ---------- music editor ----------
  Studio.editors.music = function (editor, insp, id) {
    const P = Studio.state.project;
    const m = P.music[id];
    if (!m) return;
    const pane = el('<div></div>');
    pane.appendChild(el(`<h2>Music: ${id}</h2>`));
    const props = el('<div class="panel"></div>');
    props.appendChild(field('BPM', num(m.bpm, (v) => { m.bpm = v; Studio.touch(); })));
    props.appendChild(field('Steps/beat', num(m.steps, (v) => { m.steps = v; Studio.touch(); })));
    const playBtn = el('<button class="primary">▶ Play</button>');
    const stopBtn = el('<button>■ Stop</button>');
    Studio._audio = Studio._audio || new Grog.Audio();
    playBtn.addEventListener('click', () => { Studio._audio.stopMusic(); Studio._audio.playMusic(m, id + Math.random()); Studio._audio.unlock(); });
    stopBtn.addEventListener('click', () => Studio._audio.stopMusic());
    const pr = el('<div class="row"></div>');
    pr.appendChild(playBtn); pr.appendChild(stopBtn);
    props.appendChild(pr);
    pane.appendChild(props);
    pane.appendChild(el('<h3>Tracks</h3>'));
    pane.appendChild(el('<div class="hint">Notes: <b>C4 D#4 Eb3</b>… · <b>.</b> rest · <b>-</b> hold previous · <b>x</b> noise hit · <b>|</b> ignored (bar marker). Each token is one step.</div>'));
    (m.tracks || []).forEach((tr, i) => {
      const tp = el('<div class="panel"></div>');
      const head = el('<div class="row"></div>');
      head.appendChild(field('Wave', select(['square', 'triangle', 'sawtooth', 'sine', 'noise'], tr.wave, (v) => { tr.wave = v; Studio.touch(); })));
      const vol = num(tr.vol, (v) => { tr.vol = v; Studio.touch(); });
      vol.step = '0.01';
      head.appendChild(field('Vol', vol));
      const del = el('<button class="small danger">✕ track</button>');
      del.addEventListener('click', () => { m.tracks.splice(i, 1); Studio.touch(); Studio.renderAll(); });
      head.appendChild(del);
      tp.appendChild(head);
      const ta = el('<textarea class="code" style="width:100%;height:64px"></textarea>');
      ta.value = tr.notes || '';
      ta.addEventListener('change', () => { tr.notes = ta.value; Studio.touch(); });
      tp.appendChild(ta);
      pane.appendChild(tp);
    });
    const addT = el('<button>+ Add track</button>');
    addT.addEventListener('click', () => { m.tracks.push({ wave: 'triangle', vol: 0.15, notes: 'C3 . . . G2 . . .' }); Studio.touch(); Studio.renderAll(); });
    pane.appendChild(addT);
    editor.appendChild(pane);
  };

  // ---------- settings ----------
  Studio.editors.settings = function (editor, insp) {
    const P = Studio.state.project;
    const pane = el('<div></div>');
    pane.appendChild(el('<h2>Project settings</h2>'));
    const meta = el('<div class="panel"></div>');
    meta.appendChild(field('Title', text(P.meta.title, (v) => { P.meta.title = v; Studio.touch(); })));
    meta.appendChild(field('Author', text(P.meta.author, (v) => { P.meta.author = v; Studio.touch(); })));
    meta.appendChild(field('Version', text(P.meta.version, (v) => { P.meta.version = v; Studio.touch(); })));
    meta.appendChild(field('Text speed', num(P.meta.textSpeed, (v) => { P.meta.textSpeed = v; Studio.touch(); })));
    meta.appendChild(field('Player actor', select(Object.keys(P.actors), P.player, (v) => { P.player = v; Studio.touch(); })));
    const st = P.meta.start || {};
    const startRow = el('<div class="row"><label>Start</label></div>');
    startRow.appendChild(select(Object.keys(P.rooms), st.room, (v) => { P.meta.start.room = v; Studio.touch(); }));
    startRow.appendChild(num(st.x, (v) => { P.meta.start.x = v; Studio.touch(); }));
    startRow.appendChild(num(st.y, (v) => { P.meta.start.y = v; Studio.touch(); }));
    meta.appendChild(startRow);
    pane.appendChild(meta);
    const adv = el('<div class="panel"><h3>Advanced</h3></div>');
    for (const [label, key] of [['Verb set (empty = classic 9)', 'verbs'], ['Default responses', 'defaults'], ['Initial flags', 'flags'], ['Initial vars', 'vars'], ['Custom sounds', 'sounds']]) {
      const b = el(`<button style="margin:3px 4px 3px 0">${label}…</button>`);
      b.addEventListener('click', () => Studio.jsonModal(label, P[key] || (key === 'verbs' ? Grog.DEFAULT_VERBS : {}), (v) => { P[key] = v; }));
      adv.appendChild(b);
    }
    pane.appendChild(adv);
    editor.appendChild(pane);
    insp.appendChild(el('<div class="hint">The classic verb set is used unless you override it. Verb format: {"id","label","key","prep"} — a verb with a “prep” (Use…with, Give…to) can take two nouns.</div>'));
  };
})();
