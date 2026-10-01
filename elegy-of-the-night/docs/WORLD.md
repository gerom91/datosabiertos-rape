# Elegy of the Night — world plan

Two maps: **Dracula's castle** and the **Belmont Archives** (a pocket realm inside the
Chronicle, reached through the portal book in the Long Library; it has its own map page and
completion %). Coordinates are map cells (one cell = one 24×14-tile screen). The plan is also
in `tools/world_plan.json` (machine readable). Room ids, positions, sizes and door lists below
are fixed — implement them exactly so neighbours line up.

## Progression (ability levels used by the validator)
| lvl | gained | where |
|---|---|---|
| 0 | — | start (Castle Entrance → Marble Gallery) |
| 1 | Leap Stone (double jump) | Bone Colossus, `gal_boss` |
| 2 | Soul of Wolf | Ink Doppelganger, `stk_doppel` (Archives) |
| 3 | Form of Mist | pedestal in `stk_mist` (behind a wolf tunnel) |
| 4 | Belmont Crest (+ Chronicle Page I) | Echo of the Belmont, `hun_echo` (behind mist grates) |
| 5 | Soul of Bat | pedestal in `cav_bat` (Caverns: wolf tunnel in, mist grate to the relic) |
| 6 | Lantern of Revelation (optional, ink walkways) | `vault_deep` |
| — | Gravity Boots (optional) | `cha_altar` |
| — | Chronicle Page II | Bibliophage, `vault_worm` (Vault sealed by the Crest) |
| — | Chronicle Page III | Clockwork Seraph, `clk_top` (Clock Tower sealed by the Crest) |
| end | Scrivener | `keep_throne`: needs the bat to reach the Keep and the 3 pages for the door |

Critical path: ent_gate → ent_hall → ent_corridor → ent_shaft → ent_upper → gal_entry → gal_hall
(ground) → gal_corridor → gal_boss (Leap Stone) → gal_save → gal_east (upper door) → lib_entry →
lib_hall → lib_shop → lib_portal → [Archives] arc_entry → arc_hall1 → arc_save → arc_cross ↓ stk_shaft →
stk_corridor → stk_doppel (wolf) → stk_after → stk_mist (mist) → back up arc_cross ↑ scr_entry → scr_desks →
scr_grate ↑ hun_gallery → hun_echo (Crest, Page I) → hun_richter → [Vault via stk_shaft seal] → vault_worm
(Page II) → [castle] gal_upper → gal_tower_seal → clock tower → clk_top (Page III) → [castle] ent_cellar wolf
tunnel → caverns → cav_bat (bat) → fly up from clk_top (T1) or cha_belfry (T0) to the Keep → keep_hall page
door → keep_throne.

