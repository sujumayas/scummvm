#!/usr/bin/env node
/* Builds "The Cure Needs a Stamp" — corporate-game demo for the Grog engine.
 * Reads art/ PNGs, embeds them as data URIs, and writes cure.grog.json.
 * Re-run after changing art or any authored data below:  node build-game.js
 */
const fs = require('fs');
const path = require('path');

const ART = path.join(__dirname, 'art');
function pngAsset(file) {
  const b = fs.readFileSync(path.join(ART, file));
  return {
    src: 'data:image/png;base64,' + b.toString('base64'),
    w: b.readUInt32BE(16),
    h: b.readUInt32BE(20),
  };
}

/* ---------------- assets ---------------- */
const assets = {};
for (const f of fs.readdirSync(ART)) {
  if (f.endsWith('.png')) assets[f.replace('.png', '')] = pngAsset(f);
}

/* ---------------- cast: sheet sprites + actors ---------------- */
// name, fw, fh, cells (i1..i4 idle, chip also w1..w6), talk color, speed
const CAST = {
  chip:      { fw: 39, fh: 52, walk: 6, color: 'l', speed: 62, name: 'Dr. Chip Marlow' },
  maurice:   { fw: 40, fh: 54, color: 'k', name: 'Maurice the janitor' },
  grimble:   { fw: 50, fh: 46, color: 'm', name: 'Clerk Grimble' },
  bob:       { fw: 36, fh: 44, color: 'j', name: 'Bob (queue position 13)' },
  finn:      { fw: 38, fh: 52, color: 'i', name: 'Sgt. Finn' },
  pemberton: { fw: 38, fh: 52, color: 't', name: 'Courier Pemberton' },
  extra1:    { fw: 24, fh: 38, color: 'm', name: 'hooded queue regular' },
  extra2:    { fw: 28, fh: 40, color: 'm', name: 'cone-headed queue regular' },
  ribbert:   { fw: 26, fh: 44, color: '9', name: 'Notary Ribbert' },
  sting:     { fw: 50, fh: 56, color: 's', name: 'Legal Counsel Sting' },
  porcini:   { fw: 28, fh: 56, color: '6', name: 'Consultant Porcini' },
  nautileon: { fw: 32, fh: 56, color: '8', name: 'High Chancellor Nautileon' },
  asterion:  { fw: 40, fh: 64, color: 'u', name: 'Councilor Asterion (Protocol)' },
  tuskerman: { fw: 38, fh: 54, color: 's', name: 'Councilor Tuskerman (Budget)' },
  croakwell: { fw: 33, fh: 52, color: 'a', name: 'Councilor Croakwell (Risk)' },
};

