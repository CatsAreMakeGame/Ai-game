window.AG = (() => {
  'use strict';

  const WIDTH = 900;
  const HEIGHT = 600;
  const LAST_WAVE = 50;
  const SUPPLY_LEVEL = 5;
  const AUTO_SKIP_AT = 0.6;
  const ICONS = {
    locked: 'icons/ui/shaded_lock.png',
    supplies: 'icons/ui/in_round_shop.png'
  };
  const SHIPS = {
    scout: { name: 'Scout', description: 'Balanced hull and handling.', hull: 100, speed: 445, delay: 0.28, damage: 1, color: '#d5fa74', price: 0 },
    falcon: { name: 'Falcon', description: 'Faster handling and fire with a lighter hull.', hull: 85, speed: 520, delay: 0.23, damage: 1, color: '#7ed6fb', price: 1 }
  };
  const ENEMIES = {
    grunt: { hp: 2, size: 19, unlock: 1, speed: 1, color: '#a4e991', score: 10 },
    shooter: { hp: 3, size: 21, unlock: 3, speed: 0.72, color: '#c99dff', score: 28 },
    diver: { hp: 2, size: 17, unlock: 5, speed: 1.55, color: '#ff927c', score: 18 },
    tank: { hp: 7, size: 27, unlock: 8, speed: 0.52, color: '#fbd575', score: 55 },
    boss: { hp: 110, size: 62, unlock: 10, speed: 0, color: '#ff7894', score: 600 }
  };
  const BOOSTS = {
    heal: { name: 'Hull repair', description: 'Restores up to 25 hull.', file: 'heal', color: '#71efad', glyph: '+', duration: 0 },
    rapidFire: { name: 'Rapid fire', description: 'Fires faster for 9 seconds.', file: 'rapid-fire', color: '#ffe177', glyph: '»', duration: 9 },
    doubleDamage: { name: 'Double damage', description: 'Doubles shot damage for 9 seconds.', file: 'double-damage', color: '#ffab83', glyph: '×', duration: 9 },
    shield: { name: 'Shield', description: 'Blocks damage for 10 seconds.', file: 'shield', color: '#87def9', glyph: '◇', duration: 10 }
  };
  const UPGRADES = {
    vector: { name: 'Vector Engine', description: 'Unlocks vertical and horizontal steering.',
      slot: 'Engine', chance: 0.015, color: '#87def9', glyph: '↕', vertical: true },
    wings: { name: 'Swift Wings', description: 'Increases movement speed by 20%.',
      slot: 'Wings', chance: 0.025, color: '#d5fa74', glyph: '»', speed: 1.2 },
    cannon: { name: 'Pulse Cannon', description: 'Adds 1 damage to every shot.',
      slot: 'Weapon', chance: 0.03, color: '#ffad83', glyph: '✦', damage: 1 }
  };
  const SUPPLIES = {
    heal: { name: 'Hull repair', description: 'Restores up to 25 hull.', price: 150 },
    rapidFire: { name: 'Rapid Fire+', description: 'Fires faster for 9 seconds of flight.', price: 350 }
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const xpForLevel = level => Math.round(30 * 1.3 ** (level - 1));
  function difficultyFor(wave) {
    const step = wave - 1;
    return {
      count: Math.min(66, Math.ceil(6 * 1.05 ** step)),
      health: Math.min(9, 1.045 ** step),
      speed: Math.min(175, 48 * 1.027 ** step),
      spawn: Math.max(0.19, 0.9 * 0.963 ** step),
      fire: Math.max(0.78, 3.5 * 0.955 ** step),
      boss: wave % 10 === 0
    };
  }

  function readProfile(storage) {
    let saved;
    try { saved = JSON.parse(storage.getItem('alien-shooter.profile.v1')); } catch {}
    const unlocked = ['scout'];
    if (Array.isArray(saved?.unlocked) && saved.unlocked.includes('falcon')) unlocked.push('falcon');
    const readNumber = key => Number.isSafeInteger(saved?.[key]) ? Math.max(0, saved[key]) : 0;
    return {
      unlocked, ship: unlocked.includes(saved?.ship) ? saved.ship : 'scout',
      gems: readNumber('gems'), bestScore: readNumber('bestScore'),
      bestWave: Math.min(LAST_WAVE, readNumber('bestWave')),
      tutorialSeen: saved?.tutorialSeen === true,
      sound: saved?.sound === true, auto: saved?.auto === true
    };
  }

  return { WIDTH, HEIGHT, LAST_WAVE, SUPPLY_LEVEL, AUTO_SKIP_AT, ICONS, SHIPS, ENEMIES,
    BOOSTS, UPGRADES, SUPPLIES, clamp, difficultyFor, xpForLevel, readProfile };
})();
