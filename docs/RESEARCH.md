# Point-and-Click Adventure Engines & Authoring Platforms — Research Report

*Research to inform the design of a new modern (web-first) adventure game engine + editor.*
*Date: 2026-07-12. All claims cite inline source URLs.*

---

## 1. ScummVM and the SCUMM Architecture

### 1.1 What ScummVM is (and is not)

ScummVM (https://github.com/scummvm/scummvm) is a **collection of game-engine re-implementations**, not an authoring tool. It re-implements the *interpreter* portion of classic adventure engines — the part that reads the original games' data and bytecode files — rather than emulating the hardware the games ran on ([Wikipedia](https://en.wikipedia.org/wiki/ScummVM)). It began with LucasArts' SCUMM games and now supports dozens of engines: Sierra AGI/SCI, Revolution's Virtual Theatre (Broken Sword, Lure of the Temptress), Adventure Soft's AGOS (Simon the Sorcerer), Westwood's Kyrandia, Wintermute, AGS, and many more ([ScummVM FAQ](https://www.scummvm.org/faq/)).

Key facts:

- **License:** GPL-2.0-or-later ([Wikipedia](https://en.wikipedia.org/wiki/ScummVM)). This matters: engine code inside ScummVM cannot be reused in a permissively-licensed or closed product.
- **Portability:** C++ core with an `OSystem` backend abstraction; ported to Windows, macOS, Linux, Android, iOS, Raspberry Pi, Dreamcast, PSP, PS2, Amiga, and more ([SourceForge](https://sourceforge.net/projects/scummvm/)).
- **Not for making games:** the project's own FAQ notes that only a few supported engines have public authoring tools; targeting any other engine requires reverse-engineered tooling ([ScummVM docs FAQ](https://docs.scummvm.org/en/latest/help/faq.html)). Community projects like **ScummC** (script + costume compiler, walkbox editor, producing SCUMM v6 bytecode runnable in ScummVM) exist but are hobbyist-grade ([ScummC wiki](https://github.com/AlbanBedel/scummc/wiki/Scumm-6-data-format)).

**The core lesson ScummVM teaches:** SCUMM-era games survive 35+ years later precisely because they are *data + bytecode interpreted by a replaceable VM*. The game content never had to be ported — only the small interpreter did. This is the strongest single argument for a data-driven, VM-based design in a new engine.

### 1.2 SCUMM architecture

SCUMM ("Script Creation Utility for Maniac Mansion", 1987, Ron Gilbert / Aric Wilmunder at Lucasfilm Games) sits "somewhere between a game engine and a programming language" ([Wikipedia](https://en.wikipedia.org/wiki/SCUMM)). The toolchain: the SCUMM compiler produced bytecode; the runtime interpreter **SPUTM** executed it; auxiliary tools included **FLEM** (room/object/walkbox editor) and costume/animation tools ([GameDeveloper: The SCUMM Diary](https://www.gamedeveloper.com/design/the-scumm-diary-stories-behind-one-of-the-greatest-game-engines-ever-made)).

Core concepts ([SCUMM Diary](https://www.gamedeveloper.com/design/the-scumm-diary-stories-behind-one-of-the-greatest-game-engines-ever-made), [pagetable: SCUMM Script](https://www.pagetable.com/?p=614), [dev.to SCUMM internals](https://dev.to/roperzh/scumm-internals-and-syntax-for-the-sake-of-nostalgia-384j)):

- **Rooms** — the unit of a location: a background image, its objects, local scripts, walkboxes, and Z-plane masks. Rooms were also the unit of resource loading.
- **Objects** — interactive elements inside rooms, each with a name, multiple *states* (a door open/closed swaps images), an owner (room or actor inventory), and per-verb entry points ("verb scripts": what happens on *Open door*, *Push door*, ...).
- **Verbs** — the on-screen action words (the classic bottom-of-screen verb bar). Verbs are engine-level entities; the UI is itself scripted with them.
- **Sentence line** — the "Use wrench with pipe" line built from `verb + object [+ preposition + object2]`. The engine composes the sentence from player clicks, then dispatches to the matching object's verb script. This *verb–object–object triple* is the universal interaction datum: every later UI (verb coin, two-click) is just a different way of filling it in.
- **Scripts** — SCUMM's standout feature is **cooperative multitasking**: any script can be launched with `start-script`, runs as an independent process, and yields with `break-here` (suspend one frame) or `wait-for-actor` / `wait-for-message`; `stop-script` kills it ([pagetable](https://www.pagetable.com/?p=614)). Typical game state: a global "room logic" script, ambient animation scripts, and input handling all running concurrently. Example syntax: `actor sandy walk-to 67,8`, `say-line dave "Don't be a tuna head."`.
- **Cutscenes** — `cut-scene { ... }` blocks take control from the player; a paired `override` handler makes the cutscene *skippable* (ESC jumps to the override label, which must fast-forward world state). Skippable-by-construction cutscenes were a deliberate language feature, not an afterthought.
- **Costumes** — the actor animation format: a set of directional animations (walk cycles, talk frames, reach, etc.) referenced by high-level commands (`actor sandy do-animation reach`). Actors are room-independent entities that wear costumes and can walk, talk, and hold inventory.
- **Walkboxes** — convex polygons defining walkable areas, connected into a graph for pathfinding. Each box carries **scale** information (actor sprite scaling for fake perspective), **Z-plane/masking** info (which foreground mask layer hides actors), and flags ([ScummC wiki](https://github.com/AlbanBedel/scummc/wiki/Scumm-6-data-format)). Ron Gilbert kept the same model in the Thimbleweed Park engine (2017): n-sided *convex* polygons, walkboxes that can be toggled on/off at runtime, with graceful failure (actors snapped into valid polygons on room entry) and scaling driven by boxes ([Thimbleweed Park blog: Walk Boxes!](https://blog.thimbleweedpark.com/walkbox_video.html)). His verdict: "the current system of convex 4-point polygons is simple and works great."
- **Language design** — SCUMM began Lisp-flavored, moved to C-like; Gilbert wanted scripts readable by non-programmers, "more like movie scripts" ([pagetable](https://www.pagetable.com/?p=614)). Early versions lacked full expressions (arithmetic via `+=` chains), fixed only around Monkey Island.

---

## 2. Authoring Platforms

### 2.1 Adventure Game Studio (AGS)

https://www.adventuregamestudio.co.uk / https://github.com/adventuregamestudio/ags

- **What it is:** the dominant hobbyist/indie 2D adventure tool since the late 1990s (Gemini Rue, Blackwell series, Kathy Rain, Unavowed). IDE + engine + C-like scripting language ([Wikipedia](https://en.wikipedia.org/wiki/Adventure_Game_Studio)).
- **Architecture / data model:** strictly **room-based**. Each room has: background(s), **hotspots** (painted pixel regions with interaction events), **objects** (movable/stateful sprites), **regions** (effects/events zones), **walkable areas** (painted masks, with per-area scaling incl. continuous top/bottom scaling), **walk-behinds** (painted masks with a baseline y-coordinate). Global entities: characters, inventory items, GUIs, dialogs. Dialog trees are first-class objects with their own simplified dialog-script format (option lists + script per option).
- **Scripting:** AGS Script, C-like, compiled to bytecode run by the engine ([Wikipedia](https://en.wikipedia.org/wiki/Adventure_Game_Studio)). Event-driven: the editor wires "Look at hotspot" → script function. `Blocking` vs background execution is handled by blocking function calls (e.g. `character.Walk(..., eBlock)`) rather than SCUMM-style parallel scripts — a well-known source of awkwardness for concurrent animation.
- **Editor UX:** the **room editor** is the gold standard for this genre: import background, paint hotspots/walkable areas/walk-behinds directly over it, drop objects and characters, double-click any event to jump to its script stub. Weaknesses: the editor is **Windows-only** (.NET WinForms; runs under Wine elsewhere) ([Wikipedia](https://en.wikipedia.org/wiki/Adventure_Game_Studio)); painted bitmap masks (vs. vector polygons) are resolution-bound; legacy low-res assumptions persist; UI shows its age.
- **Export/porting:** engine originally DirectDraw/Windows; the runtime was later ported (SDL2 rewrite in 3.6) to Linux, macOS, Android, iOS, PSP etc. ([Wikipedia](https://en.wikipedia.org/wiki/Adventure_Game_Studio)); a WebAssembly/Emscripten web port exists in the source tree ([GitHub](https://github.com/adventuregamestudio/ags)). Historic pain: a **native C++ plugin API** (Windows DLLs) meant popular games couldn't run on ports until plugins were reimplemented; console releases of AGS games have generally required bespoke engine work or ScummVM's AGS engine.
- **License:** editor (2010) and engine (2011) released under **Artistic License 2.0** ([Wikipedia](https://en.wikipedia.org/wiki/Adventure_Game_Studio)). Free for commercial use.

### 2.2 Escoria (Godot)

https://github.com/godot-escoria/escoria-demo-game / https://docs.escoria-framework.org

- **What it is:** a libre point-and-click framework built as Godot addons; originally developed for *The Interactive Adventures of Dog Mendonça and Pizzaboy* and open-sourced ([Godot blog](https://godotengine.org/article/our-point-click-framework-finally-out/), [Escoria docs](https://docs.escoria-framework.org/en/devel/general/what_is_escoria.html)).
- **Architecture / data model:** rooms are Godot scenes; special node types (`ESCRoom`, `ESCItem`, `ESCPlayer`, terrain nodes) provide adventure semantics (item states, exits, character movement, room transitions). Walkable terrain uses Godot navigation polygons with scaling. Dialog UIs are pluggable managers.
- **Scripting:** originally its own **ESC** dialect (event-based command lists: `:use`, `:look` events containing commands like `say`, `walk`, state changes) — since replaced by **ASHES** ("Adventure Scripting Helping EScoria") ([GitHub](https://github.com/deep-entertainment/escoria)). Game-specific logic can always drop to GDScript.
- **Editor UX:** you author *inside the Godot editor* — powerful, cross-platform, free; but Escoria adds no dedicated adventure-authoring UI beyond nodes + inspectors, so common tasks (dialog trees, verb wiring) are less streamlined than AGS. It has also repeatedly lagged Godot major versions (Godot 3 → 4 migration), a real cost of building atop a fast-moving host engine.
- **Export/porting:** everything Godot exports: Windows/macOS/Linux, Android/iOS, HTML5/WASM; consoles via third-party porting companies.
- **License:** MIT, like Godot ([GitHub](https://github.com/deep-entertainment/escoria)).

### 2.3 PowerQuest (Unity)

https://powerquest.powerhoof.com / https://powerhoof.itch.io/powerquest

- **What it is:** Powerhoof's (Dave Lloyd, *Crawl*, *The Drifter*) Unity toolkit explicitly aiming for "the fast workflow and ease-of-use of tools like AGS/Visionaire, with the power and flexibility of Unity" ([itch page](https://powerhoof.itch.io/powerquest)). 80+ released games ([itch](https://powerhoof.itch.io/powerquest)). Free (donationware), full source included.
- **Architecture / data model:** a central **PowerQuest window** lists all rooms, characters, inventory items, GUIs and dialog trees in one place ([PowerQuest docs](https://powerquest.powerhoof.com/)). Rooms contain **hotspots** (polygon colliders), **props**, **regions**, walkable areas (polygons with scaling), and per-room script files. Dialog trees are first-class assets with options + scripts.
- **Scripting:** **QuestScript** — a deliberately simplified C# dialect edited in a built-in mini script editor with autocomplete; it converts to real C# behind the scenes, and a "View C#" button opens the generated file in your IDE ([QuestScript basics](https://powerquest.powerhoof.com/questscript_basics.html)). Blocking sequences are C# coroutines under the hood (`yield return C.Dave.WalkTo(...)`), giving SCUMM-like sequential cutscene code with an escape hatch to full C#. This **two-tier scripting (friendly DSL → real language, always inspectable)** is arguably the best modern design in this space.
- **Editor UX:** strengths — one hub window, template game setups (**LucasArts 9-verb, Sierra text parser, or modern 1-click/2-click interfaces** out of the box ([itch](https://powerhoof.itch.io/powerquest))), integrated sprite animation tool (PowerSprite), instant play-in-editor. Weaknesses — you still live inside Unity (heavyweight install, versions, licensing anxiety post-2023 runtime-fee episode), and room layout uses Unity's scene view rather than a purpose-built room editor.
- **Export/porting:** anything Unity targets — desktop, WebGL, mobile, consoles (with platform licenses). Porting cost = Unity's, not yours.
- **License:** free tool with source; games are unrestricted (donation requested) ([itch](https://powerhoof.itch.io/powerquest)).

### 2.4 Visionaire Studio

https://www.visionaire-studio.net

- **What it is:** the leading commercial dedicated adventure engine (Deponia series, The Whispered World, STASIS, Anna's Quest) ([Visionaire site](https://www.visionaire-studio.net/)).
- **Architecture / data model:** scenes (rooms) with objects, way systems/walkable areas, characters with animation sets, interfaces (verb bars/coins are data-driven), and **actions built from "action parts"** — a no-code list-of-commands visual scripting system. Conditions and values (flags/variables) are first-class editor objects.
- **Scripting:** visual action-parts for the common 90%, **Lua** (currently 5.4) with a Visionaire object model for everything else ([Visionaire wiki: Scripting](https://wiki.visionaire-tracker.net/wiki/Scripting)).
- **Editor UX:** strengths — purpose-built, artists/designers ship whole commercial games without programmers; rich built-in support for the genre's needs (lip sync, particle effects, save systems). Weaknesses — closed source; editor is desktop software (Windows-centric historically); the property-grid-heavy UI has a reputation for being idiosyncratic; you're dependent on one small company for bug fixes and platform support.
- **Export/porting:** Windows, macOS, Linux, iOS, Android, **HTML5**, and consoles (PlayStation, Xbox, Switch) with appropriate licenses ([Visionaire wiki: Licenses](https://wiki.visionaire-tracker.net/wiki/Visionaire_Studio_Licenses)).
- **License:** proprietary. Free version can't export; ~€75 dev license; ~€150 incl. one commercial desktop distribution license; mobile distribution ~€490/game; console licensing separate ([Visionaire wiki](https://wiki.visionaire-tracker.net/wiki/Visionaire_Studio_Licenses_and_Publishing)). Per-game distribution fees are a notable friction vs. free alternatives.

### 2.5 Wintermute Engine (WME)

https://dead-code.org

- **What it is:** Jan Nedoma's adventure engine + toolset (2003–), notable for **2.5D**: real-time 3D characters over 2D backgrounds (used by *The White Chamber*, *Julia*, many Eastern-European titles) ([Wikipedia](https://en.wikipedia.org/wiki/Wintermute_Engine)).
- **Architecture / data model:** object-oriented: scenes contain regions (walkable/blocked), scale levels, waypoint groups, entities; windows/UI are objects too. Every game object = appearance definition + attached script responding to events ([dead-code features](http://dead-code.org/home/index.php/features/)).
- **Scripting:** proprietary OO language, C/JavaScript-like syntax, with the ability to override built-in methods ([Wikipedia](https://en.wikipedia.org/wiki/Wintermute_Engine)).
- **Editor UX:** full toolchain (ProjectMan, SceneEdit, etc.) but Windows-only and now essentially unmaintained; the project is dormant. Historically praised for higher-resolution support when AGS was stuck at low-res.
- **Export/porting:** classic WME is Windows/DirectX. **WME Lite** — a reduced 2D-only SDL reimplementation — was released under the **MIT license** for iOS/Android/desktop portability ([Wikipedia](https://en.wikipedia.org/wiki/Wintermute_Engine)); ScummVM also ships a Wintermute engine, which is how most WME games remain playable today. A cautionary tale: closed, single-maintainer, platform-bound engines die; their games survive only via ScummVM-style reimplementation.
- **License:** classic devkit freeware/donationware (closed source); WME Lite MIT ([Wikipedia](https://en.wikipedia.org/wiki/Wintermute_Engine)).

### 2.6 Ren'Py (adjacent: visual novels)

https://www.renpy.org / https://github.com/renpy/renpy

- **What it is:** the dominant visual-novel engine; adjacent because it's dialog-first with no native rooms/hotspots/pathfinding (point-and-click can be faked with imagemaps but it's not the model).
- **Architecture:** Python + pygame/SDL, with Cython/C for performance; script interpretation is separated from rendering ([Wikipedia](https://en.wikipedia.org/wiki/Ren'Py)).
- **Scripting:** a screenplay-like DSL (`label`, `scene`, `show`, `menu` for dialog choices) with inline Python escape hatches; **Screen Language** — a declarative reactive DSL for UI ([renpy.org](https://www.renpy.org/)). Its **automatic rollback + save-anywhere** system (whole VM state is serializable, players can rewind any choice) is beloved and near-unique.
- **Editor UX:** there is *no visual editor* — a launcher plus your own text editor. This is simultaneously its weakness (intimidating first hour) and strength (scripts are plain text: git-friendly, mergeable, searchable, LLM-friendly). Huge community/tutorial base compensates.
- **Export/porting:** Windows/macOS/Linux/Android/iOS and **HTML5 via WebAssembly (beta)** ([Wikipedia](https://en.wikipedia.org/wiki/Ren'Py)). The web port lags native (Python-in-WASM is heavy) — evidence that web output bolted on later is much harder than web-first.
- **License:** MIT (with some LGPL components) — free commercial use ([Wikipedia](https://en.wikipedia.org/wiki/Ren'Py)).

### 2.7 Adventure Creator (Unity)

https://adventurecreator.org

- **What it is:** the leading paid Unity adventure toolkit (used by *The Last Door: Season 2*, and prototyping on *Firewatch*'s early interaction work per its site testimonials).
- **Architecture / data model:** **Hotspots** (3D or 2D colliders) with configurable interactions, NavMeshes/polygon navigation for walkable areas, inventory, player switching, QTEs, save system, camera system ([adventurecreator.org](https://adventurecreator.org/)).
- **Scripting:** **ActionLists** — node/list-based visual scripting with 100+ adventure-specific action types; custom actions can be written in C# ([Unity Asset Store](https://assetstore.unity.com/packages/tools/game-toolkits/adventure-creator-11896)). Genuinely usable by non-programmers.
- **Interaction modes:** notable for making the interface style a **project setting**: context-sensitive one-click, two-click (use/examine), verb bar, or verb-coin-like choice UIs are all supported configurations.
- **Localization:** first-class — text/speech export for translators, script sheets for voice actors, per-language audio/lipsync ([adventurecreator.org](https://adventurecreator.org/)). Few competitors treat this as core.
- **Export/porting:** PC/Mac/WebGL/iOS/Android; consoles possible with custom scripting ([FAQ](https://adventurecreator.org/faq)).
- **License:** paid closed-source Unity asset (~US$80); no per-game royalties.

### 2.8 Tiny web-based tools: Playdate Pulp, Bitsy, PuzzleScript

These prove that a **browser IDE with instant preview and radical constraint** produces enormous creative output.

**Playdate Pulp** (https://play.date/pulp/):
- Entirely **browser-based editor** + web player for Playdate games. Everything is 8x8 1-bit tiles; the screen is one 25x15-tile "room"; tile types are world/player/sprite/item ([Pulp docs](https://play.date/pulp/docs/)).
- **PulpScript**: terse event-driven language (`on interact do ... end`) attached to tiles ([PulpScript docs](https://play.date/pulp/docs/pulpscript/)). Games export as JSON projects and compile to .pdx for the device.
- Praised as "zero to video game in 60 seconds" ([GameDeveloper](https://www.gamedeveloper.com/game-platforms/playdate-pulp-zero-to-video-game-in-60-seconds)). Lesson: mode-based editor (Room/Tile/Script/Song modes) + always-one-click-away play button.

**Bitsy** (https://ledoux.itch.io/bitsy, https://github.com/le-doux/bitsy):
- Adam Le Doux's "little editor for little games or worlds" (2017), **MIT-licensed**, written in JavaScript. Data model: avatar, rooms, sprites, items, dialog; 1-bit-style pixel editor with two-frame animation ([Opensource.com](https://opensource.com/article/22/1/bitsy-game-design)).
- **Exports a single self-contained HTML file** with game data embedded as a readable text format — trivially shareable/hostable, and the community "hacks" ecosystem grew because the format is open text ([Museum of Data](https://museumofdata.org/objects/bitsy-game-editor/)).
- Thousands of published games by first-time creators. Lesson: the export artifact should be one file you can email.

**PuzzleScript** (https://www.puzzlescript.net, https://github.com/increpare/PuzzleScript):
- Stephen Lavelle's MIT-licensed HTML5 puzzle engine (2013). The whole game is **one text file** (legend, sprites as ASCII art, rewrite **rules** like `[ > Player | Crate ] -> [ > Player | > Crate ]`, win conditions, levels as ASCII maps).
- Browser IDE with live compile/run pane; sharing via GitHub gists; export to standalone HTML ([GameDeveloper](https://www.gamedeveloper.com/design/open-source-html5-puzzle-game-engine-puzzlescript-now-available)).
- Lesson: a sufficiently high-level *declarative* description (rules, not code) plus instant feedback creates a genre-defining tool; also, plain-text projects enable forking/remixing culture.

---

## 3. Comparative Analysis

### 3.1 What makes porting hard

| Cause | Evidence |
| --- | --- |
| **Native, closed, platform-bound interpreters** | Original SCUMM/Sierra interpreters were per-platform binaries; ScummVM had to reverse-engineer them ([ScummVM](https://en.wikipedia.org/wiki/ScummVM)). WME games needed ScummVM/WME Lite to escape Windows ([Wintermute](https://en.wikipedia.org/wiki/Wintermute_Engine)). |
| **Native plugin APIs** | AGS's Windows-DLL plugin system blocked ports of games using popular plugins until each was reimplemented ([AGS repo/history](https://github.com/adventuregamestudio/ags)). |
| **Editor–runtime coupling & Windows-only editors** | AGS editor still Windows-only 25 years on ([Wikipedia](https://en.wikipedia.org/wiki/Adventure_Game_Studio)); Wintermute tools likewise. |
| **Host-engine treadmill** | Escoria's Godot 3→4 migration stalls; Unity toolkits inherit Unity version churn and licensing risk. |
| **Retrofitting web output** | Ren'Py's WASM export is still "beta" years in ([Wikipedia](https://en.wikipedia.org/wiki/Ren'Py)); AGS web is experimental. Web-as-afterthought is expensive. |
| **Per-platform commercial licensing** | Visionaire charges per-game, per-platform-class distribution fees ([Visionaire wiki](https://wiki.visionaire-tracker.net/wiki/Visionaire_Studio_Licenses_and_Publishing)). |

Conversely, what makes porting *easy*: game = pure data + small VM (SCUMM: the entire LucasArts catalog runs anywhere ScummVM compiles); or game = output of a host engine with mature exporters (Unity/Godot); or game = plain HTML/JS (Bitsy/PuzzleScript: "porting" is a non-concept).

### 3.2 What makes authoring easy

- **A purpose-built room editor**: paint hotspots/walkable areas over the background, click event → script stub (AGS). Every general-purpose engine (Godot/Unity) is worse at this specific task than AGS was in 2002.
- **A central project hub** listing rooms/characters/items/dialogs (PowerQuest window) instead of files scattered in a scene tree.
- **Templates for the interaction model**: PowerQuest and Adventure Creator ship 9-verb / parser / two-click templates so a beginner has a playable game in minutes.
- **Two-tier scripting**: visual or simplified script for designers, real code escape hatch (Visionaire action-parts→Lua, PowerQuest QuestScript→C#, Ren'Py DSL→Python). Crucially PowerQuest keeps the generated real code *visible*, avoiding the visual-scripting ceiling.
- **Sequential-looking blocking script for cutscenes** with engine-managed concurrency (SCUMM `break-here`/`wait-for`, PowerQuest coroutines). Writing `walk; say; turn; say` linearly is the core authoring pleasure of the genre.
- **Instant preview**: Bitsy/PuzzleScript/Pulp compile-and-play in under a second in the same browser tab.
- **Plain-text project formats** (PuzzleScript, Bitsy, Ren'Py) enable version control, diffing, remixing, and now LLM assistance; opaque binary project files (classic AGS rooms, Visionaire .ved binary mode) do not.

### 3.3 What makes authoring hard

- Living inside a giant host engine (Unity/Godot) for a fundamentally 2D, data-light genre.
- Windows-only editors in 2026.
- Visual scripting with no code escape hatch (or with hidden generated code).
- Blocking-vs-nonblocking confusion when the engine lacks real script concurrency (a chronic AGS forum topic).
- Bitmap-mask walkable areas and hotspots that don't survive resolution changes (AGS legacy), vs. resolution-independent polygons (SCUMM/Thimbleweed/PowerQuest).

### 3.4 Verb interfaces: 9-verb vs verb coin vs two-click

- **Verb bar**: Maniac Mansion shipped 15 verbs; Monkey Island cut to 12 then 9 (the canonical grid) as unused verbs were pruned. Maximum expressiveness, maximum UI weight; today a deliberate retro flavor (Thimbleweed Park makes it optional).
- **Verb coin**: Full Throttle (1995) introduced the hold-click radial menu; Curse of Monkey Island refined it to **hand / eye / mouth** ([Time Extension: making of CMI](https://www.timeextension.com/features/the-making-of-the-curse-of-monkey-island-scumms-underrated-swansong)). Elegant, but Full Throttle's version couldn't combine inventory items — CMI had to restore that for its 100+ items ([Time Extension](https://www.timeextension.com/features/the-making-of-the-curse-of-monkey-island-scumms-underrated-swansong)). Extra click-and-hold cost per interaction; awkward on touch.
- **Two-click / context-sensitive**: left-click = interact (context-appropriate verb), right-click = examine; or Broken Sword-style single smart cursor. Now the de-facto modern standard (Deponia, Wadjet Eye titles, Broken Age); lowest friction, at the cost of expressive verb humor ([Far Far Futures analysis](https://farfarfutures.wordpress.com/2022/04/19/monkey-island-and-the-ascent-of-point-and-single-click/)).
- **Design takeaway**: internally, all of these reduce to SCUMM's sentence (`verb, object, [object2]`). An engine that models interactions as that triple can offer any of the three UIs as a skin — exactly what PowerQuest and Adventure Creator do ([itch](https://powerhoof.itch.io/powerquest), [adventurecreator.org](https://adventurecreator.org/)).

### 3.5 Licensing summary

| Platform | License | Commercial friction |
| --- | --- | --- |
| ScummVM | GPL-2.0+ | Code unusable in permissive products |
| AGS | Artistic 2.0 (editor + engine) | None |
| Escoria | MIT | None |
| PowerQuest | Free w/ source (donationware) + Unity's terms | Unity licensing risk |
| Visionaire | Proprietary | €75–150 + per-game/platform fees |
| Wintermute | Freeware; WME Lite MIT | Abandoned |
| Ren'Py | MIT | None |
| Adventure Creator | Paid asset (~$80) + Unity's terms | Unity licensing risk |
| Pulp | Free hosted tool (closed) | Playdate-only output |
| Bitsy / PuzzleScript | MIT | None |

---

## 4. Design implications for a new web-first platform

1. **Game = data + tiny VM, never compiled monolith.** Follow SCUMM: project content (rooms, objects, scripts) is portable data interpreted by a small runtime. The runtime is the only thing that ever needs porting — and if it's TypeScript/WASM, the browser *is* the port ([ScummVM's whole existence](https://en.wikipedia.org/wiki/ScummVM) proves the payoff).
2. **Browser-based editor with sub-second play preview**, Bitsy/PuzzleScript/Pulp style: zero install, Room/Script/Sprite modes, a Play button that hot-reloads state. This is the single biggest UX differentiator vs. AGS/Visionaire/Unity toolchains.
3. **Plain-text, git-diffable project format** (JSON/YAML + script files, one folder or even one file for small games). Enables version control, collaboration, remix culture (Bitsy hacks, PuzzleScript gists) and LLM-assisted authoring. No opaque binaries.
4. **Single-file self-contained HTML export as the primary artifact** (Bitsy model), plus PWA packaging and Electron/Tauri wrappers for stores. Never bolt web on later (Ren'Py's still-beta WASM warns why).
5. **Room-centric data model**: room = background(s) + hotspots + objects-with-states + regions + walkable areas + exits + room script. Copy AGS's ontology (it's proven across thousands of games) but use **resolution-independent polygons**, not bitmap masks.
6. **Walkable areas as convex polygons with per-polygon scale ranges and runtime enable/disable**, SCUMM/Thimbleweed style — Gilbert re-validated this exact model in 2017 ([Thimbleweed blog](https://blog.thimbleweedpark.com/walkbox_video.html)). Include graceful-failure rules (snap actors into valid boxes on room entry). Add walk-behind masking via polygon+baseline or depth layers.
7. **Model every interaction as the SCUMM sentence triple** (`verb, object, object2?`) internally, and ship **switchable interface templates**: two-click (default), verb coin, 9-verb bar, touch-friendly variant. PowerQuest/Adventure Creator prove templates are what let beginners start ([PowerQuest](https://powerhoof.itch.io/powerquest)).
8. **Cooperative concurrency as a language feature**: scripts are coroutines with `waitFor(actor)`, `breakFrame()`, parallel `startScript()` — SCUMM's greatest invention, trivially implementable on JS generators/async. Avoid AGS's blocking-call model as the *only* option.
9. **`cutscene { } override { }` semantics built in**: cutscenes are skippable by construction, with a required fast-forward handler, and auto input-locking. Also auto-skippable dialog lines and a global "skip seen text" à la Ren'Py.
10. **Two-tier scripting with visible generated code**: a friendly, movie-script-flavored DSL for the 90% case that is (or compiles to) readable TypeScript/JavaScript, with a one-click "view/eject to code" like PowerQuest's "View C#" button. Never a visual-only ceiling; never hidden codegen.
11. **Dialog trees as first-class data** with a writer-friendly text format (options, conditions, once-only flags — AGS dialog script / Ink-like), editable both as text and as a graph view.
12. **Serializable-by-construction game state → free save-anywhere and rollback.** All mutable state lives in the VM (flags, actor positions, running scripts' continuations). Ren'Py shows players love rewind; SCUMM's savegames worked because state was VM state.
13. **Costume-style actor animation as a built-in system**: named directional animation sets (walk/talk/idle per facing) addressed by high-level commands (`actor.play("reach")`), with automatic lip-flap during `say`. Don't make every author rebuild this (SCUMM costumes, PowerSprite both exist because it's essential).
14. **Localization and voice pipeline from day one** (string extraction, per-language audio slots, script sheets for actors) — Adventure Creator demonstrates this is a purchasing criterion for serious teams ([adventurecreator.org](https://adventurecreator.org/)).
15. **Own the runtime; license it MIT/permissively.** Don't build on Unity/Godot (version treadmill, licensing risk, heavyweight authoring) and don't use GPL for the runtime (blocks commercial use patterns). MIT is the community norm among the healthiest projects here (Ren'Py, Bitsy, PuzzleScript, Escoria, WME Lite). No per-game fees (avoid Visionaire's friction).

---

## Appendix: Primary sources

- ScummVM: https://github.com/scummvm/scummvm · https://www.scummvm.org/faq/ · https://en.wikipedia.org/wiki/ScummVM
- SCUMM: https://en.wikipedia.org/wiki/SCUMM · https://www.gamedeveloper.com/design/the-scumm-diary-stories-behind-one-of-the-greatest-game-engines-ever-made · https://www.pagetable.com/?p=614 · https://github.com/AlbanBedel/scummc/wiki/Scumm-6-data-format
- Thimbleweed Park engine blog: https://blog.thimbleweedpark.com/walkbox_video.html · https://blog.thimbleweedpark.com/engine.html
- AGS: https://en.wikipedia.org/wiki/Adventure_Game_Studio · https://github.com/adventuregamestudio/ags
- Escoria: https://github.com/deep-entertainment/escoria · https://docs.escoria-framework.org/en/devel/general/what_is_escoria.html · https://godotengine.org/article/our-point-click-framework-finally-out/
- PowerQuest: https://powerquest.powerhoof.com/ · https://powerhoof.itch.io/powerquest · https://powerquest.powerhoof.com/questscript_basics.html
- Visionaire: https://www.visionaire-studio.net/ · https://wiki.visionaire-tracker.net/wiki/Visionaire_Studio_Licenses_and_Publishing · https://wiki.visionaire-tracker.net/wiki/Scripting
- Wintermute: https://en.wikipedia.org/wiki/Wintermute_Engine · https://dead-code.org/home/
- Ren'Py: https://www.renpy.org/ · https://en.wikipedia.org/wiki/Ren'Py · https://github.com/renpy/renpy
- Adventure Creator: https://adventurecreator.org/ · https://adventurecreator.org/faq
- Pulp: https://play.date/pulp/docs/ · https://play.date/pulp/docs/pulpscript/ · https://www.gamedeveloper.com/game-platforms/playdate-pulp-zero-to-video-game-in-60-seconds
- Bitsy: https://github.com/le-doux/bitsy · https://opensource.com/article/22/1/bitsy-game-design
- PuzzleScript: https://www.puzzlescript.net/ · https://github.com/increpare/PuzzleScript
- Verb UIs: https://www.timeextension.com/features/the-making-of-the-curse-of-monkey-island-scumms-underrated-swansong · https://farfarfutures.wordpress.com/2022/04/19/monkey-island-and-the-ascent-of-point-and-single-click/