const sprites = {};
const actors = {};
for (const [id, c] of Object.entries(CAST)) {
  const frames = { i1: 0, i2: 1, i3: 2, i4: 3 };
  if (c.walk) for (let k = 1; k <= c.walk; k++) frames['w' + k] = 3 + k;
  sprites[id + '_sp'] = { sheet: { asset: id, fw: c.fw, fh: c.fh }, frames };
  const anims = {
    idle: { frames: ['i1', 'i2', 'i3', 'i4'], fps: 3 },
    talk: { frames: ['i1', 'i2', 'i3', 'i4'], fps: 6 },
  };
  if (c.walk) {
    anims.walkR = { frames: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'], fps: 10 };
    anims.walkL = { ref: 'walkR', flip: true };
  }
  actors[id] = { name: c.name, color: c.color, speed: c.speed || 0, sprite: id + '_sp', anims };
}
actors.chip.default = 'look';
for (const id of ['maurice', 'grimble', 'bob', 'finn', 'pemberton', 'ribbert', 'sting',
                  'porcini', 'nautileon', 'asterion', 'tuskerman', 'croakwell'])
  actors[id].default = 'talk';

/* ---------------- item icons (drawn, DB32) ---------------- */
const ICONS = {
  ic_coin: [
    '..............',
    '.....8888.....',
    '...88888888...',
    '..8888888888..',
    '..88v8888v88..',
    '..88v8888v88..',
    '..8888888888..',
    '..888v88v888..',
    '...88888888...',
    '.....8888.....',
    '..............',
    '..............'],
  ic_coffee: [
    '....m....m....',
    '...m....m.....',
    '....m....m....',
    '..lllllllll...',
    '..l3333333l...',
    '..llllllllll..',
    '..lllllllll.l.',
    '..lllllllll.l.',
    '..llllllllll..',
    '...lllllll....',
    '....lllll.....',
    '..............'],
  ic_moss: [
    '..............',
    '.....9a9......',
    '...9aa9aa9....',
    '..9a9aa9aa9...',
    '..aa9aaa9aa9..',
    '..a9aab9aaa9..',
    '...aaa9aab9...',
    '....baaaab....',
    '..............',
    '..............',
    '..............',
    '..............'],
  ic_crystal: [
    '......t.......',
    '.....tqt......',
    '....tqqq......',
    '....qqtqq.....',
    '...qqtqqq.....',
    '...qtqqqqq....',
    '..qqqtqqqq....',
    '..qqqqqtqq....',
    '...qqqqqq.....',
    '....qqqq......',
    '.....qq.......',
    '..............'],
  ic_cure: [
    '......33......',
    '......33......',
    '.....kjjk.....',
    '.....kjjk.....',
    '.....kjjk.....',
    '....kjjjjk....',
    '...kjjjjjjk...',
    '...kjljjjjk...',
    '...kjjjjjjk...',
    '....kjjjjk....',
    '.....kkkk.....',
    '..............'],
  ic_napkin: [
    '..............',
    '..lllllllll...',
    '..lmmlmmmll...',
    '..lllllllll...',
    '..lmmmmmlll...',
    '..lllllllll...',
    '..lmmlmmmll...',
    '..lllllllll...',
    '..lllllllll...',
    '..............',
    '..............',
    '..............'],
  ic_form: [
    '....llllllll..',
    '....l88..88l..',
    '....llllllll..',
    '....lmmmmmml..',
    '....llllllll..',
    '....lmmmmmml..',
    '....llllllll..',
    '....lmmmmlll..',
    '....llllllll..',
    '....llllllll..',
    '..............',
    '..............'],
  ic_form_stamped: [
    '....llllllll..',
    '....l88..88l..',
    '....llllllll..',
    '....lmmmmmml..',
    '....llllllll..',
    '....lmmrrrrl..',
    '....lllrrrrl..',
    '....lmmrrrrl..',
    '....lllrrrrl..',
    '....llllllll..',
    '..............',
    '..............'],
  ic_waiver: [
    '....llllllll..',
    '....lqq..qql..',
    '....llllllll..',
    '....lmmmmmml..',
    '....llllllll..',
    '....lmmmmmml..',
    '....llllqqll..',
    '....lllqqqql..',
    '....llllqqll..',
    '....llllllll..',
    '..............',
    '..............'],
  ic_chit: [
    '..............',
    '..8888888888..',
    '..8v88888v88..',
    '..8800800888..',
    '..8808080888..',
    '..8808080888..',
    '..8800800888..',
    '..8888888888..',
    '..8888888888..',
    '..............',
    '..............',
    '..............'],
  ic_ticket: [
    '..............',
    '..jjjjjjjjjj..',
    '..j00000000j..',
    '..jjjjjjjjjj..',
    '..j0j0j0j0jj..',
    '..jjjjjjjjjj..',
    '..jjjjjjjjjj..',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............'],
  ic_copies: [
    '..lllllllll...',
    '..lmmlmmmll...',
    '.llllllllll...',
    '.lmmlmmmlll...',
    'llllllllll....',
    'lmmlmmmlll....',
    'llllllllll....',
    'llllllllll....',
    '..............',
    '..............',
    '..............',
    '..............'],
};
for (const [id, rows] of Object.entries(ICONS)) sprites[id] = { w: 14, h: 12, frames: { i: rows } };

/* ---------------- items ---------------- */
const say = (text, actor) => (actor ? { do: 'say', actor, text } : { do: 'say', text });

const items = {
  coin: { name: 'galactic quarter', icon: 'ic_coin', verbs: {
    look: [say('One galactic quarter. Legal tender on 40,000 worlds and refused by every vending machine on at least 39,999 of them.')] } },
  coffee: { name: 'vending coffee', icon: 'ic_coffee', verbs: {
    look: [say("It's brown, it's warm, and the cup says 'PROBABLY COFFEE'. Science-grade.")] } },
  coffee2: { name: 'backup coffee', icon: 'ic_coffee', verbs: {
    look: [say('My emotional support coffee. Also, my only bargaining chip that isn\'t a keyboard.')] } },
  moss: { name: 'wall moss', icon: 'ic_moss', verbs: {
    look: [say('Station moss. It survives vacuum, radiation, and quarterly performance reviews.')] } },
  crystal: { name: 'karaoke crystal', icon: 'ic_crystal', verbs: {
    look: [say('The resonance crystal from the karaoke machine. It has heard things no mineral should hear.')] } },
  cure: { name: 'THE CURE (one vial)', icon: 'ic_cure', verbs: {
    look: [say('Glows a reassuring cyan. Smells like a health inspection passed.')],
    use: [say("Not yet. This vial has an appointment with destiny. Destiny's front desk, at least.")] } },
  napkin: { name: 'recipe napkin', icon: 'ic_napkin', verbs: {
    look: [say("The full recipe: moss, coffee, crystal dust, shake. That's it. That's the cure for the galaxy."),
           say('Written on a napkin, because greatness rarely checks what it\'s written on.')] } },
  form88: { name: 'Form 88-B', icon: 'ic_form', verbs: {
    look: [{ do: 'if', cond: 'form_stamped',
      then: [say('Form 88-B: Declaration of Galactic Emergency (Minor). NOTARIZED. It practically hums with legitimacy.')],
      else: [say('Form 88-B: Declaration of Galactic Emergency (Minor). Slightly scarf-shaped from twelve years in Bob\'s care.')] }] } },
  waiver: { name: 'Exception Waiver 7-G', icon: 'ic_waiver', verbs: {
    look: [say('An Exception Waiver, embossed with the Seal of Reluctant Legal Approval.')] } },
  chit: { name: 'appointment chit', icon: 'ic_chit', verbs: {
    look: [say("Appointment with the Intergalactic Council: 'TODAY, between now and the heat death of the universe.' Punctuality encouraged.")] } },
  ticket: { name: 'queue ticket', icon: 'ic_ticket', verbs: {
    look: [say('Number 4,000,000,007. The sign says NOW SERVING 12. I believe in myself.')] } },
  copies: { name: 'recipe copies (12 billion)', icon: 'ic_copies', verbs: {
    look: [say('Twelve billion copies of a napkin. The photocopier deserves a medal. Or a union.')] } },
};

// stamped form gets the stamped icon via a second frame? simpler: swap icon at stamp time
// (engine reads item.icon each render; we mutate via... flags can't change icons — use two items)
// solved: on stamping we lose form88 and give form88s
items.form88s = { name: 'Form 88-B (NOTARIZED)', icon: 'ic_form_stamped', verbs: {
  look: [say('Form 88-B, now wearing an official stamp the way a knight wears armor.')] } };

/* ---------------- music ---------------- */
const music = {
  lab: { bpm: 112, steps: 2, tracks: [
    { wave: 'triangle', vol: 0.12, notes: 'C4 . E4 . G4 . E4 . A3 . C4 . E4 . C4 . F3 . A3 . C4 . A3 . G3 . B3 . D4 . B3 .' },
    { wave: 'square', vol: 0.05, notes: '. . C5 . . . G4 . . . A4 . . . E4 . . . F4 . . . C5 . . . B4 . . . D5 .' },
    { wave: 'triangle', vol: 0.14, notes: 'C3 . . . . . . . A2 . . . . . . . F2 . . . . . . . G2 . . . . . . .' },
  ] },
  hall: { bpm: 96, steps: 2, tracks: [
    { wave: 'square', vol: 0.07, notes: 'E4 . G4 . C5 . . . B4 . G4 . E4 . . . F4 . A4 . D5 . . . C5 . B4 . G4 . . .' },
    { wave: 'triangle', vol: 0.13, notes: 'C3 . . . G2 . . . E3 . . . G2 . . . F3 . . . G2 . . . C3 . . . G2 . . .' },
    { wave: 'noise', vol: 0.02, notes: '. . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x .' },
  ] },
  annex: { bpm: 90, steps: 1, tracks: [
    { wave: 'triangle', vol: 0.13, notes: 'D3 F3 A3 D3 F3 A3 C3 E3 G3 C3 E3 G3 Bb2 D3 F3 Bb2 D3 F3 A2 C3 E3 A2 C3 E3' },
    { wave: 'square', vol: 0.05, notes: 'D5 . . . . . E5 . . . . . F5 . . . . . E5 . . C5 . .' },
  ] },
  council: { bpm: 72, steps: 2, tracks: [
    { wave: 'sawtooth', vol: 0.08, notes: 'C3 . . . C3 . . . F3 . . . F3 . . . G3 . . . G3 . . . C3 . . . . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'C4 . . . E4 . . . F4 . . . A4 . . . G4 . . . B4 . . . C5 . . . . . . .' },
    { wave: 'square', vol: 0.04, notes: '. . G4 . . . G4 . . . A4 . . . A4 . . . B4 . . . B4 . . . C5 . . . . .' },
  ] },
  victory: { bpm: 132, steps: 2, tracks: [
    { wave: 'square', vol: 0.09, notes: 'C4 E4 G4 C5 . G4 C5 E5 . C5 E5 G5 . . C5 . D4 F4 A4 D5 . A4 D5 F5 . . D5 . C5 . . .' },
    { wave: 'triangle', vol: 0.14, notes: 'C3 . G3 . C3 . G3 . F3 . C4 . F3 . C4 . G3 . D4 . G3 . D4 . C3 . G3 . C3 . . .' },
  ] },
};

/* ---------------- shared scripts ---------------- */
const scripts = {
  check_cure: [
    { do: 'if', cond: 'c_moss && c_coffee && c_crystal && !cure_made', then: [
      say('Wait. Waaaait. The readings...'),
      { do: 'sound', id: 'teleport' },
      { do: 'shake', ms: 700 },
      { do: 'wait', ms: 500 },
      { do: 'sound', id: 'fanfare' },
      { do: 'give', item: 'cure' },
      { do: 'give', item: 'napkin' },
      { do: 'set', flag: 'cure_made' },
      { do: 'say', actor: 'narrator', text: 'DISCOVERY! The cure for The Beige: moss, coffee, crystal dust. Shake well.' },
      say("It works. IT WORKS! Three ingredients from a break room! I can cure the entire galaxy by TUESDAY!"),
      say('I wrote the recipe on a napkin. The napkin is now the most important document in the universe.'),
      say('The Intergalactic Council needs to hear about this IMMEDIATELY. How hard can that be?'),
      { do: 'say', actor: 'maurice', text: 'Oh, honey.' },
    ] },
  ],
  to_hall: [
    { do: 'fade', out: true },
    { do: 'goto', room: 'hall', x: 448, y: 132, dir: 'L' },
    { do: 'fade' },
  ],
};

/* ---------------- dialogs ---------------- */
const dialogs = {

  maurice_talk: { start: 'root', nodes: { root: { options: [
    { text: 'Maurice! I just discovered the cure for The Beige!', once: true, next: 'root', actions: [
      say("Congratulations. In 1987 I discovered a mop that works. Still waiting on the requisition form to replace it.", 'maurice'),
      say('This is bigger than mops, Maurice.', undefined),
      say("Nothing is bigger than mops, kid. But go on, have your moment.", 'maurice') ] },
    { text: "I'm taking it straight to the Intergalactic Council.", once: true, next: 'root', actions: [
      say('The Council. Oh, honey.', 'maurice'),
      say("Pack a lunch. Pack several. Update your will. Name a beneficiary for that keyboard.", 'maurice'),
      say("It's a scientific instrument.", undefined),
      say("It's a plank with buttons. I love you. Good luck.", 'maurice') ] },
    { text: 'Any advice for dealing with the administration?', once: true, next: 'root', actions: [
      say("Three rules. Never volunteer information. Never fill a form in pen you can't afford to lose. And be nice to the mail room.", 'maurice'),
      say('The mail room?', undefined),
      say("Only thing in the galaxy that still works. Nobody ever gave it a modernization budget, see. So it never broke.", 'maurice') ] },
    { text: 'Back to science.', end: true, actions: [ say('Sweep responsibly.', 'maurice') ] },
  ] } } },

  grimble_talk: { start: 'root', nodes: { root: { options: [
    { text: "I've discovered the cure for The Beige! I need the Intergalactic Council!", once: true, next: 'root', actions: [
      say('Congratulations on your feelings.', 'grimble'),
      say('Window 7 handles galactic salvation. Tuesdays only.', 'grimble'),
      say("It IS Tuesday.", undefined),
      say("Don't get smug, it's beginner's luck. You'll be needing Form 88-B: Declaration of Galactic Emergency, Minor.", 'grimble'),
      say('MINOR? The Beige has eaten nine systems!', undefined),
      say("'Major' requires ten. File now, upgrade later.", 'grimble'),
      { do: 'set', flag: 'knows_form' } ] },
    { text: 'Where do I get a Form 88-B?', cond: 'knows_form && !has(form88) && !has(form88s)', next: 'root', actions: [
      say('The dispenser. By the plant.', 'grimble'),
      say("The dispenser is empty.", undefined),
      say('Then file a Restock Request.', 'grimble'),
      say('Let me guess. On a Form 88-B.', undefined),
      say("You're getting the hang of it. We call that job security.", 'grimble'),
      { do: 'set', flag: 'knows_dispenser_empty' } ] },
    { text: 'Here. One Form 88-B, filled out in my best handwriting.', cond: 'has(form88)', next: 'root', actions: [
      say('...Unnotarized? Adorable.', 'grimble'),
      say('It needs the Stamp. Department of Forms, Stamps and Redundancy, down the service lift. Ask for Ribbert.', 'grimble'),
      say('Will mentioning your name help?', undefined),
      say('It will not. Tell him anyway. I enjoy his little face when he hears it.', 'grimble'),
      { do: 'set', flag: 'grimble_briefed' } ] },
    { text: 'One Form 88-B. NOTARIZED.', cond: 'has(form88s)', next: 'root', actions: [
      say('Hand it over.', 'grimble'),
      { do: 'wait', ms: 900 },
      say('Hmm. Margins... regulation. Ink... blue-black, acceptable. Stamp... genuine.', 'grimble'),
      { do: 'wait', ms: 700 },
      say("Ugh. It's... in order. I hate when that happens.", 'grimble'),
      { do: 'lose', item: 'form88s' },
      { do: 'sound', id: 'ding' },
      { do: 'give', item: 'chit' },
      say('One appointment chit. The Council will see you today, sometime between now and the heat death of the universe.', 'grimble'),
      say('Can you narrow that down?', undefined),
      say('No.', 'grimble'),
      { do: 'set', flag: 'chit_have' } ] },
    { text: "What IS The Beige, officially?", once: true, next: 'root', actions: [
      say("Officially? A 'wellness deviation'. We don't say 'plague'. It alarms the actuaries.", 'grimble'),
      say('It turns entire planets beige!', undefined),
      say('So does autumn. Next question.', 'grimble') ] },
    { text: "I'll come back when I hate myself more.", end: true, actions: [
      say('Window 7 never closes. Emotionally, it was never open.', 'grimble') ] },
  ] } } },

  bob_talk: { start: 'root', nodes: { root: { options: [
    { text: 'How long have you been in this queue?', once: true, next: 'root', actions: [
      say('Twelve years in spring.', 'bob'),
      say("The sign says NOW SERVING 12.", undefined),
      say("I'm thirteen. Any day now. I can feel it.", 'bob') ] },
    { text: 'Is that... a Form 88-B tucked in your scarf?', cond: 'knows_dispenser_empty', once: true, next: 'root', actions: [
      say('This? Grabbed the last one in year three. I use it as a pillow.', 'bob'),
      say('I NEED that form. Galaxy-saving business.', undefined),
      say("And I need something warm that isn't regret. Twelve years, friend. The floor is cold and the coffee machine is a rumor.", 'bob'),
      { do: 'set', flag: 'bob_wants_coffee' } ] },
    { text: 'Why not just leave? Come back another day?', once: true, next: 'root', actions: [
      say('And lose my PLACE?', 'bob'),
      say("You're the only one in line.", undefined),
      say('That\'s how good my place is.', 'bob') ] },
    { text: 'Hang in there, Bob.', end: true, actions: [
      say("Tell window 7 I said nothing. I don't want trouble.", 'bob') ] },
  ] } } },

  finn_talk: { start: 'root', nodes: { root: { options: [
    { text: 'I need to see the Council. I have the cure to the galactic plague!', once: true, next: 'root', actions: [
      say('And I have a laminated list of people allowed upstairs.', 'finn'),
      say("Guess which document wins.", 'finn'),
      say('Mine cures the galaxy.', undefined),
      say("Mine is LAMINATED.", 'finn') ] },
    { text: 'What would get me on the laminated list?', once: true, next: 'root', actions: [
      say('An appointment chit from Window 7. Standard channels. Beautiful channels.', 'finn'),
      say("I once watched a man skip channels. They renamed a cautionary training video after him.", 'finn') ] },
    { text: 'Fine. Channels it is.', end: true, actions: [
      say('Channels. It is ALWAYS channels.', 'finn') ] },
  ] } } },

  pemberton_talk: { start: 'root', nodes: { root: { options: [
    { text: 'Does the interplanetary mail actually work?', once: true, next: 'root', actions: [
      say("Only thing here that does. Standard shipping, anywhere in the galaxy, arrives tomorrow.", 'pemberton'),
      say('TOMORROW? The lift to the second floor takes a week!', undefined),
      say("Nobody ever gave the mail room a modernization budget. So nothing ever broke.", 'pemberton'),
      say("We deliver to every inhabited planet. Forty billion mailboxes. Rain, void, or paperwork.", 'pemberton'),
      { do: 'set', flag: 'knows_mail' } ] },
    { text: 'What\'s the strangest thing you\'ve delivered?', once: true, next: 'root', actions: [
      say('A live gorgon, second class. Arrived on time. Petrified the recipient.', 'pemberton'),
      say("In fairness, that's what she ordered.", 'pemberton') ] },
    { text: 'Keep flying, Pemberton.', end: true, actions: [
      say('Keep... whatever it is you do.', 'pemberton') ] },
  ] } } },

  ribbert_talk: { start: 'root', nodes: { root: { options: [
    { text: 'Grimble sent me. This Form 88-B needs notarizing.', once: true, next: 'root', actions: [
      say('...Grimble. GRIMBLE.', 'ribbert'),
      { do: 'wait', ms: 600 },
      say('The Stamp does not answer to Grimble. The Stamp answers to PROCEDURE.', 'ribbert'),
      say('To receive the Stamp, present a Stamp Requisition Form 12-A.', 'ribbert'),
      { do: 'set', flag: 'knows_12a' } ] },
    { text: 'Okay. Where do I get a Form 12-A?', cond: 'knows_12a', once: true, next: 'root', actions: [
      say('Legal. The alcove. Mind the tentacles.', 'ribbert'),
      say('Legal issues 12-As exclusively for forms that have already been stamped.', 'ribbert'),
      say('...But you stamp forms. That means no form can ever be stamped for the first time.', undefined),
      say('I see no contradiction, and I resent the implication.', 'ribbert'),
      { do: 'set', flag: 'knows_circular' } ] },
    { text: 'One Exception Waiver 7-G, signed by Legal.', cond: 'has(waiver) && !form_stamped', next: 'root', actions: [
      say('A waiver. A WAIVER.', 'ribbert'),
      { do: 'wait', ms: 500 },
      say('...It is in order. Approach the cushion. Avert your eyes.', 'ribbert'),
      { do: 'sound', id: 'open' },
      { do: 'wait', ms: 800 },
      { do: 'say', actor: 'narrator', text: 'Ribbert lifts THE STAMP. Somewhere, a choir of filing cabinets hums.' },
      { do: 'shake', ms: 500 },
      { do: 'sound', id: 'thunk' },
      { do: 'wait', ms: 600 },
      { do: 'sound', id: 'fanfare' },
      { do: 'lose', item: 'waiver' },
      { do: 'lose', item: 'form88' },
      { do: 'give', item: 'form88s' },
      { do: 'set', flag: 'form_stamped' },
      say('NOTARIZED. Go. Before I feel feelings about it.', 'ribbert'),
      say('That was genuinely beautiful.', undefined),
      say('I know. The cushion is velvet. GO.', 'ribbert') ] },
    { text: 'Tell me about The Stamp.', once: true, next: 'root', actions: [
      say('Hand-carved from the gavel of the First Bureaucrat. It has notarized declarations of war, peace, and one birthday card.', 'ribbert'),
      say('It sleeps on velvet. I sleep on a futon. This is correct and just.', 'ribbert') ] },
    { text: "I'll hop along.", end: true, actions: [
      say('The Department thanks you for your patience. The Department is legally required to say that.', 'ribbert') ] },
  ] } } },

  sting_talk: { start: 'root', nodes: { root: { options: [
    { text: 'I need a Requisition 12-A for an unstamped form.', once: true, next: 'root', actions: [
      say('Impossible. Twelve-As attach exclusively to stamped instruments.', 'sting'),
      say('But it can\'t GET stamped without the 12-A!', undefined),
      say('Correct. The system is airtight. We are very proud.', 'sting'),
      { do: 'set', flag: 'knows_legal' } ] },
    { text: 'Is there such a thing as an... exception?', cond: 'knows_legal', once: true, next: 'root', actions: [
      say('Exceptions exist. Exceptions require citation of a controlling regulation. A precise citation.', 'sting'),
      say('Misquote a subsection and we bill you by the syllable.', 'sting'),
      say('Where would one find regulations to cite?', undefined),
      say('The Binder. On the lectern. Mind the dust — it has seniority.', 'sting'),
      { do: 'set', flag: 'knows_citation' } ] },
    { text: 'I cite Regulation 7.G: any form may serve as its own prerequisite on Tuesdays.', cond: 'reg_found && !has(waiver) && !form_stamped', next: 'root', actions: [
      { do: 'wait', ms: 700 },
      say('...The Tuesday Provision.', 'sting'),
      say('Beautiful. Loopholes are the load-bearing walls of the law.', 'sting'),
      { do: 'sound', id: 'ding' },
      { do: 'give', item: 'waiver' },
      say('One Exception Waiver 7-G. Present it to the amphibian. And petitioner —', 'sting'),
      say('Yes?', undefined),
      say('Never tell anyone how easy that was.', 'sting') ] },
    { text: 'What does Legal actually do here?', once: true, next: 'root', actions: [
      say('We convert simple problems into billable ones.', 'sting'),
      say('It\'s called value creation. There is a whiteboard about it.', 'sting') ] },
    { text: 'No further questions.', end: true, actions: [
      say('Invoice to follow.', 'sting') ] },
  ] } } },

  porcini_talk: { start: 'root', nodes: { root: { options: [
    { text: 'What does a strategy consultant do in an archive basement?', once: true, next: 'root', actions: [
      say('Great question. Powerful question. Let\'s park it in the parking lot.', 'porcini'),
      say('I was hired to streamline this department. Eleven years ago. Phase One is nearly scoped.', 'porcini'),
      say('What\'s Phase One?', undefined),
      say('Defining Phase Two.', 'porcini') ] },
    { text: 'Hypothetically: how do I get a budget councilor to say yes?', once: true, next: 'root', actions: [
      say('Ooh. Okay. Rule one: never say a thing is CHEAP. Cheap means no line item. No line item means no oversight. Terror.', 'porcini'),
      say('Then what do I say?', undefined),
      say("Say it's a COST-NEUTRAL SYNERGY WITH UPSIDE OPTIONALITY.", 'porcini'),
      say('That means nothing.', undefined),
      say('It means EVERYTHING, precisely because it means nothing. Invoice me later.', 'porcini'),
      { do: 'set', flag: 'porcini_synergy' } ] },
    { text: 'What\'s on the whiteboard?', once: true, next: 'root', actions: [
      say('Our north star. Also our flywheel, our runway, and one drawing of a duck.', 'porcini'),
      say('The duck tested well with leadership.', 'porcini') ] },
    { text: 'Let\'s circle back never.', end: true, actions: [
      say('Love the energy. Ping me. Or don\'t — my calendar is aspirational.', 'porcini') ] },
  ] } } },

  croakwell_talk: { start: 'root', nodes: { root: { options: [
    { text: 'Councilor Croakwell — the cure is perfectly safe.', once: true, next: 'root', actions: [
      say('SAFE? Untested! Unregulated! Un-actuaried!', 'croakwell'),
      say('Where is your nine-eon longitudinal study? Your triple-blind trial where even the STATISTICIANS are blindfolded?', 'croakwell'),
      { do: 'set', flag: 'met_croakwell' } ] },
    { text: "Here's my study: I've been drinking it all week. Bottoms up.", cond: 'met_croakwell && has(cure)', next: 'root', actions: [
      { do: 'say', actor: 'narrator', text: 'Dr. Marlow uncorks the only vial of the cure in existence and downs it.' },
      { do: 'sound', id: 'splash' },
      { do: 'wait', ms: 900 },
      { do: 'lose', item: 'cure' },
      say('...You drank the evidence.', 'croakwell'),
      say('I FEEL AMAZING. Look at this skin. Is this beige? No it is not.', undefined),
      { do: 'wait', ms: 600 },
      say('Sample size: one. Methodology: reckless. Skin: admittedly luminous.', 'croakwell'),
      say('Fine. FINE. Risk: begrudgingly managed.', 'croakwell'),
      { do: 'sound', id: 'ding' },
      { do: 'set', flag: 'c_risk' } ] },
    { text: 'We tested it extensively on my roommate.', once: true, next: 'root', actions: [
      say('Is your roommate a certified testing facility?', 'croakwell'),
      say('He\'s certified something.', undefined),
      say('DENIED.', 'croakwell') ] },
    { text: "I'll manage your risk later.", end: true, actions: [
      say('That is not how risk works. That is EXACTLY how risk works here. DENIED, pending.', 'croakwell') ] },
  ] } } },

  tuskerman_talk: { start: 'root', nodes: { root: { options: [
    { text: 'Councilor Tuskerman — the cure costs almost nothing!', once: true, next: 'root', actions: [
      say("'Nothing'? NOTHING?", 'tuskerman'),
      say("'Nothing' means no line item. No line item means no oversight. No oversight means CHAOS with RECEIPTS MISSING.", 'tuskerman'),
      { do: 'set', flag: 'met_tuskerman' } ] },
    { text: 'It is a cost-neutral synergy with upside optionality.', cond: 'met_tuskerman && porcini_synergy', next: 'root', actions: [
      { do: 'wait', ms: 800 },
      say('...', 'tuskerman'),
      say('I do not know what that means.', 'tuskerman'),
      { do: 'wait', ms: 600 },
      say('APPROVED.', 'tuskerman'),
      { do: 'sound', id: 'ding' },
      { do: 'set', flag: 'c_budget' } ] },
    { text: 'The galaxy will pay any price to survive!', once: true, next: 'root', actions: [
      say("'Any price' is not a number, petitioner. Bring me a number. A number wearing a suit.", 'tuskerman') ] },
    { text: "I'll consult my... consultant.", end: true, actions: [
      say('Now THAT is fiscal responsibility.', 'tuskerman') ] },
  ] } } },

  asterion_talk: { start: 'root', nodes: { root: { options: [
    { text: 'Councilor Asterion — this is an emergency! Skip the protocol!', once: true, next: 'root', actions: [
      say('Emergencies. Follow. The schedule.', 'asterion'),
      say('The last unscheduled emergency was in the Third Epoch. We are still doing the paperwork.', 'asterion'),
      { do: 'set', flag: 'met_asterion' } ] },
    { text: 'Precedent: Regulation 7.G, the Tuesday Provision.', cond: 'met_asterion && reg_found', next: 'root', actions: [
      { do: 'wait', ms: 900 },
      say('...The Tuesday Provision.', 'asterion'),
      say('Invoked by the First Bureaucrat to approve the invention of Wednesday.', 'asterion'),
      say('It IS Tuesday. The precedent... holds.', 'asterion'),
      { do: 'sound', id: 'ding' },
      { do: 'set', flag: 'c_protocol' } ] },
    { text: 'What if millions perish while we deliberate?', once: true, next: 'root', actions: [
      say('Then they perish in full compliance. There is comfort in that.', 'asterion'),
      say('There really isn\'t.', undefined),
      say('There is PROCEDURE in that. Same thing.', 'asterion') ] },
    { text: 'I withdraw. Respectfully. Furiously.', end: true, actions: [
      say('Both emotions are on file.', 'asterion') ] },
  ] } } },

  nautileon_talk: { start: 'root', nodes: { root: { options: [
    { text: 'High Chancellor — where does my petition stand?', cond: '!(c_risk && c_budget && c_protocol)', next: 'root', actions: [
      say('With my colleagues, petitioner. Risk, Budget, Protocol. Convince all three.', 'nautileon'),
      say('That is the process, and the process is all.', 'nautileon'),
      say('The process is three grumpy people at one desk.', undefined),
      say('Yes. Democracy is beautiful up close.', 'nautileon') ] },
    { text: 'High Chancellor — Risk, Budget and Protocol all approve!', cond: 'c_risk && c_budget && c_protocol && !approved', next: 'root', actions: [
      say('Impossible. Let me confirm.', 'nautileon'),
      { do: 'wait', ms: 700 },
      say('Councilors?', 'nautileon'),
      say('Begrudgingly.', 'croakwell'),
      say('Synergistically.', 'tuskerman'),
      say('It is Tuesday.', 'asterion'),
      { do: 'wait', ms: 500 },
      { do: 'sound', id: 'thunk' },
      { do: 'title', text: 'MOTION 88-B PASSES', sub: 'unanimously, with three abstentions of spirit', ms: 2600 },
      say('The cure is APPROVED for immediate galactic distribution!', 'nautileon'),
      say('YES! Immediately?!', undefined),
      say('Immediately upon: environmental review, fleet procurement, tri-annual naming symposium, and the blessing of the Font Committee.', 'nautileon'),
      say('...How long is all that?', undefined),
      say('Rollout is estimated at seven to nine business eons. We are VERY excited.', 'nautileon'),
      { do: 'sound', id: 'error' },
      { do: 'set', flag: 'approved' },
      { do: 'wait', ms: 800 },
      say('Seven to nine business EONS. People are turning BEIGE out there.', undefined),
      say('...Wait. The recipe fits on a napkin. Napkins fit in envelopes.', undefined),
      say('And the mail room actually works.', undefined) ] },
    { text: 'What happens to my cure after approval?', once: true, next: 'root', actions: [
      say('It becomes an INITIATIVE. Initiatives mature into PROGRAMS. Programs, if they survive, are honored with a PILOT.', 'nautileon'),
      say('And then people are cured?', undefined),
      say('And then there is a retrospective.', 'nautileon') ] },
    { text: 'Thank you, Chancellor. I think.', end: true, actions: [
      say('The Council is always here for you. That is the problem — we are ALWAYS here.', 'nautileon') ] },
  ] } } },
};

/* ---------------- rooms ---------------- */
const rooms = {

  lab: {
    name: 'Outpost Lab 7-C', music: 'lab',
    paint: [{ op: 'image', id: 'lab', x: 0, y: 0 }],
    walk: [[6, 122, 314, 122, 314, 140, 6, 140]],
    scale: { y1: 116, s1: 0.82, y2: 142, s2: 1 },
    actors: { maurice: { x: 28, y: 132, dir: 'R' } },
    enter: [
      { do: 'if', cond: '!intro_done', then: [
        { do: 'set', flag: 'intro_done' },
        { do: 'wait', ms: 400 },
        { do: 'title', text: 'GROG ENGINE presents', ms: 1800 },
        { do: 'title', text: 'THE CURE NEEDS A STAMP', sub: 'a bureaucratic space opera', ms: 3000 },
        { do: 'wait', ms: 300 },
        { do: 'say', actor: 'narrator', text: 'Outpost Lab 7-C. Somewhere unfashionable in the Western Spiral Arm.' },
        say("Log, day 400: The Beige has taken nine systems. Everything it touches turns beige, boring, and slightly damp."),
        say('Headquarters sent moral support and a poster about teamwork.'),
        say("But last night my centrifuge made a noise centrifuges don't make. Let's science."),
      ] },
    ],
    hotspots: [
      { id: 'centrifuge', name: 'centrifuge', rect: [2, 28, 80, 80], at: [66, 130], dir: 'L', default: 'look',
        verbs: {
          look: [{ do: 'if', cond: 'cure_made',
            then: [say('My beautiful centrifuge. Technically a washing machine. Historically a hero.')],
            else: [say('The centrifuge hums expectantly. It wants... ingredients. Three, I\'d say, going by the blinking lights.')] }],
          open: [say('The sample chamber is open. It yearns.')],
          use: [{ do: 'if', cond: 'cure_made',
            then: [say('It has given enough.')],
            else: [say('It needs ingredients. Something alive, something warm, something that resonates. The classic trio.')] }],
          'use moss': [
            { do: 'lose', item: 'moss' }, { do: 'set', flag: 'c_moss' }, { do: 'sound', id: 'thunk' },
            say('Moss in. Something alive. The centrifuge purrs.'), { do: 'call', script: 'check_cure' }],
          'use coffee': [
            { do: 'lose', item: 'coffee' }, { do: 'set', flag: 'c_coffee' }, { do: 'sound', id: 'splash' },
            say('Coffee in. Something warm. The centrifuge gurgles appreciatively.'), { do: 'call', script: 'check_cure' }],
          'use coffee2': [say("One coffee for science. This one's my emotional support coffee.")],
          'use crystal': [
            { do: 'lose', item: 'crystal' }, { do: 'set', flag: 'c_crystal' }, { do: 'sound', id: 'ding' },
            say('Crystal in. Something that resonates. The centrifuge begins to sing backup.'), { do: 'call', script: 'check_cure' }],
          'use napkin': [say('The napkin is documentation, not an ingredient. Respect the napkin.')],
          'use cure': [say('Re-centrifuging the cure would make it TOO cured. Probably illegal.')],
        } },
      { id: 'desk', name: 'research desk', rect: [80, 76, 58, 30], at: [110, 128], dir: 'U',
        verbs: {
          look: [say('Forty open research tabs and one game of solitaire. For morale.'),
                 say('The keyboard stays on my shoulder. A scientist carries her instrument.')],
          use: [say('I already did the science. The noise was the science.')] } },
      { id: 'window', name: 'observation window', rect: [92, 14, 74, 62], noWalk: true,
        verbs: {
          look: [say('Planet Greeble-9. Six months ago it was turquoise. Now it looks like a waiting room.'),
                 say("That's The Beige. That's what we're up against.")] } },
      { id: 'moss', name: 'wall moss', rect: [170, 2, 84, 32], at: [205, 126], dir: 'U',
        verbs: {
          look: [{ do: 'if', cond: 'moss_taken',
            then: [say('The moss is already regrowing. Unstoppable little guys.')],
            else: [say('Station moss. It survives vacuum, radiation, and the cafeteria.')] }],
          pickup: [{ do: 'if', cond: 'moss_taken',
            then: [say("I have enough moss. Sentences I never expected to say.")],
            else: [{ do: 'sound', id: 'pickup' }, { do: 'give', item: 'moss' }, { do: 'set', flag: 'moss_taken' },
                   say('Sorry, little guys. You\'re about to be famous.')] }] } },
      { id: 'couch', name: 'lab couch', rect: [136, 96, 72, 34], at: [172, 130], dir: 'U',
        verbs: {
          look: [say('The nap station. Officially: "Horizontal Thinking Module".')],
          open: [{ do: 'if', cond: 'coin_found',
            then: [say('Just crumbs and a support group of lost pens.')],
            else: [{ do: 'sound', id: 'pickup' }, { do: 'give', item: 'coin' }, { do: 'set', flag: 'coin_found' },
                   say('A galactic quarter! The couch provides. The couch always provides.')] }],
          pickup: [{ do: 'if', cond: 'coin_found',
            then: [say('The couch stays. The couch has tenure.')],
            else: [{ do: 'sound', id: 'pickup' }, { do: 'give', item: 'coin' }, { do: 'set', flag: 'coin_found' },
                   say('Digging in the cushions... a galactic quarter! The couch provides.')] }],
          use: [say('Tempting. But the galaxy is turning beige while I nap.')] } },
      { id: 'vending', name: 'vending machine', rect: [204, 52, 40, 76], at: [225, 130], dir: 'U',
        verbs: {
          look: [say("The Bever-Ator 3000. Powered by a small fusion cell and spite. Exact change only.")],
          use: [{ do: 'if', cond: 'coffee_bought',
            then: [say("'ONE (1) DISPENSE PER FISCAL QUARTER.' The machine remembers.")],
            else: [say('It wants exact galactic change. Of course it does.')] }],
          'use coin': [{ do: 'if', cond: 'coffee_bought',
            then: [say('It kept my quarter last time. We are not doing this again.')],
            else: [
              { do: 'lose', item: 'coin' }, { do: 'sound', id: 'thunk' }, { do: 'wait', ms: 600 },
              { do: 'sound', id: 'ding' },
              { do: 'say', actor: 'narrator', text: "The machine dispenses TWO coffees. A sticker explains: 'BOGO FISCAL STIMULUS — Q4 ONLY'." },
              { do: 'give', item: 'coffee' }, { do: 'give', item: 'coffee2' }, { do: 'set', flag: 'coffee_bought' },
              say('Two coffees. The economy is healing.')] }] } },
      { id: 'karaoke', name: 'broken karaoke machine', rect: [244, 68, 34, 58], at: [258, 128], dir: 'U',
        verbs: {
          look: [say("Karaoke-Tron. Died mid-ballad in 3086. The resonance crystal inside still glows with unfinished business.")],
          pickup: [{ do: 'if', cond: 'crystal_taken',
            then: [say('The Karaoke-Tron has nothing left to give. Rest, sweet prince.')],
            else: [{ do: 'sound', id: 'pickup' }, { do: 'give', item: 'crystal' }, { do: 'set', flag: 'crystal_taken' },
                   say("The resonance crystal! Still warm. Still humming 'Total Eclipse of the Quasar'.")] }],
          open: [{ do: 'if', cond: 'crystal_taken',
            then: [say('Empty. Like the second verse of every karaoke performance.')],
            else: [{ do: 'sound', id: 'pickup' }, { do: 'give', item: 'crystal' }, { do: 'set', flag: 'crystal_taken' },
                   say('Popping the panel... the resonance crystal! Still humming.')] }],
          use: [say('Not until it\'s fixed. The galaxy has suffered enough.')] } },
      { id: 'door', name: 'shuttle door', rect: [280, 42, 36, 92], at: [296, 130], dir: 'R', default: 'open',
        verbs: {
          look: [say('The shuttle to the Administration Sector. Three weeks each way, or four if the pilot is "feeling reflective".')],
          open: [{ do: 'if', cond: 'cure_made',
            then: [
              say("Intergalactic Council, here I come. They're going to LOVE me."),
              { do: 'say', actor: 'maurice', text: 'Famous last words, honey. Take snacks.' },
              { do: 'fade', out: true }, { do: 'sound', id: 'teleport' },
              { do: 'title', text: 'THREE WEEKS LATER', sub: 'one shuttle, two transfers, zero legroom', ms: 2600 },
              { do: 'goto', room: 'hall', x: 448, y: 132, dir: 'L' },
              { do: 'fade' }],
            else: [say("Leave? Now? I'm one weird noise away from a breakthrough.")] }],
          use: [{ do: 'call', script: 'noop_door' }] } },
    ],
  },

  hall: {
    name: 'Intake Hall, Administration Sector', music: 'hall', w: 480,
    paint: [{ op: 'image', id: 'hall', x: 0, y: 0 }],
    walk: [[10, 124, 470, 124, 470, 140, 10, 140]],
    scale: { y1: 118, s1: 0.85, y2: 142, s2: 1 },
    actors: {
      grimble: { x: 290, y: 94, dir: 'D' },
      bob: { x: 245, y: 123, dir: 'D' },
      extra1: { x: 182, y: 122, dir: 'D' },
      extra2: { x: 212, y: 123, dir: 'D' },
      finn: { x: 414, y: 131, dir: 'D' },
      pemberton: { x: 352, y: 130, dir: 'D' },
    },
    enter: [
      { do: 'if', cond: '!hall_seen', then: [
        { do: 'set', flag: 'hall_seen' },
        { do: 'wait', ms: 400 },
        { do: 'say', actor: 'narrator', text: 'The Intake Hall of the Intergalactic Administration. Nine windows. One open. Sort of.' },
        say('Right. Cure in pocket, truth in heart. How hard can this be?'),
        { do: 'say', actor: 'bob', text: 'Oh, a new one. He still has hope. Look at him glow.' },
      ] },
    ],
    hotspots: [
      { id: 'lift_annex', name: 'service lift', rect: [28, 46, 62, 90], at: [96, 130], dir: 'L', default: 'open',
        verbs: {
          look: [say("A sign: 'SERVICE LIFT — AUTHORIZED ERRANDS ONLY'. The button is worn down to a nub.")],
          open: [{ do: 'if', cond: 'grimble_briefed',
            then: [
              { do: 'sound', id: 'open' }, { do: 'fade', out: true },
              { do: 'goto', room: 'annex', x: 30, y: 132, dir: 'R' },
              { do: 'fade' }],
            else: [say("I don't have an errand yet. Give it time. This place breeds errands.")] }],
          use: [{ do: 'if', cond: 'grimble_briefed',
            then: [
              { do: 'sound', id: 'open' }, { do: 'fade', out: true },
              { do: 'goto', room: 'annex', x: 30, y: 132, dir: 'R' },
              { do: 'fade' }],
            else: [say('AUTHORIZED ERRANDS ONLY. My errand is unauthorized. My errand is a dream.')] }] } },
      { id: 'plant', name: 'departmental plant', rect: [104, 86, 40, 54], at: [130, 130], dir: 'L',
        verbs: {
          look: [say("It's been waiting longer than anyone. Its ticket blew away in '02."),
                 say('Still more alive than window 4.')],
          use: [say('I water it with my remaining optimism. It wilts further.')] } },
      { id: 'posters_l', name: 'motivational posters', rect: [16, 2, 96, 44], noWalk: true,
        verbs: { look: [say("'UNITY THROUGH FORMS.' 'THE QUEUE IS THE JOURNEY.' 'SMILING IS A CHANGE REQUEST.'")] } },
      { id: 'windows', name: 'service windows', rect: [150, 40, 105, 55], at: [230, 128], dir: 'U',
        verbs: {
          look: [say("Windows 5 through 9. Window 5: 'BE BACK NEVER'. Window 6: shuttered. Window 8: 'CLOSED FOREVER'. Window 9: existentially dark."),
                 say('Window 7 is open. Window 7 is always open. Window 7 is the trap.')] } },
      { id: 'window7', name: 'window 7', rect: [258, 52, 55, 44], at: [274, 126], dir: 'U', default: 'talk',
        verbs: {
          look: [say('The one working window in the sector. Behind it: Grimble. Before it: despair, neatly queued.')],
          talk: [{ do: 'dialog', id: 'grimble_talk' }] } },
      { id: 'serving_sign', name: 'NOW SERVING sign', rect: [280, 0, 52, 44], noWalk: true,
        verbs: {
          look: [{ do: 'if', cond: 'has(ticket)',
            then: [say('NOW SERVING: 12. My ticket says 4,000,000,007. Math is not on my side.')],
            else: [say("NOW SERVING: 12. It's been 12 since the sign was installed. The 12 is load-bearing.")] }] } },
      { id: 'ticket_machine', name: 'ticket dispenser', rect: [286, 84, 28, 42], at: [277, 128], dir: 'R',
        verbs: {
          look: [say("'TAKE A NUMBER. BECOME A NUMBER.' Inspirational.")],
          use: [{ do: 'if', cond: 'has(ticket)',
            then: [say("One per customer. The machine remembers. The machine judges.")],
            else: [{ do: 'sound', id: 'ding' }, { do: 'give', item: 'ticket' },
                   say('Number 4,000,000,007. The queue is the journey, I guess.')] }],
          pull: [say('The machine dispenses tickets, not miracles.')] } },
      { id: 'mail_window', name: 'interplanetary mail window', rect: [326, 44, 50, 62], at: [350, 128], dir: 'U', default: 'talk',
        verbs: {
          look: [say('INTERPLANETARY MAIL. The counter is clean. The queue is zero. Something here... works?')],
          talk: [{ do: 'dialog', id: 'pemberton_talk' }] } },
      { id: 'parcels', name: 'outgoing parcels', rect: [322, 100, 78, 40], at: [368, 130], dir: 'U',
        verbs: {
          look: [say('Stamped, sorted, and sailing tomorrow. A small cathedral of competence.')],
          pickup: [say("Tampering with the mail is the one crime this place actually prosecutes.")] } },
      { id: 'posters_r', name: 'compliance posters', rect: [392, 2, 52, 40], noWalk: true,
        verbs: { look: [say("'REPORT JOY TO YOUR SUPERVISOR.' Noted.")] } },
      { id: 'lift_gold', name: 'Council elevator', rect: [396, 26, 74, 112], at: [392, 132], dir: 'R', default: 'open',
        verbs: {
          look: [say('Gold doors, velvet glow, faint choir. The elevator to the Council floor. It has a dress code and the dress code is worthiness.')],
          open: [{ do: 'if', cond: 'has(chit)',
            then: [
              { do: 'say', actor: 'finn', text: 'Chit... verified. Laminated list... updated. Proceed, citizen.' },
              say('That\'s it? Twelve stamps and a waiver and a— you know what, thank you, Sergeant.'),
              { do: 'say', actor: 'finn', text: 'Enjoy the choir. It unionized.' },
              { do: 'sound', id: 'open' }, { do: 'fade', out: true },
              { do: 'goto', room: 'council', x: 40, y: 132, dir: 'R' },
              { do: 'fade' }],
            else: [
              { do: 'say', actor: 'finn', text: 'Appointment chit or no lift, citizen.' },
              say('One day, Finn.'),
              { do: 'say', actor: 'finn', text: 'That is what the plant said.' }] }],
          use: [{ do: 'if', cond: 'has(chit)',
            then: [
              { do: 'sound', id: 'open' }, { do: 'fade', out: true },
              { do: 'goto', room: 'council', x: 40, y: 132, dir: 'R' },
              { do: 'fade' }],
            else: [{ do: 'say', actor: 'finn', text: 'Chit. Lift. In that order.' }] }] } },
    ],
  },

  annex: {
    name: 'Dept. of Forms, Stamps & Redundancy', music: 'annex',
    paint: [
      { op: 'image', id: 'annex', x: 0, y: 0 },
      { op: 'image', id: 'cut_desk', x: 96, y: 88, z: 104 },
    ],
    walk: [[6, 126, 314, 126, 314, 140, 6, 140]],
    scale: { y1: 120, s1: 0.85, y2: 142, s2: 1 },
    actors: {
      ribbert: { x: 145, y: 96, dir: 'D' },
      sting: { x: 44, y: 124, dir: 'D' },
      porcini: { x: 292, y: 131, dir: 'D' },
    },
    enter: [
      { do: 'if', cond: '!annex_seen', then: [
        { do: 'set', flag: 'annex_seen' },
        { do: 'wait', ms: 300 },
        { do: 'say', actor: 'narrator', text: 'The Department of Forms, Stamps and Redundancy. Also the Department of Forms, Stamps and Redundancy.' },
        say('The air is 40% dust, 60% precedent.'),
      ] },
    ],
    hotspots: [
      { id: 'exit_hall', name: 'service lift', rect: [0, 40, 12, 100], at: [14, 132], dir: 'L', default: 'open',
        verbs: {
          look: [say('Back up to the Intake Hall.')],
          open: [{ do: 'sound', id: 'open' }, { do: 'fade', out: true },
                 { do: 'goto', room: 'hall', x: 96, y: 130, dir: 'R' }, { do: 'fade' }],
          use: [{ do: 'sound', id: 'open' }, { do: 'fade', out: true },
                { do: 'goto', room: 'hall', x: 96, y: 130, dir: 'R' }, { do: 'fade' }] } },
      { id: 'alcove', name: 'legal alcove', rect: [4, 8, 50, 88], at: [40, 130], dir: 'L',
        verbs: {
          look: [say('Scales, scrolls, and a faint smell of billable hours.')] } },
      { id: 'binder', name: 'Binder of Regulations', rect: [48, 60, 44, 62], at: [80, 132], dir: 'L', default: 'open',
        verbs: {
          look: [say('The Binder of Regulations, Vol. 1 of 1. It contains all volumes. Do not ask how.')],
          open: [{ do: 'if', cond: 'reg_found',
            then: [say("I've read enough. Regulation 7.G is tattooed on my soul.")],
            else: [
              say("Let's see... Regulation 7.A: forms must be beige. Figures."),
              { do: 'wait', ms: 400 },
              say('7.C: queues may not be enjoyed. 7.E: hope requires a permit.'),
              { do: 'wait', ms: 400 },
              { do: 'sound', id: 'ding' },
              say("Hold on. Regulation 7.G: 'Any form may serve as its own prerequisite on Tuesdays.'"),
              say('The Tuesday Provision. It IS Tuesday. Oh, this is a loophole with my name on it.'),
              { do: 'set', flag: 'reg_found' }] }],
          use: [{ do: 'if', cond: 'reg_found',
            then: [say('7.G. Tuesday. Got it.')],
            else: [say("It's a reading binder, not a using binder. Let me OPEN it.")] }] } },
      { id: 'stacks', name: 'paper stacks', rect: [88, 12, 74, 60], at: [125, 130], dir: 'U',
        verbs: {
          look: [say('Every tower is a decade of unprocessed requests. The tall one is labeled URGENT.')],
          push: [say("If one falls, they all fall. Civilization is load-bearing paperwork."),
                 say('...Tempting, though.')],
          pickup: [say('Removing one sheet voids the entire century.')] } },
      { id: 'sign', name: 'department sign', rect: [176, 22, 50, 34], noWalk: true,
        verbs: { look: [say("'DEPARTMENT OF FORMS, STAMPS AND REDUNDANCY.' The R is silent. And redundant.")] } },
      { id: 'notary_desk', name: 'notary desk', rect: [96, 58, 100, 70], at: [146, 133], dir: 'U', default: 'talk',
        verbs: {
          look: [say('A desk with more gravitas than most moons. Behind it: Ribbert, Keeper of the Stamp.')],
          talk: [{ do: 'dialog', id: 'ribbert_talk' }] } },
      { id: 'stamp', name: 'THE Stamp', rect: [156, 56, 30, 36], at: [146, 133], dir: 'U',
        verbs: {
          look: [say('THE Stamp. It sleeps on a velvet cushion under its own spotlight. I sleep on a futon.')],
          pickup: [
            { do: 'say', actor: 'ribbert', text: 'TOUCH THE STAMP AND LOSE THE HAND, PETITIONER.' },
            say('Just... admiring it. From here. With my hands in my pockets.')],
          use: [{ do: 'say', actor: 'ribbert', text: 'The Stamp is not USED. The Stamp is PETITIONED.' }] } },
      { id: 'photocopier', name: 'photocopier', rect: [198, 52, 56, 80], at: [226, 131], dir: 'U',
        verbs: {
          look: [say("An ancient Duplicatron. Green glow, infinite toner. The plaque says 'IN CASE OF REVOLUTION'.")],
          use: [say('I have nothing worth twelve billion copies. ...Yet.')],
          'use napkin': [{ do: 'if', cond: 'approved',
            then: [
              say("The Council approved the cure. In seven to nine business eons. The people need it by Thursday."),
              say('Regulation 7.G says a form can be its own prerequisite. I say a napkin can be its own distribution plan.'),
              { do: 'sound', id: 'ding' }, { do: 'wait', ms: 400 },
              { do: 'sound', id: 'ding' }, { do: 'wait', ms: 300 },
              { do: 'sound', id: 'ding' }, { do: 'wait', ms: 200 },
              { do: 'say', actor: 'narrator', text: 'The Duplicatron glows. Somewhere, the Font Committee feels a disturbance.' },
              { do: 'shake', ms: 400 },
              { do: 'give', item: 'copies' },
              { do: 'set', flag: 'copies_made' },
              say('Twelve billion copies. Now I just need the one department that actually delivers.')],
            else: [{ do: 'if', cond: 'cure_made',
              then: [say("Tempting. But I'm doing this RIGHT. Through channels. Proper channels."),
                     say("...I'm going to regret saying that, aren't I.")],
              else: [say('Copy a blank napkin? Even this place has standards. Barely.')] }] }] } },
      { id: 'cabinets', name: 'filing cabinets', rect: [252, 52, 36, 64], at: [264, 130], dir: 'U',
        verbs: {
          look: [say("Drawers labeled A–F, G–L, M–S, and 'SCREAMING'.")],
          open: [{ do: 'sound', id: 'open' }, say('The SCREAMING drawer is full. I close it gently.')] } },
      { id: 'whiteboard', name: 'strategy whiteboard', rect: [282, 22, 38, 74], noWalk: true,
        verbs: {
          look: [say("Arrows, circles, the word 'SYNERGY' underlined four times, and a duck."),
                 say('The duck tested well with leadership, apparently.')] } },
      { id: 'beanbag', name: 'consultant corner', rect: [252, 94, 64, 42], at: [284, 132], dir: 'R',
        verbs: {
          look: [say('A beanbag in a load-bearing paperwork facility. The consultant lives here. Thrives, even.')],
          use: [say("If I sit in the beanbag I become a stakeholder. No.")] } },
    ],
  },

  council: {
    name: 'The Intergalactic Council', music: 'council',
    paint: [
      { op: 'image', id: 'council', x: 0, y: 0 },
      { op: 'image', id: 'cut_bench', x: 60, y: 82, z: 95 },
      { op: 'image', id: 'cut_podium', x: 140, y: 108, z: 141 },
    ],
    walk: [[12, 122, 308, 122, 308, 140, 12, 140]],
    scale: { y1: 114, s1: 0.8, y2: 142, s2: 1 },
    actors: {
      croakwell: { x: 92, y: 90, dir: 'D' },
      tuskerman: { x: 140, y: 90, dir: 'D' },
      nautileon: { x: 176, y: 90, dir: 'D' },
      asterion: { x: 226, y: 90, dir: 'D' },
    },
    enter: [
      { do: 'if', cond: '!council_open', then: [
        { do: 'set', flag: 'council_open' },
        { do: 'wait', ms: 500 },
        { do: 'say', actor: 'narrator', text: 'The Intergalactic Council. Four beings. One agenda. Zero urgency.' },
        { do: 'say', actor: 'nautileon', text: 'Petitioner! Approach the podium. State your business in triplicate.' },
        { do: 'walk', x: 190, y: 134 },
        { do: 'face', dir: 'U' },
        say('Councilors! I hold in this vial the cure for The Beige!'),
        say('It costs almost nothing. I can brew it in a sink. Planets can be un-beiged by THURSDAY.'),
        { do: 'wait', ms: 600 },
        { do: 'say', actor: 'nautileon', text: 'Thrilling! Marvelous! Referred to the Standing Subcommittee on Miracles.' },
        say('...Where does the subcommittee meet?'),
        { do: 'say', actor: 'nautileon', text: 'It convenes now. It is us. We vote unanimously or not at all.' },
        { do: 'say', actor: 'nautileon', text: 'Convince my colleagues: Risk, Budget, Protocol. You have until recess. Recess is soon, and sacred.' },
      ] },
    ],
    hotspots: [
      { id: 'exit_council', name: 'gold elevator', rect: [0, 78, 12, 64], at: [16, 130], dir: 'L', default: 'open',
        verbs: {
          look: [say('Back down to the Intake Hall. The choir hums in a minor key on the way down.')],
          open: [{ do: 'sound', id: 'open' }, { do: 'fade', out: true },
                 { do: 'goto', room: 'hall', x: 392, y: 132, dir: 'L' }, { do: 'fade' }],
          use: [{ do: 'sound', id: 'open' }, { do: 'fade', out: true },
                { do: 'goto', room: 'hall', x: 392, y: 132, dir: 'L' }, { do: 'fade' }] } },
      { id: 'podium', name: 'petitioner podium', rect: [140, 104, 40, 38], at: [186, 133], dir: 'L',
        verbs: {
          look: [say("The petitioner's podium. Smaller than regulation. That IS the regulation.")],
          use: [say('*ahem* Fellow sapients— no. Save it for the vote.')] } },
      { id: 'galaxy_window', name: 'galactic window', rect: [70, 4, 180, 74], noWalk: true,
        verbs: {
          look: [say('The whole galaxy, framed like a motivational poster. Somewhere out there, nine beige systems wait on hold.')] } },
      { id: 'banner_l', name: 'council banners', rect: [4, 2, 58, 74], noWalk: true,
        verbs: { look: [say("The Council crest: a planet, rampant, on a field of tasteful mauve. Chosen after 900 years of debate.")] } },
      { id: 'banner_r', name: 'council banners', rect: [258, 2, 58, 76], noWalk: true,
        verbs: { look: [say('This one is the backup banner, in case the first banner is impeached.')] } },
      { id: 'staffs', name: 'ceremonial staffs', rect: [16, 78, 44, 46], at: [48, 128], dir: 'L',
        verbs: {
          look: [say('Ceremonial staffs. Purely decorative. Like most of the agenda.')],
          pickup: [say("Touching a staff triggers a 40-page incident report. I've read it. It's on the wall of the Annex.")] } },
      { id: 'bench', name: 'the bench', rect: [64, 80, 194, 34], at: [160, 128], dir: 'U',
        verbs: {
          look: [say('Elevated, curved, and paid for over nine budget cycles. The bench outranks me. The bench outranks gravity.')] } },
    ],
  },
};

/* ---------------- defaults (unhandled verb responses) ---------------- */
const defaults = {
  look: [
    "Curious. But it won't get me past a single clerk.",
    'Noted. Filed. Mentally shredded.',
    "I see it. It sees me. Neither of us has an appointment.",
  ],
  pickup: [
    "I'd need a Property Transfer Request in triplicate.",
    'My pockets are at regulation capacity.',
  ],
  use: [
    'The universe considers my proposal. The universe opens a ticket.',
    "That combination requires a permit I don't have.",
  ],
  open: ["It's closed for lunch. Since 3079.", "It doesn't open without a work order."],
  close: ['Closing things is how this whole mess started.'],
  push: ['I push. It files a complaint.', "It won't budge without sign-off."],
  pull: ['Pulling requires a different form than pushing. Naturally.'],
  talk: ["It's not authorized to speak with petitioners.", 'It keeps its counsel. Smart.'],
  give: ["It has no use for my worldly goods.", 'Bribery! ...is what that would be. Probably keep it.'],
  _generic: ['Denied. Even my imagination has a waiting list.'],
};

/* ---------------- assemble ---------------- */
const project = {
  meta: {
    title: 'The Cure Needs a Stamp',
    author: 'Grog Studio — corporate-game cast',
    version: '1.0',
    pipeline: 'assets',
    textSpeed: 16,
    start: { room: 'lab', x: 160, y: 132, dir: 'D' },
  },
  player: 'chip',
  flags: {},
  vars: {},
  assets,
  actors,
  sprites,
  items,
  rooms,
  dialogs,
  scripts,
  music,
  defaults,
};

/* finale: give copies to Pemberton (actor verb) */
actors.pemberton.verbs = {
  talk: [{ do: 'dialog', id: 'pemberton_talk' }],
  look: [say('Courier Pemberton. Backpack older than three empires. Delivery record: unblemished.')],
  'give copies': [
    say('Pemberton. Twelve billion envelopes. One per mailbox. Standard shipping.'),
    { do: 'say', actor: 'pemberton', text: 'Standard shipping. Arrives tomorrow.' },
    { do: 'say', actor: 'pemberton', text: '...This is the cure, isn\'t it. The one the Council approved for seven eons from now.' },
    say('It\'s a napkin. Mailing napkins is legal.'),
    { do: 'say', actor: 'pemberton', text: 'Best kind of legal. The kind nobody thought to forbid.' },
    { do: 'lose', item: 'copies' },
    { do: 'sound', id: 'fanfare' },
    { do: 'music', id: 'victory' },
    { do: 'fade', out: true },
    { do: 'title', text: 'THE NEXT DAY', ms: 2000 },
    { do: 'title', text: 'The recipe reached forty billion mailboxes.', ms: 2600 },
    { do: 'title', text: 'The Beige was cured within the week.', sub: 'moss, coffee, crystal dust — shake well', ms: 3000 },
    { do: 'title', text: 'The Council press release is expected in 7–9 business eons.', ms: 3000 },
    { do: 'title', text: 'Dr. Chip Marlow was fined 12 credits for Unlicensed Heroism.', sub: 'he paid in exact change', ms: 3200 },
    { do: 'end', text: 'THE CURE NEEDS A STAMP', sub: 'The galaxy got better anyway. Thanks for playing!' },
  ],
};

/* other actor verbs (look/talk wiring) */
actors.maurice.verbs = {
  talk: [{ do: 'dialog', id: 'maurice_talk' }],
  look: [say('Maurice. Janitor, philosopher, keeper of the only working mop in the sector.')],
};
actors.grimble.verbs = {
  talk: [{ do: 'dialog', id: 'grimble_talk' }],
  look: [say('Clerk Grimble of Window 7. Eyes like a Monday. Soul like a longer Monday.')],
  'give form88': [say("He won't take it by hand. 'Documents travel through the SLOT.' There is no slot.")],
  'give form88s': [say("'Through the SLOT.' Fine — I'll TALK to him and wave it meaningfully.")],
};
actors.bob.verbs = {
  talk: [{ do: 'dialog', id: 'bob_talk' }],
  look: [say('Bob. Queue position 13 of 12. A scarf, a dream, and suspicious paperwork padding.')],
  'give coffee2': [{ do: 'if', cond: 'bob_wants_coffee',
    then: [
      say('Bob. One backup coffee. Still warm. For the form.'),
      { do: 'say', actor: 'bob', text: '...Warm. WARM. Twelve years, friend. Deal.' },
      { do: 'sound', id: 'pickup' },
      { do: 'lose', item: 'coffee2' },
      { do: 'give', item: 'form88' },
      { do: 'say', actor: 'bob', text: 'One Form 88-B. Barely slept-on. May it queue kindly for you.' },
      say('It smells like patience and scarf. Perfect.')],
    else: [{ do: 'say', actor: 'bob', text: "I don't take drinks from strangers. Ask me about my LIFE first. Nobody ever asks." }] }],
};
actors.finn.verbs = {
  talk: [{ do: 'dialog', id: 'finn_talk' }],
  look: [say('Sgt. Finn. Guards the gold lift. His laminated list gleams with terrible power.')],
  'give cure': [{ do: 'say', actor: 'finn', text: 'Unregistered beverages go in the amnesty bin, citizen.' }],
};
actors.ribbert.verbs = {
  talk: [{ do: 'dialog', id: 'ribbert_talk' }],
  look: [say('Notary Ribbert. A frog of the cloth. The Stamp chose HIM, he will tell you. At length.')],
  'give form88': [{ do: 'say', actor: 'ribbert', text: 'Presented without a 12-A or a waiver? The cushion WEEPS. Speak to me properly.' }],
  'give waiver': [say("He gestures at the queue-of-one. 'Formal petitions VERBALLY.' I'll talk to him.")],
};
actors.sting.verbs = {
  talk: [{ do: 'dialog', id: 'sting_talk' }],
  look: [say('Legal Counsel Sting. You can hear the billable seconds ticking.')],
};
actors.porcini.verbs = {
  talk: [{ do: 'dialog', id: 'porcini_talk' }],
  look: [say('Consultant Porcini. Engagement: eternal. Deliverables: a duck, so far.')],
};
actors.nautileon.verbs = {
  talk: [{ do: 'dialog', id: 'nautileon_talk' }],
  look: [say('High Chancellor Nautileon. Magnificent uniform. Every medal is for meeting attendance.')],
  'give cure': [{ do: 'say', actor: 'nautileon', text: 'Gifts to the Chair constitute lobbying. Delightful, but no.' }],
};
actors.asterion.verbs = {
  talk: [{ do: 'dialog', id: 'asterion_talk' }],
  look: [say('Councilor Asterion, Keeper of Protocol. Old as the rules. Possibly older. Possibly IS the rules.')],
};
actors.tuskerman.verbs = {
  talk: [{ do: 'dialog', id: 'tuskerman_talk' }],
  look: [say('Councilor Tuskerman, Budget. Those tusks have gored a thousand line items.')],
};
actors.croakwell.verbs = {
  talk: [{ do: 'dialog', id: 'croakwell_talk' }],
  look: [say('Councilor Croakwell, Risk & Compliance. Sees a liability. Everywhere. Right now: me.')],
  'use cure': [{ do: 'if', cond: 'met_croakwell && !c_risk',
    then: [{ do: 'dialog', id: 'croakwell_talk' }],
    else: [{ do: 'say', actor: 'croakwell', text: 'Do not wave fluids at Compliance.' }] }],
};
actors.extra1.verbs = {
  look: [say('A hooded regular. Has seen queues you people wouldn\'t believe.')],
  talk: [{ do: 'say', actor: 'extra1', text: '...shhh. If we speak, the line resets.' }],
};
actors.extra2.verbs = {
  look: [say('A cone-headed regular. The cone is a queueing strategy: nobody cuts in front of a cone.')],
  talk: [{ do: 'say', actor: 'extra2', text: 'I was born in this line. I will be promoted in this line.' }],
};

/* clean helper artifact from scripts */
scripts.check_cure = scripts.check_cure.map((op) => op); // no-op, keeps shape
scripts.noop_door = [say('The door prefers to be OPENED. Doors have processes too.')];

const out = path.join(__dirname, 'cure.grog.json');
fs.writeFileSync(out, JSON.stringify(project));
const kb = Math.round(fs.statSync(out).size / 1024);
console.log(`wrote ${out} (${kb} KB)`);