## Maps
```
CASTLE  (x →, y ↓; each cell = one 24x14-tile screen)
     0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 
  0   .  .  .  .  .  .  .  .  .  .  .  .  .  . wesweswes . thrthrthrthr . easeaseas .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  1   .  .  .  .  .  .  .  .  .  .  .  .  .  . weswesweshalhalhalhalhalhaleaseaseas .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  2   .  .  .  .  .  .  .  .  .  .  .  .  .  . weswesweshalhalhalhalhalhaleaseaseas .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  3   .  .  .  .  .  .  .  .  .  .  .  .  .  . belbel .  .  .  .  .  .  .  . toptoptop .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  4   .  .  .  .  .  .  .  .  .  .  .  .  .  . belbel .  .  .  .  .  .  .  . toptoptop .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  5   .  .  .  .  .  .  .  .  .  .  .  .  .  . belbel .  .  .  .  .  .  .  . toptoptop .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  6   .  .  .  .  .  .  .  .  .  . altaltaltalttowtow .  .  .  .  .  .  .  . uppuppupp .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  7   .  .  .  .  .  .  .  .  .  . altaltaltalttowtow .  .  .  .  .  .  .  . uppuppupp .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  8   .  .  .  .  .  .  .  .  .  .  .  .  .  . towtow .  .  .  .  .  .  .  . uppuppupp .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  9   .  .  .  .  .  .  .  .  .  .  .  .  .  . towtowsav .  .  .  .  .  .  . uppuppupp .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 10   .  .  .  .  .  .  .  .  .  .  .  .  .  . towtow .  .  .  .  .  .  .  . uppuppupp .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 11   .  .  .  .  .  .  .  .  .  .  .  .  .  . towtow .  .  .  .  .  .  .  . basbas .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 12   .  .  .  .  .  .  .  .  .  . navnavnavnaventent .  .  .  .  .  .  .  . basbasgeageageageatp .  .  .  .  .  .  .  .  .  .  .  . 
 13   .  .  .  .  .  .  .  .  . connavnavnavnaventent .  .  .  .  .  .  .  . basbasgeageageageasav .  .  .  .  .  .  .  .  .  .  .  . 
 14   .  .  .  .  .  .  .  .  .  .  .  .  .  . entent .  .  .  .  .  .  .  . basbas .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 15   .  .  .  .  .  .  .  .  .  .  .  .  .  . weswes .  .  .  .  .  .  .  . tow .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 16   .  .  .  .  .  .  .  .  .  .  .  .  .  . wesweshalhalhalhaluppuppuppupptow .  .  .  .  .  .  .  . halhalhalhalhaluppuppuppupptp
 17   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . halhalhalhal .  .  . bosbos . easeaseaseasentententhalhalhalhalhal .  . porpor . 
 18   .  .  .  .  .  .  .  .  .  . shauppuppuppententhalhalhalhalcorcorcorbosbossaveaseaseaseas .  .  . halhalhalhalhalshoshoporpor . 
 19   .  .  . halhalhalbalbal .  . shasav .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 20  gatgatgathalhalhalcorcorcorcorshacelcelcelentent .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 21   .  .  .  .  .  .  .  .  .  .  .  .  .  . entent .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 22   .  .  .  .  .  .  .  .  .  .  .  .  .  . ententfalfalfal .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 23   .  .  .  .  .  .  .  .  .  . laklaklaklaklaklakfalfalfalcrycrycrysavsav .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 24   .  .  .  .  .  .  .  .  .  . laklaklaklaklaklakdeedeedeedee .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 25   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . deedeedeedee .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 26   .  .  .  .  .  .  .  .  .  .  .  . botbotbotbotdeedeedeedeebatbat .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 27   .  .  .  .  .  .  .  .  .  .  .  . botbotbotbot .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 28   .  .  .  .  .  .  .  .  .  .  .  .  . entent .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 29   .  .  .  .  .  .  .  .  .  .  .  .  . entent .  .  .  .  . crycrycry .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 30   .  .  .  .  .  .  .  .  .  .  .  .  . ententossossossossosscrycrycrysavdeedeedee .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 31   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . deedeedee .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 32   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . deedeedee .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 

ARCHIVES  (x →, y ↓; each cell = one 24x14-tile screen)
     0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 
  0   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . echechech .  . 
  1   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . galgalgalgalgalechechechricric
  2   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . galgalgalgalgal .  .  .  .  . 
  3   .  .  .  .  .  .  .  .  .  .  .  .  .  .  . weswesweswesentent .  .  .  . gra .  .  .  .  .  .  .  . 
  4   .  .  .  .  .  .  .  .  .  .  .  .  .  .  . weswesweswesententdesdesdesdesgra .  .  .  .  .  .  .  . 
  5   .  .  .  .  .  .  .  .  .  .  .  .  . inkinkinkink .  . entent .  .  .  .  .  .  .  .  .  .  .  .  . 
  6   .  .  .  .  .  .  .  .  .  .  .  .  . inkinkinkink . crocro .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  7   .  .  .  .  .  .  .  .  .  .  .  .  . halhalhalhal . crocro .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  8   .  .  .  .  .  .  .  .  .  . entententhalhalhalhalsavcrocro .  .  .  .  .  .  .  .  .  .  .  .  .  . 
  9   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . crocrotp .  .  .  .  .  .  .  .  .  .  .  .  . 
 10   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . shasha .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 11   .  .  .  .  .  .  .  .  .  .  .  . tomwesweswesweswesshasha .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 12   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . shasha .  .  .  . dopdop .  . mismis .  .  .  . 
 13   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . shashacorcorcorcordopdopaftaftmismis .  .  .  . 
 14   .  .  .  .  .  .  .  .  .  .  .  .  . stastastastagatgat .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 15   .  .  .  .  .  .  .  .  .  .  .  .  . stastastastagatgat .  .  .  .  .  .  .  .  .  .  .  .  .  .  . 
 16   .  .  .  .  .  .  .  .  .  .  .  .  . deedeedeedee . worworworwor .  .  .  .  .  .  .  .  .  .  .  . 
 17   .  .  .  .  .  .  .  .  .  .  .  .  . deedeedeedee . worworworwor .  .  .  .  .  .  .  .  .  .  .  . 
 18   .  .  .  .  .  .  .  .  .  .  .  .  . deedeedeedeesavworworworwortretre .  .  .  .  .  .  .  .  .  . 

```

