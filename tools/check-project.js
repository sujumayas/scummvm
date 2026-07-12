#!/usr/bin/env node
// Grog project linter: JSON validity, sprite grid widths, dangling references.
const fs = require('fs');
const path = process.argv[2] || 'demo/engine-room.grog.json';
const P = JSON.parse(fs.readFileSync(path, 'utf8'));
let errors = 0;
const err = (m) => { console.error('ERROR: ' + m); errors++; };
const warn = (m) => console.warn('warn: ' + m);

// sprites: every frame row must match sprite width, only legal chars
const COLORS = '0123456789abcdefghijklmnopqrstuv. ';
for (const [sid, spr] of Object.entries(P.sprites || {})) {
  if (spr.sheet) {
    if (!(P.assets || {})[spr.sheet.asset]) err(`sprite ${sid}: sheet asset '${spr.sheet.asset}' missing`);
    continue;
  }
  for (const [fid, rows] of Object.entries(spr.frames || {})) {
    if (!Array.isArray(rows)) { err(`sprite ${sid}.${fid}: not a pixel grid`); continue; }
    rows.forEach((row, i) => {
      if (row.length !== spr.w) err(`sprite ${sid}.${fid} row ${i}: length ${row.length} != w ${spr.w}`);
      for (const ch of row) if (!COLORS.includes(ch)) err(`sprite ${sid}.${fid} row ${i}: bad char '${ch}'`);
    });
  }
}
// image ops reference assets
function checkPaint(ops, where) {
  for (const op of ops || []) {
    if (op.op === 'image' && !(P.assets || {})[op.id]) err(`${where}: image op references missing asset '${op.id}'`);
    if (op.op === 'sprite' && !(P.sprites || {})[op.id]) err(`${where}: sprite op references missing sprite '${op.id}'`);
  }
}
for (const [rid, room] of Object.entries(P.rooms || {})) {
  checkPaint(room.paint, `room ${rid}.paint`);
  for (const h of room.hotspots || []) {
    checkPaint(h.paint, `room ${rid}.${h.id}.paint`);
    for (const [st, sd] of Object.entries(h.states || {})) checkPaint(sd.paint, `room ${rid}.${h.id}[${st}].paint`);
  }
}
// actors reference sprites + anim frames exist
for (const [aid, a] of Object.entries(P.actors || {})) {
  const spr = (P.sprites || {})[a.sprite];
  if (!spr) { err(`actor ${aid}: sprite '${a.sprite}' missing`); continue; }
  for (const [an, def] of Object.entries(a.anims || {})) {
    if (def.ref) { if (!a.anims[def.ref]) err(`actor ${aid} anim ${an}: ref '${def.ref}' missing`); continue; }
    for (const f of def.frames || []) if ((spr.frames || {})[f] === undefined) err(`actor ${aid} anim ${an}: frame '${f}' missing in sprite ${a.sprite}`);
  }
}
// items reference icon sprites
for (const [iid, it] of Object.entries(P.items || {})) {
  if (it.icon && !(P.sprites || {})[it.icon]) err(`item ${iid}: icon sprite '${it.icon}' missing`);
}
// walk action scan: goto rooms exist, dialogs exist, items exist, scripts exist, hotspot refs
const roomIds = new Set(Object.keys(P.rooms || {}));
const itemIds = new Set(Object.keys(P.items || {}));
const dialogIds = new Set(Object.keys(P.dialogs || {}));
const scriptIds = new Set(Object.keys(P.scripts || {}));
const musicIds = new Set(Object.keys(P.music || {}));
function scanActions(list, where) {
  if (!Array.isArray(list)) return;
  for (const op of list) {
    if (!op || typeof op !== 'object') continue;
    if (op.cond !== undefined && op.actions) { scanActions(op.actions, where); continue; }
    switch (op.do) {
      case 'goto': if (!roomIds.has(op.room)) err(`${where}: goto unknown room '${op.room}'`); break;
      case 'give': case 'lose': if (!itemIds.has(op.item)) err(`${where}: unknown item '${op.item}'`); break;
      case 'dialog': if (!dialogIds.has(op.id)) err(`${where}: unknown dialog '${op.id}'`); break;
      case 'call': if (!scriptIds.has(op.script)) err(`${where}: unknown script '${op.script}'`); break;
      case 'music': if (op.id && !musicIds.has(op.id)) err(`${where}: unknown music '${op.id}'`); break;
      case 'if': scanActions(op.then, where); scanActions(op.else, where); break;
      case 'random': (op.of || []).forEach((l) => scanActions(l, where)); break;
    }
  }
}
function scanVerbs(verbs, where) {
  for (const [v, val] of Object.entries(verbs || {})) {
    if (Array.isArray(val) && val.length && val[0] && val[0].cond !== undefined && val[0].actions) {
      val.forEach((variant, i) => scanActions(variant.actions, `${where}.${v}[${i}]`));
    } else scanActions(val, `${where}.${v}`);
  }
}
for (const [rid, room] of Object.entries(P.rooms || {})) {
  if (room.music && !musicIds.has(room.music)) err(`room ${rid}: unknown music '${room.music}'`);
  scanActions(room.enter, `room ${rid}.enter`);
  for (const h of room.hotspots || []) {
    if (!h.rect && !h.poly) warn(`room ${rid} hotspot ${h.id}: no rect/poly`);
    scanVerbs(h.verbs, `room ${rid}.${h.id}`);
    for (const [st, sdef] of Object.entries(h.states || {})) scanVerbs(sdef.verbs, `room ${rid}.${h.id}[${st}]`);
    if (h.states && h.state === undefined) warn(`room ${rid} hotspot ${h.id}: has states but no initial 'state'`);
  }
  for (const aid of Object.keys(room.actors || {})) if (!(P.actors || {})[aid]) err(`room ${rid}: unknown actor '${aid}'`);
}
for (const [aid, a] of Object.entries(P.actors || {})) scanVerbs(a.verbs, `actor ${aid}`);
for (const [iid, it] of Object.entries(P.items || {})) scanVerbs(it.verbs, `item ${iid}`);
for (const [did, d] of Object.entries(P.dialogs || {})) {
  for (const [nid, n] of Object.entries(d.nodes || {})) {
    scanActions(n.actions, `dialog ${did}.${nid}`);
    (n.options || []).forEach((o, i) => {
      scanActions(o.actions, `dialog ${did}.${nid}[${i}]`);
      if (o.next && !d.nodes[o.next]) err(`dialog ${did}.${nid}[${i}]: next '${o.next}' missing`);
    });
  }
}
for (const [sid, s] of Object.entries(P.scripts || {})) scanActions(s, `script ${sid}`);
if (!P.rooms[(P.meta || {}).start && P.meta.start.room]) err(`meta.start.room invalid`);
if (!(P.actors || {})[P.player]) err(`player '${P.player}' not an actor`);

console.log(errors ? `${errors} error(s).` : 'Project OK: ' + Object.keys(P.rooms).length + ' rooms, ' + Object.keys(P.sprites).length + ' sprites, ' + Object.keys(P.dialogs).length + ' dialogs.');
process.exit(errors ? 1 : 0);
