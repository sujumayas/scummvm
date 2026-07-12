# Making a game with Grog Studio

This is the complete authoring guide. It assumes you opened
`http://localhost:8000/studio/` and clicked **Start a blank project**.
Everything here can be done in the UI; the JSON shown is what the UI writes,
and every editor has a JSON escape hatch if you prefer typing.

## 1. The mental model

A Grog game is **one JSON document**:

```
meta        title, author, start position, text speed
actors      characters (the player is just an actor)
sprites     pixel art (text grids), shared by actors, items, rooms
items       inventory objects
rooms       backgrounds, walk areas, hotspots, placed actors
dialogs     conversation trees
scripts     reusable action lists ($intro runs at game start)
music       chiptune patterns
flags/vars  initial game state
```

Gameplay is: the player points at a **hotspot** (or actor/item), picks a
**verb**, and the matching **action list** runs. That's the whole platform.

## 2. Rooms

**Rooms → + → id** like `kitchen`. The canvas shows the room at 320×144
(the verb UI takes the rest of the 320×200 screen).

### Painting the background

Backgrounds are a stack of paint ops, drawn top to bottom (later ops overdraw
earlier ones). Add ops with **+ Add paint op**; click an op in the list to edit
it in the inspector; reorder with ↑↓.

| op | what it draws |
|---|---|
| `fill` | flood the room with a palette color |
| `rect` `ellipse` `poly` `line` | shapes |
| `grad` | vertical dithered gradient (skies!) |
| `scatter` | seeded random dots (stars, waves, moss, texture) |
| `sprite` | stamp any sprite frame (reuse art) |

Colors are DawnBringer-32 palette indices (`0`–`9`, `a`–`v`). The picker shows
them; you'll memorize your favorites fast.

**Walk-behinds:** give any op a `z` value — the baseline y where the object
"stands". Actors whose feet are *above* that line draw behind it. That's how
Deb walks behind the column in the demo.

### Walkable area

Tool **▦ Walk** → click to drop polygon points (a floor is usually one
trapezoid). Multiple polygons that touch are one connected floor — the engine
rasterizes them to a grid and runs A* with path smoothing.

### Scale band

Set `y1,s1,y2,s2` in the inspector (e.g. `64, 0.25, 140, 1.0`): an actor at
y=64 renders at 25% and walks proportionally slower. This is SCUMM's
perspective trick — see Boundary Beach in the demo.

### Scrolling rooms

