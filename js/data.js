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
  const RARITIES = { common: '#d5d9df', rare: '#75df95', epic: '#bc80d6', legendary: '#ffbf51', mythical: '#ff626b', godly: '#8872ff', exclusive: '#58eee2' };
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
    zenith: ['Zenith', 153, 590, .195, 4, 3, 'zenith', '#f9c383', 'legendary', null],
    enemyGrunt: ['Grunt', 105, 430, .27, 1, 1, 'enemyGrunt', '#a4e991', 'common', null],
    enemyShooter: ['Shooter', 117, 455, .22, 2, 2, 'enemyShooter', '#c99dff', 'rare', null],
    enemyDiver: ['Diver', 112, 615, .21, 2, 2, 'enemyDiver', '#ff927c', 'epic', null],
    enemyTank: ['Tank', 195, 390, .27, 4, 3, 'enemyTank', '#fbd575', 'epic', null],
    enemySmokeNinja: ['Smoke Ninja', 166, 570, .19, 4, 3, 'enemySmokeNinja', '#cbb4e5', 'legendary', null],
    snowman: ['Snowman', 145, 600, .22, 4, 3, 'snowman', '#d9f7ff', 'mythical', null],
    supernova: ['Supernova', 205, 630, .17, 5, 3, 'supernova', '#b99aff', 'godly', null]
  };
  const SHIPS = Object.fromEntries(Object.entries(shipRows).map(([id, row]) => {
    const [name, hull, originalSpeed, delay, damage, engines, frame, color, rarity, price] = row;
    const speed = originalSpeed * .8;
    return [id, { name, hull, speed, delay, damage, engines, frame, color, rarity, price,
      description: hull + ' hull · ' + speed + ' speed · ' + damage + ' damage · ' + engines + (engines === 1 ? ' engine' : ' engines') }];
  }));
  Object.assign(SHIPS.supernova, {
    gemPrice: 100,
    ability: { name: 'Nova Aegis', interval: 24, capacity: 50 }
  });
  SHIPS.singularity.barrage = { name: 'Singularity Barrage', energy: 115, shots: 960, duration: 8, sweepPasses: 6, arcDegrees: 120, damageScale: 1.25 };
  const aegisCapacity = ship => contentActive() ? ship.hull * 1.5 : ship.ability?.capacity ?? 0;
  for (const id of ['enemyGrunt', 'enemyShooter', 'enemyDiver', 'enemyTank', 'enemySmokeNinja']) SHIPS[id].enemyFrame = true;
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
    const count = tiers <= 5 ? tiers : Math.min(48, 5 + Math.ceil(9 * Math.log10(wave / 50)));
    return Array.from({ length: count }, (_, i) => types[i % types.length]);
  }

  const ENEMIES = {
    grunt: { hp: 2, size: 19, unlock: 1, speed: 1, color: '#a4e991', score: 10 },
    shooter: { hp: 3, size: 21, unlock: 3, speed: 0.72, color: '#c99dff', score: 28 },
    diver: { hp: 2, size: 17, unlock: 5, speed: 1.55, color: '#ff927c', score: 18 },
    tank: { hp: 7, size: 27, unlock: 8, speed: 0.52, color: '#fbd575', score: 55 },
    smokeNinja: { name: 'Smoke Ninja', hp: 28, size: 24, unlock: 30, speed: .67, color: '#cbb4e5', score: 170 },
    ...BOSSES
  };
  const SNOW_START = Date.parse('2026-12-01T00:00:00+11:00');
  const SNOW_END = Date.parse('2027-01-01T00:00:00+11:00');
  const TRAILS_START = Date.parse('2026-11-28T22:40:00+11:00');
  const ALIEN_TOKEN_START = Date.parse('2026-11-28T22:45:00+11:00');
  const trailsActive = (now = Date.now()) => now >= TRAILS_START;
  const alienTokenActive = (now = Date.now()) => now >= ALIEN_TOKEN_START;
  const alienChestEvent = (now = Date.now()) => alienTokenActive(now) && now < SNOW_END;
  const ALIEN_TOKEN_DURATION = 72 * 3600000;
  const ALIEN_TOKEN_ODDS = 1 / 9975;
  const WISP_TRAIL_ODDS = .005;
  const snowSeason = (now = Date.now()) => now >= SNOW_START && now < SNOW_END;
  const QUESTS_START = Date.parse('2026-11-28T15:00:00+11:00');
  const questsActive = (now = Date.now()) => now >= QUESTS_START;
  const BOOSTS = {
    goldenTrident: { name: 'Golden Trident', rarity: 'legendary', duration: 0, coreWeapon: true, glyph: '♆',
      description: 'Halves current enemy health. On wave 50, use once to destroy the other enemies, halve the lead Nexus Overlord’s health, and expose its Energy Core.' },
    snowCrystal: { name: 'Snow Crystal', rarity: 'rare', duration: 0, snowfall: true,
      glyph: '❄', description: 'Summons snowfall from a boost slot. 90-second cooldown.' },
    quickload: { name: 'Quickload Cache', rarity: 'epic', duration: 8, barrels: 2, pickupChance: .0025,
      glyph: 'Ⅱ', description: 'Fires two shots per volley for 8 seconds. Also used to craft Twin Cannon.' },
    salvoAmmo: { name: 'Salvo Cache', rarity: 'legendary', duration: 10, barrels: 3, pickupChance: .0008,
      glyph: 'Ⅲ', description: 'Fires three shots per volley for 10 seconds. Also used to craft Triple Cannon.' },
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
      slot: 'Weapon', rarity: 'rare', chance: 0.03, killDropChance: .02, color: '#ffad83', glyph: '✦', damage: 1 },
    booster: { name: 'Auxiliary Booster', slot: 'Engine', rarity: 'rare', chance: .018, color: '#70c9ff', glyph: '▲', speed: .12, description: 'Adds 12% movement speed.' },
    carbon: { name: 'Carbon Wing', slot: 'Wings', rarity: 'epic', chance: .009, color: '#c597ff', glyph: '◀', speed: .32, description: 'Adds 32% movement speed.' },
    rail: { name: 'Rail Lance', slot: 'Weapon', rarity: 'epic', chance: .008, color: '#c597ff', glyph: '↑', damage: 2, description: 'Adds 2 damage to every shot.' },
    fusion: { name: 'Fusion Drive', slot: 'Engine', rarity: 'epic', chance: .007, color: '#c597ff', glyph: '☼', speed: .26, description: 'Adds 26% movement speed.' },
    nova: { name: 'Nova Emitter', slot: 'Weapon', rarity: 'mythical', chance: .002, color: '#ff7ba7', glyph: '✹', damage: 4, description: 'Adds 4 damage to every shot.' },
    rocket: { name: 'Blast Missile', slot: 'Weapon', rarity: 'rare', chance: .015, glyph: '◆', missile: 'blast',
      description: 'Launches toward a target’s current position. Its blast can hit several enemies.' },
    seeker: { name: 'Heat-Seeking Missile', slot: 'Weapon', rarity: 'legendary', glyph: '➶', missile: 'homing',
      description: 'Steers after its target and can retarget if the original enemy is destroyed.' },
    smokeBomb: { name: 'Smoke Bomb', slot: 'Engine', rarity: 'rare', glyph: '☁', smoke: 8,
      description: 'Leaves a five-second smoke trail with range 8. Deals 3 damage every half second.' },
    radioactiveSmoke: { name: 'Radioactive Smoke Bomb', slot: 'Engine', rarity: 'mythical', glyph: '☢', smoke: 6, radioactive: true,
      description: 'Leaves radioactive smoke with range 6. Poisons enemies for four seconds after exposure and deals 4 damage every half second.' },
    slimeCannon: { name: 'Slime Cannon', slot: 'Wings', rarity: 'epic', glyph: '●', slime: true,
      description: 'Fires straight slime shots that splash and slow enemies by 50% for six seconds. Deals 75% of unmodified base shot damage on ships with at least 4 base damage.' },
    twinCannon: { name: 'Twin Cannon', slot: 'Weapon', rarity: 'mythical', glyph: 'Ⅱ', barrels: 2,
      description: 'Fires two parallel projectiles per shot.' },
    tripleCannon: { name: 'Triple Cannon', slot: 'Weapon', rarity: 'godly', glyph: 'Ⅲ', barrels: 3,
      description: 'Fires three parallel projectiles per shot.' },
    beacon: { name: 'Lightning Beacon', slot: 'Special', rarity: 'godly', glyph: '⚡', laser: true,
      description: 'Giant energy beam. Aim with the pointer. Right-click to toggle, or hold the Lightning Beacon key. Each 0.1-second pulse uses 1% energy and deals shot damage divided by 2.75.' },
    magnet: { name: 'Loot Magnet', slot: 'Ability', rarity: 'legendary', glyph: '∪', magnet: true,
      description: 'Makes drops accelerate toward your ship much faster after their one-second pause.' },
    boostRelay: { name: 'Boost Cycle', slot: 'Ability', rarity: 'epic', glyph: '▣', boostRelay: { types: 3, capacity: 15, interval: 2 },
      description: 'Holds up to 15 each of three boost types, with two seconds between activations. Right-click its equipped slot in Ship Loadout to configure it. Switch it on manually during flight.' },
    boostCascade: { name: 'Boost Cascade', slot: 'Ability', rarity: 'legendary', glyph: '▣',
      boostRelay: { types: 5, capacity: 30, interval: .5 },
      description: 'Holds up to 30 each of five boost types, with half a second between activations.' },
    boostOverdrive: { name: 'Boost Overdrive', slot: 'Ability', rarity: 'mythical', glyph: '▣', premium: 75,
      boostRelay: { types: 3, capacity: 150, interval: 0 },
      description: 'Holds up to 150 each of three boost types and activates eligible boosts without a delay.' }
  };
  const TRAILS = {
    wispTrail: { name: 'Wisp Trail', rarity: 'rare', glyph: '〰', description: 'Wisps of wind drift behind your ship.' },
    rocketTrail: { name: 'Rocket Trail', rarity: 'epic', glyph: '🔥', creditPrice: 1500, description: 'Red, orange and yellow rocket exhaust with grey smoke.' },
    bubbleTrail: { name: 'Bubble Trail', rarity: 'exclusive', glyph: '🫧', gemPrice: 20, description: 'Translucent bubbles float behind your ship.' },
    rainbowTrail: { name: 'Rainbow Trail', rarity: 'exclusive', glyph: '🌈', gemPrice: 35, description: 'A six-colour ribbon follows your ship.' },
    christmasTrail: { name: 'Christmas Trail', rarity: 'legendary', glyph: '🎄', description: 'Red and green sparks celebrate Christmas.' }
  };
  const CRATES = {
    alienChest: { name: 'Alien Chest', rarity: 'rare', glyph: '▣', alienChest: true,
      description: 'Contains 5–25 Credits. 5% chance of 1–3 Star Gems and a separate 1 in 9,975 chance of an Alien Token.' },
    jollyGiftBag: { name: 'Jolly Gift Bag', rarity: 'legendary', glyph: '◆', gift: true,
      description: 'Contains 50–250 Credits, 3–10 Star Gems, 5–15 Snowflakes, and 3 random items. Higher rarities are harder to draw. Retired event rewards can appear.' },
    shipCrate: { name: 'Spaceship Crate', rarity: 'epic', glyph: '▣', price: 4, outcomes: [
      { rarity: 'rare', weight: 68, items: ['comet'] }, { rarity: 'epic', weight: 23, items: ['eclipse'] },
      { rarity: 'legendary', weight: 8, items: ['zenith'] },
      { rarity: 'mythical', weight: 1, items: ['singularity'] }
    ] },
    enemyCrate: { name: 'Enemy Crate', rarity: 'epic', glyph: '▣', price: 4, outcomes: [
      { rarity: 'common', weight: 34, items: ['enemyGrunt'] },
      { rarity: 'rare', weight: 25, items: ['enemyShooter'] },
      { rarity: 'epic', weight: 19, items: ['enemyDiver'] },
      { rarity: 'epic', weight: 14, items: ['enemyTank'] },
      { rarity: 'legendary', weight: 8, items: ['enemySmokeNinja'] }
    ] },
    upgradeCrate: { name: 'Upgrade Crate', rarity: 'rare', glyph: '▧', price: 2, outcomes: [
      { rarity: 'rare', weight: 56, items: ['booster', 'wings', 'cannon', 'rocket'] },
      { rarity: 'epic', weight: 42, items: ['rail', 'fusion', 'carbon', 'boostRelay'] },
      { rarity: 'mythical', weight: 1.5, items: ['nova'] },
      { rarity: 'godly', weight: .5, items: ['beacon'] }
    ] },
    boostBundle: { name: 'Boost Bundle', rarity: 'rare', glyph: '▣', bundle: [5, 20],
      pool: ['heal', 'rapidFire', 'doubleDamage', 'shield', 'overdrive', 'nanites'], description: 'Contains 5–20 boosts across several types.' },
    upgradeBundle: { name: 'Upgrade Bundle', rarity: 'epic', glyph: '▣', bundle: [2, 4],
      pool: ['booster', 'wings', 'cannon', 'rocket', 'nova', 'rail', 'fusion', 'carbon'], description: 'Contains 2–4 upgrades across several types.' }
  };
  const CURRENCIES = {
    credit: { name: 'Credits', rarity: 'common', glyph: '●', file: 'icons/currency/credit_gold.png' },
    gem: { name: 'Star Gems', rarity: 'legendary', glyph: '◆', file: 'icons/currency/star_gem.png' }
  };
  const ITEMS = { ...SHIPS, ...UPGRADES, ...BOOSTS, ...CRATES, ...CURRENCIES, ...TRAILS,
    energyOverdrive: { name: 'Energy Overdrive', rarity: 'epic', glyph: '⚡',
      description: 'At full energy, grants 40% more movement speed and a faster fire rate until 25% energy remains.' }
  };
  const SLOTS = {
    leftWing: ['Wings', 'Left wing'], rightWing: ['Wings', 'Right wing'],
    engine1: ['Engine', 'Centre engine'], engine2: ['Engine', 'Left engine'], engine3: ['Engine', 'Right engine'],
    nose: ['Weapon', 'Nose'], special: ['Special', 'Ultimate ability'], ability1: ['Ability', 'Ability 1'], ability2: ['Ability', 'Ability 2']
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

  const SHIP_ORDER = ['supernova', 'singularity', 'snowman', 'aurora', 'zenith', 'enemySmokeNinja', 'leviathan', 'enemyTank', 'eclipse', 'solaris', 'enemyDiver', 'tempest', 'bastion', 'enemyShooter', 'comet', 'wraith', 'falcon', 'enemyGrunt', 'scout'];
  const BOOST_LOCK = 'new-icons/vector-icon-pack/General/Lock/Lock 256.png';
  const CONTENT_START = Date.parse('2026-11-28T12:15:00+11:00');
  const BALANCE_START = Date.parse('2026-11-28T02:08:22.000Z');
  const balanceActive = (now = Date.now()) => now >= BALANCE_START;
  const contentActive = (now = Date.now()) => now >= CONTENT_START;
  const LAUNCH_DEALS_END = Date.parse('2026-11-29T00:00:00+11:00');
  const SHIP_CRATE_OFFER_PRICE = CRATES.shipCrate.price / 4;
  const launchDealsActive = (now = Date.now()) => contentActive(now) && now < LAUNCH_DEALS_END;
  const PREMIUM_PURCHASE_COOLDOWN = 3600000;
  const CRATE_BUY_AMOUNTS = [1, 4, 10];
  const giftCalendar = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const updateGiftDay = now => giftCalendar.format(now);
  const UPDATE_GIFTS = [
    { wait: 180000, rewards: { credit: 50, gem: 1 } },
    { wait: 300000, rewards: { credit: 100, gem: 2, upgradeBundle: 1, boostBundle: 1 } },
    { wait: 720000, rewards: { credit: 150, gem: 3, shipCrate: 1, upgradeCrate: 1, enemyCrate: 1, upgradeBundle: 3, boostBundle: 3 } }
  ];
  const crateUnitPrice = (id, now = Date.now()) => id === 'shipCrate' && !contentActive(now) ? 3 : (CRATES[id]?.price ?? 0);
  function liveCrate(id) {
    const crate = CRATES[id];
    if (id === 'enemyCrate' && balanceActive()) {
      const weights = [42, 23, 17, 13, 5];
      return { ...crate, outcomes: crate.outcomes.map((tier, i) => ({ ...tier, weight: weights[i] })) };
    }
    if (contentActive() || !crate) return crate;
    if (id === 'shipCrate') return { ...crate, price: crateUnitPrice(id), outcomes: crate.outcomes.filter(tier => tier.rarity !== 'legendary')
      .map(tier => tier.rarity === 'rare' ? { ...tier, weight: 76 } : tier) };
    if (id !== 'upgradeCrate') return crate;
    return { ...crate, outcomes: crate.outcomes.map(tier =>
      tier.rarity === 'epic' ? { ...tier, items: tier.items.filter(item => item !== 'boostRelay') } : tier) };
  }
  const newContent = new Set(['zenith', 'enemyCrate', 'enemyGrunt', 'enemyShooter', 'enemyDiver', 'enemyTank', 'enemySmokeNinja', 'boostCascade', 'boostOverdrive', 'twinCannon', 'tripleCannon', 'slimeCannon', 'radioactiveSmoke', 'slime', 'uranium', 'boostBundle', 'upgradeBundle']);
  function itemAvailable(id, now = Date.now()) {
    if (Object.hasOwn(TRAILS, id)) return trailsActive(now);
    if (id === 'alienToken' || id === 'alienChest') return alienTokenActive(now);
    return contentActive(now) || !newContent.has(id);
  }
  const MERCHANT = { boostCascade: 3200, seeker: 2200, vector: 2400, magnet: 2000 };
  const merchantCatalog = (now = Date.now()) => ({
    ...(contentActive(now) ? MERCHANT : { boostRelay: 1600, seeker: 2200, vector: 2400, magnet: 2000 }),
    ...(trailsActive(now) ? { rocketTrail: TRAILS.rocketTrail.creditPrice } : {})
  });
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
      count: Math.ceil(6 * 1.05 ** step * (1 + extra * 3.8)),
      damage: 1 + .012 * step + .58 * extra,
      bossHealth: 1 + 1.25 * extra,
      pack: Math.min(12, 1 + Math.floor(3 * extra)),
      bossPack: Math.min(5, 1 + Math.floor(extra)),
      bossCap: Math.min(12, 5 + Math.floor(2 * extra)),
      bossSpawn: Math.max(.35, 1.35 / (1 + extra)),
      health: 1.045 ** step * (1 + 1.45 * extra),
      speed: Math.min(175, 48 * 1.027 ** step),
      spawn: Math.max(.12, .9 * .963 ** step / (1 + .65 * extra)),
      fire: Math.max(.36, 3.5 * .955 ** step / (1 + .42 * extra)),
      boss: wave % 10 === 0
    };
  }

  function readProfile(storage) {
    let saved;
    for (const key of ['alien-shooter.profile.v1', 'alien-shooter.profile.v1.backup']) {
      try {
        const value = JSON.parse(storage.getItem(key));
        if (value && typeof value === 'object' && !Array.isArray(value)) { saved = value; break; }
      } catch {}
    }
    const alienShips = Object.fromEntries(Object.entries(saved?.alienShips ?? {}).filter(([id, ship]) =>
      /^alien-[1-9]\d*$/.test(id) && ship?.alien === true && typeof ship.name === 'string' &&
      Object.values(shipRows).some(row => row[6] === ship.frame) && Number.isFinite(ship.damage) &&
      Number.isFinite(ship.hull) && Number.isFinite(ship.speed) && ship.delay > 0 && ship.engines >= 1 && ship.engines <= 3));
    for (const ship of Object.values(alienShips)) {
      delete ship.barrage;
      const original = Object.values(SHIPS).find(base => !base.alien && base.name === ship.donor?.replace(/^(Alien )+/, ''));
      if (original && ship.donor !== original.name) {
        Object.assign(ship, window.AG.createAlien(original), { mindControl: ship.mindControl });
      }
      if (original) {
        ship.speed = original.speed * 1.1;
        ship.description = window.AG.createAlien(original).description;
      }
      ship.rarity = original?.rarity ?? (Object.hasOwn(RARITIES, ship.donorRarity) ? ship.donorRarity : ship.rarity);
      ship.mindControl = ship.mindControl === true || (saved?.serumUsed === true && saved?.mindControlPerShip !== true);
    }
    const catalog = { ...SHIPS, ...alienShips };
    const unlocked = Array.isArray(saved?.unlocked) ? [] : ['scout'];
    if (Array.isArray(saved?.unlocked)) {
      for (const id of saved.unlocked) if (Object.hasOwn(catalog, id) && !unlocked.includes(id)) unlocked.push(id);
    }
    if (!unlocked.length) unlocked.push('scout');
    const counts = (key, catalog) => Object.fromEntries(Object.entries(saved?.[key] ?? {})
      .filter(([id, count]) => Object.hasOwn(catalog, id) && Number.isSafeInteger(count) && count > 0));
    const upgrades = counts('upgrades', UPGRADES);
    const trails = counts('trails', TRAILS);
    const loadouts = {};
    for (const ship of unlocked) {
      const mounts = {};
      for (const [slot, id] of Object.entries(saved?.loadouts?.[ship] ?? {})) {
        const key = slot === 'collector' ? 'ability1' : slot === 'relay' ? 'ability2' :
          !saved?.layoutVersion && catalog[ship].engines === 2 && slot.startsWith('engine') ? 'engine' + (+slot.slice(-1) + 1) : slot;
        mounts[key] = id;
      }
      if (mounts.ability3 && !mounts.ability1) mounts.ability1 = mounts.ability3;
      else if (mounts.ability3 && !mounts.ability2) mounts.ability2 = mounts.ability3;
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
    const discoveries = new Set((Array.isArray(saved?.discoveries) ? saved.discoveries : [])
      .filter(id => Object.hasOwn(ITEMS, id) || Object.hasOwn(catalog, id)));
    for (const id of unlocked) discoveries.add(id);
    for (const group of [upgrades, materials, trails, counts('boosts', BOOSTS), counts('crates', CRATES), counts('boostReserve', BOOSTS)]) {
      for (const id of Object.keys(group)) discoveries.add(id);
    }
    if (saved?.credits > 0) discoveries.add('credit');
    if (saved?.gems > 0) discoveries.add('gem');
    const reserve = {};
    const boostStock = counts('boosts', BOOSTS);
    for (const [id, count] of Object.entries(saved?.boostReserves?.boostRelay ?? counts('boostReserve', BOOSTS))) {
      if (!Object.hasOwn(BOOSTS, id) || !Number.isSafeInteger(count) || count <= 0) continue;
      discoveries.add(id);
      const loaded = Object.keys(reserve).length < 3 ? Math.min(count, 15) : 0;
      if (loaded) reserve[id] = loaded;
      if (count > loaded) boostStock[id] = Math.min(Number.MAX_SAFE_INTEGER, (boostStock[id] ?? 0) + count - loaded);
    }
    const boostReserves = { boostRelay: reserve };
    for (const id of ['boostCascade', 'boostOverdrive']) {
      const { types, capacity } = UPGRADES[id].boostRelay;
      const target = boostReserves[id] = {};
      for (const [type, count] of Object.entries(saved?.boostReserves?.[id] ?? {})) {
        if (!Object.hasOwn(BOOSTS, type) || !Number.isSafeInteger(count) || count <= 0) continue;
        const loaded = Object.keys(target).length < types ? Math.min(count, capacity) : 0;
        if (loaded) target[type] = loaded;
        if (count > loaded) boostStock[type] = Math.min(Number.MAX_SAFE_INTEGER, (boostStock[type] ?? 0) + count - loaded);
        discoveries.add(type);
      }
    }
    const bindings = { extend: saved?.bindings?.extend || 'e', retract: saved?.bindings?.retract || 'q', laser: saved?.bindings?.laser || 'f' };
    const usedKeys = Object.values(bindings);
    const relayKey = saved?.bindings?.relay;
    bindings.relay = /^[a-z]$/.test(relayKey ?? '') && !'wasdpi'.includes(relayKey) && !usedKeys.includes(relayKey)
      ? relayKey : [...'bgrtchjklmnuovxyz'].find(key => !usedKeys.includes(key));
    const readNumber = key => Number.isSafeInteger(saved?.[key]) ? Math.max(0, saved[key]) : 0;
    const giftSave = saved?.updateGifts;
    const claimed = Number.isSafeInteger(giftSave?.claimed) ? Math.min(UPDATE_GIFTS.length, Math.max(0, giftSave.claimed)) : 0;
    let nextAt = Number.isSafeInteger(giftSave?.nextAt) ? Math.max(0, giftSave.nextAt) : 0;
    if (giftSave?.version !== 2 && claimed === 2 && nextAt > 0 && nextAt <= 8640000000000000 - 60000) nextAt += 60000;
    // Older saves used three- and six-minute follow-up waits.
    if (giftSave?.version !== 3 && nextAt > 0) nextAt += claimed === 1 ? 120000 : claimed === 2 ? 360000 : 0;
    const previousClaim = nextAt - (UPDATE_GIFTS[claimed]?.wait ?? 0);
    const giftDay = typeof giftSave?.day === 'string' ? giftSave.day :
      claimed && nextAt <= 8640000000000000 && previousClaim > 0 ? updateGiftDay(previousClaim) : '';
    return {
      unlocked, ship: unlocked.includes(saved?.ship) ? saved.ship : unlocked[0], alienShips,
      materials, trails, trail: trails[saved?.trail] ? saved.trail : '',
      alienTokenUntil: Math.min(readNumber('alienTokenUntil'), 8640000000000000),
      alienTokenClaims: Object.fromEntries(Object.entries(saved?.alienTokenClaims ?? {}).filter(([key, day]) =>
        /^(supernova|boostOverdrive|trail:(bubbleTrail|rainbowTrail)|crate:(shipCrate|enemyCrate|upgradeCrate):(1|4|10))$/.test(key) &&
        typeof day === 'string')),
      copies: counts('copies', catalog), flagshipPurchases: Math.max(0, saved?.flagshipPurchases === undefined ? Number(unlocked.includes('supernova')) : readNumber('flagshipPurchases')),
      flagshipTime: readNumber('flagshipTime'), boostOverdriveTime: readNumber('boostOverdriveTime'),
      boostOverdrivePurchases: saved?.boostOverdrivePurchases === undefined ? Number(readNumber('boostOverdriveTime') > 0) : readNumber('boostOverdrivePurchases'),
      serumUsed: saved?.serumUsed === true, mindControlPerShip: true,
      quests: saved?.quests ?? null,
      questSupernovaTime: readNumber('questSupernovaTime'),
      updateGifts: { version: 3, day: giftDay, claimed, nextAt },
      shipCrateOfferUsed: saved?.shipCrateOfferUsed === true,
      allowRareCrateSkip: saved?.allowRareCrateSkip === true,
      bounties: (Array.isArray(saved?.bounties) ? saved.bounties : []).filter(id => Object.hasOwn(BOSSES, id)),
      boostSlots: Array.from({ length: 3 }, (_, i) => {
        const id = (saved?.boostSlots ?? saved?.favoriteBoosts)?.[i];
        return Object.hasOwn(BOOSTS, id) || Object.hasOwn(window.AG?.MATERIALS ?? {}, id) ? id : '';
      }),
      bestPilotLevel: Math.min(50, Math.max(1, readNumber('bestPilotLevel'), Number.isInteger(checkpoint?.level) ? checkpoint.level : 1)),
      pilotXp: saved?.pilotXp === undefined ? Math.max(0, Number.isSafeInteger(checkpoint?.xp) ? checkpoint.xp : 0) : readNumber('pilotXp'),
      pendingMilestones: counts('pendingMilestones', window.AG?.ITEMS ?? {}),
      lastRewards: counts('lastRewards', window.AG?.ITEMS ?? {}),
      merchant: saved?.merchant ?? null,
      boostSide: saved?.boostSide === 'left' ? 'left' : 'right',
      layoutVersion: 1,
      presets: Array.from({ length: 2 }, (_, i) => {
        const entry = saved?.presets?.[i];
        return entry && typeof entry === 'object' ? Object.fromEntries(Object.entries(entry)
          .filter(([key, id]) => Object.hasOwn(SLOTS, key) && Object.hasOwn(UPGRADES, id))) : null;
      }),
      nameStyle: ['original', 'roman', 'numeric'].includes(saved?.nameStyle) ? saved.nameStyle : 'original',
      bindings, boostReserves, discoveries: [...discoveries],
      mode: Object.hasOwn(window.AG?.MODES ?? {}, saved?.mode) ? saved.mode : 'hard',
      checkpoint, modeRecords: saved?.modeRecords ?? {},
      credits: readNumber('credits'), gems: readNumber('gems'), upgrades, loadouts,
      boosts: boostStock, crates: counts('crates', CRATES), bestScore: readNumber('bestScore'),
      bestWave: Math.min(LAST_WAVE, readNumber('bestWave')),
      tutorialSeen: saved?.tutorialSeen === true,
      sound: saved?.sound === true, auto: saved?.auto === true
    };
  }

  function energyCapacity(ship) {
    if (ship.alien) return energyCapacity(
      Object.values(SHIPS).find(base => !base.alien && base.name === ship.donor?.replace(/^Alien /, '')) ??
      { rarity: ship.donorRarity ?? 'mythical' });
    if (ship.name === 'Snowman') return 105;
    if (ship.name === 'Supernova') return 110;
    return { common: 40, rare: 60, epic: 80, legendary: 100, mythical: 115, godly: 110 }[ship.rarity] ?? 40;
  }

  const statNames = { booster: ['Speed', 1], wings: ['Speed', 2], fusion: ['Speed', 3], carbon: ['Speed', 4],
    cannon: ['Damage', 1], rail: ['Damage', 2], nova: ['Damage', 3] };
  function itemName(id, style = window.AG?.game?.profile.nameStyle) {
    const tier = statNames[id];
    if (!tier || !['roman', 'numeric'].includes(style)) return ITEMS[id] ? ITEMS[id].name + (SHIPS[id]?.mindControl ? ' 🧠' : '') : id;
    return tier[0] + ' ' + (style === 'roman' ? ['I','II','III','IV'][tier[1] - 1] : tier[1]);
  }

  function formatCurrency(amount) {
    for (const [value, suffix] of [[1e12, 't'], [1e9, 'b'], [1e6, 'm'], [1e3, 'k']]) {
      if (Math.abs(amount) >= value) return Number((amount / value).toFixed(2)).toString() + suffix;
    }
    return String(amount);
  }

  return { TRAILS, TRAILS_START, ALIEN_TOKEN_START, ALIEN_TOKEN_DURATION, ALIEN_TOKEN_ODDS, WISP_TRAIL_ODDS, trailsActive, alienTokenActive, alienChestEvent, QUESTS_START, questsActive, SNOW_START, SNOW_END, snowSeason, BALANCE_START, balanceActive, aegisCapacity, crateUnitPrice, CONTENT_START, LAUNCH_DEALS_END, SHIP_CRATE_OFFER_PRICE, launchDealsActive, PREMIUM_PURCHASE_COOLDOWN, updateGiftDay, CRATE_BUY_AMOUNTS, UPDATE_GIFTS, contentActive, itemAvailable, liveCrate, merchantCatalog, formatCurrency, energyCapacity, itemName, slotAvailable, fitLoadout, SHIP_ORDER, MERCHANT, BOOST_LOCK, WIDTH, HEIGHT, LAST_WAVE, MAX_WAVE, TARGET_MODES, BOSSES, bossLineup, RARITIES, CRATES, ITEMS, SLOTS, SUPPLY_LEVEL, AUTO_SKIP_AT, ICONS, SHIPS, ENEMIES,
    BOOSTS, UPGRADES, SUPPLIES, clamp, difficultyFor, xpForLevel, readProfile };
})();
