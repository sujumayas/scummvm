# The Cure Needs a Stamp
*A bureaucratic space adventure — Grog engine demo using the corporate-game cast.*

## Premise
Junior xenomycologist **Dr. Chip Marlow** (keyboard-warrior-80s — the keyboard is his
field instrument) discovers the cure for **The Beige** — a galactic plague that slowly
turns whole planets beige, boring, and slightly damp. The cure is trivially cheap:
swamp moss + vending-machine coffee + a karaoke crystal. Curing the galaxy takes an
afternoon. Getting the Intergalactic Council to *approve* it takes the rest of the game.

Satire target: State + Corporate bureaucracy — queues, circular form dependencies,
consultants, committees, and a mail room that is the only thing that actually works.

## Cast (from corporate-game/)
| asset | role |
|---|---|
| keyboard-warrior-80s | **Dr. Chip Marlow** — player |
| blue-yeti | **Maurice**, lab janitor. Knows everything. Warned you. |
| gray-gremlin | **Clerk Grimble**, Intake Window 7 |
| blue-toad-scarf | **Bob**, in the queue for 12 years, holds a spare Form 88-B |
| shark-fin-guard | **Sgt. Finn**, guards the Council lift |
| pink-walrus | **Courier Pemberton**, Interplanetary Mail window (the finale) |
| hooded-pointy, cone-head-gnome | queue extras (decor) |
| frog-monk | **Notary Ribbert**, Stamp Sanctum |
| jellyfish-head | **Legal Counsel Sting**, grants Exception Waivers |
| mushroom-pilgrim | **Consultant Porcini**, strategy consultant ("synergy") |
| nautilus-imperial | **High Chancellor Nautileon** |
| asterion-priest | **Councilor Asterion** — Protocol ("no precedent") |
| walrus-tusker | **Councilor Tuskerman** — Budget ("who pays?") |
| toad-critic | **Councilor Croakwell** — Risk & Compliance ("untested!") |

## Rooms
1. **lab** — Outpost Lab: centrifuge, vending machine, couch (coin), karaoke machine
   (crystal), moss on the wall, shuttle door. Tutorial + discovery cutscene.
2. **hall** — Intergalactic Administration Intake Hall (scrolling, 480px): ticket
   machine (#4,000,000,007 — now serving 12), Window 7 (Grimble), queue (Bob + extras),
   Mail window (Pemberton), Council lift (Finn), lift to Annex.
3. **annex** — Dept. of Forms, Stamps & Redundancy: Notary desk (Ribbert), Legal nook
   (Sting), Consultant corner (Porcini), Binder of Regulations, photocopier.
4. **council** — Council Chamber: Nautileon + three councilors on the bench.

## Puzzle chain
- **Lab:** coin (couch) → coffee ×2 from vending machine ("BOGO fiscal stimulus") ·
  moss (wall) · crystal (karaoke machine). Put all three in centrifuge → **CURE** +
  **recipe napkin**. Cutscene of self-importance → to hall.
- **Hall:** Finn needs **Appointment Chit**. Grimble needs **notarized Form 88-B**;
  dispenser empty → trade spare **coffee** to Bob for his Form 88-B. Ticket machine
  running gag. Lift to annex now relevant.
- **Annex:** Ribbert stamps 88-B only with Requisition 12-A; Legal issues 12-A only
  for already-stamped forms (circular). Read **Binder** → find **Regulation 7.G**
  ("any form may serve as its own prerequisite on Tuesdays") → cite it to Sting →
  **Exception Waiver** → Ribbert stamps 88-B (ceremony). Porcini teaches the phrase
  **"cost-neutral synergy"** (flag for council).
- **Hall:** stamped 88-B → Grimble → **Appointment Chit** → Finn opens lift.
- **Council:** present cure. Subcommittee formed; three blockers:
  Croakwell (risk) → drink the cure in front of him; Tuskerman (budget) → say
  "cost-neutral synergy"; Asterion (protocol) → cite Regulation 7.G. Motion passes…
  rollout in **7–9 business eons**. Womp.
- **Finale:** photocopy the **recipe napkin** in the Annex → give copies to
  **Courier Pemberton** → mailed to every inhabited planet, arrives tomorrow.
  Galaxy cured; the Council is still deliberating the press release. THE END.

## Items
coin, coffee (spare), moss, crystal, cure vial, recipe napkin, form 88-B
(flag `form_stamped`), exception waiver, appointment chit, recipe copies.
Icons: hand-drawn DB32 pixel sprites.

## Music
lab = quirky lo-fi science · hall = infinite hold-muzak · annex = dusty waltz ·
council = pompous anthem · finale = fanfare. Chiptune patterns in-JSON.
