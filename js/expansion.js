(() => {
  'use strict';
  const AG = window.AG;
  const { Game, SHIPS, BOSSES, BOOSTS, ITEMS, WIDTH, HEIGHT, MAX_WAVE, clamp } = AG;
  const MODES = { easy: 20, medium: 30, hard: 50, endless: MAX_WAVE };
  const EVENT_END = Date.parse('2026-12-01T00:00:00+11:00');
  const MATERIALS = {
    energyCore: { name: 'Energy Core', rarity: 'mythical', glyph: '◉', description: 'Catch it after defeating a charged Nexus Overlord. Redeem it for Supernova in Quests.' },
    snowflake: { name: 'Snowflake', rarity: 'common', glyph: '❄', description: 'Catch during snowfall. Craft five into a Snow Crystal.' },
    slime: { name: 'Slime', rarity: 'common', glyph: '●', description: 'Dropped by green Grunts. Used to craft a Slime Cannon.' },
    uranium: { name: 'Uranium Ore', rarity: 'epic', glyph: '◆', description: 'Found in green asteroids. Used to craft a Radioactive Smoke Bomb.' },
    alienCell: { name: 'Alien Cell', rarity: 'rare', description: 'Used in both Alien recipes.' },
    alienMind: { name: 'Alien Mind', rarity: 'legendary', description: 'Crafted from nine Alien Cells. Place below the ship used in the recipe to craft an Alien Ship.' },
    alienSerum: { name: 'Alien Mind Serum', rarity: 'mythical', description: 'Use in the crafting grid to make an Alien ship or give an Alien ship Mind Control.' }
  };
  const RECIPES = {
    snowCrystal: { name: 'Snow Crystal', event: true, available: game => game.now() >= AG.SNOW_START, output: 'snowCrystal', pattern: ['', 'snowflake', '', 'snowflake', 'snowflake', 'snowflake', '', 'snowflake', ''] },
    twinCannon: { name: 'Twin Cannon', output: 'twinCannon', pattern: ['rail', 'nova', 'rail', '', 'quickload', '', '', '', ''], shift: true },
    tripleCannon: { name: 'Triple Cannon', output: 'tripleCannon', pattern: ['nova', 'nova', 'nova', '', 'salvoAmmo', '', '', '', ''], shift: true },
    slimeCannon: { name: 'Slime Cannon', output: 'slimeCannon', ingredients: ['cannon', 'rocket', 'slime'] },
    radioactiveSmoke: { name: 'Radioactive Smoke Bomb', output: 'radioactiveSmoke', pattern: ['', 'nova', '', 'uranium', 'smokeBomb', 'uranium', '', '', ''] },
    ship: { name: 'Alien Ship', event: true, pattern: ['alienCell', 'alienSerum', 'alienCell', 'alienCell', 'donor', 'alienCell', 'alienCell', 'alienMind', 'alienCell'] },
    mind: { name: 'Alien Mind', event: true, pattern: Array(9).fill('alienCell') },
    serum: { name: 'Alien Mind Serum', event: true, pattern: ['alienCell', 'alienCell', 'alienCell', 'alienCell', 'alienMind', 'alienCell', 'alienCell', 'alienCell', 'alienCell'] },
    control: { name: 'Mind Control', event: true, ingredients: ['alienShip', 'alienSerum', 'alienMind'] }
  };
  const BASE_SHIPS = { ...SHIPS };
  Object.assign(ITEMS, MATERIALS);
  for (const [id, icon] of Object.entries({
  "shipCrate": "Items/Chest/Chest 1/Chest Large 1 256.png",
  "enemyCrate": "Items/Chest/Chest 2/Chest Large 2 256.png",
  "upgradeCrate": "Items/Crate/Crate Gold 256.png",
  "shield": "Weapons/Shield/Shield 256.png",
  "fortress": "Weapons/Shield/Shield Gold 256.png",
  "heal": "Tools/Potion 1/Potion 1 256.png",
  "nanites": "Tools/Potion 1/Potion 1 Pink 256.png",
  "overdrive": "General/Lightning Bolt/Lightning Bolt Yellow 256.png",
  "energyCore": "General/Power Cell/Power Cell 1 256.png",
  "snowflake": "Nature/Snowflake/Snowflake 256.png",
  "snowCrystal": "Materials/Ice/Ice 256.png",
  "goldenTrident": "Weapons/Trident/Trident 256.png",
  "energyOverdrive": "General/Lightning Bolt/Lightning Bolt Purple 256.png",
  "rapidFire": "UI/Arrow/Arrow Up 256.png",
  "doubleDamage": "General/Sparkle/Sparkle 256.png",
  "vector": "Transport/Rocket/Rocket 2 256.png",
  "wings": "Items/Wing/Wing 256.png",
  "carbon": "Items/Wing/Wing Purple 256.png",
  "booster": "General/Settings/Gear 256.png",
  "fusion": "Items/Battery/Battery 256.png",
  "cannon": "Weapons/Target/Target 256.png",
  "rail": "Weapons/Rocket Launcher/Rocket Launcher 256.png",
  "nova": "General/Star/Star Gold 256.png",
  "rocket": "Transport/Rocket/Rocket 256.png",
  "seeker": "UI/Crosshair/Crosshair 256.png",
  "beacon": "General/Lightning Bolt/Lightning Bolt 256.png",
  "smokeBomb": "Nature/Cloud/Cloud 256.png",
  "magnet": "Tools/Magnet/Magnet 256.png",
  "boostBundle": "Items/Pouch/Pouch Blue 256.png",
  "upgradeBundle": "Items/Pouch/Pouch Purple 256.png",
  "boostCascade": "General/Lightning Bolt/Lightning Bolt Yellow 256.png",
  "boostOverdrive": "General/Lightning Bolt/Lightning Bolt Purple 256.png",
  "radioactiveSmoke": "UI/Radioactive Sign/Radioactive Sign 256.png",
  "slime": "General/Slime/Slime Green 256.png",
  "uranium": "Currency/Gem/Gem Green 256.png",
  "slimeCannon": "General/Slime/Slime Blue 256.png",
  "twinCannon": "Weapons/Ammo/Ammo Silver 256.png",
  "tripleCannon": "Weapons/Ammo 2/Ammo 2 Bronze 256.png",
  "quickload": "Items/Storage Box/Storage Box White 256.png",
  "salvoAmmo": "Items/Storage Box/Storage Box Gold 256.png",
  "boostRelay": "Clothing/Backpack/Backpack Blue 256.png",
  "alienCell": "Nature/DNA/DNA 256.png",
  "alienMind": "Player/Brain/Brain 256.png",
  "alienSerum": "Tools/Potion 3/Potion 3 Green 256.png"
})) {
    ITEMS[id].icon = 'new-icons/vector-icon-pack/' + icon;
    ITEMS[id].glyph ??= '◆';
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  const checkpointKeys = ['level', 'xp', 'score', 'energy', 'targetMode', 'boosts', 'aegisCooldown', 'aegisShield', 'mindCooldown', 'stats', 'drops', 'boostCycleOn', 'boostCycleDelay', 'cleared', 'activeSeconds', 'loadout', 'energyOverdrive', 'overdriveTick', 'overdriveSuppressed', 'controlSequence', 'enemySmoke', 'smokeDamageIn', 'asteroidDelay', 'asteroidField', 'asteroids', 'barrage', 'snowfall', 'snowCooldown', 'snowShotCount'];
  const eventActive = (time = Date.now()) => time < EVENT_END;
  const mainBoss = wave => wave >= 10 && wave % 10 === 0 ? Object.keys(BOSSES)[Math.min(wave / 10 - 1, 4)] : null;

  function crateRoll(crate, random = Math.random) {
    let value = random() * 100;
    const tier = crate.outcomes.find(entry => (value -= entry.weight) < 0) ?? crate.outcomes.at(-1);
    return { id: tier.items[Math.floor(random() * tier.items.length)], rarity: tier.rarity };
  }

  function gamma(shape, random) {
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (let attempt = 0; ; attempt++) {
      const rng = attempt < 32 ? random : Math.random;
      const normal = Math.sqrt(-2 * Math.log(Math.max(Number.MIN_VALUE, 1 - rng()))) * Math.cos(2 * Math.PI * rng());
      const base = 1 + c * normal;
      if (base <= 0) continue;
      const v = base ** 3;
      const u = rng();
      if (u < 1 - .0331 * normal ** 4 ||
          Math.log(u) < .5 * normal ** 2 + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  function binomial(count, probability, random) {
    let successes = 0;
    // Split by a beta-distributed order statistic to avoid one roll per crate.
    while (count > 64 && probability > 0 && probability < 1) {
      const split = Math.floor(count / 2) + 1;
      const left = gamma(split, random);
      const right = gamma(count - split + 1, random);
      const pivot = left / (left + right);
      if (pivot <= probability) {
        successes += split;
        count -= split;
        probability = (probability - pivot) / (1 - pivot);
      } else {
        count = split - 1;
        probability /= pivot;
      }
    }
    if (probability >= 1) return successes + count;
    if (probability > 0) for (let i = 0; i < count; i++) if (random() < probability) successes++;
    return successes;
  }

  function crateTotals(crate, count, random) {
    const totals = new Map();
    if (count <= 1000) {
      for (let i = 0; i < count; i++) {
        const { id } = crateRoll(crate, random);
        totals.set(id, (totals.get(id) ?? 0) + 1);
      }
      return totals;
    }
    const outcomes = crate.outcomes.flatMap(tier => tier.items.map(id => [id, tier.weight / tier.items.length]));
    let remainingWeight = outcomes.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [index, [id, weight]] of outcomes.entries()) {
      const amount = index === outcomes.length - 1 ? count : binomial(count, weight / remainingWeight, random);
      if (amount) totals.set(id, (totals.get(id) ?? 0) + amount);
      count -= amount;
      remainingWeight -= weight;
    }
    return totals;
  }

  function bundleTotals(spec, count, random) {
    const [min, max] = spec.bundle;
    const sizes = Array.from({ length: max - min + 1 }, (_, index) => min + index);
    const roll = (items, amount) => crateTotals({ outcomes: [{ items, weight: 100 }] }, amount, random);
    const rewards = {};
    const ranks = Object.keys(AG.RARITIES);
    const limited = AG.liveCrate('upgradeCrate').outcomes.flatMap(tier =>
      tier.items.filter(id => spec.pool.includes(id) && ranks.indexOf(AG.UPGRADES[id]?.rarity) >= ranks.indexOf('legendary'))
        .map(id => ({ items: [id], weight: tier.weight / tier.items.length / 3 })));
    const pool = spec.pool.filter(id => !limited.some(tier => tier.items[0] === id));
    const totalWeight = limited.reduce((sum, tier) => sum + tier.weight, 0);
    const slots = limited.length ? crateTotals({ outcomes: [...limited, { items: [''], weight: 100 - totalWeight }] }, count, random) :
      new Map([['', count]]);
    for (const [rareItem, copies] of slots) {
      if (rareItem) rewards[rareItem] = copies;
      for (const [size, bundles] of roll(sizes, copies)) {
        const ordinary = size - Number(Boolean(rareItem));
        // Each bundle draws all full sets, then a uniform subset for the remaining items.
        const full = Math.floor(ordinary / pool.length);
        if (full) for (const id of pool) rewards[id] = (rewards[id] ?? 0) + full * bundles;
        const remainder = ordinary % pool.length;
        if (!remainder) continue;
        const subsetMasks = [];
        for (let mask = 1; mask < 2 ** pool.length; mask++) {
          let bits = 0;
          for (let value = mask; value; value &= value - 1) bits++;
          if (bits === remainder) subsetMasks.push(mask);
        }
        for (const [mask, copies] of roll(subsetMasks, bundles)) {
          pool.forEach((id, index) => {
            if (mask & (1 << index)) rewards[id] = (rewards[id] ?? 0) + copies;
          });
        }
      }
    }
    return rewards;
  }

  function syncShips(profile) {
    for (const id of Object.keys(SHIPS)) {
      if (Object.hasOwn(BASE_SHIPS, id)) continue;
      delete SHIPS[id];
      delete ITEMS[id];
    }
    Object.assign(SHIPS, profile.alienShips);
    Object.assign(ITEMS, profile.alienShips);
  }

  function createAlien(donor) {
    const name = 'Alien ' + donor.name;
    const hull = Number((donor.hull * 1.1).toFixed(2));
    const damage = Number((donor.damage * 1.1).toFixed(3));
    return { name, hull, damage, speed: donor.speed * 1.1, delay: donor.delay / 1.1,
      energyCapacity: AG.energyCapacity(donor), engines: donor.engines, frame: donor.frame, color: '#8ae86c', rarity: donor.rarity, alien: true, mindControl: false,
      donor: donor.name, donorRarity: donor.donorRarity ?? donor.rarity, donorDamage: donor.donorDamage ?? donor.damage,
      description: hull + ' hull · ' + Math.round(donor.speed * 1.1) + ' speed · ' + damage + ' damage · ' + donor.engines + (donor.engines === 1 ? ' engine' : ' engines') };
  }

  Object.assign(Game.prototype, {
    checkpoint() {
      const run = this.run;
      if (this.testing || run.practice || run.wave >= this.waveLimit) return;
      this.profile.checkpoint = clone({
        wave: run.wave, mode: run.mode, shipId: run.shipId,
        player: { x: run.player.x, y: run.player.y, hp: run.player.hp },
        anchors: run.tendrils.map(({ anchorX, anchorY }) => ({ anchorX, anchorY })),
        allies: run.enemies.filter(enemy => enemy.allied).map(({ grips, freed, ...enemy }) => enemy),
        ...Object.fromEntries(checkpointKeys.map(key => [key, run[key]]))
      });
    },

    canContinue() {
      const saved = this.profile.checkpoint;
      return !this.testing && Boolean(saved && Object.hasOwn(MODES, saved.mode) && Number.isInteger(saved.wave) &&
        saved.wave >= 1 && saved.wave < MODES[saved.mode] && this.profile.unlocked.includes(saved.shipId) &&
        saved.player?.hp > 0 && saved.stats?.bossKills && Array.isArray(saved.drops) && Array.isArray(saved.allies));
    },

    continueRun() {
      if (!this.canContinue()) return false;
      const saved = clone(this.profile.checkpoint);
      this.start(saved.mode, saved.shipId);
      for (const key of checkpointKeys) if (key !== 'level' && key !== 'xp' && Object.hasOwn(saved, key)) this.run[key] = saved[key];
      if (!Object.hasOwn(saved, 'asteroidDelay')) this.run.asteroidDelay = null;
      Object.assign(this.run.player, saved.player);
      this.run.player.hp = Math.min(this.run.player.hp, this.maxHull());
      this.run.enemies = saved.allies;
      this.run.energy = clamp(this.run.energy, 0, this.run.energyCap);
      this.run.tendrils = (saved.anchors ?? []).map(anchor => ({ ...anchor, captures: new Map() }));
      if (this.run.loadout.ability3 && !this.run.loadout.ability1) this.run.loadout.ability1 = this.run.loadout.ability3;
      else if (this.run.loadout.ability3 && !this.run.loadout.ability2) this.run.loadout.ability2 = this.run.loadout.ability3;
      delete this.run.loadout.ability3;
      if (!this.upgradeEffects().vertical) this.run.player.y = HEIGHT - 58;
      this.beginWave(saved.wave + 1);
      return true;
    },

    newRun() {
      this.abandonSavedRun();
      this.start();
      this.save();
    },

    shipCount(id) {
      return this.profile.unlocked.includes(id) ? (this.profile.copies[id] ?? 1) : 0;
    },

    recipe(grid) {
      if (!this.canVisitBase() || !Array.isArray(grid) || grid.length !== 9) return '';
      const donor = grid[4];
      const items = this.profile.materials;
      if (items.alienCell >= 9 && RECIPES.mind.pattern.every((id, index) => grid[index] === id)) return 'mind';
      if (items.alienMind > 0 && items.alienCell >= 8 && RECIPES.serum.pattern.every((id, index) => grid[index] === id)) return 'serum';
      if (this.controlRecipeShip(grid)) return 'control';
      if (this.shipCount(donor) && !SHIPS[donor].alien && items.alienMind > 0 && items.alienSerum > 0 && items.alienCell >= 6 &&
          RECIPES.ship.pattern.every((id, index) => grid[index] === (id === 'donor' ? donor : id))) return 'ship';
      if (!AG.contentActive()) return '';
      const placed = Array.from(grid, id => id || '');
      const selected = placed.filter(Boolean);
      const needed = {};
      for (const id of selected) needed[id] = (needed[id] ?? 0) + 1;
      if (Object.entries(needed).some(([id, count]) => this.itemCount(id) < count)) return '';
      for (const [key, spec] of Object.entries(RECIPES)) {
        if (!spec.output || (spec.available && !spec.available(this))) continue;
        if (spec.pattern) {
          const matches = pattern => pattern.every((id, index) => id === placed[index]);
          if (matches(spec.pattern) || (spec.shift && matches(['', '', '', ...spec.pattern.slice(0, 6)]))) return key;
        } else if (selected.length === spec.ingredients.length && spec.ingredients.every(id => needed[id] === 1)) return key;
      }
      return '';
    },

    controlRecipeShip(grid) {
      const chosen = grid.filter(Boolean);
      const shipId = chosen.find(id => SHIPS[id]?.alien);
      if (chosen.length !== 3 || !shipId || !this.shipCount(shipId) || SHIPS[shipId].mindControl ||
          !chosen.includes('alienSerum') || !chosen.includes('alienMind') ||
          !(this.profile.materials.alienSerum > 0) || !(this.profile.materials.alienMind > 0)) return '';
      return shipId;
    },

    addAlien(donor) {
      if (!donor || donor.alien) return '';
      let nextId = 1;
      while (this.profile.alienShips['alien-' + nextId]) nextId++;
      const id = 'alien-' + nextId;
      this.profile.alienShips[id] = createAlien(donor);
      syncShips(this.profile);
      return id;
    },

    craft(grid) {
      const recipe = this.recipe(grid);
      if (!recipe) return '';
      const profile = this.profile;
      const donor = grid[4];
      const output = RECIPES[recipe].output;
      if (output) {
        if (!Number.isSafeInteger(this.itemCount(output) + 1)) return '';
        for (const part of grid.filter(Boolean)) this.itemStock(part)[part]--;
        for (const [id, mounts] of Object.entries(profile.loadouts)) {
          profile.loadouts[id] = AG.fitLoadout(SHIPS[id], mounts, profile.upgrades);
        }
        this.grantItem(output);
        return output;
      }
      if (recipe === 'mind' || recipe === 'serum') {
        const id = recipe === 'mind' ? 'alienMind' : 'alienSerum';
        if (!Number.isSafeInteger(this.itemCount(id) + 1)) return '';
        profile.materials.alienCell -= recipe === 'mind' ? 9 : 8;
        if (recipe === 'serum') profile.materials.alienMind--;
        this.grantItem(id);
        return id;
      }
      if (recipe === 'control') {
        const id = this.controlRecipeShip(grid);
        profile.materials.alienSerum--;
        profile.materials.alienMind--;
        profile.alienShips[id].mindControl = true;
        profile.serumUsed = true;
        this.save();
        return id;
      }
      const id = this.addAlien(SHIPS[donor]);
      profile.materials.alienMind--;
      profile.materials.alienSerum--;
      profile.materials.alienCell -= 6;
      const copies = this.shipCount(donor);
      if (copies > 1) {
        profile.copies[donor] = copies - 1;
      } else {
        profile.unlocked = profile.unlocked.filter(ship => ship !== donor);
        delete profile.alienShips[donor];
        delete profile.loadouts[donor];
        delete profile.copies[donor];
        if (profile.checkpoint?.shipId === donor) profile.checkpoint = null;
        if (profile.ship === donor) profile.ship = id;
        syncShips(profile);
      }
      this.grantItem(id);
      return id;
    },

    flagshipPrice(id) {
      return SHIPS[id]?.gemPrice * 2 ** this.profile.flagshipPurchases;
    },
    flagshipWait() {
      return this.premiumWait(this.profile.flagshipTime, this.profile.flagshipPurchases);
    },

    grantEverything() {
      if (!this.testing) return false;
      for (const id of Object.keys(BASE_SHIPS).filter(AG.itemAvailable)) if (!this.shipCount(id)) this.grantItem(id);
      for (const [id, ship] of Object.entries(BASE_SHIPS)) {
        if (!AG.itemAvailable(id)) continue;
        if (!Object.values(this.profile.alienShips).some(alien => alien.donor === ship.name)) {
          this.grantItem(this.addAlien(ship));
        }
      }
      for (const [bucket, specs] of [['materials', MATERIALS], ['upgrades', AG.UPGRADES], ['boosts', BOOSTS], ['crates', AG.CRATES]]) {
        for (const id of Object.keys(specs).filter(AG.itemAvailable)) this.profile[bucket][id] = Math.max(999, this.profile[bucket][id] ?? 0);
      }
      this.profile.credits = Math.max(this.profile.credits, 1000000);
      this.profile.gems = Math.max(this.profile.gems, 1000000);
      return true;
    },

    setBinding(action, key) {
      const { bindings } = this.profile;
      if (!Object.hasOwn(bindings, action) || !/^[a-z]$/.test(key) || 'wasdpi'.includes(key) ||
          Object.entries(bindings).some(([name, value]) => name !== action && value === key)) return false;
      bindings[action] = key;
      this.save();
      return true;
    },

    alienHit(enemy, source, damage) {
      if (!this.run.practice && eventActive(this.now()) && BOSSES[enemy.type] && damage > 0 &&
          source !== 'ally' && this.random() < .009) this.dropItem('alienCell', enemy.x, enemy.y);
    },

    rewardAlien(enemy) {
      const run = this.run;
      const boss = BOSSES[enemy.type];
      const { x, y } = enemy;
      if (boss) {
        run.stats.bossKills[enemy.type] = (run.stats.bossKills[enemy.type] ?? 0) + 1;
        if (!this.profile.bounties.includes(enemy.type)) {
          this.profile.bounties.push(enemy.type);
          const amount = boss.tier + 2;
          run.stats.gems += amount;
          this.grantItem('gem', amount);
          this.notify('upgrade', boss.name + ' first defeat · +' + amount + ' Star Gems');
        }
      }
      if (eventActive(this.now())) {
        if (this.random() < (boss ? .06 : .0015)) this.dropItem('alienCell', x, y);
        if (!boss) return;
        if (this.random() < .01) this.dropItem('alienMind', x - 20, y);
        if (run.wave === 50 && enemy.type === 'nexus' && !this.profile.serumUsed && this.random() < .005) {
          this.dropItem('alienSerum', x + 20, y);
        }
      } else if (boss) {
        this.dropItem('alienCell', x, y, 6);
        if (enemy.type === mainBoss(run.wave) && this.random() < .5) this.dropItem('alienMind', x - 20, y);
        if (enemy.type === 'nexus') this.dropItem('alienSerum', x + 20, y);
      }
    },

    extendTendril() {
      const run = this.run;
      if (this.state !== 'playing' || !run?.ship.alien || run.energy + 1e-8 < 30 || run.enemies.some(enemy => enemy.allied)) return false;
      const { player, tendrils } = run;
      run.energy = Math.max(0, run.energy - 30);
      tendrils.push({ anchorX: player.x <= WIDTH / 2 ? 0 : WIDTH, anchorY: player.y, captures: new Map() });
      return true;
    },

    canEnergyOverdrive() {
      return !!this.run && this.run.energy <= this.run.energyCap + 1e-8 &&
        !this.run.ship.alien && !this.hasSingularityBarrage() && !this.upgradeEffects().laser;
    },

    hasEnergyOverdriveBoost() {
      const run = this.run;
      return run.energyOverdrive && this.canEnergyOverdrive() && (!AG.balanceActive() || run.energy > run.energyCap / 4 + 1e-8);
    },

    overdriveStacks() {
      return this.boostCount('overdrive') + Number(this.hasEnergyOverdriveBoost());
    },

    gainEnergy(amount, ceiling = this.run.energyCap) {
      const run = this.run;
      if (run.energyOverdrive || run.energy > run.energyCap) return;
      if (run.energy < ceiling) run.energy = Math.min(ceiling, run.energy + amount);
      this.tryEnergyOverdrive();
    },

    tryEnergyOverdrive() {
      const run = this.run;
      if (!this.canEnergyOverdrive() || run.energyOverdrive || run.overdriveSuppressed ||
          run.energy + 1e-8 < run.energyCap) return false;
      run.energyOverdrive = true;
      run.overdriveTick = 0;
      this.notify('upgrade', 'Energy Overdrive active');
      return true;
    },

    toggleEnergyOverdrive() {
      if (!['playing', 'intermission'].includes(this.state) || !this.canEnergyOverdrive()) return false;
      const run = this.run;
      if (run.energyOverdrive) {
        run.energyOverdrive = false;
        run.overdriveTick = 0;
        run.overdriveSuppressed = run.energy >= run.energyCap;
        return true;
      }
      run.overdriveSuppressed = false;
      return this.tryEnergyOverdrive();
    },

    updateEnergy(dt) {
      const run = this.run;
      if (!this.canEnergyOverdrive()) run.energyOverdrive = false;
      if (run.energyOverdrive && AG.balanceActive()) {
        run.energy = Math.max(0, run.energy - 6 * dt);
        if (run.energy <= 1e-8) { run.energy = 0; run.energyOverdrive = false; run.overdriveTick = 0; }
      } else if (run.energyOverdrive) {
        run.overdriveTick += dt;
        const intervals = Math.floor((run.overdriveTick + 1e-9) / .25);
        if (intervals) {
          run.overdriveTick -= intervals * .25;
          run.energy = Math.max(0, run.energy - intervals * run.energyCap * .01);
          if (run.energy < 1e-8) {
            run.energy = 0;
            run.energyOverdrive = false;
            run.overdriveTick = 0;
          }
        }
      } else {
        if (run.energy < run.energyCap) run.overdriveSuppressed = false;
        if (run.tendrils.length) run.energy = Math.max(0, run.energy + (.5 - run.tendrils.length) * dt);
        else this.gainEnergy(.5 * dt, Math.min(100, run.energyCap));
      }
      if (run.energy <= 1e-8 && run.tendrils.length) while (this.retractTendril()) {}
      if (run.ship.mindControl && run.mindCooldown > 0) {
        run.mindCooldown = Math.max(0, run.mindCooldown - dt);
        if (run.mindCooldown === 0) this.notify('upgrade', 'Mind control ready · select an enemy');
      }
    },

    releaseCapture(tendril, enemy) {
      const capture = tendril.captures.get(enemy);
      enemy.grips = Math.max(0, (enemy.grips ?? 1) - 1);
      this.repair(capture.drained / 3, false);
      tendril.captures.delete(enemy);
    },

    retractTendril() {
      const tendril = this.run?.tendrils.pop();
      if (!tendril) return false;
      for (const enemy of tendril.captures.keys()) this.releaseCapture(tendril, enemy);
      return true;
    },

    updateAlien(dt) {
      const run = this.run;
      if (!run.tendrils.length) return;
      const live = new Set(run.enemies);
      const intersections = new Map();
      for (const tendril of run.tendrils) {
        for (const [enemy, capture] of tendril.captures) {
          if (!live.has(enemy) || enemy.allied) {
            this.releaseCapture(tendril, enemy);
            continue;
          }
          capture.time += dt;
          if (capture.ticks < 8 && capture.time + 1e-8 >= (capture.ticks + 1) * .5) {
            capture.ticks++;
            if (capture.ticks === 4) this.gainEnergy(1);
            capture.drained += Math.min(enemy.hp, 1);
            this.hitEnemy(run.enemies.indexOf(enemy), 1, 'tendril');
            if (enemy.hp <= 0) live.delete(enemy);
          }
          if (capture.ticks === 8 || enemy.hp <= 0) {
            (enemy.freed ??= new WeakSet()).add(tendril);
            this.releaseCapture(tendril, enemy);
          }
        }
        const { anchorX, anchorY } = tendril;
        const key = anchorX + ':' + anchorY;
        let candidates = intersections.get(key);
        if (!candidates) {
          candidates = [];
          intersections.set(key, candidates);
          const dx = run.player.x - anchorX;
          const dy = run.player.y - anchorY;
          const lengthSquared = dx * dx + dy * dy;
          const minX = Math.min(anchorX, run.player.x);
          const maxX = Math.max(anchorX, run.player.x);
          const minY = Math.min(anchorY, run.player.y);
          const maxY = Math.max(anchorY, run.player.y);
          for (const enemy of run.enemies) {
            const radius = enemy.size + 9;
            if (enemy.allied || enemy.y < 0 || enemy.x < minX - radius || enemy.x > maxX + radius ||
                enemy.y < minY - radius || enemy.y > maxY + radius) continue;
            const x = enemy.x - anchorX;
            const y = enemy.y - anchorY;
            const t = lengthSquared ? clamp((x * dx + y * dy) / lengthSquared, 0, 1) : 0;
            if ((x - dx * t) ** 2 + (y - dy * t) ** 2 <= radius ** 2) candidates.push(enemy);
          }
        }
        for (const enemy of candidates) {
          if (!live.has(enemy) || tendril.captures.has(enemy) || enemy.freed?.has(tendril)) continue;
          enemy.grips = (enemy.grips ?? 0) + 1;
          tendril.captures.set(enemy, { time: 0, ticks: 0, drained: 0 });
        }
      }
    },

    mindControl(point) {
      const run = this.run;
      if (this.state !== 'playing' || !run?.ship.mindControl || run.mindCooldown > 0) return false;
      const enemy = run.enemies.find(target => !target.allied && target.y >= 0 &&
        Math.hypot(target.x - point.x, target.y - point.y) <= target.size + 8);
      if (!enemy) return false;
      if (enemy.type === mainBoss(run.wave) && enemy.bornWave === run.wave && !enemy.escort) {
        this.notify('upgrade', 'The lead boss resists mind control');
        return true;
      }
      while (this.retractTendril()) {}
      enemy.joinedAtY = enemy.y;
      enemy.controlOrder = ++run.controlSequence;
      enemy.allied = true;
      enemy.alliedFor = BOSSES[enemy.type] ? 8 : null;
      if (enemy.bornWave === run.wave) run.resolved++;
      run.mindCooldown = 30;
      this.notify('upgrade', 'Mind control active');
      return true;
    },

    releaseControlledEnemy(enemy) {
      enemy.allied = false;
      enemy.x = enemy.origin;
      enemy.y = enemy.joinedAtY ?? enemy.y;
      if (enemy.bornWave === this.run.wave) this.run.resolved--;
    },

    releaseMindControl() {
      if (!['playing', 'intermission'].includes(this.state)) return false;
      const enemy = this.run.enemies.filter(entry => entry.allied)
        .reduce((latest, entry) => (entry.controlOrder ?? 0) >= (latest?.controlOrder ?? 0) ? entry : latest, null);
      if (!enemy) return false;
      this.releaseControlledEnemy(enemy);
      return true;
    },

    actAsAlly(enemy, dt, followingOnly = false) {
      const run = this.run;
      if (!followingOnly && enemy.alliedFor !== null) {
        enemy.alliedFor -= dt;
        if (enemy.alliedFor <= 0) {
          this.releaseControlledEnemy(enemy);
          return;
        }
      }

      const allies = run.enemies.filter(entry => entry.allied);
      const index = allies.indexOf(enemy);
      const offset = (index % 2 === 0 ? -1 : 1) * (52 + 27 * Math.floor(index / 2));
      const targetX = clamp(run.player.x + offset, enemy.size, WIDTH - enemy.size);
      const targetY = clamp(run.player.y - 40, 85, HEIGHT - enemy.size);
      const step = Math.min(1, dt * 5);
      enemy.x += (targetX - enemy.x) * step;
      enemy.y += (targetY - enemy.y) * step;

      if (followingOnly) return;
      const boss = BOSSES[enemy.type];
      if (!boss && !['shooter', 'tank'].includes(enemy.type)) return;
      enemy.fireIn -= dt;
      if (enemy.fireIn > 0) return;
      let target;
      let nearest = Infinity;
      for (const candidate of run.enemies) {
        if (candidate.allied || candidate.y < 0) continue;
        const distance = Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y);
        if (distance >= nearest) continue;
        nearest = distance;
        target = candidate;
      }
      if (!target) return;
      const speed = 425;
      const lead = Math.min(.65, nearest / speed) * .7;
      const aim = Math.atan2(target.y + (BOSSES[target.type] ? 0 : target.speed * lead) - enemy.y, target.x - enemy.x);
      const count = boss?.shots ?? 1;
      for (let shot = 0; shot < count; shot++) {
        const angle = aim + (shot - (count - 1) / 2) * (boss?.spread ?? 0) * .65;
        run.allyShots.push({ x: enemy.x, y: enemy.y, size: 5, vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed, damage: this.shotDamage(false), color: run.ship.color });
      }
      enemy.fireIn = boss?.cadence ?? 1.35;
    },

    fillPractice(kind) {
      const run = this.run;
      Object.assign(run, { practice: kind, enemies: [], shots: [], missiles: [], hostile: [], allyShots: [],
        pending: [], energy: run.energyCap, spawned: 0, resolved: 0 });
      run.player.hp = run.ship.hull;
      const types = kind === 'cluster' ? ['grunt', 'grunt', 'shooter', 'grunt', 'grunt'] : [kind === 'moving' ? 'diver' : 'boss'];
      run.total = types.length;
      types.forEach((type, i) => {
        this.spawn(type);
        const enemy = run.enemies.at(-1);
        enemy.x = enemy.origin = WIDTH / 2 + (i - (types.length - 1) / 2) * 56;
        enemy.y = 245 + i % 2 * 20;
        enemy.hp = enemy.maxHp = kind === 'boss' ? 220 : kind === 'moving' ? 30 : 8;
      });
    },

    startPractice(kind) {
      this.start('hard');
      this.fillPractice(kind);
    }
  });

  Object.assign(AG, { createAlien, MODES, EVENT_END, MATERIALS, BASE_SHIPS, RECIPES, eventActive, mainBoss, crateRoll, crateTotals, bundleTotals, syncShips });
})();
