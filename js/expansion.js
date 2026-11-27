(() => {
  'use strict';
  const AG = window.AG;
  const { Game, SHIPS, BOSSES, BOOSTS, ITEMS, WIDTH, HEIGHT, MAX_WAVE, clamp } = AG;
  const MODES = { easy: 20, medium: 30, hard: 50, endless: MAX_WAVE };
  const EVENT_END = Date.parse('2026-12-01T00:00:00+11:00');
  const MATERIALS = {
    alienCell: { name: 'Alien Cell', rarity: 'rare', description: 'Used in both Alien recipes.' },
    alienMind: { name: 'Alien Mind', rarity: 'legendary', description: 'Crafted with Alien Serum and eight Alien Cells. Place below the ship used in the recipe to craft an Alien Ship.' },
    alienSerum: { name: 'Alien Serum', rarity: 'godly', description: 'Use to craft an Alien Mind or apply to an equipped Alien Ship to unlock mind control permanently.' }
  };
  const RECIPES = {
    ship: { name: 'Alien Ship', pattern: ['alienCell', 'alienSerum', 'alienCell', 'alienCell', 'donor', 'alienCell', 'alienCell', 'alienMind', 'alienCell'] },
    mind: { name: 'Alien Mind', pattern: ['alienCell', 'alienCell', 'alienCell', 'alienCell', 'alienSerum', 'alienCell', 'alienCell', 'alienCell', 'alienCell'] }
  };
  const BASE_SHIPS = { ...SHIPS };
  Object.assign(ITEMS, MATERIALS);
  for (const [id, icon] of Object.entries({
  "shipCrate": "Items/Chest/Chest 1/Chest Large 1 256.png",
  "upgradeCrate": "Items/Crate/Crate Gold 256.png",
  "shield": "Weapons/Shield/Shield 256.png",
  "fortress": "Weapons/Shield/Shield Gold 256.png",
  "heal": "Tools/Potion 1/Potion 1 256.png",
  "nanites": "Tools/Potion 1/Potion 1 Pink 256.png",
  "overdrive": "General/Lightning Bolt/Lightning Bolt Yellow 256.png",
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
  "boostRelay": "Clothing/Backpack/Backpack Blue 256.png",
  "alienCell": "Nature/DNA/DNA 256.png",
  "alienMind": "Player/Brain/Brain 256.png",
  "alienSerum": "Tools/Potion 3/Potion 3 Pink 256.png"
})) {
    ITEMS[id].icon = 'new-icons/vector-icon-pack/' + icon;
    ITEMS[id].glyph ??= '◆';
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  const checkpointKeys = ['level', 'xp', 'score', 'energy', 'targetMode', 'boosts', 'aegisCooldown', 'aegisShield', 'mindCooldown', 'stats', 'drops', 'boostRelayOn', 'cleared', 'loadout', 'energyOverdrive', 'overdriveTick', 'overdriveSuppressed'];
  const eventActive = (time = Date.now()) => time < EVENT_END;
  const mainBoss = wave => wave >= 10 && wave % 10 === 0 ? Object.keys(BOSSES)[Math.min(wave / 10 - 1, 4)] : null;

  function crateRoll(crate, random = Math.random) {
    let value = random() * 100;
    const tier = crate.outcomes.find(entry => (value -= entry.weight) < 0) ?? crate.outcomes.at(-1);
    return { id: tier.items[Math.floor(random() * tier.items.length)], rarity: tier.rarity };
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
    const name = 'Alien ' + (donor.alien ? donor.name.slice(6) : donor.name);
    const hull = Number((donor.hull * 1.1).toFixed(2));
    const damage = Number((donor.damage * 1.1).toFixed(3));
    return { name, hull, damage, speed: donor.speed * 1.1, delay: donor.delay / 1.1,
      energyCapacity: AG.energyCapacity(donor), engines: donor.engines, frame: donor.frame, color: '#8ae86c', rarity: 'mythical', alien: true,
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
        saved.wave > 0 && saved.wave < MODES[saved.mode] && this.profile.unlocked.includes(saved.shipId) &&
        saved.player?.hp > 0 && saved.stats?.bossKills && Array.isArray(saved.drops) && Array.isArray(saved.allies));
    },

    continueRun() {
      if (!this.canContinue()) return false;
      const saved = clone(this.profile.checkpoint);
      this.start(saved.mode, saved.shipId);
      for (const key of checkpointKeys) if (Object.hasOwn(saved, key)) this.run[key] = saved[key];
      Object.assign(this.run.player, saved.player);
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
      this.profile.checkpoint = null;
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
      if (items.alienSerum > 0 && items.alienCell >= 8 && RECIPES.mind.pattern.every((id, index) => grid[index] === id)) return 'mind';
      if (this.shipCount(donor) && items.alienMind > 0 && items.alienSerum > 0 && items.alienCell >= 6 &&
          RECIPES.ship.pattern.every((id, index) => grid[index] === (id === 'donor' ? donor : id))) return 'ship';
      return '';
    },

    addAlien(donor) {
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
      if (recipe === 'mind') {
        profile.materials[donor]--;
        profile.materials.alienCell -= 8;
        this.grantItem('alienMind');
        return 'alienMind';
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

    applySerum() {
      const profile = this.profile;
      if (!this.canVisitBase() || !SHIPS[profile.ship].alien || !profile.materials.alienSerum || profile.serumUsed) return false;
      profile.materials.alienSerum--;
      profile.serumUsed = true;
      this.save();
      return true;
    },

    flagshipPrice(id) { return SHIPS[id]?.gemPrice * 2 ** this.profile.flagshipPurchases; },
    flagshipWait() { return Math.max(0, this.profile.flagshipTime + 3600000 - this.now()); },

    grantEverything() {
      if (!this.testing) return false;
      for (const id of Object.keys(BASE_SHIPS)) if (!this.shipCount(id)) this.grantItem(id);
      for (const ship of Object.values(BASE_SHIPS)) {
        if (!Object.values(this.profile.alienShips).some(alien => alien.donor === ship.name)) {
          this.grantItem(this.addAlien(ship));
        }
      }
      for (const [bucket, specs] of [['materials', MATERIALS], ['upgrades', AG.UPGRADES], ['boosts', BOOSTS], ['crates', AG.CRATES]]) {
        for (const id of Object.keys(specs)) this.profile[bucket][id] = Math.max(999, this.profile[bucket][id] ?? 0);
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
          source !== 'ally' && this.random() < .003) this.dropItem('alienCell', enemy.x, enemy.y);
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
        if (this.random() < (boss ? .02 : .0005)) this.dropItem('alienCell', x, y);
        if (!boss) return;
        if (this.random() < .02) this.dropItem('alienMind', x - 20, y);
        if (run.wave === 50 && enemy.type === 'nexus' && !this.profile.serumUsed && this.random() < .005) {
          this.dropItem('alienSerum', x + 20, y);
        }
      } else if (boss) {
        this.dropItem('alienCell', x, y, 2);
        if (enemy.type === mainBoss(run.wave)) this.dropItem('alienMind', x - 20, y);
        if (enemy.type === 'nexus') this.dropItem('alienSerum', x + 20, y);
      }
    },

    extendTendril() {
      const run = this.run;
      if (this.state !== 'playing' || !run?.ship.alien || run.energy + 1e-8 < 30) return false;
      const { player, tendrils } = run;
      run.energy = Math.max(0, run.energy - 30);
      tendrils.push({ anchorX: player.x <= WIDTH / 2 ? 0 : WIDTH, anchorY: player.y, captures: new Map() });
      return true;
    },

    canEnergyOverdrive() {
      return !!this.run && !this.run.ship.alien && !this.upgradeEffects().laser;
    },

    overdriveStacks() {
      return this.boostCount('overdrive') + Number(this.run.energyOverdrive && this.canEnergyOverdrive());
    },

    gainEnergy(amount) {
      const run = this.run;
      if (run.energyOverdrive) return;
      run.energy = Math.min(run.energyCap, run.energy + amount);
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
      if (run.energyOverdrive) {
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
        else this.gainEnergy(.5 * dt);
      }
      if (run.energy <= 1e-8 && run.tendrils.length) while (this.retractTendril()) {}
      if (run.ship.alien && this.profile.serumUsed && run.mindCooldown > 0) {
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
      for (const tendril of run.tendrils) {
        for (const [enemy, capture] of tendril.captures) {
          const index = run.enemies.indexOf(enemy);
          if (index < 0 || enemy.allied) {
            this.releaseCapture(tendril, enemy);
            continue;
          }
          capture.time += dt;
          if (capture.ticks < 8 && capture.time + 1e-8 >= (capture.ticks + 1) * .5) {
            capture.ticks++;
            if (capture.ticks === 4) this.gainEnergy(1);
            capture.drained += Math.min(enemy.hp, 1);
            this.hitEnemy(index, 1, 'tendril');
          }
          if (capture.ticks === 8 || enemy.hp <= 0) {
            (enemy.freed ??= new WeakSet()).add(tendril);
            this.releaseCapture(tendril, enemy);
          }
        }
        const { anchorX, anchorY } = tendril;
        const dx = run.player.x - anchorX;
        const dy = run.player.y - anchorY;
        const lengthSquared = dx * dx + dy * dy;
        for (const enemy of run.enemies) {
          if (enemy.allied || enemy.y < 0 || tendril.captures.has(enemy) || enemy.freed?.has(tendril)) continue;
          const t = clamp(((enemy.x - anchorX) * dx + (enemy.y - anchorY) * dy) / lengthSquared, 0, 1);
          if (Math.hypot(enemy.x - anchorX - dx * t, enemy.y - anchorY - dy * t) > enemy.size + 9) continue;
          enemy.grips = (enemy.grips ?? 0) + 1;
          tendril.captures.set(enemy, { time: 0, ticks: 0, drained: 0 });
        }
      }
    },

    mindControl(point) {
      const run = this.run;
      if (this.state !== 'playing' || !run?.ship.alien || !this.profile.serumUsed || run.mindCooldown > 0) return false;
      const enemy = run.enemies.find(target => !target.allied && target.y >= 0 &&
        Math.hypot(target.x - point.x, target.y - point.y) <= target.size + 8);
      if (!enemy) return false;
      if (enemy.type === mainBoss(run.wave) && enemy.bornWave === run.wave && !enemy.escort) {
        this.notify('upgrade', 'The lead boss resists mind control');
        return true;
      }
      enemy.joinedAtY = enemy.y;
      enemy.allied = true;
      enemy.alliedFor = BOSSES[enemy.type] ? 8 : null;
      if (enemy.bornWave === run.wave) run.resolved++;
      run.mindCooldown = 30;
      this.notify('upgrade', 'Mind control active');
      return true;
    },

    actAsAlly(enemy, dt) {
      const run = this.run;
      if (enemy.alliedFor !== null) {
        enemy.alliedFor -= dt;
        if (enemy.alliedFor <= 0) {
          enemy.allied = false;
          enemy.x = enemy.origin;
          enemy.y = enemy.joinedAtY ?? enemy.y;
          if (enemy.bornWave === run.wave) run.resolved--;
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
          vy: Math.sin(angle) * speed, damage: run.ship.donorDamage, color: AG.ENEMIES[enemy.type].color });
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

  Object.assign(AG, { MODES, EVENT_END, MATERIALS, BASE_SHIPS, RECIPES, eventActive, mainBoss, crateRoll, syncShips });
})();
