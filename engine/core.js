/* Grog Engine — core: namespace, palette, state, main loop, input, rooms, saves.
   Zero dependencies. Files extend Grog.Engine.prototype and are concatenation-safe. */
(function () {
  'use strict';
  const Grog = (window.Grog = window.Grog || {});

  Grog.VERSION = '1.0.0';

  // DawnBringer-32 palette. Sprite/paint color indices: 0-9 then a-v. '.' = transparent.
  Grog.PALETTE = [
    '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a',
    '#fbf236', '#99e550', '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39', '#3f3f74',
    '#306082', '#5b6ee1', '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
    '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba', '#8f974a', '#8a6f30',
  ];
  Grog.COLOR_CHARS = '0123456789abcdefghijklmnopqrstuv';
  Grog.colorIndex = (ch) => Grog.COLOR_CHARS.indexOf(ch);
  Grog.color = (i) => Grog.PALETTE[i] || '#ff00ff';

  // Native room/view geometry (SCUMM-style 320x200: room 320x144, UI below).
  Grog.W = 320;
  Grog.H = 200;
  Grog.VIEW_H = 144;      // room viewport height
  Grog.SENT_Y = 145;      // sentence line
  Grog.UI_Y = 156;        // verb/inventory area top
  Grog.TEXT_SCALE = 2;    // text layer runs at 2x for readability

  // Deterministic RNG (mulberry32) for seeded paint scatter etc.
  Grog.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  Grog.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  Grog.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  Grog.pointInPoly = function (x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  Grog.Engine = class Engine {
    constructor(project, container, opts = {}) {
      this.project = project;
      this.opts = opts;
      this.container = typeof container === 'string' ? document.querySelector(container) : container;

      // --- runtime state (what gets saved) ---
      this.state = {
        flags: Object.assign({}, project.flags || {}),
        vars: Object.assign({}, project.vars || {}),
        inventory: [],
        room: null,
        rooms: {},        // per-room overrides: { hotspotId: {hidden,state}, actors:{id:{x,y,dir,hidden}} }
        dialogOnce: {},    // used dialog options
        actorRooms: {},    // actorId -> roomId placement overrides
        playtime: 0,
      };

      // --- transient ---
      this.actors = {};       // live actor objects
      this.room = null;       // current room def
      this.camera = { x: 0 };
      this.cutscenes = 0;     // >0 = input locked to script
      this.hover = null;      // hovered hotspot/actor/item descriptor
      this.verb = null;       // selected verb id
      this.heldItem = null;   // first noun for use/give sentences
      this.sentence = '';
      this.dialog = null;     // active dialog ui state
      this.speech = [];       // active speech bubbles [{actorId,text,color,until,x,y}]
      this.menu = null;       // save/load overlay state
      this.toast = null;      // transient message
      this.fade = { v: 0, target: 0, speed: 0 }; // 0 = visible, 1 = black
      this.mouse = { x: 0, y: 0, inView: false };
      this.time = 0;
      this._acc = 0;
      this._saveKey = 'grog_' + (project.meta && project.meta.title || 'game').replace(/\W+/g, '_').toLowerCase();
      this._ended = false;

      this._buildDom();
      this._bindInput();
      this.audio = new Grog.Audio();
      this._initVerbs();
    }

    _buildDom() {
      const c = this.container;
      c.innerHTML = '';
      c.style.position = 'relative';
      c.style.background = '#000';
      c.style.overflow = 'hidden';
      c.style.cursor = 'none';
      c.style.userSelect = 'none';
      // low-res game layer
      this.cv = document.createElement('canvas');
      this.cv.width = Grog.W; this.cv.height = Grog.H;
      this.ctx = this.cv.getContext('2d');
      // 2x text/UI overlay layer
      this.tv = document.createElement('canvas');
      this.tv.width = Grog.W * Grog.TEXT_SCALE; this.tv.height = Grog.H * Grog.TEXT_SCALE;
      this.tctx = this.tv.getContext('2d');
      // composited display canvas
      this.dv = document.createElement('canvas');
      this.dv.style.position = 'absolute';
      this.dv.style.left = '50%'; this.dv.style.top = '50%';
      this.dv.style.transform = 'translate(-50%,-50%)';
      this.dv.style.imageRendering = 'pixelated';
      this.dctx = this.dv.getContext('2d');
      c.appendChild(this.dv);
      // offscreen room buffer (rooms can be wider than the view: scrolling)
      this.rv = document.createElement('canvas');
      this.rctx = this.rv.getContext('2d');
      this._resize();
      this._onResize = () => this._resize();
      window.addEventListener('resize', this._onResize);
    }

    _resize() {
      const cw = this.container.clientWidth || Grog.W, ch = this.container.clientHeight || Grog.H;
      const s = Math.max(1, Math.floor(Math.min(cw / Grog.W, ch / Grog.H)));
      const fit = Math.min(cw / Grog.W, ch / Grog.H);
      this.scale = fit >= 1 ? s : fit; // integer scale when possible, shrink-to-fit otherwise
      this.dv.width = Math.round(Grog.W * this.scale * Grog.TEXT_SCALE) / Grog.TEXT_SCALE * 1; // keep simple
      this.dv.width = Grog.W * Grog.TEXT_SCALE;
      this.dv.height = Grog.H * Grog.TEXT_SCALE;
      this.dv.style.width = Math.round(Grog.W * this.scale) + 'px';
      this.dv.style.height = Math.round(Grog.H * this.scale) + 'px';
    }

    _bindInput() {
      const toNative = (e) => {
        const r = this.dv.getBoundingClientRect();
        return {
          x: Grog.clamp(((e.clientX - r.left) / r.width) * Grog.W, 0, Grog.W - 1),
          y: Grog.clamp(((e.clientY - r.top) / r.height) * Grog.H, 0, Grog.H - 1),
        };
      };
      this.dv.addEventListener('mousemove', (e) => {
        const p = toNative(e);
        this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.inView = p.y < Grog.VIEW_H;
      });
      this.dv.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const p = toNative(e);
        this.mouse.x = p.x; this.mouse.y = p.y;
        this.onClick(p.x, p.y, e.button === 2);
      });
      this.dv.addEventListener('contextmenu', (e) => e.preventDefault());
      this._onKey = (e) => this.onKey(e);
      window.addEventListener('keydown', this._onKey);
    }

    destroy() {
      this._ended = true;
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('keydown', this._onKey);
      if (this.audio) this.audio.stopMusic();
      cancelAnimationFrame(this._raf);
    }

    // ---------- lifecycle ----------
    async start() {
      const meta = this.project.meta || {};
      this._makeActors();
      const start = meta.start || {};
      await this.gotoRoom(start.room || Object.keys(this.project.rooms)[0], start.x, start.y, { instant: true });
      this._last = performance.now();
      const loop = (t) => {
        if (this._ended) return;
        const dt = Math.min(0.1, (t - this._last) / 1000);
        this._last = t;
        this.update(dt);
        this.render();
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
      // intro script
      if (this.project.scripts && this.project.scripts.$intro) this.runScript(this.project.scripts.$intro);
    }

    _makeActors() {
      const P = this.project;
      for (const id in P.actors || {}) {
        const def = P.actors[id];
        this.actors[id] = {
          id, def,
          x: 0, y: 0, dir: 'D',
          scale: 1, roomId: null, hidden: false,
          anim: 'idle', frame: 0, ftime: 0,
          path: null, pathI: 0, speed: def.speed || 42,
          talking: false, walkResolve: null,
        };
      }
      this.playerId = P.player || Object.keys(P.actors || {})[0];
    }

    player() { return this.actors[this.playerId]; }

    update(dt) {
      this.time += dt;
      this.state.playtime += dt;
      this.updateWalks(dt);
      this.updateAnims(dt);
      this.updateSpeech();
      this.updateHover();
      // fade
      if (this.fade.v !== this.fade.target) {
        const d = Math.sign(this.fade.target - this.fade.v) * this.fade.speed * dt;
        this.fade.v = Grog.clamp(this.fade.v + d, 0, 1);
      }
      // camera follows player
      const room = this.room;
      if (room) {
        const rw = room.w || Grog.W;
        if (rw > Grog.W) {
          const p = this.player();
          if (p && p.roomId === this.state.room) {
            const target = Grog.clamp(p.x - Grog.W / 2, 0, rw - Grog.W);
            this.camera.x += (target - this.camera.x) * Math.min(1, dt * 4);
          }
        } else this.camera.x = 0;
      }
    }

    // ---------- rooms ----------
    roomState(roomId) {
      const rs = this.state.rooms;
      if (!rs[roomId]) rs[roomId] = { hotspots: {}, actors: {} };
      return rs[roomId];
    }
    hotspotState(roomId, hid) {
      const rs = this.roomState(roomId);
      if (!rs.hotspots[hid]) rs.hotspots[hid] = {};
      return rs.hotspots[hid];
    }
    hotspotVisible(h) {
      const hs = this.hotspotState(this.state.room, h.id);
      if (hs.hidden !== undefined) return !hs.hidden;
      return !h.hidden;
    }
    hotspotCurState(h) {
      const hs = this.hotspotState(this.state.room, h.id);
      return hs.state !== undefined ? hs.state : h.state;
    }

    async gotoRoom(roomId, x, y, opts = {}) {
      const P = this.project;
      const room = P.rooms[roomId];
      if (!room) { console.warn('No room', roomId); return; }
      if (!opts.instant) await this.fadeTo(1, 2.5);
      this.state.room = roomId;
      this.room = room;
      this.camera.x = 0;
      this.speech = [];
      this.buildWalkGrid(room);
      this.prerenderRoom(room);
      // place actors that belong to this room
      for (const id in this.actors) {
        const a = this.actors[id];
        const override = this.state.actorRooms[id];
        const placed = (room.actors || {})[id];
        const inRoom = override !== undefined ? override === roomId : !!placed;
        a.roomId = inRoom ? roomId : (override !== undefined ? override : a.roomId === roomId ? null : a.roomId);
        if (inRoom && placed && !a._moved) { a.x = placed.x; a.y = placed.y; a.dir = placed.dir || 'D'; }
        const ast = this.roomState(roomId).actors[id];
        if (ast) { if (ast.x !== undefined) { a.x = ast.x; a.y = ast.y; } if (ast.hidden !== undefined) a.hidden = ast.hidden; }
      }
      // player placement
      const p = this.player();
      if (p) {
        p.roomId = roomId;
        this.state.actorRooms[this.playerId] = roomId;
        if (x !== undefined) { p.x = x; p.y = y; }
        p.path = null; p.anim = 'idle'; p.frame = 0;
        if (opts.dir) p.dir = opts.dir;
        p.scale = this.scaleAt(p.y);
      }
      if (room.music !== undefined) this.audio.playMusic(room.music ? (P.music || {})[room.music] : null, room.music);
      if (!opts.instant) await this.fadeTo(0, 2.5);
      if (room.enter && !opts.noEnter) await this.runScript(room.enter);
    }

    fadeTo(target, speed) {
      this.fade.target = target; this.fade.speed = speed || 2.5;
      return new Promise((res) => {
        const check = () => {
          if (this._ended || this.fade.v === this.fade.target) return res();
          requestAnimationFrame(check);
        };
        check();
      });
    }

    // ---------- saves ----------
    saveSlots() {
      const out = [];
      for (let i = 0; i < 3; i++) {
        try {
          const raw = localStorage.getItem(this._saveKey + '_' + i);
          out.push(raw ? JSON.parse(raw).meta : null);
        } catch (e) { out.push(null); }
      }
      return out;
    }
    saveGame(slot) {
      const p = this.player();
      const data = {
        meta: { when: Date.now(), room: this.room ? this.room.name : '', playtime: Math.round(this.state.playtime) },
        state: this.state,
        player: p ? { x: p.x, y: p.y, dir: p.dir } : null,
      };
      try { localStorage.setItem(this._saveKey + '_' + slot, JSON.stringify(data)); this.showToast('Game saved.'); }
      catch (e) { this.showToast('Save failed: ' + e.message); }
    }
    async loadGame(slot) {
      let data;
      try { data = JSON.parse(localStorage.getItem(this._saveKey + '_' + slot)); } catch (e) { }
      if (!data) { this.showToast('Empty slot.'); return; }
      this.state = data.state;
      this.state.rooms = this.state.rooms || {};
      this.menu = null; this.dialog = null; this.speech = []; this.cutscenes = 0;
      this.clearSentence();
      await this.gotoRoom(this.state.room, data.player && data.player.x, data.player && data.player.y, { instant: true, noEnter: true });
      if (data.player) this.player().dir = data.player.dir;
      this.showToast('Game loaded.');
    }

    showToast(text) { this.toast = { text, until: this.time + 2.2 }; }
  };
})();