### Castle rooms

| id | area | x,y | w×h | doors | lvl | notes |
|---|---|---|---|---|---|---|
| `ent_gate` | entrance | 0,20 | 3×1 | R0 | 0 | DONE. Outdoor approach, start. |
| `ent_hall` | entrance | 3,19 | 3×2 | L1 R0 R1 | 0 | DONE. Erase cutscene, Rusted Saber. |
| `ent_balcony` | entrance | 6,19 | 2×1 | L0 | 0 | DONE. Teleporter, Traveler's Cloak. |
| `ent_corridor` | entrance | 6,20 | 4×1 | L0 R0 | 0 | DONE. |
| `ent_shaft` | entrance | 10,18 | 1×3 | L2 R0 R1 R2 | 0 | DONE. |
| `ent_save` | entrance | 11,19 | 1×1 | L0 | 0 | DONE. Save. |
| `ent_upper` | entrance | 11,18 | 3×1 | L0 R0 | 0 | DONE. R0 → gal_entry. |
| `ent_cellar` | entrance | 11,20 | 3×1 | L0 R0 | 0 | DONE. R0 is a 1-tile-high wolf tunnel at row 11 → cav_entry L0 (arrival on row 11). |
| `gal_entry` | gallery | 14,18 | 2×1 | L0 R0 | 0 | Short marble antechamber. Enemies: marionette, bone_scribe. 2 candles (one sub:holy_water). |
| `gal_hall` | gallery | 16,16 | 4×3 | L2 R2 L0 R0 | 0 | Grand three-tier marble hall. Ground tier (floor rows 40-41) is the critical path L2→R2 at lvl 0. Middle tier (floor at row 26) reachable by stairs/platforms (single jumps). Top tier (row 12 floor) reachable ONLY with double jump (one 5-7 tile rise) → gates {L0:1, R0:1}. Maria npc on the ground tier: b.npc(x,y,'maria',{scene:'maria_gallery', scene2:'maria_again'}). Items: velvet_hat (middle), hp_up (top). Enemies: marionette x2, gargoyle, mirror_wraith. Statues/columns feel. |
| `gal_west` | gallery | 14,15 | 2×2 | R1 T0 | 1 | Small hall. A Belmont seal: fill the T0 shaft with 'X' (gate T0:4). Item garnet_ring. Enemy spear_guard. T0 leads up to the Chapel (climb with ledges inside cha_entry). |
| `gal_upper` | gallery | 20,16 | 4×1 | L0 R0 | 1 | Upper gallery corridor, paintings, chandeliers. Items: mp_up, iron_helm. Enemies: spear_guard, gargoyle x2. |
| `gal_tower_seal` | gallery | 24,15 | 1×2 | L1 T0 | 1 | Vertical shaft: from L1 up to T0, blocked by a seal 'X' band (gate T0:4). Ledges inside for climbing (double jump available). |
| `gal_corridor` | gallery | 20,18 | 3×1 | L0 R0 | 0 | Corridor to the boss. Item longsword (displayed on a pedestal). Enemies: marionette x2, spear_guard. |
| `gal_boss` | gallery | 23,17 | 2×2 | L1 R1 | 0 | Boss arena for 'colossus' (Bone Colossus). Flat floor at row 26 (cell-row 1), no platforms in the middle, maybe two small ledges at row 20 near the walls. Boss placed near the right wall: b.boss(36, 25, 'colossus'). Reward: Leap Stone. |
| `gal_save` | gallery | 25,18 | 1×1 | L0 R0 | 1 | Save room. |
| `gal_east` | gallery | 26,17 | 4×2 | L1 R0 | 1 | East wing, tall windows. Enter L1 (ground). The R0 door (upper level, row 12 floor) needs the double jump (one 5-7 tile rise): gates {} because lvl is 1. Items: heart_up, candle sub:cross. Enemies: mirror_wraith, gargoyle. |
| `lib_entry` | library | 30,17 | 3×1 | L0 R0 | 1 | Library vestibule. Enemies: flying_tome x2. Candles (lantern style looks fine). |
| `lib_hall` | library | 33,16 | 5×3 | L1 R2 R0 | 1 | Huge library hall (5x3) with tall bookcases, wooden walkways at several heights, ladders as platforms. Path L1 → R2 (shop) easy; R0 (upper right door, row 12 floor) via platforms (double jump ok, lvl 1). Items: ember_tome on a high shelf, hp_up hidden behind a breakable shelf (b.hidden). Enemies: flying_tome x3, scholar_ghoul x2, candle_imp. |
| `lib_shop` | library | 38,18 | 2×1 | L0 R0 | 1 | The Librarian: b.shop(x, 11) at the left-middle, and a save point b.save(...) on the right. No enemies. darkness 0.15. |
| `lib_portal` | library | 40,17 | 2×2 | L1 | 1 | Reading room with the PORTAL book to the Belmont Archives: b.portal(x, 25, 'arc_entry', 5, 11) (arrive at tile 5,11 of arc_entry). Place it in the middle of the bottom floor. No enemies. A lore lectern optional. |
| `lib_upper` | library | 38,16 | 4×1 | L0 R0 | 1 | Upper stacks corridor. Items: sapphire_ring, mana_tonic. Enemies: candle_imp x2, flying_tome. |
| `lib_tp` | library | 42,16 | 1×1 | L0 | 1 | Teleporter. |
| `clk_base` | clocktower | 24,11 | 2×4 | B0 R1 T1 | 4 | Clock tower base: tall 2x4 shaft. B0 entry from below (land on a ledge right above the hole!). Climb with ledges/moving platforms (double jump). R1 → gears room; T1 → clk_upper. Enemies: cog_imp x2, gorgon_head. Candles. |
| `clk_gears` | clocktower | 26,12 | 4×2 | L0 R0 R1 | 4 | Gear room: moving platforms (b.mplat) over spikes '^'. Item clock_hammer. Enemies harpy, cog_imp. R0 → teleporter, R1 → save. |
| `clk_tp` | clocktower | 30,12 | 1×1 | L0 | 4 | Teleporter. |
| `clk_save` | clocktower | 30,13 | 1×1 | L0 | 4 | Save room. |
| `clk_upper` | clocktower | 24,6 | 3×5 | B1 T1 | 4 | Big vertical (3x5) with pendulum decor, moving platforms and ledges. Lore cas_clock. Item hp_up. Enemies: gorgon_head x2, harpy x2, cog_imp. Exit T1 at the top (to the boss room). |
| `clk_top` | clocktower | 24,3 | 3×3 | B1 T1 | 4 | Seraph arena (3x3): wide floor at row 40, a few floating platforms at rows ~30 and ~22. Boss 'seraph' (reward: page3 + hourglass_pin). T1 → Keep, gate T1:5 (bat only: no ledges reach the hole). |
| `cha_entry` | chapel | 14,12 | 2×3 | B0 L0 T0 | 4 | Chapel entry shaft (2x3): from B0 (bottom, coming from gal_west) climb up; L0 → nave; T0 → cha_tower. Enemies choir_ghost. Make sure there is a ledge next to the B0 hole. |
| `cha_nave` | chapel | 10,12 | 4×2 | R0 L1 | 4 | Nave (4x2) with pews, stained glass. Enemies: templar, choir_ghost x2. Item silver_plate. L1 → confessional. |
| `cha_confess` | chapel | 9,13 | 1×1 | R0 | 4 | Confessional: crimson_shield + lore cas_chapel. |
| `cha_tower` | chapel | 14,6 | 2×6 | B0 L1 R3 T0 | 4 | Bell tower climb (2x6): ledges alternating, double jump. L1 → altar, R3 → save, T0 → belfry. Item mp_up. Enemies: choir_ghost, harpy. |
| `cha_altar` | chapel | 10,6 | 4×2 | R1 | 4 | Altar room: relic gravity_boots on the altar, item chapel_halberd. Enemies: templar x2. |
| `cha_save` | chapel | 16,9 | 1×1 | L0 | 4 | Save room. |
| `cha_belfry` | chapel | 14,3 | 2×3 | B0 T0 | 4 | Belfry (2x3) with bells. Item heart_up. T0 → keep_west, gate T0:5 (bat; or gravity boots). |
| `keep_west` | keep | 14,0 | 3×3 | B0 R2 | 5 | Keep west tower (3x3): arrive from below (B0) — ledge next to the hole. Climb to R2. Enemies: axe_lord, blood_skeleton x2. Item crown_ash. |
| `keep_hall` | keep | 17,1 | 6×2 | L1 R1 T1 | 5 | Throne antechamber (6x2): long hall, red curtains. Save point. Lore cas_keep. Item nightguard; dhampir_blade hidden in a breakable wall. The T1 door (to keep_throne) is sealed by the three pages: do NOT carve it as open tiles. Instead leave T1 solid and add an interactive page lock (see note in WORLD.md 'Keep door'). |
| `keep_east` | keep | 23,0 | 3×3 | L2 B2 | 5 | Keep east tower (3x3): arrive from clk_top (B2) by bat; climb/descend to L2. Enemies: axe_lord, blood_skeleton. Item royal_cloak. |
| `keep_throne` | keep | 18,0 | 4×1 | B0 | 5 | Final arena (4x1): flat floor row 12, high ceiling, big windows, no platforms. Boss 'scrivener' (reward: scene 'ending'). Arrive from B0 (hole in the floor at cols 10-13): put ledges next to the hole. |
| `cav_entry` | caverns | 14,20 | 2×3 | L0 B0 R2 | 2 | Cave descent (2x3). L0 arrival is a 1-tile tunnel at row 11 (wolf) — keep row 11 open next to L0, solid above. Go down to B0 (→ lake) or R2 (→ falls). Enemies crystal_crawler x2. Item hp_up. |
| `cav_lake` | caverns | 10,23 | 6×2 | T4 R1 | 2 | Underground lake (6x2) with water '~' pools. Arrive from T4 (top, x14 column) — there must be a ledge under the hole. Items blood_signet, moonlit_blade. Enemies drowned_one x2, cave_toad. R1 → cav_deep. |
| `cav_falls` | caverns | 16,22 | 3×2 | L0 R1 | 2 | Waterfall chamber (3x2). Enemies crystal_crawler, cave_toad. Item mana_tonic. |
| `cav_crystal` | caverns | 19,23 | 3×1 | L0 R0 | 2 | Crystal grotto corridor. Enemies cave_toad, drowned_one. Item heart_up. |
| `cav_save` | caverns | 22,23 | 2×1 | L0 | 2 | Save point + teleporter (2x1). |
| `cav_deep` | caverns | 16,24 | 4×3 | L0 R2 L2 | 2 | Deep caves (4x3). L0 from lake; L2 → cav_bottom; R2 → cav_bat through a 'G' grate column (gate R2:3). |
| `cav_bat` | caverns | 20,26 | 2×1 | L0 | 3 | Relic room: soul_bat on a pedestal. |
| `cav_bottom` | caverns | 12,26 | 4×2 | R0 B1 | 2 | Bottom cave (4x2). Item frost_codex. Enemy cave_toad. B1 floor hole covered by a 'G' grate (gate B1:3); below it the catacombs. |
| `cat_entry` | catacombs | 13,28 | 2×3 | T0 R2 | 3 | Descent (2x3) from T0 (falling in through the grate hole). Enemies bone_pillar, corpse_spider. R2 → ossuary. |
| `cat_ossuary` | catacombs | 15,30 | 5×1 | L0 R0 | 3 | Bone hall (5x1). Enemies plague_doctor, bone_pillar x2, corpse_spider. Item bone_cleaver. |
| `cat_crypt` | catacombs | 20,29 | 3×2 | L1 R1 | 3 | Crypt (3x2). Enemies corpse_spider x2, plague_doctor. Item twilight_mail. |
| `cat_save` | catacombs | 23,30 | 1×1 | L0 R0 | 3 | Save room. |
| `cat_deep` | catacombs | 24,30 | 3×3 | L0 | 3 | Deepest crypt (3x3). Items thorn_scourge, hp_up; the legendary 'elegy' sword in a sealed niche high up only reachable by bat (gates {'item:elegy':5}) and behind breakable walls. Enemies plague_doctor x2, bone_pillar, blood_skeleton. |

