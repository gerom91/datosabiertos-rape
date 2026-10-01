/* Elegy of the Night — data_items.js
 * Every item, weapon, armour, accessory, consumable, relic, sub-weapon and
 * spell. Names/descriptions are bilingual {en, es}.
 *
 * kind: 'weapon' | 'shield' | 'head' | 'body' | 'cloak' | 'acc' | 'use' | 'key' | 'relic'
 * weapon.wtype: short | sword | great | rapier | mace | spear | whip | fist | tome
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});

  const I = (G.ITEMS = {});
  function add(id, o) {
    o.id = id;
    I[id] = o;
  }
  const N = (en, es) => ({ en, es });

  // ---- Weapons -------------------------------------------------------------------
  // atk: base attack; el: element; wind/act/rec: frames; reach/hh: hitbox; len: blade art length
  add('fist', { kind: 'weapon', wtype: 'fist', name: N('Fist', 'Puño'), desc: N('Bare-handed strike.', 'Golpe a mano desnuda.'), atk: 2, el: 'hit', wind: 2, act: 5, rec: 7, reach: 14, hh: 10, icon: 'fist', col: '#f2dccf', hidden: true });
  add('stiletto', { kind: 'weapon', wtype: 'short', name: N('Silver Stiletto', 'Estilete de plata'), desc: N('A slim blade favoured by hunters’ squires. Quick.', 'Hoja fina, favorita de los escuderos cazadores. Rápida.'), atk: 7, el: 'cut', wind: 2, act: 6, rec: 8, reach: 22, hh: 8, len: 12, col: '#d8dce8', bonus: { lck: 1 }, price: 400, icon: 'dagger' });
  add('hunter_knife', { kind: 'weapon', wtype: 'short', name: N('Hunter’s Knife', 'Cuchillo de cazador'), desc: N('Heavy skinning knife from the Belmont armoury.', 'Pesado cuchillo de desollar de la armería Belmont.'), atk: 11, el: 'cut', wind: 2, act: 6, rec: 8, reach: 24, hh: 8, len: 13, col: '#c8ccd8', price: 1200, icon: 'dagger' });
  add('ink_dagger', { kind: 'weapon', wtype: 'short', name: N('Ink Dagger', 'Daga de tinta'), desc: N('Forged from hardened ink. May poison.', 'Forjada con tinta endurecida. Puede envenenar.'), atk: 18, el: 'dark', status: { poison: 0.2 }, wind: 2, act: 6, rec: 8, reach: 24, hh: 9, len: 13, col: '#3a2a5a', glow: '#8a6ae0', price: 2600, icon: 'dagger' });
  add('rusted_saber', { kind: 'weapon', wtype: 'sword', name: N('Rusted Saber', 'Sable oxidado'), desc: N('Pitted with rust, but it still bites.', 'Picado de óxido, pero aún muerde.'), atk: 9, el: 'cut', wind: 3, act: 7, rec: 11, reach: 34, hh: 12, len: 20, col: '#a89070', price: 150, icon: 'sword' });
  add('longsword', { kind: 'weapon', wtype: 'sword', name: N('Knight’s Longsword', 'Espada de caballero'), desc: N('A dependable blade of the castle guard.', 'Fiable hoja de la guardia del castillo.'), atk: 15, el: 'cut', wind: 3, act: 7, rec: 11, reach: 36, hh: 12, len: 22, col: '#d0d6e4', price: 1500, icon: 'sword' });
  add('falchion', { kind: 'weapon', wtype: 'sword', name: N('Hunter’s Falchion', 'Falcata del cazador'), desc: N('Blessed steel carried by Belmont initiates. Holy.', 'Acero bendito de los iniciados Belmont. Sagrado.'), atk: 22, el: 'holy', wind: 3, act: 7, rec: 11, reach: 36, hh: 13, len: 22, col: '#f0e6c0', glow: '#ffe8a0', price: 4000, icon: 'sword' });
  add('moonlit_blade', { kind: 'weapon', wtype: 'sword', name: N('Moonlit Blade', 'Hoja lunar'), desc: N('Cold as the subterranean lake. Ice.', 'Fría como el lago subterráneo. Hielo.'), atk: 28, el: 'ice', wind: 3, act: 7, rec: 11, reach: 38, hh: 13, len: 23, col: '#bfe6ff', glow: '#9ad8ff', price: 6800, icon: 'sword' });
  add('requiem_edge', { kind: 'weapon', wtype: 'sword', name: N('Requiem Edge', 'Filo del réquiem'), desc: N('Its hum is a funeral mass. Dark. INT +3.', 'Su zumbido es una misa fúnebre. Oscuridad. INT +3.'), atk: 36, el: 'dark', bonus: { int: 3 }, wind: 3, act: 7, rec: 11, reach: 38, hh: 14, len: 24, col: '#5a3a7a', glow: '#b48cff', price: 9800, icon: 'sword' });
  add('dhampir_blade', { kind: 'weapon', wtype: 'sword', name: N('Dhampir Blade', 'Espada dhampir'), desc: N('Alucard’s own sword, written back into being. Drains life.', 'La espada de Alucard, reescrita en la existencia. Absorbe vida.'), atk: 44, el: 'cut', drain: 0.06, wind: 3, act: 7, rec: 10, reach: 40, hh: 14, len: 25, col: '#e8ecf8', glow: '#ff4060', price: 0, icon: 'sword' });
  add('elegy', { kind: 'weapon', wtype: 'sword', name: N('Elegy', 'Elegía'), desc: N('A blade of mourning. Each swing leaves an echo that strikes again.', 'Hoja de luto. Cada tajo deja un eco que golpea otra vez.'), atk: 56, el: 'cut', echo: true, wind: 2, act: 7, rec: 9, reach: 42, hh: 15, len: 26, col: '#f4f0ff', glow: '#c8b0ff', price: 0, icon: 'sword' });
  add('bone_cleaver', { kind: 'weapon', wtype: 'great', hands: 2, name: N('Bone Cleaver', 'Rajahuesos'), desc: N('A butcher’s greatblade from the catacombs. Two-handed.', 'Gran hoja de carnicero de las catacumbas. A dos manos.'), atk: 32, el: 'hit', wind: 8, act: 9, rec: 16, reach: 44, hh: 36, len: 30, col: '#d8cdb0', price: 5200, icon: 'great' });
  add('claymore', { kind: 'weapon', wtype: 'great', hands: 2, name: N('Cathedral Claymore', 'Mandoble catedralicio'), desc: N('Consecrated greatsword of the chapel templars. Holy. Two-handed.', 'Mandoble consagrado de los templarios de la capilla. Sagrado. A dos manos.'), atk: 48, el: 'holy', wind: 8, act: 9, rec: 15, reach: 48, hh: 38, len: 32, col: '#f4f4ff', glow: '#fff0b0', price: 12000, icon: 'great' });
  add('quill_rapier', { kind: 'weapon', wtype: 'rapier', name: N('Quill Rapier', 'Estoque pluma'), desc: N('A rapier shaped like a scribe’s quill. Lightning-fast thrusts.', 'Un estoque con forma de pluma de escriba. Estocadas rapidísimas.'), atk: 16, el: 'cut', wind: 1, act: 5, rec: 6, reach: 42, hh: 6, len: 26, col: '#f0e8d8', price: 2400, icon: 'rapier' });
  add('scholar_foil', { kind: 'weapon', wtype: 'rapier', name: N('Scholar’s Foil', 'Florete del erudito'), desc: N('Duelling foil of the archive wardens. INT +5.', 'Florete de duelo de los guardianes del archivo. INT +5.'), atk: 24, el: 'cut', bonus: { int: 5 }, wind: 1, act: 5, rec: 6, reach: 44, hh: 6, len: 27, col: '#e0d0a0', price: 5600, icon: 'rapier' });
  add('iron_mace', { kind: 'weapon', wtype: 'mace', name: N('Iron Mace', 'Maza de hierro'), desc: N('Crushes bone and armour alike.', 'Aplasta huesos y armaduras por igual.'), atk: 20, el: 'hit', wind: 6, act: 8, rec: 13, reach: 32, hh: 28, len: 18, col: '#8a8c98', price: 2000, icon: 'mace' });
  add('clock_hammer', { kind: 'weapon', wtype: 'mace', hands: 2, name: N('Clockwork Hammer', 'Martillo de relojería'), desc: N('Wound springs release a thunderclap on impact. Two-handed.', 'Sus muelles liberan un trueno al impactar. A dos manos.'), atk: 40, el: 'thunder', wind: 8, act: 9, rec: 15, reach: 38, hh: 32, len: 22, col: '#c8a050', glow: '#ffe870', price: 9000, icon: 'mace' });
  add('chapel_halberd', { kind: 'weapon', wtype: 'spear', hands: 2, name: N('Chapel Halberd', 'Alabarda de la capilla'), desc: N('Long reach, holy edge. Two-handed.', 'Gran alcance, filo sagrado. A dos manos.'), atk: 30, el: 'holy', wind: 4, act: 8, rec: 12, reach: 58, hh: 8, len: 40, col: '#d8d8e8', price: 7400, icon: 'spear' });
  add('chain_whip', { kind: 'weapon', wtype: 'whip', name: N('Chain Whip', 'Látigo de cadenas'), desc: N('A hunter’s training whip. Long horizontal reach.', 'Látigo de entrenamiento de cazador. Gran alcance horizontal.'), atk: 14, el: 'hit', wind: 7, act: 6, rec: 12, reach: 70, hh: 8, col: '#9a9aa8', price: 2200, icon: 'whip' });
  add('hunters_lash', { kind: 'weapon', wtype: 'whip', name: N('Hunter’s Lash', 'Azote del cazador'), desc: N('Belmont leather. Holy, but it burns your hand: each lash costs 1 HP.', 'Cuero Belmont. Sagrado, pero te quema la mano: cada latigazo cuesta 1 PV.'), atk: 34, el: 'holy', hpCost: 1, wind: 7, act: 6, rec: 12, reach: 78, hh: 9, col: '#8a5a2a', glow: '#ffe8a0', price: 0, icon: 'whip' });
  add('thorn_scourge', { kind: 'weapon', wtype: 'whip', name: N('Thorned Scourge', 'Azote de espinas'), desc: N('Barbed chains dripping venom. May poison.', 'Cadenas espinadas que gotean veneno. Puede envenenar.'), atk: 30, el: 'cut', status: { poison: 0.3 }, wind: 7, act: 6, rec: 12, reach: 72, hh: 9, col: '#5a8a4a', price: 6200, icon: 'whip' });
  add('ember_tome', { kind: 'weapon', wtype: 'tome', name: N('Tome of Embers', 'Tomo de brasas'), desc: N('Reading aloud hurls a fireball. Power grows with INT.', 'Leerlo en voz alta lanza una bola de fuego. Su poder crece con INT.'), atk: 8, el: 'fire', proj: 'ember', wind: 6, act: 4, rec: 14, col: '#c84020', price: 1800, icon: 'tome' });
  add('frost_codex', { kind: 'weapon', wtype: 'tome', name: N('Frost Codex', 'Códice de escarcha'), desc: N('Its pages exhale ice shards. Power grows with INT.', 'Sus páginas exhalan esquirlas de hielo. Su poder crece con INT.'), atk: 14, el: 'ice', proj: 'frost', wind: 6, act: 4, rec: 14, col: '#4080c8', price: 4800, icon: 'tome' });
  add('thunder_psalter', { kind: 'weapon', wtype: 'tome', name: N('Thunder Psalter', 'Salterio del trueno'), desc: N('Psalms that call lightning down ahead of you. Power grows with INT.', 'Salmos que invocan rayos frente a ti. Su poder crece con INT.'), atk: 22, el: 'thunder', proj: 'bolt', wind: 7, act: 4, rec: 16, col: '#c8b040', price: 8800, icon: 'tome' });
  add('iron_knuckles', { kind: 'weapon', wtype: 'fist', name: N('Iron Knuckles', 'Nudillos de hierro'), desc: N('Brawler’s iron. Extremely fast jabs.', 'Hierro de pendenciero. Golpes rapidísimos.'), atk: 10, el: 'hit', wind: 1, act: 4, rec: 5, reach: 18, hh: 10, col: '#7a7c88', price: 900, icon: 'fist' });

  // ---- Shields ------------------------------------------------------------------------
  add('buckler', { kind: 'shield', name: N('Wooden Buckler', 'Rodela de madera'), desc: N('Hold the button to guard. DEF +2.', 'Mantén el botón para cubrirte. DEF +2.'), def: 2, guard: 0.6, price: 200, icon: 'shield', col: '#8a5a2a' });
  add('iron_shield', { kind: 'shield', name: N('Iron Shield', 'Escudo de hierro'), desc: N('Sturdy kite shield. DEF +5.', 'Robusto escudo de cometa. DEF +5.'), def: 5, guard: 0.75, price: 1800, icon: 'shield', col: '#8a8c98' });
  add('ink_shield', { kind: 'shield', name: N('Inkblack Shield', 'Escudo de tinta negra'), desc: N('Absorbs shadow. DEF +8, resists dark.', 'Absorbe sombras. DEF +8, resiste oscuridad.'), def: 8, guard: 0.85, res: { dark: 0.5 }, price: 4200, icon: 'shield', col: '#2a1a3a' });
  add('mirror_aegis', { kind: 'shield', name: N('Mirror Aegis', 'Égida espejo'), desc: N('Polished silver. Guarding reflects projectiles. DEF +10.', 'Plata bruñida. Al cubrirte refleja proyectiles. DEF +10.'), def: 10, guard: 0.9, reflect: true, price: 9600, icon: 'shield', col: '#d8dcf0' });
  add('crimson_shield', { kind: 'shield', name: N('Crimson Shield', 'Escudo carmesí'), desc: N('A dhampir’s heirloom. DEF +13.', 'Reliquia familiar de un dhampir. DEF +13.'), def: 13, guard: 0.95, price: 0, icon: 'shield', col: '#a01828' });

  // ---- Head -----------------------------------------------------------------------------
  add('velvet_hat', { kind: 'head', name: N('Velvet Hat', 'Sombrero de terciopelo'), desc: N('Wide-brimmed and fashionable. DEF +1.', 'De ala ancha y elegante. DEF +1.'), def: 1, price: 300, icon: 'hat', col: '#3a2a4a' });
  add('spectacles', { kind: 'head', name: N('Scholar’s Spectacles', 'Anteojos del erudito'), desc: N('INT +4. Reveals enemy HP when struck.', 'INT +4. Muestra los PV del enemigo al golpearlo.'), def: 0, bonus: { int: 4 }, showHp: true, price: 1600, icon: 'glasses', col: '#c9a24a' });
  add('iron_helm', { kind: 'head', name: N('Iron Helm', 'Yelmo de hierro'), desc: N('Heavy but protective. DEF +4.', 'Pesado pero protector. DEF +4.'), def: 4, price: 1400, icon: 'helm', col: '#8a8c98' });
  add('silver_circlet', { kind: 'head', name: N('Silver Circlet', 'Diadema de plata'), desc: N('DEF +3, LCK +3, MP +10.', 'DEF +3, SUE +3, PM +10.'), def: 3, bonus: { lck: 3, mp: 10 }, price: 3800, icon: 'circlet', col: '#d8dcf0' });
  add('hunter_bandana', { kind: 'head', name: N('Hunter’s Bandana', 'Pañuelo del cazador'), desc: N('Worn by a young Belmont. DEF +2, STR +3.', 'Lo llevó un joven Belmont. DEF +2, FUE +3.'), def: 2, bonus: { str: 3 }, price: 2600, icon: 'bandana', col: '#a02020' });
  add('crown_ash', { kind: 'head', name: N('Crown of Ash', 'Corona de ceniza'), desc: N('The crown of a forgotten king. DEF +8, all stats +3.', 'La corona de un rey olvidado. DEF +8, todos los atributos +3.'), def: 8, bonus: { str: 3, con: 3, int: 3, lck: 3 }, price: 0, icon: 'crown', col: '#8a8a8a' });

  // ---- Body ---------------------------------------------------------------------------------
  add('linen_shirt', { kind: 'body', name: N('Linen Shirt', 'Camisa de lino'), desc: N('Plain cloth. DEF +1.', 'Tela sencilla. DEF +1.'), def: 1, price: 100, icon: 'shirt', col: '#e8e0d0' });
  add('leather_coat', { kind: 'body', name: N('Leather Coat', 'Abrigo de cuero'), desc: N('Tanned and dependable. DEF +4.', 'Curtido y fiable. DEF +4.'), def: 4, price: 800, icon: 'armor', col: '#6a4a2a' });
  add('chainmail', { kind: 'body', name: N('Chain Mail', 'Cota de malla'), desc: N('Interlocking rings. DEF +8.', 'Anillas entrelazadas. DEF +8.'), def: 8, price: 2500, icon: 'armor', col: '#8a8c98' });
  add('archivist_robe', { kind: 'body', name: N('Archivist’s Robe', 'Túnica del archivista'), desc: N('DEF +6, INT +5. MP regenerates faster.', 'DEF +6, INT +5. Los PM se regeneran más rápido.'), def: 6, bonus: { int: 5 }, mpRegen: 1, price: 4400, icon: 'robe', col: '#3a2a5a' });
  add('silver_plate', { kind: 'body', name: N('Silver Plate', 'Coraza de plata'), desc: N('DEF +14. Resists holy and dark.', 'DEF +14. Resiste lo sagrado y la oscuridad.'), def: 14, res: { holy: 0.5, dark: 0.5 }, price: 8800, icon: 'armor', col: '#d8dcf0' });
  add('twilight_mail', { kind: 'body', name: N('Twilight Mail', 'Malla crepuscular'), desc: N('Alucard’s armour, recovered. DEF +20.', 'La armadura de Alucard, recuperada. DEF +20.'), def: 20, price: 0, icon: 'armor', col: '#2a2a4a' });
  add('nightguard', { kind: 'body', name: N('Nightguard Plate', 'Coraza de la guardia nocturna'), desc: N('Worn by the keep’s elite. DEF +26.', 'La lleva la élite del torreón. DEF +26.'), def: 26, price: 0, icon: 'armor', col: '#3a1a22' });

  // ---- Cloaks ---------------------------------------------------------------------------
  add('traveler_cloak', { kind: 'cloak', name: N('Traveler’s Cloak', 'Capa de viajero'), desc: N('Dusty but warm. DEF +1.', 'Polvorienta pero cálida. DEF +1.'), def: 1, price: 150, icon: 'cloak', col: '#5a4a3a', lining: '#7a6a4a' });
  add('velvet_cape', { kind: 'cloak', name: N('Velvet Cape', 'Capa de terciopelo'), desc: N('DEF +2, LCK +2.', 'DEF +2, SUE +2.'), def: 2, bonus: { lck: 2 }, price: 900, icon: 'cloak', col: '#2a1a3a', lining: '#6a2a8a' });
  add('ink_mantle', { kind: 'cloak', name: N('Ink-stained Mantle', 'Manto manchado de tinta'), desc: N('DEF +4. Resists dark and poison.', 'DEF +4. Resiste oscuridad y veneno.'), def: 4, res: { dark: 0.3 }, immune: ['poison'], price: 3600, icon: 'cloak', col: '#141024', lining: '#3a2a6a' });
  add('royal_cloak', { kind: 'cloak', name: N('Royal Cloak', 'Capa real'), desc: N('DEF +6, CON +3.', 'DEF +6, CON +3.'), def: 6, bonus: { con: 3 }, price: 6200, icon: 'cloak', col: '#3a0a14', lining: '#c9a24a' });
  add('nightfall_cloak', { kind: 'cloak', name: N('Nightfall Cloak', 'Capa del ocaso'), desc: N('Alucard’s cloak. DEF +8.', 'La capa de Alucard. DEF +8.'), def: 8, price: 0, icon: 'cloak', col: '#141018', lining: '#a01828' });

  // ---- Accessories ------------------------------------------------------------------------
  add('garnet_ring', { kind: 'acc', name: N('Garnet Ring', 'Anillo de granate'), desc: N('STR +3.', 'FUE +3.'), bonus: { str: 3 }, price: 1200, icon: 'ring', col: '#c02030' });
  add('sapphire_ring', { kind: 'acc', name: N('Sapphire Ring', 'Anillo de zafiro'), desc: N('INT +3.', 'INT +3.'), bonus: { int: 3 }, price: 1200, icon: 'ring', col: '#2050c8' });
  add('topaz_ring', { kind: 'acc', name: N('Topaz Ring', 'Anillo de topacio'), desc: N('CON +3.', 'CON +3.'), bonus: { con: 3 }, price: 1200, icon: 'ring', col: '#e0a020' });
  add('moon_ring', { kind: 'acc', name: N('Moon Ring', 'Anillo lunar'), desc: N('MP +20, INT +2.', 'PM +20, INT +2.'), bonus: { mp: 20, int: 2 }, price: 4000, icon: 'ring', col: '#c8d8ff' });
  add('lucky_coin', { kind: 'acc', name: N('Lucky Coin', 'Moneda de la suerte'), desc: N('A coin that always lands face up. LCK +6.', 'Una moneda que siempre cae de cara. SUE +6.'), bonus: { lck: 6 }, price: 2000, icon: 'coin', col: '#e0c040' });
  add('heart_pendant', { kind: 'acc', name: N('Heart Pendant', 'Colgante corazón'), desc: N('Defeated foes sometimes leave extra hearts.', 'Los enemigos derrotados a veces dejan corazones extra.'), heartsOnKill: 0.35, price: 1500, icon: 'amulet', col: '#e04060' });
  add('bookmark_charm', { kind: 'acc', name: N('Bookmark Charm', 'Amuleto marcapáginas'), desc: N('Silk ribbon of the archives. MP regenerates much faster.', 'Cinta de seda de los archivos. Los PM se regeneran mucho más rápido.'), mpRegen: 2, price: 3000, icon: 'charm', col: '#c03040' });
  add('belmont_rosary', { kind: 'acc', name: N('Belmont Rosary', 'Rosario Belmont'), desc: N('Sub-weapons cost 1 heart less (minimum 1).', 'Las subarmas cuestan 1 corazón menos (mínimo 1).'), subDiscount: 1, price: 0, icon: 'rosary', col: '#d8c890' });
  add('inkpot_amulet', { kind: 'acc', name: N('Inkpot Amulet', 'Amuleto del tintero'), desc: N('Grants immunity to poison.', 'Otorga inmunidad al veneno.'), immune: ['poison'], price: 1800, icon: 'amulet', col: '#3a2a6a' });
  add('silver_locket', { kind: 'acc', name: N('Silver Locket', 'Relicario de plata'), desc: N('Holds a faded portrait. HP +25.', 'Guarda un retrato desvaído. PV +25.'), bonus: { hp: 25 }, price: 2400, icon: 'amulet', col: '#d8dcf0' });
  add('hourglass_pin', { kind: 'acc', name: N('Hourglass Pin', 'Broche de reloj de arena'), desc: N('The Stopwatch costs half and lasts longer.', 'El Cronómetro cuesta la mitad y dura más.'), watchDiscount: true, price: 3200, icon: 'pin', col: '#c8a050' });
  add('blood_signet', { kind: 'acc', name: N('Blood Signet', 'Sello de sangre'), desc: N('Recover 1 HP with every blow you land.', 'Recuperas 1 PV con cada golpe que aciertas.'), hpOnHit: 1, price: 0, icon: 'ring', col: '#8a0010' });
  add('owl_brooch', { kind: 'acc', name: N('Owl Brooch', 'Broche del búho'), desc: N('Breakable walls glimmer before your eyes.', 'Los muros rompibles brillan ante tus ojos.'), seeWalls: true, price: 2800, icon: 'pin', col: '#a08060' });
  add('wolf_fang', { kind: 'acc', name: N('Wolf Fang Charm', 'Colmillo de lobo'), desc: N('Wolf form costs no MP and bites harder.', 'La forma de lobo no gasta PM y muerde más fuerte.'), wolfBoost: true, price: 3400, icon: 'charm', col: '#e8e8e8' });
  add('scrivener_eye', { kind: 'acc', name: N('Scrivener’s Eye', 'Ojo del Escriba'), desc: N('All stats +5. Rare drops are more common.', 'Todos los atributos +5. Los objetos raros aparecen más.'), bonus: { str: 5, con: 5, int: 5, lck: 5 }, rareBoost: true, price: 0, icon: 'eye', col: '#b48cff' });

  // ---- Consumables -----------------------------------------------------------------------
  add('potion', { kind: 'use', name: N('Potion', 'Poción'), desc: N('Restores 40 HP.', 'Recupera 40 PV.'), heal: 40, price: 80, icon: 'potion', col: '#e04040' });
  add('high_potion', { kind: 'use', name: N('High Potion', 'Poción mayor'), desc: N('Restores 120 HP.', 'Recupera 120 PV.'), heal: 120, price: 320, icon: 'potion', col: '#ff8040' });
  add('elixir', { kind: 'use', name: N('Elixir', 'Elixir'), desc: N('Fully restores HP and MP.', 'Recupera por completo PV y PM.'), heal: 9999, mana: 9999, price: 2400, icon: 'potion', col: '#e0d040' });
  add('mana_tonic', { kind: 'use', name: N('Mana Tonic', 'Tónico de maná'), desc: N('Restores 40 MP.', 'Recupera 40 PM.'), mana: 40, price: 220, icon: 'potion', col: '#4060e0' });
  add('blood_ink', { kind: 'use', name: N('Blood Ink', 'Tinta de sangre'), desc: N('The Scrivener’s ink. Restores 120 MP.', 'La tinta del Escriba. Recupera 120 PM.'), mana: 120, price: 900, icon: 'ink', col: '#8a1020' });
  add('antidote', { kind: 'use', name: N('Antidote', 'Antídoto'), desc: N('Cures poison.', 'Cura el veneno.'), cure: 'poison', price: 40, icon: 'potion', col: '#40c060' });
  add('holy_salt', { kind: 'use', name: N('Holy Salt', 'Sal bendita'), desc: N('Lifts a curse.', 'Levanta una maldición.'), cure: 'curse', price: 60, icon: 'pouch', col: '#f0f0f0' });
  add('heart_jar', { kind: 'use', name: N('Jar of Hearts', 'Tarro de corazones'), desc: N('Restores 30 hearts.', 'Recupera 30 corazones.'), hearts: 30, price: 250, icon: 'jar', col: '#e04060' });
  add('bread', { kind: 'use', food: true, name: N('Black Bread', 'Pan negro'), desc: N('Restores 20 HP.', 'Recupera 20 PV.'), heal: 20, price: 30, icon: 'bread', col: '#6a4a2a' });
  add('blood_orange', { kind: 'use', food: true, name: N('Blood Orange', 'Naranja sanguina'), desc: N('Restores 45 HP.', 'Recupera 45 PV.'), heal: 45, price: 0, icon: 'fruit', col: '#e05020' });
  add('red_wine', { kind: 'use', food: true, name: N('Red Wine', 'Vino tinto'), desc: N('A 1724 vintage. Restores 30 HP and 30 MP.', 'Cosecha de 1724. Recupera 30 PV y 30 PM.'), heal: 30, mana: 30, price: 0, icon: 'bottle', col: '#6a0a20' });
  add('roast_fowl', { kind: 'use', food: true, name: N('Roast Fowl', 'Ave asada'), desc: N('Still warm, somehow. Restores 90 HP.', 'Aún caliente, de algún modo. Recupera 90 PV.'), heal: 90, price: 0, icon: 'meat', col: '#a06030' });
  add('pheasant', { kind: 'use', food: true, name: N('Glazed Pheasant', 'Faisán glaseado'), desc: N('A banquet hidden in the wall. Restores 220 HP.', 'Un banquete escondido en el muro. Recupera 220 PV.'), heal: 220, price: 0, icon: 'meat', col: '#c08030' });
  add('library_card', { kind: 'use', name: N('Library Card', 'Tarjeta de biblioteca'), desc: N('Returns you to the Long Library.', 'Te devuelve a la Biblioteca Larga.'), warp: 'lib_shop', price: 500, icon: 'card', col: '#c9a24a' });
  add('life_apple', { kind: 'use', name: N('Life Apple', 'Manzana de la vida'), desc: N('If you fall, it revives you once with half your HP (used automatically).', 'Si caes, te revive una vez con la mitad de tus PV (se usa sola).'), revive: true, price: 3000, icon: 'fruit', col: '#ffd040' });

  // ---- Key items --------------------------------------------------------------------------
  add('page1', { kind: 'key', name: N('Chronicle Page I', 'Página de la Crónica I'), desc: N('"Here the hunters swore to guard the night." Taken from the Echo of the Belmont.', '«Aquí los cazadores juraron custodiar la noche.» Arrancada al Eco del Belmont.'), icon: 'page', col: '#e8d8b0' });
  add('page2', { kind: 'key', name: N('Chronicle Page II', 'Página de la Crónica II'), desc: N('"Every name written here is a promise kept." Torn from the Bibliophage.', '«Cada nombre escrito aquí es una promesa cumplida.» Arrancada al Bibliófago.'), icon: 'page', col: '#e8d8b0' });
  add('page3', { kind: 'key', name: N('Chronicle Page III', 'Página de la Crónica III'), desc: N('"Time itself cannot unwrite a vow." Pried from the Clockwork Seraph.', '«Ni el tiempo puede desescribir un juramento.» Arrancada al Serafín de Relojería.'), icon: 'page', col: '#e8d8b0' });

  // ---- Relics ------------------------------------------------------------------------------
  const R = (G.RELICS = {});
  function relic(id, o) {
    o.id = id;
    o.kind = 'relic';
    R[id] = o;
    I[id] = o;
  }
  relic('leap_stone', { name: N('Leap Stone', 'Piedra de salto'), desc: N('Press jump again in mid-air to leap once more.', 'Pulsa saltar de nuevo en el aire para dar un segundo salto.'), icon: 'relic', col: '#80c0ff', ability: true });
  relic('soul_wolf', { name: N('Soul of Wolf', 'Alma de lobo'), desc: N('Transform into a wolf [E / LT]. Run fast and slip through low tunnels.', 'Transfórmate en lobo [E / LT]. Corre rápido y cruza túneles bajos.'), icon: 'relic', col: '#d0d0d8', ability: true });
  relic('form_mist', { name: N('Form of Mist', 'Forma de niebla'), desc: N('Become mist [W / RB]. Drift through iron grates. Drains MP.', 'Conviértete en niebla [W / RB]. Atraviesa rejas de hierro. Consume PM.'), icon: 'relic', col: '#a0b0c8', ability: true });
  relic('soul_bat', { name: N('Soul of Bat', 'Alma de murciélago'), desc: N('Become a bat [Q / LB] and fly freely. Drains MP. Attack to ram.', 'Conviértete en murciélago [Q / LB] y vuela libremente. Consume PM. Ataca para embestir.'), icon: 'relic', col: '#8a2030', ability: true });
  relic('gravity_boots', { name: N('Gravity Boots', 'Botas de gravedad'), desc: N('Press ↓ ↑ + Jump to launch high into the air.', 'Pulsa ↓ ↑ + Saltar para impulsarte muy alto.'), icon: 'relic', col: '#c08040', ability: true });
  relic('belmont_crest', { name: N('Belmont Crest', 'Blasón Belmont'), desc: N('The hunters’ seals now recognise you as an ally.', 'Los sellos de los cazadores ahora te reconocen como aliado.'), icon: 'relic', col: '#ffd060', ability: true });
  relic('lore_lens', { name: N('Lens of Lore', 'Lente del saber'), desc: N('Shows the name and HP of enemies you strike.', 'Muestra el nombre y los PV de los enemigos que golpeas.'), icon: 'relic', col: '#60e0c0', toggle: true });
  relic('echo_bat', { name: N('Echo of Bat', 'Eco del murciélago'), desc: N('In bat form, attack to send out sonic waves.', 'En forma de murciélago, ataca para lanzar ondas sónicas.'), icon: 'relic', col: '#c060ff', toggle: true });
  relic('familiar_bat', { name: N('Familiar: Bat', 'Familiar: Murciélago'), desc: N('A loyal bat fights at your side. Toggle in this menu.', 'Un murciélago leal lucha a tu lado. Actívalo en este menú.'), icon: 'relic', col: '#ff6060', toggle: true, familiar: 'bat' });
  relic('familiar_faerie', { name: N('Familiar: Faerie', 'Familiar: Hada'), desc: N('A faerie heals you with potions and cures ailments.', 'Un hada te cura con pociones y elimina estados alterados.'), icon: 'relic', col: '#ff90e0', toggle: true, familiar: 'faerie' });
  relic('lantern', { name: N('Lantern of Revelation', 'Linterna de la revelación'), desc: N('Reveals walkways written in invisible ink inside the Archives.', 'Revela pasarelas escritas con tinta invisible en los Archivos.'), icon: 'relic', col: '#ffe0a0', ability: true });

  // ---- Sub-weapons (hearts) -----------------------------------------------------------------
  G.SUBWEAPONS = {
    dagger: { name: N('Dagger', 'Daga'), cost: 1, atk: 10, el: 'cut', icon: 'dagger', col: '#d8dce8' },
    axe: { name: N('Axe', 'Hacha'), cost: 3, atk: 22, el: 'cut', icon: 'axe', col: '#a8acb8' },
    holy_water: { name: N('Holy Water', 'Agua bendita'), cost: 3, atk: 9, el: 'holy', icon: 'vial', col: '#60a0ff' },
    cross: { name: N('Cross', 'Cruz'), cost: 4, atk: 20, el: 'holy', icon: 'cross', col: '#ffd060' },
    stopwatch: { name: N('Stopwatch', 'Cronómetro'), cost: 12, atk: 0, el: 'none', icon: 'watch', col: '#e0c070' },
    quill: { name: N('Silver Quill', 'Pluma de plata'), cost: 2, atk: 14, el: 'cut', icon: 'quill', col: '#f0f0ff', isNew: true },
    inkwell: { name: N('Inkwell', 'Tintero'), cost: 3, atk: 6, el: 'dark', icon: 'ink', col: '#3a2a6a', isNew: true },
    grimoire: { name: N('Grimoire Pages', 'Páginas del grimorio'), cost: 5, atk: 12, el: 'holy', icon: 'page', col: '#e8d8b0', isNew: true },
  };

  // ---- Spells (MP, command input) ------------------------------------------------------------
  // seq is facing-relative: f, b, u, d, uf, ub, df, db.  Shown in the Spells menu.
  G.SPELLS = {
    spirit: { name: N('Summon Spirit', 'Invocar espíritu'), seq: ['b', 'f', 'u', 'd'], mp: 5, known: true, desc: N('A spirit homes in on the nearest foe.', 'Un espíritu persigue al enemigo más cercano.'), shout: 'Spirit!' },
    hellfire: { name: N('Hellfire', 'Fuego infernal'), seq: ['u', 'd', 'df', 'f'], mp: 15, known: true, desc: N('Hurl three fireballs.', 'Lanza tres bolas de fuego.'), shout: 'Hellfire!' },
    dark_meta: { name: N('Dark Metamorphosis', 'Metamorfosis oscura'), seq: ['b', 'ub', 'u', 'uf', 'f'], mp: 10, known: true, desc: N('For a while, your blows drain life.', 'Durante un tiempo, tus golpes absorben vida.'), shout: 'Dark Metamorphosis!' },
    soul_steal: { name: N('Soul Steal', 'Robo de almas'), seq: ['b', 'f', 'df', 'd', 'db', 'b', 'f'], mp: 40, known: true, desc: N('Drain the life of every foe on screen.', 'Absorbe la vida de todos los enemigos en pantalla.'), shout: 'Soul Steal!' },
    ink_lance: { name: N('Ink Lance', 'Lanza de tinta'), seq: ['d', 'df', 'f'], mp: 8, known: false, isNew: true, desc: N('A piercing lance of black ink.', 'Una lanza perforante de tinta negra.'), shout: 'Ink Lance!' },
    belmont_ward: { name: N('Belmont Ward', 'Égida Belmont'), seq: ['f', 'd', 'df'], mp: 20, known: false, isNew: true, desc: N('Holy crosses orbit you, burning what they touch.', 'Cruces sagradas orbitan a tu alrededor y queman lo que tocan.'), shout: 'Belmont Ward!' },
    crimson_requiem: { name: N('Crimson Requiem', 'Réquiem carmesí'), seq: ['d', 'u', 'd', 'u'], mp: 30, known: false, isNew: true, desc: N('Blades of blood rain down around you.', 'Hojas de sangre llueven a tu alrededor.'), shout: 'Crimson Requiem!' },
  };

  // Element names for UI
  G.ELEMENTS = {
    hit: N('Strike', 'Golpe'), cut: N('Slash', 'Corte'), fire: N('Fire', 'Fuego'), ice: N('Ice', 'Hielo'),
    thunder: N('Thunder', 'Trueno'), holy: N('Holy', 'Sagrado'), dark: N('Dark', 'Oscuridad'), poison: N('Poison', 'Veneno'), none: N('—', '—'),
  };

  // The Librarian's stock (unlocks progressively by flags)
  G.SHOP = [
    { id: 'potion' }, { id: 'antidote' }, { id: 'holy_salt' }, { id: 'mana_tonic' }, { id: 'heart_jar' },
    { id: 'library_card' }, { id: 'buckler' }, { id: 'velvet_hat' }, { id: 'leather_coat' }, { id: 'traveler_cloak' },
    { id: 'stiletto' }, { id: 'iron_knuckles' }, { id: 'garnet_ring' }, { id: 'sapphire_ring' }, { id: 'topaz_ring' },
    { id: 'high_potion', flag: 'boss_doppel' }, { id: 'spectacles', flag: 'boss_doppel' }, { id: 'iron_mace', flag: 'boss_doppel' },
    { id: 'iron_shield', flag: 'boss_doppel' }, { id: 'chainmail', flag: 'boss_doppel' }, { id: 'iron_helm', flag: 'boss_doppel' },
    { id: 'ember_tome', flag: 'boss_doppel' }, { id: 'longsword', flag: 'boss_doppel' },
    { id: 'heart_pendant', flag: 'boss_echo' }, { id: 'inkpot_amulet', flag: 'boss_echo' }, { id: 'lucky_coin', flag: 'boss_echo' },
    { id: 'velvet_cape', flag: 'boss_echo' }, { id: 'silver_locket', flag: 'boss_echo' }, { id: 'owl_brooch', flag: 'boss_echo' },
    { id: 'elixir', flag: 'boss_seraph' }, { id: 'life_apple', flag: 'boss_seraph' }, { id: 'moon_ring', flag: 'boss_seraph' },
    { id: 'frost_codex', flag: 'boss_seraph' }, { id: 'scholar_foil', flag: 'boss_biblio' }, { id: 'blood_ink', flag: 'boss_biblio' },
  ];
})();
