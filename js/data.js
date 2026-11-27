window.AG = (() => {
  'use strict';

  const WIDTH = 900;
  const HEIGHT = 600;
  const LAST_WAVE = 50;
  const MAX_WAVE = 2147483647;
  const SUPPLY_LEVEL = 5;
  const AUTO_SKIP_AT = 0.6;
  const ICONS = {
    locked: 'icons/ui/shaded_lock.png',
    supplies: 'icons/ui/in_round_shop.png'
  };
  const RARITIES = { common: '#d5d9df', rare: '#75df95', epic: '#9b67cc', legendary: '#ffbf51', mythical: '#ff626b', godly: '#8872ff' };
  // Hull, speed, shot interval, damage, engine mounts, silhouette, accent, rarity, price.
  const shipRows = {
    scout: ['Scout', 100, 445, .28, 1, 1, 'dart', '#d5fa74', 'common', 0],
    falcon: ['Falcon', 85, 520, .23, 1, 2, 'swept', '#7ed6fb', 'rare', 400],
    bastion: ['Bastion', 155, 350, .32, 2, 2, 'block', '#ffd080', 'rare', 650],
    wraith: ['Wraith', 90, 575, .21, 1, 1, 'split', '#bb8cff', 'rare', 850],
    tempest: ['Tempest', 110, 480, .24, 2, 2, 'crescent', '#73f2b0', 'epic', 1250],
    solaris: ['Solaris', 125, 470, .25, 3, 3, 'delta', '#ff9474', 'epic', 1750],
    leviathan: ['Leviathan', 180, 370, .3, 4, 3, 'hex', '#ffbe68', 'legendary', 2600],
    aurora: ['Aurora', 160, 575, .19, 4, 3, 'arrow', '#83fff3', 'legendary', 3300],
    comet: ['Comet', 100, 605, .21, 1, 2, 'needle', '#6edaff', 'rare', null],
    eclipse: ['Eclipse', 138, 525, .22, 3, 2, 'fang', '#e0a1ff', 'epic', null],
    singularity: ['Singularity', 165, 560, .19, 4, 3, 'star', '#ff81bf', 'mythical', null],
    supernova: ['Supernova', 205, 630, .17, 5, 3, 'supernova', '#b99aff', 'godly', null]
  };
  const SHIPS = Object.fromEntries(Object.entries(shipRows).map(([id, row]) => {
    const [name, hull, speed, delay, damage, engines, frame, color, rarity, price] = row;
    return [id, { name, hull, speed, delay, damage, engines, frame, color, rarity, price,
      description: hull + ' hull · ' + speed + ' speed · ' + damage + ' damage · ' + engines + (engines === 1 ? ' engine' : ' engines') }];
  }));
  Object.assign(SHIPS.supernova, {
    gemPrice: 100,
    ability: { name: 'Nova Aegis', interval: 24, capacity: 15 }
  });
  const BOSSES = {
    boss: { name: 'Mothership', hp: 95, size: 49, color: '#ff7894', score: 600, tier: 0, shots: 5, spread: .18, cadence: 2.2 },
    prism: { name: 'Prism Carrier', hp: 145, size: 44, color: '#bf8cff', score: 850, tier: 1, shots: 3, spread: .15, cadence: 1.8 },
    dread: { name: 'Iron Dreadnought', hp: 205, size: 53, color: '#ffc26e', score: 1150, tier: 2, shots: 8, spread: .22, cadence: 2.7 },
    phantom: { name: 'Phantom Ark', hp: 255, size: 46, color: '#6ef6d9', score: 1500, tier: 3, shots: 4, spread: .1, cadence: 1.6 },
    nexus: { name: 'Nexus Overlord', hp: 350, size: 57, color: '#fa83d9', score: 2100, tier: 4, shots: 9, spread: .27, cadence: 2.45 }
  };
  function bossLineup(wave) {
    if (wave % 10) return [];
    const types = Object.keys(BOSSES);
    const tiers = Math.floor(wave / 10);
    const count = tiers <= 5 ? tiers : Math.min(28, 5 + Math.ceil(Math.log2(tiers - 4)));
    return Array.from({ length: count }, (_, i) => types[i % types.length]);
  }

  const ENEMIES = {
    grunt: { hp: 2, size: 19, unlock: 1, speed: 1, color: '#a4e991', score: 10 },
    shooter: { hp: 3, size: 21, unlock: 3, speed: 0.72, color: '#c99dff', score: 28 },
    diver: { hp: 2, size: 17, unlock: 5, speed: 1.55, color: '#ff927c', score: 18 },
    tank: { hp: 7, size: 27, unlock: 8, speed: 0.52, color: '#fbd575', score: 55 },
    ...BOSSES
  };
  const BOOSTS = {
    heal: { name: 'Hull repair', description: 'Restores up to 25 hull.', file: 'heal', color: '#71efad', glyph: '+', duration: 0 },
    rapidFire: { name: 'Rapid fire', description: 'Fires faster for 9 seconds.', file: 'rapid-fire', color: '#ffe177', glyph: '»', duration: 9 },
    doubleDamage: { name: 'Double damage', description: 'Doubles shot damage for 9 seconds.', file: 'double-damage', color: '#ffab83', glyph: '×', duration: 9 },
    shield: { name: 'Shield', description: 'Blocks damage for 10 seconds.', file: 'shield', color: '#87def9', glyph: '◇', duration: 10 }
  };
  Object.assign(BOOSTS, {
    overdrive: { name: 'Overdrive', description: 'Boosts speed by 40% and firing rate for 12 seconds.', color: '#c597ff', glyph: '⚡', duration: 12, rarity: 'epic' },
    fortress: { name: 'Fortress Shield', description: 'Blocks damage for 18 seconds.', color: '#ffce70', glyph: '⬡', duration: 18, rarity: 'legendary' },
    nanites: { name: 'Nanite Repair', description: 'Restores up to 60 hull.', color: '#c597ff', glyph: '✚', duration: 0, repair: 60, rarity: 'epic' }
  });
  BOOSTS.heal.repair = 25;
  BOOSTS.rapidFire.rarity = BOOSTS.doubleDamage.rarity = BOOSTS.shield.rarity = 'rare';

  const UPGRADES = {
    vector: { name: 'Vector Engine', description: 'Unlocks vertical and horizontal steering.',
      slot: 'Engine', rarity: 'legendary', color: '#87def9', glyph: '↕', vertical: true },
    wings: { name: 'Swift Wings', description: 'Increases movement speed by 20%.',
      slot: 'Wings', rarity: 'rare', chance: 0.025, color: '#d5fa74', glyph: '»', speed: .2 },
    cannon: { name: 'Pulse Cannon', description: 'Adds 1 damage to every shot.',
      slot: 'Weapon', rarity: 'rare', chance: 0.03, color: '#ffad83', glyph: '✦', damage: 1 },
    booster: { name: 'Auxiliary Booster', slot: 'Engine', rarity: 'rare', chance: .018, color: '#70c9ff', glyph: '▲', speed: .12, description: 'Adds 12% movement speed.' },
    carbon: { name: 'Carbon Wing', slot: 'Wings', rarity: 'epic', chance: .009, color: '#c597ff', glyph: '◀', speed: .32, description: 'Adds 32% movement speed.' },
    rail: { name: 'Rail Lance', slot: 'Weapon', rarity: 'epic', chance: .008, color: '#c597ff', glyph: '↑', damage: 2, description: 'Adds 2 damage to every shot.' },
    fusion: { name: 'Fusion Drive', slot: 'Engine', rarity: 'epic', chance: .007, color: '#c597ff', glyph: '☼', speed: .26, description: 'Adds 26% movement speed.' },
    nova: { name: 'Nova Emitter', slot: 'Weapon', rarity: 'mythical', chance: .002, color: '#ff7ba7', glyph: '✹', damage: 4, description: 'Adds 4 damage to every shot.' },
    rocket: { name: 'Blast Missile', slot: 'Weapon', rarity: 'rare', chance: .015, glyph: '◆', missile: 'blast',
      description: 'Launches toward a target’s current position. Its blast can hit several enemies.' },
    seeker: { name: 'Heat-Seeking Missile', slot: 'Weapon', rarity: 'legendary', glyph: '➶', missile: 'homing',
      description: 'Steers after its target and can retarget if the original enemy is destroyed.' },
    smokeBomb: { name: 'Smoke Bomb', slot: 'Engine', rarity: 'rare', glyph: '☁', smoke: true, chance: .018,
      description: 'Leaves a two-second smoke trail that deals 1 damage per second to enemies inside it.' },
    beacon: { name: 'Lightning Beacon', slot: 'Special', rarity: 'godly', glyph: '⚡', laser: true,
      description: 'Giant energy beam. Aim with the pointer. Right-click to toggle, or hold the Lightning Beacon key. Each pulse costs 3% and deals double shot damage.' },
    magnet: { name: 'Loot Magnet', slot: 'Ability', rarity: 'legendary', glyph: '∪', magnet: true,
      description: 'Pulls enemy loot to your ship and collects it when it arrives.' },
    boostRelay: { name: 'Auto Boost', slot: 'Ability', rarity: 'epic', glyph: '▣', boostRelay: true,
      description: 'Holds up to five copies each of five boost types. Right-click its equipped slot in Ship Loadout to configure it.' }
  };
  const CRATES = {
    shipCrate: { name: 'Spaceship Crate', rarity: 'epic', glyph: '▣', price: 3, outcomes: [
      { rarity: 'rare', weight: 72, items: ['comet'] }, { rarity: 'epic', weight: 23, items: ['eclipse'] },
      { rarity: 'mythical', weight: 5, items: ['singularity'] }
    ] },
    upgradeCrate: { name: 'Upgrade Crate', rarity: 'rare', glyph: '▧', price: 2, outcomes: [
      { rarity: 'rare', weight: 56, items: ['booster', 'wings', 'cannon', 'rocket', 'smokeBomb'] },
      { rarity: 'epic', weight: 42, items: ['rail', 'fusion', 'carbon'] }, { rarity: 'mythical', weight: 1.5, items: ['nova'] },
      { rarity: 'godly', weight: .5, items: ['beacon'] }
    ] }
  };
  const CURRENCIES = {
    credit: { name: 'Credits', rarity: 'common', glyph: '●', file: 'icons/currency/credit_gold.png' },
    gem: { name: 'Star Gems', rarity: 'legendary', glyph: '◆', file: 'icons/currency/star_gem.png' }
  };
  const ITEMS = { ...SHIPS, ...UPGRADES, ...BOOSTS, ...CRATES, ...CURRENCIES };
  const SLOTS = {
    leftWing: ['Wings', 'Left wing'], rightWing: ['Wings', 'Right wing'],
    engine1: ['Engine', 'Centre engine'], engine2: ['Engine', 'Left engine'], engine3: ['Engine', 'Right engine'],
    nose: ['Weapon', 'Nose'], special: ['Special', 'Ultimate ability'], ability1: ['Ability', 'Ability 1'], ability2: ['Ability', 'Ability 2'], ability3: ['Ability', 'Ability 3']
  };
  function slotAvailable(ship, slot) {
    if (!Object.hasOwn(SLOTS, slot)) return false;
    if (!slot.startsWith('engine')) return true;
    return ship.engines === 3 || (ship.engines === 1 ? slot === 'engine1' : slot !== 'engine1');
  }

  function fitLoadout(ship, entries, upgrades) {
    const mounts = {};
    const used = {};
    const ordered = Object.entries(entries).sort(([a], [b]) => Number(slotAvailable(ship, b)) - Number(slotAvailable(ship, a)));
    for (const [slot, id] of ordered) {
      if (!upgrades[id] || used[id] >= upgrades[id] || SLOTS[slot]?.[0] !== UPGRADES[id]?.slot) continue;
      const fits = key => SLOTS[key][0] === SLOTS[slot][0] && slotAvailable(ship, key) && !mounts[key];
      const target = fits(slot) ? slot : Object.keys(SLOTS).find(fits);
      if (!target) continue;
      mounts[target] = id;
      used[id] = (used[id] ?? 0) + 1;
    }
    return mounts;
  }

  const SHIP_ORDER = ['supernova', 'singularity', 'aurora', 'leviathan', 'eclipse', 'solaris', 'tempest', 'bastion', 'comet', 'wraith', 'falcon', 'scout'];
  const BOOST_LOCK = 'new-icons/vector-icon-pack/General/Lock/Lock 256.png';
  const MERCHANT = { boostRelay: 1600, seeker: 2200, vector: 2400, magnet: 2000 };
  const TARGET_MODES = { nearest: 'Closest to ship', bottom: 'Closest to bottom', strongest: 'Strongest', weakest: 'Weakest' };
  const SUPPLIES = {
    heal: { name: 'Hull repair', description: 'Restores up to 25 hull.', price: 150 },
    rapidFire: { name: 'Rapid Fire+', description: 'Fires faster for 9 seconds of flight.', price: 350 }
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const xpForLevel = level => Math.round(30 * 1.3 ** (level - 1));
  function difficultyFor(wave) {
    const step = Math.min(wave, 50) - 1;
    const extra = Math.max(0, Math.log10(wave / 50));
    return {
      count: Math.ceil(6 * 1.05 ** step + 28 * extra),
      health: 1.045 ** step * (1 + .5 * extra),
      speed: Math.min(175, 48 * 1.027 ** step),
      spawn: Math.max(0.19, 0.9 * 0.963 ** step),
      fire: Math.max(0.78, 3.5 * 0.955 ** step),
      boss: wave % 10 === 0
    };
  }

  function readProfile(storage) {
    let saved;
    try { saved = JSON.parse(storage.getItem('alien-shooter.profile.v1')); } catch {}
    const alienShips = Object.fromEntries(Object.entries(saved?.alienShips ?? {}).filter(([id, ship]) =>
      /^alien-[1-9]\d*$/.test(id) && ship?.alien === true && typeof ship.name === 'string' &&
      Object.values(shipRows).some(row => row[6] === ship.frame) && Number.isFinite(ship.damage) &&
      Number.isFinite(ship.hull) && Number.isFinite(ship.speed) && ship.delay > 0 && ship.engines >= 1 && ship.engines <= 3));
    const catalog = { ...SHIPS, ...alienShips };
    const unlocked = Array.isArray(saved?.unlocked) ? [] : ['scout'];
    if (Array.isArray(saved?.unlocked)) {
      for (const id of saved.unlocked) if (Object.hasOwn(catalog, id) && !unlocked.includes(id)) unlocked.push(id);
    }
    if (!unlocked.length) unlocked.push('scout');
    const counts = (key, catalog) => Object.fromEntries(Object.entries(saved?.[key] ?? {})
      .filter(([id, count]) => Object.hasOwn(catalog, id) && Number.isSafeInteger(count) && count > 0));
    const upgrades = counts('upgrades', UPGRADES);
    const loadouts = {};
    for (const ship of unlocked) {
      const mounts = {};
      for (const [slot, id] of Object.entries(saved?.loadouts?.[ship] ?? {})) {
        const key = slot === 'collector' ? 'ability1' : slot === 'relay' ? 'ability2' :
          !saved?.layoutVersion && catalog[ship].engines === 2 && slot.startsWith('engine') ? 'engine' + (+slot.slice(-1) + 1) : slot;
        mounts[key] = id;
      }
      loadouts[ship] = fitLoadout(catalog[ship], mounts, upgrades);
    }
    const materials = counts('materials', window.AG?.MATERIALS ?? {});
    const canonicalMaterial = id => id === 'alienBrain' ? 'alienMind' : id === 'craftingSerum' ? 'alienSerum' : id;
    for (const oldId of ['alienBrain', 'craftingSerum']) {
      const quantity = saved?.materials?.[oldId];
      if (!Number.isSafeInteger(quantity) || quantity <= 0) continue;
      const id = canonicalMaterial(oldId);
      materials[id] = Math.min(Number.MAX_SAFE_INTEGER, (materials[id] ?? 0) + quantity);
    }
    const checkpoint = saved?.checkpoint ?? null;
    if (Array.isArray(checkpoint?.drops)) {
      checkpoint.drops = checkpoint.drops.map(drop => ({ ...drop, type: canonicalMaterial(drop.type) }));
    }
    if (checkpoint?.stats?.rarest) checkpoint.stats.rarest = canonicalMaterial(checkpoint.stats.rarest);
    const reserve = Object.fromEntries(Object.entries(counts('boostReserve', BOOSTS)).slice(0, 5)
      .map(([id, count]) => [id, Math.min(count, 5)]));
    const bindings = { extend: saved?.bindings?.extend || 'e', retract: saved?.bindings?.retract || 'q', laser: saved?.bindings?.laser || 'f' };
    const usedKeys = Object.values(bindings);
    const relayKey = saved?.bindings?.relay;
    bindings.relay = /^[a-z]$/.test(relayKey ?? '') && !'wasdpi'.includes(relayKey) && !usedKeys.includes(relayKey)
      ? relayKey : [...'bgrtchjklmnuovxyz'].find(key => !usedKeys.includes(key));
    const readNumber = key => Number.isSafeInteger(saved?.[key]) ? Math.max(0, saved[key]) : 0;
    return {
      unlocked, ship: unlocked.includes(saved?.ship) ? saved.ship : unlocked[0], alienShips,
      materials,
      copies: counts('copies', catalog), flagshipPurchases: Math.max(0, readNumber('flagshipPurchases') || Number(unlocked.includes('supernova'))),
      flagshipTime: readNumber('flagshipTime'), serumUsed: saved?.serumUsed === true,
      bounties: (Array.isArray(saved?.bounties) ? saved.bounties : []).filter(id => Object.hasOwn(BOSSES, id)),
      boostSlots: Array.from({ length: 3 }, (_, i) => {
        const id = (saved?.boostSlots ?? saved?.favoriteBoosts)?.[i];
        return Object.hasOwn(BOOSTS, id) ? id : '';
      }),
      bestPilotLevel: Math.max(1, readNumber('bestPilotLevel'), Number.isInteger(checkpoint?.level) ? Math.min(50, checkpoint.level) : 1),
      merchant: saved?.merchant ?? null,
      boostSide: saved?.boostSide === 'left' ? 'left' : 'right',
      layoutVersion: 1,
      presets: Array.from({ length: 2 }, (_, i) => {
        const entry = saved?.presets?.[i];
        return entry && typeof entry === 'object' ? Object.fromEntries(Object.entries(entry)
          .filter(([key, id]) => Object.hasOwn(SLOTS, key) && Object.hasOwn(UPGRADES, id))) : null;
      }),
      bindings, boostReserve: reserve,
      mode: Object.hasOwn(window.AG?.MODES ?? {}, saved?.mode) ? saved.mode : 'hard',
      checkpoint, modeRecords: saved?.modeRecords ?? {},
      credits: readNumber('credits'), gems: readNumber('gems'), upgrades, loadouts,
      boosts: counts('boosts', BOOSTS), crates: counts('crates', CRATES), bestScore: readNumber('bestScore'),
      bestWave: Math.min(LAST_WAVE, readNumber('bestWave')),
      tutorialSeen: saved?.tutorialSeen === true,
      sound: saved?.sound === true, auto: saved?.auto === true
    };
  }

  return { slotAvailable, fitLoadout, SHIP_ORDER, MERCHANT, BOOST_LOCK, WIDTH, HEIGHT, LAST_WAVE, MAX_WAVE, TARGET_MODES, BOSSES, bossLineup, RARITIES, CRATES, ITEMS, SLOTS, SUPPLY_LEVEL, AUTO_SKIP_AT, ICONS, SHIPS, ENEMIES,
    BOOSTS, UPGRADES, SUPPLIES, clamp, difficultyFor, xpForLevel, readProfile };
})();
