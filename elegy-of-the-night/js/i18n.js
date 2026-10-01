/* Elegy of the Night — i18n.js
 * Text language (ES/EN). Voices are always English.
 * Data strings are objects {en:'...', es:'...'}; UI strings use G.t(key).
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});

  G.lang = 'es';
  try {
    const nl = (root.navigator && (root.navigator.language || '')).toLowerCase();
    if (nl && !nl.startsWith('es')) G.lang = 'en';
  } catch (e) {}

  G.tr = function (o) {
    if (o == null) return '';
    if (typeof o === 'string') return o;
    return o[G.lang] != null ? o[G.lang] : o.en != null ? o.en : '';
  };

  const S = (G.strings = {
    // title / system
    press_start: { en: 'Press any key', es: 'Pulsa cualquier tecla' },
    tap_start: { en: 'Tap to begin', es: 'Toca para empezar' },
    new_game: { en: 'New Game', es: 'Nueva partida' },
    continue: { en: 'Continue', es: 'Continuar' },
    options: { en: 'Options', es: 'Opciones' },
    controls: { en: 'Controls', es: 'Controles' },
    credits: { en: 'Credits', es: 'Créditos' },
    back: { en: 'Back', es: 'Volver' },
    yes: { en: 'Yes', es: 'Sí' },
    no: { en: 'No', es: 'No' },
    empty_slot: { en: '— Empty —', es: '— Vacío —' },
    slot: { en: 'File', es: 'Archivo' },
    choose_file: { en: 'Choose a file', es: 'Elige un archivo' },
    overwrite: { en: 'Overwrite this file?', es: '¿Sobrescribir este archivo?' },
    delete_file: { en: 'Delete file', es: 'Borrar archivo' },
    delete_q: { en: 'Delete this file permanently?', es: '¿Borrar este archivo para siempre?' },
    export_save: { en: 'Export save (.json)', es: 'Exportar partida (.json)' },
    import_save: { en: 'Import save (.json)', es: 'Importar partida (.json)' },
    saved: { en: 'Game saved', es: 'Partida guardada' },
    save_fail: { en: 'Could not save', es: 'No se pudo guardar' },
    loaded: { en: 'Game loaded', es: 'Partida cargada' },
    storage_cloud: { en: 'Saves: your claude.ai account', es: 'Guardado: tu cuenta de claude.ai' },
    storage_local: { en: 'Saves: this browser', es: 'Guardado: este navegador' },
    storage_none: { en: 'Saves: export to file (storage blocked)', es: 'Guardado: exportar a archivo (almacenamiento bloqueado)' },
    save_here: { en: 'Save your progress?', es: '¿Guardar tu progreso?' },
    hp_restored: { en: 'HP and MP restored', es: 'PV y PM restaurados' },
    // options
    language: { en: 'Text language', es: 'Idioma del texto' },
    music_vol: { en: 'Music volume', es: 'Volumen música' },
    sfx_vol: { en: 'Effects volume', es: 'Volumen efectos' },
    voice_vol: { en: 'Voice volume (English)', es: 'Volumen voces (inglés)' },
    voices: { en: 'English voices', es: 'Voces en inglés' },
    screen_shake: { en: 'Screen shake', es: 'Temblor de pantalla' },
    show_damage: { en: 'Damage numbers', es: 'Números de daño' },
    touch_controls: { en: 'Touch controls', es: 'Controles táctiles' },
    fullscreen: { en: 'Fullscreen', es: 'Pantalla completa' },
    on: { en: 'On', es: 'Sí' },
    off: { en: 'Off', es: 'No' },
    auto: { en: 'Auto', es: 'Auto' },
    // pause menu tabs
    tab_status: { en: 'Status', es: 'Estado' },
    tab_equip: { en: 'Equip', es: 'Equipo' },
    tab_items: { en: 'Items', es: 'Objetos' },
    tab_relics: { en: 'Relics', es: 'Reliquias' },
    tab_spells: { en: 'Spells', es: 'Hechizos' },
    tab_map: { en: 'Map', es: 'Mapa' },
    tab_bestiary: { en: 'Bestiary', es: 'Bestiario' },
    tab_system: { en: 'System', es: 'Sistema' },
    // status
    level: { en: 'LEVEL', es: 'NIVEL' },
    exp: { en: 'EXP', es: 'EXP' },
    next: { en: 'NEXT', es: 'SIG.' },
    gold: { en: 'GOLD', es: 'ORO' },
    kills: { en: 'KILLS', es: 'BAJAS' },
    time: { en: 'TIME', es: 'TIEMPO' },
    rooms: { en: 'ROOMS', es: 'SALAS' },
    str: { en: 'STR', es: 'FUE' },
    con: { en: 'CON', es: 'CON' },
    int: { en: 'INT', es: 'INT' },
    lck: { en: 'LCK', es: 'SUE' },
    atk: { en: 'ATT', es: 'ATQ' },
    def: { en: 'DEF', es: 'DEF' },
    hp: { en: 'HP', es: 'PV' },
    mp: { en: 'MP', es: 'PM' },
    hearts: { en: 'HEARTS', es: 'CORAZONES' },
    status_good: { en: 'Good', es: 'Bien' },
    status_poison: { en: 'Poison', es: 'Veneno' },
    status_curse: { en: 'Curse', es: 'Maldición' },
    resist: { en: 'Resist', es: 'Resiste' },
    weak: { en: 'Weak', es: 'Débil' },
    absorb: { en: 'Absorb', es: 'Absorbe' },
    immune: { en: 'Immune', es: 'Inmune' },
    // equip
    slot_rhand: { en: 'Right hand', es: 'Mano der.' },
    slot_lhand: { en: 'Left hand', es: 'Mano izq.' },
    slot_head: { en: 'Head', es: 'Cabeza' },
    slot_body: { en: 'Body', es: 'Cuerpo' },
    slot_cloak: { en: 'Cloak', es: 'Capa' },
    slot_acc1: { en: 'Other', es: 'Otro' },
    slot_acc2: { en: 'Other', es: 'Otro' },
    nothing: { en: '— nothing —', es: '— nada —' },
    two_handed: { en: 'Two-handed', es: 'A dos manos' },
    use: { en: 'Use', es: 'Usar' },
    cannot_use: { en: 'Cannot use now', es: 'No se puede usar ahora' },
    no_items: { en: 'No items', es: 'Sin objetos' },
    sort: { en: 'Sort', es: 'Ordenar' },
    // shop
    shop_title: { en: 'The Librarian', es: 'El Bibliotecario' },
    buy: { en: 'Buy', es: 'Comprar' },
    sell: { en: 'Sell', es: 'Vender' },
    talk: { en: 'Talk', es: 'Hablar' },
    enemy_list: { en: 'Enemy list', es: 'Lista de enemigos' },
    leave: { en: 'Leave', es: 'Salir' },
    owned: { en: 'Owned', es: 'Tienes' },
    price: { en: 'Price', es: 'Precio' },
    not_enough_gold: { en: 'Not enough gold', es: 'Oro insuficiente' },
    thank_you: { en: 'A wise purchase.', es: 'Una compra sabia.' },
    quantity: { en: 'Quantity', es: 'Cantidad' },
    // map
    map_castle: { en: 'Castle', es: 'Castillo' },
    map_archives: { en: 'Belmont Archives', es: 'Archivos Belmont' },
    explored: { en: 'explored', es: 'explorado' },
    legend_save: { en: 'Save', es: 'Guardar' },
    legend_warp: { en: 'Teleport', es: 'Teletransporte' },
    legend_you: { en: 'You', es: 'Tú' },
    // spells
    spell_unknown: { en: '??????', es: '??????' },
    mp_cost: { en: 'MP', es: 'PM' },
    // misc / notifications
    obtained: { en: 'Obtained', es: 'Obtenido' },
    level_up: { en: 'LEVEL UP', es: 'SUBES DE NIVEL' },
    game_over: { en: 'GAME OVER', es: 'FIN DE LA PARTIDA' },
    load_last: { en: 'Load last save', es: 'Cargar última partida' },
    to_title: { en: 'Return to title', es: 'Volver al título' },
    quit_q: { en: 'Return to the title screen? Unsaved progress will be lost.', es: '¿Volver al título? Se perderá el progreso no guardado.' },
    paused: { en: 'Paused', es: 'Pausa' },
    click_resume: { en: 'Click or press a key to resume', es: 'Haz clic o pulsa una tecla para continuar' },
    sealed: { en: 'A Belmont seal blocks the way.', es: 'Un sello Belmont bloquea el paso.' },
    locked_pages: { en: 'The door is bound by three missing pages of the Chronicle.', es: 'La puerta está sellada por tres páginas perdidas de la Crónica.' },
    teleport_to: { en: 'Teleport to…', es: 'Teletransportar a…' },
    cancel: { en: 'Cancel', es: 'Cancelar' },
    up_to_enter: { en: '↑ Enter', es: '↑ Entrar' },
    up_to_read: { en: '↑ Read', es: '↑ Leer' },
    up_to_talk: { en: '↑ Talk', es: '↑ Hablar' },
    up_to_save: { en: '↑ Save', es: '↑ Guardar' },
    up_to_use: { en: '↑ Use', es: '↑ Usar' },
    skip: { en: 'Skip', es: 'Saltar' },
    completion: { en: 'Completion', es: 'Completado' },
    the_end: { en: 'THE END', es: 'FIN' },
    unofficial: {
      en: 'Unofficial non-commercial fan game inspired by Symphony of the Night. Not affiliated with Konami. Original code, art and music.',
      es: 'Fan game no oficial y sin ánimo de lucro inspirado en Symphony of the Night. Sin afiliación con Konami. Código, arte y música originales.',
    },
  });

  G.t = function (key) {
    const s = S[key];
    return s ? G.tr(s) : key;
  };
})();