### Belmont Archives rooms

| id | area | x,y | w×h | doors | lvl | notes |
|---|---|---|---|---|---|---|
| `arc_entry` | arc_hall | 10,8 | 3×1 | R0 | 1 | Arrival hall (3x1). A portal book back to the castle: b.portal(4, 11, 'lib_portal', 20, 25). Arrival spot for the castle portal is tile (5,11). b.trigger(8, 11, 'archives_enter', 2, 3). Candles; no enemies near the portal; one page_swarm at the far right. |
| `arc_hall1` | arc_hall | 13,7 | 4×2 | L1 R1 T1 | 1 | Reading Hall (4x2): long tables (platforms), lecterns. Lore arc_oath. Item hunter_knife. Enemies: living_grimoire, page_swarm x2, flying_tome. T1 (x14) → arc_ink: gate T1:6? No — T1 itself is reachable at lvl 1; the ink walkways are INSIDE arc_ink. |
| `arc_ink` | arc_hall | 13,5 | 4×2 | B1 | 1 | Hidden study above the hall (4x2). Arrive from B1. Belmont Ward tome on a high ledge reachable only via invisible-ink walkways 'I' (gates {'tome':6}). heart_up also up there. |
| `arc_save` | arc_hall | 17,8 | 1×1 | L0 R0 | 1 | Save room. |
| `arc_cross` | arc_hall | 18,6 | 2×4 | L2 B0 T1 R3 | 1 | Crossroads shaft (2x4): L2 from save; B0 down to the Stacks; T1 up to the Scriptorium (climb with double jump); R3 → teleporter. Enemies flying_tome x2. Item mp_up. |
| `arc_tp` | arc_hall | 20,9 | 1×1 | L0 | 1 | Teleporter. |
| `stk_shaft` | arc_stacks | 18,10 | 2×4 | T0 L1 R3 B0 | 1 | Stacks shaft (2x4): tall bookcases, ledges. T0 from above (land on a ledge near the hole), L1 → stk_west, R3 → corridor, B0 → vault_gate blocked by a seal band 'X' (gate B0:4). Enemies shelf_mimic, page_swarm. |
| `stk_west` | arc_stacks | 13,11 | 5×1 | R0 L0 | 1 | West stacks (5x1). Item quill_rapier. Enemies ink_slime x2, living_grimoire. L0 is a 1-tile wolf tunnel (gate L0:2). |
| `stk_tome` | arc_stacks | 12,11 | 1×1 | R0 | 2 | Tiny study: tome ink_lance. Entered through a wolf tunnel from R0 (row 11). |
| `stk_corridor` | arc_stacks | 20,13 | 4×1 | L0 R0 | 1 | Corridor (4x1) to the boss. Enemies archive_sentinel, ink_slime. Item hp_up. |
| `stk_doppel` | arc_stacks | 24,12 | 2×2 | L1 R1 | 1 | Doppelganger arena (2x2): flat floor row 26, two side ledges at row 20. Boss 'doppel' (reward relic soul_wolf). b.boss(32, 25, 'doppel'). |
| `stk_after` | arc_stacks | 26,13 | 2×1 | L0 R0 | 2 | After the boss (2x1). Item ink_dagger. The R0 exit is reachable only through a 1-tile wolf tunnel (gate R0:2). |
| `stk_mist` | arc_stacks | 28,12 | 2×2 | L1 | 2 | Relic room: form_mist pedestal. |
| `scr_entry` | arc_scriptorium | 19,3 | 2×3 | B0 L1 R1 | 1 | Scriptorium entrance shaft (2x3): arrive from B0 — ledge next to the hole. L1 → scr_west, R1 → desks. Enemy quill_wraith. |
| `scr_west` | arc_scriptorium | 15,3 | 4×2 | R1 | 1 | Scroll archive (4x2): scroll racks, chains. Items chain_whip, inkpot_amulet. Lore arc_scrivener. Enemies quill_wraith x2, page_swarm. |
| `scr_desks` | arc_scriptorium | 21,4 | 4×1 | L0 R0 | 1 | Copyists' desks (4x1). Items archivist_robe. Lore arc_spells. Enemies quill_wraith, living_grimoire x2. |
| `scr_grate` | arc_scriptorium | 25,3 | 1×2 | L1 T0 | 1 | Grate column (1x2): from L1 up to T0 through several horizontal 'G' grate layers → mist only (gate T0:3). |
| `hun_gallery` | arc_hunters | 24,1 | 5×2 | B1 R0 | 3 | Hall of Hunters (5x2): rows of portraits (decor:['portrait','crest','candelabra']). Arrive from B1 (grate shaft) — ledge near the hole. Lore arc_portraits. Items hunter_bandana, falchion. Enemies hunter_shade x2, archive_sentinel. |
| `hun_echo` | arc_hunters | 29,0 | 3×2 | L1 R1 | 3 | Echo arena (3x2): flat floor row 26, a central raised dais (3 tiles high, 8 wide) and two side platforms at row 18. Boss 'echo' (reward scene 'echo_post' which grants the Crest + Page I). |
| `hun_richter` | arc_hunters | 32,1 | 2×1 | L0 | 3 | Richter bound in ink chains: b.npc(x, 11, 'richter', {scene:'richter_freed', need?}) — see note 'Richter' in WORLD.md. |
| `vault_gate` | arc_vault | 17,14 | 2×2 | T1 L1 | 4 | Vault gate (2x2): from T1 (seal band above, crossing it requires crest) down to L1. |
| `vault_stairs` | arc_vault | 13,14 | 4×2 | R1 B0 | 4 | Vault stairs (4x2): R1 entry, B0 down. Lore arc_bibliophage. Item scholar_foil. Enemies archive_sentinel, ink_slime x2. |
| `vault_deep` | arc_vault | 13,16 | 4×3 | T0 R2 | 4 | Flooded vault (4x3): ink-black water '~' pools (darkness 0.6). Relic lantern. Item requiem_edge. Lore arc_ink. Enemies vault_horror x2. T0 arrival: ledge under the hole. |
| `vault_save` | arc_vault | 17,18 | 1×1 | L0 R0 | 4 | Save room. |
| `vault_worm` | arc_vault | 18,16 | 4×3 | L2 R2 | 4 | Bibliophage arena (4x3): big open space, floor row 40, a few platforms at rows 30 and 22 on the sides. Boss 'biblio' (reward items page2, blood_ink). |
| `vault_treasure` | arc_vault | 22,18 | 2×1 | L0 | 4 | Treasure (2x1): nightfall_cloak, ink_shield, hp_up, tome crimson_requiem. |

