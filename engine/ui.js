/* Grog Engine — ui: verbs, sentence line, inventory, dialogs, menu, cursor, input. */
(function () {
  'use strict';
  const Grog = window.Grog;
  const E = Grog.Engine.prototype;

  Grog.DEFAULT_VERBS = [
    { id: 'give', label: 'Give', key: 'g', prep: 'to' },
    { id: 'pickup', label: 'Pick up', key: 'p' },
    { id: 'use', label: 'Use', key: 'u', prep: 'with' },
    { id: 'open', label: 'Open', key: 'o' },
    { id: 'look', label: 'Look at', key: 'l' },
    { id: 'push', label: 'Push', key: 's' },
    { id: 'close', label: 'Close', key: 'c' },
    { id: 'talk', label: 'Talk to', key: 't' },
    { id: 'pull', label: 'Pull', key: 'y' },
  ];

  E._initVerbs = function () {
    this.verbs = this.project.verbs && this.project.verbs.length ? this.project.verbs : Grog.DEFAULT_VERBS;
    this.invScroll = 0;
  };

  E.verbById = function (id) { return this.verbs.find((v) => v.id === id); };

  E.clearSentence = function () { this.verb = null; this.heldItem = null; };

  // ---------- hover ----------
  E.updateHover = function () {
    this.hover = null;
    this._hits = [];
    const locked = this.cutscenes > 0;
    // UI hit regions (recomputed every frame; used by render + click)
    if (!locked && !this.dialog && !this.menu) this._layoutUI();
    if (this.menu || this.dialog) return;
    if (locked) return;
    if (this.mouse.y < Grog.VIEW_H && this.room) {
      const rx = this.mouse.x + Math.round(this.camera.x), ry = this.mouse.y;
      // actors first (but never the player)
      for (const id in this.actors) {
        if (id === this.playerId) continue;
        const a = this.actors[id];
        if (a.roomId !== this.state.room || a.hidden) continue;
        const img = this._actorImg(a);
        if (!img) continue;
        const w = img.width * (a.scale || 1), h = img.height * (a.scale || 1);
        if (rx >= a.x - w / 2 && rx <= a.x + w / 2 && ry >= a.y - h && ry <= a.y) {
          this.hover = { type: 'actor', id, name: a.def.name || id, default: (a.def.default || 'talk') };
          return;
        }
      }
      let best = null, bestArea = Infinity;
      for (const h of this.room.hotspots || []) {
        if (!this.hotspotVisible(h)) continue;
        let hit = false, area = Infinity;
        if (h.rect) {
          hit = rx >= h.rect[0] && rx <= h.rect[0] + h.rect[2] && ry >= h.rect[1] && ry <= h.rect[1] + h.rect[3];
          area = h.rect[2] * h.rect[3];
        } else if (h.poly) {
          hit = Grog.pointInPoly(rx, ry, h.poly);
          let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
          for (let i = 0; i < h.poly.length; i += 2) {
            minX = Math.min(minX, h.poly[i]); maxX = Math.max(maxX, h.poly[i]);
            minY = Math.min(minY, h.poly[i + 1]); maxY = Math.max(maxY, h.poly[i + 1]);
          }
          area = (maxX - minX) * (maxY - minY);
        }
        // most specific (smallest) hotspot wins on overlap
        if (hit && area <= bestArea) { best = h; bestArea = area; }
      }
      if (best) this.hover = { type: 'hotspot', h: best, name: this.hotspotName(best), default: best.default || 'look' };
    } else {
      // UI area: verbs & inventory hover handled via _hits in render/click
      for (const hit of this._hits) {
        if (this.mouse.x >= hit.x && this.mouse.x < hit.x + hit.w && this.mouse.y >= hit.y && this.mouse.y < hit.y + hit.h) {
          if (hit.type === 'item') this.hover = { type: 'item', id: hit.id, name: (this.project.items[hit.id] || {}).name || hit.id, default: 'look' };
        }
      }
    }
  };

  // ---------- UI layout ----------
  const V_X = 2, V_Y = 158, V_W = 56, V_H = 14;
  const I_X = 180, I_Y = 158, I_W = 33, I_H = 20, I_COLS = 4, I_ROWS = 2;

  E._layoutUI = function () {
    this._hits = [];
    this.verbs.forEach((v, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      this._hits.push({ x: V_X + col * V_W, y: V_Y + row * V_H, w: V_W - 2, h: V_H - 1, type: 'verb', id: v.id });
    });
    const inv = this.state.inventory;
    const perPage = I_COLS * I_ROWS;
    const maxScroll = Math.max(0, Math.ceil(inv.length / I_COLS) - I_ROWS);
    this.invScroll = Grog.clamp(this.invScroll, 0, maxScroll);
    for (let i = 0; i < perPage; i++) {
      const idx = this.invScroll * I_COLS + i;
      if (idx >= inv.length) break;
      const col = i % I_COLS, row = Math.floor(i / I_COLS);
      this._hits.push({ x: I_X + col * I_W, y: I_Y + row * I_H, w: I_W - 2, h: I_H - 2, type: 'item', id: inv[idx] });
    }
    if (maxScroll > 0) {
      this._hits.push({ x: I_X - 12, y: I_Y, w: 10, h: 18, type: 'scroll', dir: -1 });
      this._hits.push({ x: I_X - 12, y: I_Y + 20, w: 10, h: 18, type: 'scroll', dir: 1 });
    }
    this._hits.push({ x: Grog.W - 16, y: Grog.H - 57, w: 14, h: 12, type: 'menu' });
  };

  // ---------- drawing ----------
  E.drawUIPanels = function (ctx) {
    if (this.dialog) {
      ctx.fillStyle = '#1a1626';
      ctx.fillRect(0, Grog.VIEW_H, Grog.W, Grog.H - Grog.VIEW_H);
      return;
    }
    ctx.fillStyle = '#1a1626';
    ctx.fillRect(0, Grog.VIEW_H, Grog.W, Grog.H - Grog.VIEW_H);
    ctx.fillStyle = '#0e0c16';
    ctx.fillRect(0, Grog.VIEW_H, Grog.W, 1);
    if (this.cutscenes > 0) return;
    // inventory cells + icons (low-res so icons stay chunky)
    const inv = this.state.inventory;
    for (const hit of this._hits || []) {
      if (hit.type === 'item') {
        ctx.fillStyle = '#222034';
        ctx.fillRect(hit.x, hit.y, hit.w, hit.h);
        const item = this.project.items[hit.id];
        if (item && item.icon) {
          const img = Grog.rasterFrame(this.project, item.icon, item.frame || Object.keys((this.project.sprites[item.icon] || { frames: {} }).frames)[0]);
          if (img) {
            const s = Math.min((hit.w - 2) / img.width, (hit.h - 2) / img.height, 2);
            const w = Math.max(1, Math.floor(img.width * s)), hh = Math.max(1, Math.floor(img.height * s));
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, hit.x + Math.floor((hit.w - w) / 2), hit.y + Math.floor((hit.h - hh) / 2), w, hh);
          }
        }
      } else if (hit.type === 'scroll') {
        ctx.fillStyle = '#222034';
        ctx.fillRect(hit.x, hit.y, hit.w, hit.h);
      }
    }
  };

  E.drawUIText = function () {
    const hoverHit = (h) => this.mouse.x >= h.x && this.mouse.x < h.x + h.w && this.mouse.y >= h.y && this.mouse.y < h.y + h.h;

    // dialog options replace the whole UI zone
    if (this.dialog) {
      this.dialog.hover = -1;
      this.dialog.options.forEach((o, i) => {
        const y = Grog.VIEW_H + 4 + i * 10;
        const hov = this.mouse.y >= y - 1 && this.mouse.y < y + 9;
        if (hov) this.dialog.hover = i;
        this.text((hov ? '▸ ' : '  ') + o.opt.text, 6, y, { color: hov ? '#fbf236' : '#99e550', small: true });
      });
      this.drawCursorOnly = false;
      return;
    }
    if (this.cutscenes > 0) return;

    // sentence line
    let sent;
    if (this.verb || this.heldItem) {
      const v = this.verbById(this.verb) || { label: 'Use' };
      sent = v.label;
      if (this.heldItem) {
        sent += ' ' + ((this.project.items[this.heldItem] || {}).name || this.heldItem) + ' ' + (v.prep || 'with');
      }
      if (this.hover && !(this.hover.type === 'item' && this.hover.id === this.heldItem)) sent += ' ' + this.hover.name;
    } else {
      sent = this.hover ? 'Walk to ' + this.hover.name : 'Walk to';
      if (this.hover && this.hover.type !== 'hotspot' || (this.hover && this.hover.type === 'hotspot')) {
        // right-click default hint shown via highlight color only
      }
    }
    this.text(sent, Grog.W / 2, Grog.VIEW_H + 3, { align: 'center', color: '#5fcde4', small: true });

    // verb buttons
    for (const hit of this._hits || []) {
      if (hit.type === 'verb') {
        const v = this.verbById(hit.id);
        const active = this.verb === hit.id;
        const hov = hoverHit(hit);
        this.text(v.label, hit.x + 2, hit.y + 2, { color: active ? '#fbf236' : hov ? '#cbdbfc' : '#639bff', small: true });
      } else if (hit.type === 'scroll') {
        this.text(hit.dir < 0 ? '▲' : '▼', hit.x + 2, hit.y + 5, { color: '#639bff', small: true });
      } else if (hit.type === 'menu') {
        this.text('☰', hit.x + 1, hit.y + 1, { color: hoverHit(hit) ? '#fbf236' : '#639bff', small: true });
      } else if (hit.type === 'item' && hoverHit(hit)) {
        // name shown in sentence line via hover
      }
    }
  };

  E.drawMenu = function () {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, Grog.W, Grog.H);
    this._hits = [];
    const cx = Grog.W / 2;
    this.text((this.project.meta && this.project.meta.title) || 'Grog', cx, 18, { align: 'center', color: '#fbf236' });
    const slots = this.saveSlots();
    let y = 44;
    const addBtn = (label, data, color) => {
      const w = 200, x = cx - w / 2;
      const hov = this.mouse.x >= x && this.mouse.x <= x + w && this.mouse.y >= y - 2 && this.mouse.y < y + 9;
      this.text(label, cx, y, { align: 'center', color: hov ? '#fbf236' : color || '#cbdbfc', small: true });
      this._hits.push({ x, y: y - 2, w, h: 11, type: 'menubtn', data });
      y += 13;
    };
    for (let i = 0; i < 3; i++) {
      const s = slots[i];
      const label = s ? `Slot ${i + 1}: ${s.room} (${Math.floor(s.playtime / 60)}m)` : `Slot ${i + 1}: — empty —`;
      addBtn((this.menu.mode === 'save' ? 'Save → ' : 'Load ← ') + label, { slot: i });
    }
    y += 4;
    addBtn(this.menu.mode === 'save' ? '[ Switch to Load ]' : '[ Switch to Save ]', { switch: true }, '#99e550');
    addBtn(this.audio.musicOn ? 'Music: ON' : 'Music: OFF', { music: true }, '#99e550');
    addBtn(this.audio.soundOn ? 'Sound: ON' : 'Sound: OFF', { sound: true }, '#99e550');
    addBtn('[ Back to game ]', { close: true }, '#d95763');
    this.text('F5 opens this menu anytime', cx, Grog.H - 14, { align: 'center', color: '#847e87', small: true });
  };

  E.drawCursor = function () {
    const x = this.mouse.x, y = this.mouse.y;
    const color = this.hover ? '#fbf236' : '#cbdbfc';
    const t = this.tctx, S = Grog.TEXT_SCALE;
    t.fillStyle = '#000';
    t.fillRect((x - 4) * S - 1, y * S - 1, 8 * S + 2, S + 2);
    t.fillRect(x * S - 1, (y - 4) * S - 1, S + 2, 8 * S + 2);
    t.fillStyle = color;
    t.fillRect((x - 4) * S, y * S, 8 * S, S);
    t.fillRect(x * S, (y - 4) * S, S, 8 * S);
  };

  // ---------- input ----------
  E.onClick = async function (x, y, right) {
    this.audio.unlock();
    if (this.menu) {
      for (const hit of this._hits || []) {
        if (hit.type === 'menubtn' && x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y < hit.y + hit.h) {
          const d = hit.data;
          if (d.close) this.menu = null;
          else if (d.switch) this.menu.mode = this.menu.mode === 'save' ? 'load' : 'save';
          else if (d.music) this.audio.musicOn = !this.audio.musicOn;
          else if (d.sound) this.audio.soundOn = !this.audio.soundOn;
          else if (d.slot !== undefined) {
            if (this.menu.mode === 'save') { this.saveGame(d.slot); this.menu = null; }
            else await this.loadGame(d.slot);
          }
          return;
        }
      }
      return;
    }
    if (this.dialog) {
      if (this.dialog.hover >= 0) this.dialog.choose(this.dialog.hover);
      return;
    }
    if (this.cutscenes > 0) { this.skipSpeech(); return; }

    if (y < Grog.VIEW_H) {
      // room click
      const target = this.hover;
      if (target && (target.type === 'hotspot' || target.type === 'actor')) {
        if (right) { this._startSentence(target.default, target, null); return; }
        if (this.verb || this.heldItem) { this._startSentence(this.verb || 'use', target, this.heldItem); return; }
        this._startSentence(target.default === 'walk' ? null : null, target, null, true);
        return;
      }
      // plain walk: cancel any pending sentence walk
      this._sentenceCancelled = true;
      this.clearSentence();
      const p = this.nearestWalkable(x + Math.round(this.camera.x), Math.min(y, Grog.VIEW_H - 2));
      this.walkTo(this.playerId, p.x, p.y);
      return;
    }

    // UI click
    for (const hit of this._hits || []) {
      if (x >= hit.x && x < hit.x + hit.w && y >= hit.y && y < hit.y + hit.h) {
        if (hit.type === 'verb') { this.verb = hit.id; this.heldItem = null; return; }
        if (hit.type === 'scroll') { this.invScroll += hit.dir; return; }
        if (hit.type === 'menu') { this.menu = { mode: 'save' }; return; }
        if (hit.type === 'item') {
          const target = { type: 'item', id: hit.id };
          if (right) { this._startSentence('look', target, null); return; }
          if (this.heldItem && this.heldItem !== hit.id) { this._startSentence(this.verb || 'use', target, this.heldItem); return; }
          if (this.verb) {
            const v = this.verbById(this.verb);
            if (v && v.prep && !this.heldItem) { this.heldItem = hit.id; return; } // "Use X with ..."
            this._startSentence(this.verb, target, null);
            return;
          }
          this._startSentence('look', target, null);
          return;
        }
      }
    }
  };

  // Walk-to-target then run the verb script. Cancellable by clicking elsewhere.
  E._startSentence = async function (verbId, target, withItem, walkOnly) {
    this._sentenceCancelled = false;
    const verb = verbId;
    this.clearSentence();
    if (walkOnly && target.type === 'hotspot') {
      // click a hotspot with no verb: walk to it (its exit script may fire via 'walkto' verb)
      const h = target.h;
      const at = h.at || this._hotspotCenter(h);
      await this.walkTo(this.playerId, at[0], at[1], h.dir);
      if (this._sentenceCancelled) return;
      if (h.verbs && h.verbs.walkto) await this.runScript(h.verbs.walkto, { hotspot: h });
      return;
    }
    if (walkOnly && target.type === 'actor') {
      const a = this.actors[target.id];
      if (a) await this.walkTo(this.playerId, a.x + (a.x < this.player().x ? 16 : -16), a.y + 2);
      return;
    }
    await this.execVerb(verb || 'use', target, withItem || null);
  };

  E.onKey = function (e) {
    if (e.key === 'F5') { e.preventDefault(); this.menu = this.menu ? null : { mode: 'save' }; return; }
    if (this.menu) { if (e.key === 'Escape') this.menu = null; return; }
    if (this.dialog) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= this.dialog.options.length) this.dialog.choose(n - 1);
      return;
    }
    if (e.key === 'Escape' || e.key === '.') { this.skipSpeech(); return; }
    if (this.cutscenes > 0) return;
    for (const v of this.verbs) {
      if (v.key && e.key.toLowerCase() === v.key) { this.verb = v.id; this.heldItem = null; return; }
    }
  };
})();