Set **Width px** > 320 (the demo's dock is 480). The camera follows the player.

### Hotspots

Tool **+ Hotspot** → drag a rectangle → name it. In the inspector:

- **name** — what the sentence line shows ("Walk to *grog barrel*")
- **walk-to at / dir** — where the player stands and faces before acting
- **default verb** — what right-click does
- **no walk** — act from anywhere (skies, horizons)
- **verb scripts** — the interactions (next section)
- **states** — alternate looks/names/verbs (`closed`/`open`/`taken`…), switched
  at runtime by the `state` command. Each state can have its own paint ops and
  its own verb handlers; state handlers override base handlers.

## 3. Scripts (action lists)

Every interaction is a list of commands run in order. The editor is a form —
pick a command, fill the blanks:

```
say      actor? text          walk    actor? x y | to dir     face  actor? dir
anim     actor? name wait     wait    ms                      goto  room x y dir
set      flag [value]         var     name set|add            give/lose item
show/hide hotspot [room]      state   hotspot state [room]    actor id room x y hidden
sound    id                   music   id|off                  dialog id
call     script               if      cond then else          random of[...]
shake ms · fade out/in · title text sub ms · end text sub · stop
```

Notes:

- `say` without an actor = the player. `actor: "narrator"` = centered
  screen-top text, DOTT style.
- Verb scripts run as **cutscenes**: input locked, clicks skip the current line.
- **Conditions** are tiny expressions over game state:
  `door_open && !has(rope) && v.coins >= 3` — flags are bare names, `has(item)`
  checks inventory, `v.name` reads vars, with `&& || ! == != < <= > >=` and parens.
- A hotspot verb can also be a list of **conditional variants**
  (`[{cond, actions}, …]` — first match runs). The demo's progress gauge does this.

### Two-noun sentences

“Use X with Y” / “Give X to Y”: put a handler named `use rope` or
`give coin` on the *target* hotspot/actor. Item-on-item combos go on either
item as `use otherItem`. Unhandled combinations fall back to the (customizable)
default responses — always write a few funny ones.

## 4. Sprites & actors

The sprite editor is a pixel grid: pencil / eraser / fill / color-pick, frame
strip below (right-click a frame to rename/duplicate/delete), mirror & shift
buttons, animation preview, and **Import PNG** (quantizes to the palette).

An **actor** binds a sprite to animations:

```
idle idleR idleL idleU idleD   standing (per facing, optional)
walkR walkL walkU walkD        walk cycles
talk                           mouth flaps while speaking
```

Only draw the right-facing art: `walkL = { ref: "walkR", flip: true }` mirrors
it for free. Set the talk **color** — it's the actor's speech-text color, the
classic way players tell voices apart.

The **player** is just an actor (Settings → Player actor). NPCs are placed per
room (“Actors in room…”), can start `hidden` (tentacle in a crate), and can be
moved/revealed with the `actor` command.

## 4½. Imported assets (the modern pipeline)

Prefer drawing in Aseprite/Photoshop — or generating art with AI? Import it:

1. **Assets → +** — pick PNGs. They're stored as data URIs *inside* the project
   JSON (exports stay single-file; nothing can go missing).
2. **Backgrounds**: open the asset → *Set as background* (target 320×144, or
   wider for a scrolling room — the *Resize* tool has a fit-320×144 button).
   Then draw walk polygons and hotspots over it exactly as usual.
3. **Characters**: open the asset → set the frame cell size → *Create sheet
   sprite*. A numbered grid shows each cell; name the frames (idleD, w1, w2…)
   and reference them from actor animations like any drawn sprite.
   Mirroring still works (`walkL = {ref:"walkR", flip:true}`).
4. **Interactive elements / states**: a hotspot state's paint can be an
   `image` op — e.g. a `door_open.png` overlay on top of the background.
   Give an image op a `z` to make it a walk-behind foreground cutout.

Tips: kill backgrounds' baked-in characters by prompting/erasing them out;
put sprites on a flat magenta background and key it before import (or import
with transparency). Imported art keeps its full colors — the DB32 palette only
constrains *drawn* sprites and paint ops. Both pipelines mix freely in one
room: the noir demo's inventory pixel icon is hand-drawn while everything else
is imported.

## 5. Dialogs

A dialog is nodes → options. Options can be gated (`cond`), one-shot (`once`),
run actions, jump to another node (`→`), or end the dialog. The player
character speaks the option text automatically (add `"silent": true` via JSON
to suppress). Node entry actions run every time the node is (re)entered —
that's where the NPC's prompt line goes.

Insult sword-fighting is just three nodes where the wrong comebacks loop back
to the same node. See `tree_talk` in the demo.

## 6. Music & sound

A track is a wave (`square/triangle/sawtooth/sine/noise`), a volume, and a
pattern string — one token per step: note names (`C4`, `F#3`, `Bb2`), `.` rest,
`-` hold, `x` noise hit. Set BPM and steps-per-beat, press ▶. Rooms pick a
track in their properties; the `music` command switches mid-game.

SFX are built-in presets (`pickup open close error ding splash thunk teleport
step laugh fanfare`) — or define custom sweeps in Settings → Custom sounds.

## 7. Testing

- **▶ Playtest** any time; **▶ from this room** skips the journey.
- **Check** finds broken references (missing rooms, items, frames, dialog nodes).
- Saves live in the browser (3 slots + F5 menu in-game).
- CLI: `node tools/check-project.js mygame.grog.json` for CI.

## 8. Shipping

**Export & publish** in the sidebar:

- **Single-file HTML** — the entire game in one file. itch.io: upload, tick
  “this file will be played in the browser”, done.
- **PWA zip** — host on HTTPS; phones can “Add to Home Screen” and play offline.
- **Electron zip** — `npm install && npm start`; `npm run dist` for installers.
- **Tauri zip** — `cargo tauri build` for ~4 MB native binaries.

The exported HTML embeds the engine, so shipped games never break when this
repo changes.

## 9. House style (optional but correct)

- Every hotspot gets a funny `look`. No exceptions. This is the genre contract.
- Wrong verb ≠ silence: write default responses with personality.
- Puzzles read as: *see the lock → find the key is absurd → laugh → use it anyway.*
- If the engine has a limitation, don't hide it — hang a lampshade on it and
  charge admission. (See: the Invisible Wall. It has tenure.)
