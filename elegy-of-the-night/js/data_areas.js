/* Elegy of the Night — data_areas.js
 * Areas of both maps: Dracula's castle and the Belmont Archives (a separate
 * map reached through the portal book in the Long Library).
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const A = G.world.area;
  const N = (en, es) => ({ en, es });

  // Dracula's castle
  A('entrance', { name: N('Castle Entrance', 'Entrada del Castillo'), theme: 'entrance', music: 'entrance', map: 'castle' });
  A('gallery', { name: N('Marble Gallery', 'Galería de Mármol'), theme: 'gallery', music: 'gallery', map: 'castle' });
  A('library', { name: N('Long Library', 'Biblioteca Larga'), theme: 'library', music: 'library', map: 'castle' });
  A('caverns', { name: N('Underground Caverns', 'Cavernas Subterráneas'), theme: 'caverns', music: 'caverns', map: 'castle' });
  A('catacombs', { name: N('Catacombs', 'Catacumbas'), theme: 'catacombs', music: 'catacombs', map: 'castle' });
  A('clocktower', { name: N('Clock Tower', 'Torre del Reloj'), theme: 'clocktower', music: 'clocktower', map: 'castle' });
  A('chapel', { name: N('Royal Chapel', 'Capilla Real'), theme: 'chapel', music: 'chapel', map: 'castle' });
  A('keep', { name: N('Castle Keep', 'Torreón del Castillo'), theme: 'keep', music: 'keep', map: 'castle' });

  // The Belmont Archives (separate map)
  A('arc_hall', { name: N('Reading Hall', 'Sala de Lectura'), theme: 'archives', music: 'archives', map: 'archives' });
  A('arc_stacks', { name: N('The Stacks', 'Las Estanterías'), theme: 'archives', music: 'archives', map: 'archives' });
  A('arc_scriptorium', { name: N('Scriptorium', 'Scriptorium'), theme: 'archives', music: 'archives', map: 'archives' });
  A('arc_hunters', { name: N('Hall of Hunters', 'Salón de los Cazadores'), theme: 'archives', music: 'archives', map: 'archives' });
  A('arc_vault', { name: N('Forbidden Vault', 'Cripta Prohibida'), theme: 'vault', music: 'archives_deep', map: 'archives' });
})();