## Special notes
* **Area themes** come from the area (`data_areas.js`): entrance, gallery, library, caverns, catacombs,
  clocktower, chapel, keep, archives (arc_hall/arc_stacks/arc_scriptorium/arc_hunters) and vault.
  Decorations are added automatically; override with `decor:[...]` (names in `js/tiles.js` DECOR:
  window, pillar, torch, banner, chain, painting, statue, chandelier, curtain, lamp, ladder, desk, globe,
  candelabra, portrait, crest, scrollrack, rift, lectern, stalactite, crystal, waterfall, gear, clockface,
  pendulum, niche, bonepile, stained, pew, organ, throne).
* **Keep door**: in `keep_hall` carve T1 normally with `b.door('T', 1)` (so the map knows the door) and
  put `b.pagelock(35, 25)` below it on the floor; add
  `onEnter(g, room){ G.setDoorLocked(room, 'T', 1, !G.state.flags.keep_open); }` to the room meta. The
  lock plays the scene `keep_door`, which opens it once the player owns page1..page3.
* **Richter** (`hun_richter`): `b.npc(x, 11, 'richter', {scene:'richter_freed', hideFlag:'richter_free'})`.
* **Maria** (`gal_hall` ground floor): `b.npc(x, 40, 'maria', {scene:'maria_gallery', scene2:'maria_again'})`.
* **Portals**: `lib_portal`: `b.portal(x, 25, 'arc_entry', 5, 11)`; `arc_entry`: `b.portal(4, 11, 'lib_portal', 20, 25)`.
  Keep tile (5,11) of arc_entry and (20,25) of lib_portal free floor spots.
* **Bosses** ids: colossus, doppel, echo, biblio, seraph, scrivener (defined in `js/data_bosses.js`).
* **Vessels**: put `hp_up` ×10, `heart_up` ×8, `mp_up` ×6 around the world (some in secrets).
* **Teleporters** (`b.tp`): ent_balcony, lib_tp, clk_tp, cav_save, arc_tp. **Save points**: ent_save,
  gal_save, lib_shop, clk_save, cha_save, cav_save, cat_save, keep_hall, arc_save, vault_save.
* Re-findable starting gear (erased by the Scrivener in the intro): dhampir_blade (keep_hall, hidden),
  crimson_shield (cha_confess), twilight_mail (cat_crypt), nightfall_cloak (vault_treasure),
  blood_signet (cav_lake).
