# Elegy of the Night — The Belmont Archives

An unofficial, non-commercial fan sequel to the gameplay of *Castlevania: Symphony of the Night*,
playable in any modern browser. Alucard returns to Dracula's castle one year later and discovers that
the hidden library of the Belmont family — the **Belmont Archives** — has been dragged into it by a
renegade chronicler, the Scrivener, who intends to erase the hunters from history.

Everything is original and generated at runtime by the code: pixel art (procedural sprites, tiles
and backgrounds), music (Web Audio synthesis), sound effects. Character voices are spoken in English
by the browser's speech synthesis. No assets from the original game are used.

> Castlevania, Alucard and the Belmont family are trademarks of Konami. This project is not
> affiliated with or endorsed by Konami.

## Play
* Open `index.html` in a browser (Chrome, Edge, Firefox, Safari), or the single-file build
  `dist/elegy-of-the-night.html`.
* Saves: 3 files at the save points (red crystals). They are stored in the browser (localStorage);
  when the game runs as a claude.ai artifact they are stored in your claude.ai account. You can also
  export/import a save as a `.json` file from *Menu → System*.

### Controls
| Action | Keyboard | Gamepad |
|---|---|---|
| Move / crouch | ← → / ↓ | D-pad / left stick |
| Jump (↓+jump drops through platforms) | Z or Space | A |
| Right hand / left hand (hold a shield to guard) | X / C | X / B |
| Backdash | A or Shift | Y |
| Sub-weapon (costs hearts) | ↑ + X, or S | RT |
| Bat / Mist / Wolf (relics needed) | Q / W / E | LB / RB / LT |
| Menu / Map | Enter or Esc / Tab or M | Start / Back |
| Interact (save, talk, read, teleport, portal) | ↑ | ↑ |

Spells use fighting-game motions + attack (listed in *Menu → Spells*), e.g. Hellfire ↑ ↓ ↘ → + X.
Touch controls appear automatically on phones and tablets.

## What is in it
* Alucard with SotN mechanics: double jump, backdash, dive kick, super jump, two-handed equipment
  slots, shields, sub-weapons with hearts, command spells, bat/mist/wolf forms, familiars, relics
  that can be toggled, levelling, status effects, Librarian shop, teleporters, map with completion %.
* Two maps: **Dracula's castle** (Entrance, Marble Gallery, Long Library, Clock Tower, Royal Chapel,
  Castle Keep, Underground Caverns, Catacombs) and the new **Belmont Archives** (Reading Hall, Stacks,
  Scriptorium, Hall of Hunters, Forbidden Vault), with its own map page.
* 79 rooms (53 in the castle, 26 in the Archives), each checked by `tools/validate.js` for doors,
  reachability per ability level and the global progression.
* 92 items: 25 weapons (swords, greatswords, rapiers, maces, a spear, whips, tomes, fists), 23 pieces of
  armour (shields, helmets, body armour, cloaks), 15 accessories, 15 consumables; 11 relics; 8
  sub-weapons (including the new Silver Quill, Inkwell and Grimoire Pages) and 7 spells (including the
  new Ink Lance, Belmont Ward and Crimson Requiem).
* 33 enemy types and 6 bosses (Bone Colossus, Ink Doppelganger, Echo of the Belmont, Bibliophage,
  Clockwork Seraph and the Scrivener), each with a bestiary entry.
* 18 synthesized music tracks and 84 sound effects (Web Audio, no audio files); bilingual text
  (Español / English); English voice acting through the browser's speech synthesis (the voice quality
  depends on the voices installed in the browser/OS).

## Development
Classic scripts, no build step (see `index.html` for the load order and `docs/` for the engine
guide, world plan and bestiary).
```
node tools/validate.js            # checks every room: format, doors, reachability per ability level
node tools/build.js               # dist/elegy-of-the-night.html (+ dist/artifact.html)
NODE_PATH=/path/to/global/node_modules node tools/shot.js tour      # headless screenshots (Playwright)
NODE_PATH=/path/to/global/node_modules node tools/shot.js bosses    # wakes and defeats every boss
NODE_PATH=/path/to/global/node_modules node tools/roommaps.js out/  # full-room renders for review
NODE_PATH=/path/to/global/node_modules node tools/test_audio.js     # audio engine checks
```
