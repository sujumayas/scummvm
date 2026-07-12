# Grog Platform — Architecture

Grog is a modern, web-first platform for building classic point-and-click adventure
games (SCUMM-style: *Monkey Island*, *Day of the Tentacle*, *Indiana Jones and the
Fate of Atlantis*). It consists of:

| Piece | What it is |
|---|---|
| **Grog Engine** (`engine/`) | Zero-dependency JavaScript runtime. Runs in any browser. |
| **Grog Studio** (`studio/`) | Browser-based authoring tool: rooms, sprites, scripts, dialogs, playtest, export. |
| **Player shell** (`play.html`) | Minimal host page for running a game project. |
| **Exporters** (in Studio) | Single-file HTML (web/itch.io), PWA (mobile/offline), Electron & Tauri wrappers (desktop). |
| **Demo game** (`demo/`) | *Escape from the Engine Room* — showcases every capability, jokes included. |

## Why this is easier to port than ScummVM-class engines

ScummVM is ~4M lines of C++ with per-OS backends (SDL, Dreamcast, 3DS, …). Every new
platform is a new backend. Grog inverts this: the *only* target is the web platform,
which already ships on every OS. Desktop builds are thin wrappers (Tauri/Electron),
mobile is a PWA, web is a single self-contained `.html` file. One runtime, no
recompilation, no per-platform code.

## Why authoring is easier

- **One JSON file is the whole game.** Rooms, art, animation, scripts, dialogs, music.
  No binary formats, no asset pipeline, trivially diffable in git.
- **Art is data.** Backgrounds are lists of paint ops (rects, polys, gradients,
  dithers, seeded scatter). Sprites are text grids of palette indices. Both are
  edited visually in Studio — no external image editor required (though PNG import
  also works).
- **Scripts are action lists**, not a programming language: `say`, `walk`, `give`,
  `goto`, `if`, … built in a form-based editor with a raw-JSON escape hatch.
- **Instant playtest.** One click runs the game in an embedded player.

## Engine design

- Native resolution **320×180** (16:9 update of SCUMM's 320×200), integer-scaled,
  `image-rendering: pixelated`.
- Palette: **DawnBringer-32** (indices `0-9,a-v`; `.` = transparent in sprites).
- **Rooms**: paint ops (background), walk polygons, scale band (y-based actor
  scaling, like SCUMM's proportional walkboxes), walk-behind ops (`z` baseline),
  hotspots (rect/poly + per-verb action scripts + states), entry points, ambient
  script.
- **Actors**: sprite sheets (text-grid frames), named animations
  (`idle/walkR/walkL/walkU/walkD/talk` — `flip` mirrors an existing anim), walk
  speed, talk color.
- **Pathfinding**: walk polygons rasterized to an 4-px grid → A* → line-of-sight
  smoothing.
- **Script interpreter**: sequential async commands; verb scripts run as cutscenes
  (input locked) exactly like SCUMM `cutscene()`. Conditions are tiny expressions
  over flags/vars/inventory: `caught_fish && !door_open && v.coins >= 3 && has(rope)`.
- **Dialogs**: tree of nodes, options with `once`/condition gating, MI-style
  bottom-of-screen choice list.
- **Verbs**: configurable; default 9-verb grid + sentence line + inventory,
  right-click = smart default verb.
- **Audio**: WebAudio chiptune synth — pattern-based music sequencer + procedural
  SFX presets. No audio files needed (files also supported via data URIs).
- **Saves**: full game state (flags, vars, inventory, hotspot states, room,
  position) to localStorage, 3 slots + autosave.

## File layout

- `engine/*.js` — namespace-style files (`Grog.*`), concatenation-safe, loaded in
  order: `core`, `render`, `walk`, `audio`, `script`, `ui`, `boot`.
- `studio/` — the editor app (also dependency-free).
- `demo/engine-room.grog.json` — the demo game.
- `docs/` — this file, RESEARCH.md, AUTHORING.md.

## Project JSON schema (abridged)

```jsonc
{
  "meta": { "title", "author", "version", "start": {"room","x","y"} },
  "verbs": [{"id":"look","label":"Look at","key":"l"}, ...],
  "player": "guy",                    // actor id controlled by the player
  "actors": { "guy": { "name","color","speed","sprite","anims":{...} } },
  "sprites": { "guy": { "w","h","frames": {"f1": ["..0aa0..", ...] } } },
  "items":  { "rope": { "name","icon","verbs": {"look":[...]} } },
  "rooms":  { "deck": {
      "name", "paint":[...], "walk":[[x,y,...]], "scale":{"y1","s1","y2","s2"},
      "hotspots":[{ "id","name","rect":[x,y,w,h],"default":"look",
                    "verbs":{"look":[{"do":"say","text":"..."}]},
                    "states":{...}, "state":"closed" }],
      "actors": {"pirate":{"x","y","dir"}},
      "enter":[...], "exits":[...]
  }},
  "dialogs": { "pirate_talk": { "start":"n1", "nodes": { "n1": {"options":[...]}}}},
  "scripts": { "shared_thing": [...] },     // callable via {"do":"call","script":...}
  "music":   { "theme": { "bpm", "tracks":[...] } },
  "flags":   {}, "vars": {}
}
```

## Action commands

`say, walk, face, anim, wait, goto, set, var, give, lose, show, hide, state,
sound, music, dialog, call, if, random, stop, shake, fade, title`

Each is a small JSON object: `{"do":"say","actor":"pirate","text":"Arr."}`.
