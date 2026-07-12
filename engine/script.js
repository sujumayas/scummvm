/* Grog Engine — script: action interpreter, condition expressions, verbs, dialogs. */
(function () {
  'use strict';
  const Grog = window.Grog;
  const E = Grog.Engine.prototype;
  const STOP = Symbol('stop');

  // ---------- condition expressions ----------
  // Grammar: or := and ('||' and)*   and := not ('&&' not)*   not := '!' not | prim
  // prim := '(' or ')' | has(item) | v.name cmp value | flagName
  Grog.evalCond = function (engine, src) {
    if (src === undefined || src === null || src === '' || src === true) return true;
    if (src === false) return false;
    const toks = String(src).match(/\(|\)|&&|\|\||!|==|!=|>=|<=|>|<|[A-Za-z_][\w.]*(\(\s*[\w]*\s*\))?|-?\d+(\.\d+)?|"[^"]*"|'[^']*'/g) || [];
    let i = 0;
    const peek = () => toks[i];
    const next = () => toks[i++];
    function prim() {
      const t = next();
      if (t === '(') { const v = or(); next(); return v; }
      if (t === '!') return !prim();
      let val;
      if (/^-?\d/.test(t)) val = parseFloat(t);
      else if (/^["']/.test(t)) val = t.slice(1, -1);
      else if (/^has\(/i.test(t)) val = engine.state.inventory.includes(t.replace(/^has\(\s*/i, '').replace(/\s*\)$/, ''));
      else if (t && t.startsWith('v.')) val = engine.state.vars[t.slice(2)];
      else val = !!engine.state.flags[t];
      const op = peek();
      if (['==', '!=', '>=', '<=', '>', '<'].includes(op)) {
        next();
        let rhs = next();
        if (/^-?\d/.test(rhs)) rhs = parseFloat(rhs);
        else if (/^["']/.test(rhs)) rhs = rhs.slice(1, -1);
        else if (rhs && rhs.startsWith('v.')) rhs = engine.state.vars[rhs.slice(2)];
        else rhs = !!engine.state.flags[rhs];
        switch (op) {
          case '==': return val == rhs; case '!=': return val != rhs;
          case '>=': return val >= rhs; case '<=': return val <= rhs;
          case '>': return val > rhs; case '<': return val < rhs;
        }
      }
      return !!val;
    }
    function and() { let v = prim(); while (peek() === '&&') { next(); const r = prim(); v = v && r; } return v; }
    function or() { let v = and(); while (peek() === '||') { next(); const r = and(); v = v || r; } return v; }
    try { return or(); } catch (e) { console.warn('Bad condition:', src, e); return false; }
  };

  // ---------- say ----------
  E.say = function (actorId, text, opts = {}) {
    text = String(text);
    const a = this.actors[actorId];
    const color = opts.color || (a && a.def.color ? Grog.color(Grog.colorIndex(a.def.color)) : '#fff');
    // one active line per actor: cut the previous
    for (const s of this.speech) if (s.actorId === actorId) s.until = this.time;
    const cps = (this.project.meta && this.project.meta.textSpeed) || 15; // chars/sec
    const dur = Grog.clamp(0.9 + text.length / cps, 1.4, 12);
    if (a) a.talking = true;
    return new Promise((resolve) => {
      this.speech.push({ actorId, text, color, until: this.time + dur, resolve: () => { if (a) a.talking = false; resolve(); }, offscreen: opts.offscreen });
    });
  };

  // ---------- interpreter ----------
  E.runScript = async function (actions, ctx = {}) {
    if (!actions || !actions.length) return;
    if (!ctx.free) this.cutscenes++;
    try {
      await this._run(actions, ctx);
    } catch (e) {
      if (e !== STOP) console.error('Script error:', e);
    } finally {
      if (!ctx.free) this.cutscenes = Math.max(0, this.cutscenes - 1);
    }
  };

  E._run = async function (actions, ctx) {
    for (const op of actions) {
      if (this._ended) throw STOP;
      await this._exec(op, ctx);
    }
  };

  E._resolveActor = function (op, ctx) {
    const id = op.actor || ctx.actor || this.playerId;
    return id === 'player' ? this.playerId : id;
  };

  E._exec = async function (op, ctx) {
    const P = this.project;
    switch (op.do) {
      case 'say': {
        if (op.actor === 'narrator') { await this.say('$narrator', op.text, { color: op.color || '#cbdbfc', offscreen: true }); break; }
        const id = this._resolveActor(op, ctx);
        await this.say(id, op.text, { color: op.color && Grog.color(Grog.colorIndex(op.color)) });
        break;
      }
      case 'walk': {
        const id = this._resolveActor(op, ctx);
        let x = op.x, y = op.y, dir = op.dir;
        if (op.to) {
          const h = this.findHotspot(op.to);
          if (h) { const at = h.at || this._hotspotCenter(h); x = at[0]; y = at[1]; dir = dir || h.dir; }
        }
        if (x === undefined) break;
        await this.walkTo(id, x, y, dir);
        break;
      }
      case 'face': { const a = this.actors[this._resolveActor(op, ctx)]; if (a) a.dir = op.dir || 'D'; break; }
      case 'anim': {
        const a = this.actors[this._resolveActor(op, ctx)];
        if (!a) break;
        if (op.name === null || op.name === 'none') { a.animLock = null; break; }
        a.animLock = op.name; a.frame = 0; a.ftime = 0; a.anim = op.name;
        if (op.wait) { a.animOnce = true; await new Promise((r) => (a.animResolve = r)); }
        else if (op.once) a.animOnce = true;
        break;
      }
      case 'wait': await this.sleep(op.ms || 500); break;
      case 'goto': await this.gotoRoom(op.room, op.x, op.y, { dir: op.dir }); break;
      case 'set': this.state.flags[op.flag] = op.value === undefined ? true : !!op.value; break;
      case 'var': {
        const v = this.state.vars;
        if (op.set !== undefined) v[op.name] = op.set;
        else if (op.add !== undefined) v[op.name] = (v[op.name] || 0) + op.add;
        break;
      }
      case 'give': {
        if (!this.state.inventory.includes(op.item)) this.state.inventory.push(op.item);
        if (op.silent !== true) this.audio.sfx('pickup');
        break;
      }
      case 'lose': {
        const ix = this.state.inventory.indexOf(op.item);
        if (ix >= 0) this.state.inventory.splice(ix, 1);
        if (this.heldItem === op.item) this.heldItem = null;
        break;
      }
      case 'show': case 'hide': {
        const room = op.room || this.state.room;
        this.hotspotState(room, op.hotspot).hidden = op.do === 'hide';
        if (room === this.state.room) this.markRoomDirty();
        break;
      }
      case 'state': {
        const room = op.room || this.state.room;
        this.hotspotState(room, op.hotspot).state = op.state;
        if (room === this.state.room) this.markRoomDirty();
        break;
      }
      case 'actor': {
        const a = this.actors[op.id];
        if (!a) break;
        if (op.room !== undefined) { this.state.actorRooms[op.id] = op.room; a.roomId = op.room; }
        if (op.x !== undefined) { a.x = op.x; a.y = op.y; a.path = null; }
        if (op.dir) a.dir = op.dir;
        if (op.hidden !== undefined) a.hidden = !!op.hidden;
        const rs = this.roomState(a.roomId || this.state.room);
        rs.actors[op.id] = { x: a.x, y: a.y, hidden: a.hidden };
        break;
      }
      case 'sound': this.audio.sfx(op.id, (P.sounds || {})[op.id]); break;
      case 'music': this.audio.playMusic(op.id ? (P.music || {})[op.id] : null, op.id || null); break;
      case 'dialog': await this.runDialog(op.id); break;
      case 'call': await this._run((P.scripts || {})[op.script] || [], ctx); break;
      case 'if':
        if (Grog.evalCond(this, op.cond)) await this._run(op.then || [], ctx);
        else await this._run(op.else || [], ctx);
        break;
      case 'random': {
        const lists = op.of || [];
        if (lists.length) await this._run(lists[Math.floor(Math.random() * lists.length)], ctx);
        break;
      }
      case 'shake': {
        const end = this.time + (op.ms || 400) / 1000;
        const orig = this.camera.x;
        while (this.time < end) { this.camera.x = orig + (Math.random() * 4 - 2); await this.sleep(30); }
        this.camera.x = orig;
        break;
      }
      case 'fade': {
        if (op.out) await this.fadeTo(1, op.speed || 2.5);
        else await this.fadeTo(0, op.speed || 2.5);
        break;
      }
      case 'title': {
        this.titleCard = { text: op.text || '', sub: op.sub, until: this.time + (op.ms || 2500) / 1000 };
        if (op.wait !== false) await this.sleep(op.ms || 2500);
        break;
      }
      case 'end': {
        this.state.flags.$ended = true;
        this.titleCard = { text: op.text || 'The End', sub: op.sub || 'Thanks for playing!', until: this.time + 3600 };
        this.cutscenes++; // lock input forever (until restart/load)
        break;
      }
      case 'stop': throw STOP;
      default: console.warn('Unknown command', op);
    }
  };

  E.sleep = function (ms) {
    return new Promise((res) => {
      const end = this.time + ms / 1000;
      const check = () => { if (this._ended || this.time >= end) res(); else requestAnimationFrame(check); };
      check();
    });
  };

  // ---------- hotspot helpers ----------
  E.findHotspot = function (id, roomId) {
    const room = this.project.rooms[roomId || this.state.room];
    if (!room) return null;
    return (room.hotspots || []).find((h) => h.id === id) || null;
  };
  E._hotspotCenter = function (h) {
    if (h.at) return h.at;
    if (h.rect) return [h.rect[0] + h.rect[2] / 2, Math.min(Grog.VIEW_H - 4, h.rect[1] + h.rect[3] + 2)];
    if (h.poly) {
      let sx = 0, sy = 0, n = h.poly.length / 2;
      for (let i = 0; i < h.poly.length; i += 2) { sx += h.poly[i]; sy += h.poly[i + 1]; }
      return [sx / n, Math.min(Grog.VIEW_H - 4, sy / n)];
    }
    return [Grog.W / 2, Grog.VIEW_H - 10];
  };
  E.hotspotName = function (h) {
    if (h.states) {
      const st = h.states[this.hotspotCurState(h)];
      if (st && st.name) return st.name;
    }
    return h.name || h.id;
  };

  // ---------- verb execution ----------
  // target: {type:'hotspot',h} | {type:'actor',id} | {type:'item',id}
  // withItem: inventory item id used as the first noun ("Use X with/on Y").
  E.execVerb = async function (verbId, target, withItem) {
    const P = this.project;
    let actions = null, ctxName = '';
    const tryKeys = (verbsObj, keys) => {
      if (!verbsObj) return null;
      for (const k of keys) {
        const v = verbsObj[k];
        if (!v) continue;
        // conditional variants: value may be [{cond, actions}] — pick first matching
        if (Array.isArray(v) && v.length && v[0] && v[0].cond !== undefined && v[0].actions) {
          for (const variant of v) if (Grog.evalCond(this, variant.cond)) return variant.actions;
          continue;
        }
        return v;
      }
      return null;
    };
    if (target.type === 'hotspot') {
      const h = target.h;
      ctxName = this.hotspotName(h);
      const keys = withItem ? [verbId + ' ' + withItem, verbId] : [verbId];
      // state-specific verbs override base verbs
      if (h.states) {
        const st = h.states[this.hotspotCurState(h)];
        if (st) actions = tryKeys(st.verbs, keys);
      }
      if (!actions) actions = tryKeys(h.verbs, keys);
      if (!actions && withItem) actions = tryKeys((P.items[withItem] || {}).verbs, [verbId + ' ' + h.id]);
      // walk to the hotspot first (unless script opts out with h.noWalk)
      if (!h.noWalk) {
        const at = h.at || this._hotspotCenter(h);
        await this.walkTo(this.playerId, at[0], at[1], h.dir);
        if (this._sentenceCancelled) return;
      }
    } else if (target.type === 'actor') {
      const adef = (P.actors[target.id] || {});
      ctxName = adef.name || target.id;
      const keys = withItem ? [verbId + ' ' + withItem, verbId] : [verbId];
      actions = tryKeys(adef.verbs, keys);
      if (!actions && withItem) actions = tryKeys((P.items[withItem] || {}).verbs, [verbId + ' ' + target.id]);
      const a = this.actors[target.id];
      if (a && a.roomId === this.state.room && !a.hidden) {
        const dx = a.x < this.player().x ? 20 : -20;
        await this.walkTo(this.playerId, a.x + dx, a.y + 2, a.x < this.player().x ? 'L' : 'R');
        if (this._sentenceCancelled) return;
        a.dir = this.player().x < a.x ? 'L' : 'R';
      }
    } else if (target.type === 'item') {
      const idef = P.items[target.id] || {};
      ctxName = idef.name || target.id;
      const keys = withItem ? [verbId + ' ' + withItem, verbId] : [verbId];
      actions = tryKeys(idef.verbs, keys);
      if (!actions && withItem) actions = tryKeys((P.items[withItem] || {}).verbs, [verbId + ' ' + target.id]);
    }
    if (actions) await this.runScript(actions, { hotspot: target.h, verb: verbId });
    else await this.defaultResponse(verbId, ctxName, withItem);
  };

  E.defaultResponse = async function (verbId, name, withItem) {
    const P = this.project;
    const defs = P.defaults || {};
    let pool = defs[verbId] || Grog.DEFAULT_RESPONSES[verbId] || defs._generic || Grog.DEFAULT_RESPONSES._generic;
    if (!Array.isArray(pool)) pool = [pool];
    const line = pool[Math.floor(Math.random() * pool.length)];
    await this.runScript([{ do: 'say', text: line }]);
  };

  Grog.DEFAULT_RESPONSES = {
    look: ["It's remarkably unremarkable.", "I see nothing special about it.", "Yep. That's definitely a thing."],
    pickup: ["I don't need that.", "I'd rather leave it where it is.", "My pockets have standards."],
    use: ["I can't use that.", "That doesn't seem to work.", "Nice try, but no."],
    open: ["It doesn't open.", "It's not the opening kind."],
    close: ["It's not the closing kind.", "That's already as closed as it gets."],
    push: ["It won't budge.", "I push. Nothing happens. Story of my life."],
    pull: ["It won't budge.", "Pulling accomplishes remarkably little."],
    talk: ["I'd rather not talk to that.", "It doesn't seem chatty."],
    give: ["I'd rather keep it.", "That doesn't want it."],
    _generic: ["That doesn't seem to work.", "Hmm. No.", "I have a bad feeling about that."],
  };

  // ---------- dialogs ----------
  E.runDialog = async function (dialogId) {
    const def = (this.project.dialogs || {})[dialogId];
    if (!def) return;
    let nodeId = def.start || Object.keys(def.nodes)[0];
    while (nodeId && !this._ended) {
      const node = def.nodes[nodeId];
      if (!node) break;
      if (node.actions) await this._run(node.actions, {});
      const opts = (node.options || []).filter((o, ix) => {
        if (o.once && this.state.dialogOnce[dialogId + '/' + nodeId + '/' + ix]) return false;
        return Grog.evalCond(this, o.cond);
      });
      if (!opts.length) break;
      const chosen = await this.presentDialog(opts, dialogId, nodeId, node);
      if (chosen === null) break;
      const o = chosen.opt;
      if (o.once) this.state.dialogOnce[dialogId + '/' + nodeId + '/' + chosen.ix] = true;
      if (!o.silent) await this.say(this.playerId, o.text);
      if (o.actions) await this._run(o.actions, {});
      if (o.end) break;
      nodeId = o.next || nodeId;
    }
    this.dialog = null;
  };

  E.presentDialog = function (opts, dialogId, nodeId, node) {
    return new Promise((resolve) => {
      const all = node.options || [];
      this.dialog = {
        options: opts.map((o) => ({ opt: o, ix: all.indexOf(o) })),
        hover: -1,
        choose: (i) => {
          const c = this.dialog.options[i];
          this.dialog = null;
          resolve(c || null);
        },
      };
    });
  };
})();
