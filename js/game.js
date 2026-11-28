(() => {
  'use strict';

  const AG = window.AG;
  const { WIDTH, HEIGHT, LAST_WAVE, MAX_WAVE, BOSSES, CRATES, SLOTS, SUPPLY_LEVEL, AUTO_SKIP_AT, SHIPS, BOOSTS, UPGRADES,
    ENEMIES, SUPPLIES, clamp, difficultyFor, xpForLevel } = AG;
  const MOVE = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
    arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
  const FLIGHT_LANE = HEIGHT - 58;
  const touches = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.size + b.size) ** 2;

  class Game {
    constructor(storage, notify = () => {}, random = Math.random) {
      this.storage = storage;
      this.notify = notify;
      this.random = random;
      this.profile = AG.readProfile(storage);
      AG.syncShips(this.profile);
      this.keys = new Set();
      this.pointer = null;
      this.state = 'home';
      this.run = null;
      this.testing = false;
      this.liveSession = null;
      this.testProfile = null;
      this.testSpeed = 1;
      this.testTimeOffset = 0;
    }

    now() { return Date.now() + (this.testing ? this.testTimeOffset : 0); }

    advanceTestClock(milliseconds) {
      if (!this.testing || !Number.isSafeInteger(milliseconds) || Math.abs(milliseconds) > 365 * 86400000) return false;
      this.testTimeOffset += milliseconds;
      return true;
    }

    setTestEnergy(value) {
      if (!this.testing || !this.run || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) return false;
      this.run.energy = value;
      this.run.energyOverdrive = false;
      this.run.overdriveTick = 0;
      this.run.overdriveSuppressed = value >= this.run.energyCap;
      return true;
    }

    get simulationSpeed() { return this.testing ? this.testSpeed : 1; }

    setTestSpeed(speed) {
      if (!this.testing || !Number.isFinite(speed) || speed < .25 || speed > 1000) return false;
      this.testSpeed = speed;
      return true;
    }

    get credits() { return this.profile.credits; }
    get waveLimit() { return this.testing && this.run?.unlimitedTest ? MAX_WAVE : AG.MODES[this.run?.mode ?? this.profile.mode] ?? LAST_WAVE; }
    get waveLabel() {
      const wave = this.run.wave;
      const limit = this.run.mode === 'endless' ? '∞' : this.waveLimit;
      return wave.toLocaleString() + ' / ' + limit.toLocaleString();
    }

    save() {
      if (this.testing || this.run?.practice) return;
      if (this.state === 'intermission') this.checkpoint();
      try { this.storage.setItem('alien-shooter.profile.v1', JSON.stringify(this.profile)); } catch {}
    }

    enterTesting() {
      if (this.testing) return;
      this.liveSession = {
        profile: this.profile, run: this.run, state: this.state, resumeState: this.resumeState
      };
      this.profile = this.testProfile ?? JSON.parse(JSON.stringify(this.profile));
      AG.syncShips(this.profile);
      this.testing = true;
      this.run = null;
      this.state = 'home';
    }

    leaveTesting() {
      if (!this.testing) return;
      const { profile, run, state, resumeState } = this.liveSession;
      this.testProfile = this.profile;
      this.profile = profile;
      AG.syncShips(profile);
      this.run = run;
      this.state = state;
      this.resumeState = resumeState;
      this.liveSession = null;
      this.testing = false;
      this.releaseInput();
    }

    clearTestingData() {
      if (!this.testing) return false;
      this.profile = AG.readProfile(null);
      AG.syncShips(this.profile);
      this.testProfile = this.profile;
      this.testSpeed = 1;
      this.testTimeOffset = 0;
      this.run = null;
      this.state = 'home';
      this.releaseInput();
      return true;
    }

    releaseInput() {
      this.keys.clear();
      this.pointer = null;
      this.laserInput('off');
    }

    start(mode = this.profile.mode, shipId = this.profile.ship) {
      const ship = SHIPS[shipId];
      this.releaseInput();
      this.run = {
        wave: 0, level: this.profile.bestPilotLevel, xp: this.profile.pilotXp, score: 0, cleared: 0, activeSeconds: 0, loadout: { ...this.profile.loadouts[shipId] }, boosts: {}, boostCycleOn: false, boostCycleDelay: 0, ship, shipId, mode, mindCooldown: 30, controlSequence: 0, tendrils: [],
        stats: { bossKills: {}, gems: 0, rarest: null, lastHit: '' }, allyShots: [], aegisCooldown: AG.contentActive() ? (ship.ability?.interval ?? 0) : 0, aegisShield: 0, smoke: [], smokeIn: 0, enemySmoke: [], smokeDamageIn: .5, asteroids: [], asteroidField: null, slimeShots: [], slimeIn: 0,
        player: { x: WIDTH / 2, y: FLIGHT_LANE, size: 13, hp: ship.hull, invulnerable: 0, fireIn: 0.15 },
        enemies: [], shots: [], hostile: [], drops: [],
        missiles: [], missileIn: 0, barrage: null, targetMode: 'nearest', energy: 0, energyCap: AG.energyCapacity(ship), energyOverdrive: false, overdriveTick: 0, overdriveSuppressed: false,
        laser: { held: false, toggled: false, tick: 0, aim: null }
      };
      this.run.asteroidDelay = AG.contentActive() && this.random() < .01 ? 6 : null;
      this.beginWave(1);
    }

    beginWave(number, carryShots = false) {
      const run = this.run;
      number = clamp(Math.trunc(number) || 1, 1, this.waveLimit);
      const diff = difficultyFor(number);
      run.wave = number;
      run.diff = diff;
      run.pending = AG.bossLineup(number);
      const lead = AG.mainBoss(number);
      if (lead) run.pending.unshift(...run.pending.splice(run.pending.indexOf(lead), 1));
      const pool = Object.keys(ENEMIES).filter(type => type !== 'smokeNinja' && !BOSSES[type] && ENEMIES[type].unlock <= number);
      const count = diff.boss ? Math.ceil(diff.count * 0.42) : diff.count;
      for (let index = 0; index < count; index++) {
        run.pending.push(pool[Math.floor(this.random() * pool.length)]);
      }
      if (number >= 30 && !run.practice && this.random() < (AG.balanceActive() ? .05 : run.mode === 'endless' ? .03 : .1)) {
        run.pending.splice(lead ? 1 : 0, 0, 'smokeNinja');
      }
      run.total = run.pending.length;
      run.spawned = 0;
      run.resolved = 0;
      run.spawnIn = carryShots ? 0.25 : 0.55;
      if (!carryShots) {
        run.shots = [];
        run.missiles = [];
        run.hostile = [];
        this.laserInput('off');
      }
      this.state = 'playing';
      this.notify('wave', diff.boss ? (BOSSES[lead].name + ' incoming') : 'Wave ' + number.toLocaleString());
    }

    canSkip() {
      const run = this.run;
      return this.state === 'playing' && !run.practice && !run.diff.boss && run.wave < this.waveLimit && run.pending.length > 0;
    }

    skip() {
      if (!this.canSkip()) return false;
      const { wave, spawned, resolved, total } = this.run;
      this.beginWave(wave + 1, true);
      this.notify('skip', { wave, spawned, resolved, total });
      return true;
    }

    finishWave() {
      const run = this.run;
      const credits = 18 + Math.min(500, run.wave * 2);
      this.profile.credits += credits;
      const before = run.player.hp;
      this.gainXp(12);
      this.repair(8, false);
      const repaired = run.player.hp - before;
      this.notify('reward', '+' + credits + ' credits' + (repaired ? ' · +' + repaired + ' hull' : ''));
      this.laserInput('off');
      run.breakTime = run.wave >= this.waveLimit ? 7 : 4.8;
      run.hostile = [];
      this.state = 'intermission';
      run.allyShots = [];
      for (const tendril of run.tendrils) for (const enemy of tendril.captures.keys()) this.releaseCapture(tendril, enemy);
      run.cleared++;
      if (AG.balanceActive()) {
        if (run.wave % 10 === 0) this.awardWaveMilestone(run.wave);
      } else {
        this.awardMilestone();
        this.awardEndlessWave();
        if (run.cleared % 5 === 0 || (run.mode === 'endless' && run.wave % 10 === 0) || run.wave === this.waveLimit) this.rollBonusRewards();
      }
      this.save();
      this.notify('wave', 'Wave ' + run.wave + ' clear');
    }

    waveRewards(wave, scale = 1) {
      const base = Math.min(1000, wave / 50);
      const pack = { credit: 12000, gem: 36, upgradeCrate: 15, shipCrate: 10, boostBundle: 9, upgradeBundle: 6 };
      if (AG.eventActive(this.now())) pack.alienCell = 6;
      return Object.fromEntries(Object.entries(pack)
        .map(([id, amount]) => [id, Math.floor(amount * base * scale)])
        .filter(([, amount]) => amount > 0));
    }

    runFinishRewards(wave, mode, activeSeconds) {
      if (!Number.isFinite(activeSeconds) || activeSeconds < 10) return {};
      const packs = {
        easy: { credit: 1500, gem: 3, upgradeCrate: 1 },
        medium: { credit: 3000, gem: 6, upgradeCrate: 2 },
        hard: { credit: 6000, gem: 10, upgradeCrate: 2, shipCrate: 1 },
        endless: { credit: 6000, gem: 10, upgradeCrate: 2, shipCrate: 1 }
      };
      const progress = Math.min(mode === 'endless' ? 1000 : 1, wave / (mode === 'endless' ? 50 : AG.MODES[mode]));
      const timeFactor = Math.min(1, activeSeconds / Math.max(30, wave * 3));
      return Object.fromEntries(Object.entries(packs[mode] ?? packs.hard)
        .map(([id, count]) => [id, Math.floor(count * progress * timeFactor)])
        .filter(([, count]) => count > 0));
    }

    awardWaveMilestone(wave) {
      if (wave % 100 === 0) {
        // The wave-100 milestone pays 2.5 times the full Hard wave-50 run plus its five milestones.
        const hardTotal = this.waveRewards(50);
        for (let mark = 10; mark <= 50; mark += 10) {
          for (const [id, count] of Object.entries(this.waveRewards(mark, .5))) hardTotal[id] = (hardTotal[id] ?? 0) + count;
        }
        const scale = 2.5 * Math.min(100, wave / 100);
        this.queueRewards(Object.fromEntries(Object.entries(hardTotal).map(([id, count]) => [id, Math.round(count * scale)])), false);
        if (this.random() < .5) this.queueRewards({ enemyCrate: Math.max(1, Math.round(scale)) }, false);
        if (this.random() < .12) this.queueRewards({ beacon: 1 }, false);
      } else {
        const scale = this.run.mode === 'endless' ? Math.min(12, .5 + wave / 100) : .5;
        this.queueRewards(this.waveRewards(wave, scale), false);
        if (this.run.mode === 'endless' && this.random() < .1) this.queueRewards({ enemyCrate: 1 }, false);
      }
      this.notify('milestone', 'Wave ' + wave + ' milestone · Rewards earned');
    }

    awardMilestone() {
      const count = this.run.cleared;
      if (count % 5) return;
      const boosts = ['heal', 'rapidFire', 'shield', 'doubleDamage', 'nanites', 'overdrive'];
      const rewards = { [this.rewardPick(boosts)]: 3 };
      if (AG.contentActive()) rewards.boostBundle = 1;
      if (count % 10 === 0) {
        const tier = Math.min(5, count / 10);
        Object.assign(rewards, { credit: 500 * tier, gem: 3 * tier, upgradeCrate: tier,
          [this.rewardPick(['wings', 'carbon', 'fusion', 'rail', 'nova', 'booster', 'cannon', 'rocket'])]: Math.min(3, tier) });
        if (AG.contentActive()) rewards.upgradeBundle = 1;
        if (AG.eventActive(this.now())) rewards.alienCell = tier;
      }
      this.queueRewards(rewards);
      this.notify('milestone', count + ' waves cleared · Rewards earned');
    }

    rewardPick(pool) {
      return pool[Math.floor(this.random() * pool.length)] ?? pool[0];
    }

    queueRewards(rewards, reduce = true) {
      const pending = this.profile.pendingMilestones;
      for (const [id, amount] of Object.entries(rewards)) {
        const quantity = reduce ? Math.max(1, Math.round(amount * 2 / 3)) : amount;
        pending[id] = Math.min(Number.MAX_SAFE_INTEGER, (pending[id] ?? 0) + quantity);
      }
    }

    rollBonusRewards() {
      const active = AG.eventActive(this.now());
      if (this.random() < .10) this.queueRewards({ [this.rewardPick(active ? ['fortress', 'alienMind'] : ['fortress'])]: 1 }, false);
      if (this.random() < .03) this.queueRewards({ [this.rewardPick(active ? ['alienSerum', 'singularity'] : ['singularity'])]: 1 }, false);
    }

    awardModeClear() {
      const { mode } = this.run;
      if (mode === 'endless' || this.run.unlimitedTest) return;
      const tier = { easy: 1, medium: 2, hard: 3 }[mode];
      const upgrade = this.rewardPick(tier === 1 ? ['cannon', 'wings', 'rocket'] :
        ['rail', 'fusion', 'nova', 'carbon']);
      const boost = this.rewardPick(['nanites', 'overdrive', 'doubleDamage']);
      const rewards = { credit: 4000 * tier, gem: 12 * tier, upgradeCrate: 5 * tier,
        [boost]: 4 * tier, [upgrade]: 2 * tier, shipCrate: [2, 5, 10][tier - 1] };
      if (AG.contentActive()) { rewards.boostBundle = 3 * tier; rewards.upgradeBundle = 2 * tier; }
      if (AG.eventActive(this.now())) rewards.alienCell = tier * 2;
      this.queueRewards(rewards);
    }

    awardEndlessWave() {
      const wave = this.run.wave;
      if (this.run.mode !== 'endless' || wave % 10 !== 0) return;
      const scale = Math.min(1000, 3 ** ((wave - 50) / 50));
      const scaled = amount => Math.max(1, Math.round(amount * scale));
      const upgrade = this.rewardPick(wave >= 100 ? ['nova', 'carbon', 'fusion', 'rail'] : ['rail', 'fusion', 'carbon', 'rocket']);
      const boost = this.rewardPick(['nanites', 'overdrive', 'shield', 'doubleDamage']);
      if (!AG.contentActive()) {
        const previous = Math.floor(Math.sqrt(wave / 10));
        const rewards = { credit: wave * 100, gem: previous * 8, upgradeCrate: previous * 4, [boost]: previous * 3, [upgrade]: previous * 2 };
        if (wave % 50 === 0) rewards.shipCrate = previous * 3;
        if (AG.eventActive(this.now())) rewards.alienCell = previous;
        this.queueRewards(rewards);
        return;
      }
      const rewards = { credit: scaled(5000), gem: scaled(12), upgradeCrate: scaled(4),
        [boost]: scaled(3), [upgrade]: scaled(2), boostBundle: scaled(2), upgradeBundle: scaled(1) };
      if (wave % 50 === 0) rewards.shipCrate = scaled(3);
      if (AG.eventActive(this.now())) rewards.alienCell = scaled(1);
      this.queueRewards(rewards, false);
    }

    settleMilestones() {
      const earned = Object.entries(this.profile.pendingMilestones);
      const settled = [];
      this.profile.pendingMilestones = {};
      for (const [id, amount] of earned) {
        const room = Number.MAX_SAFE_INTEGER - this.itemCount(id);
        if (room < amount) this.profile.pendingMilestones[id] = amount - room;
        const payable = Math.min(amount, room);
        if (payable < 1) continue;
        this.addItem(id, payable);
        this.discoverItem(id);
        settled.push([id, payable]);
      }
      return settled;
    }

    abandonSavedRun() {
      if (AG.balanceActive() && this.canContinue()) this.queueRewards(this.runFinishRewards(this.profile.checkpoint.wave, this.profile.checkpoint.mode, this.profile.checkpoint.activeSeconds), false);
      this.profile.checkpoint = null;
      const rewards = this.settleMilestones();
      if (rewards.length) this.profile.lastRewards = Object.fromEntries(rewards);
      this.save();
      return rewards;
    }

    isDiscovered(type) {
      return this.profile.discoveries.includes(type);
    }

    discoverItem(type, announce = !AG.contentActive() || (AG.balanceActive() && !['playing', 'intermission'].includes(this.state))) {
      if (this.isDiscovered(type)) return false;
      this.profile.discoveries.push(type);
      if (announce) this.notify('discovery', type);
      return true;
    }

    finish(state) {
      const run = this.run;
      run.shots = [];
      run.missiles = [];
      run.hostile = [];
      run.allyShots = [];
      this.profile.bestScore = Math.max(this.profile.bestScore, run.score);
      this.profile.bestWave = Math.max(this.profile.bestWave, Math.min(LAST_WAVE, run.wave));
      this.profile.modeRecords[run.mode] = Math.max(this.profile.modeRecords[run.mode] ?? 0, run.wave);
      this.profile.checkpoint = null;
      this.releaseInput();
      this.state = state;
      if (AG.balanceActive() && !run.practice) this.queueRewards(this.runFinishRewards(run.wave, run.mode, run.activeSeconds), false);
      else if (state === 'victory') this.awardModeClear();
      run.milestoneRewards = this.settleMilestones();
      if (run.milestoneRewards.length) this.profile.lastRewards = Object.fromEntries(run.milestoneRewards);
      this.save();
    }

    gainXp(amount) {
      const run = this.run;
      if (run.level >= 50) return;
      run.xp += amount;
      while (run.level < 50 && run.xp >= xpForLevel(run.level)) {
        run.xp -= xpForLevel(run.level);
        run.level++;
        this.repair(10, false);
        this.notify('upgrade', run.level === SUPPLY_LEVEL ? 'Level 5 · Supplies unlocked' : 'Pilot level ' + run.level);
      }
      if (run.level === 50) run.xp = 0;
      if (!run.practice) {
        this.profile.bestPilotLevel = run.level;
        this.profile.pilotXp = run.xp;
        this.save();
      }
    }

    repair(amount, announce = true) {
      const { player, ship } = this.run;
      if (player.hp <= 0) return;
      const repaired = Math.min(amount, ship.hull - player.hp);
      player.hp += repaired;
      if (announce) this.notify('reward', repaired ? '+' + repaired + ' hull' : 'Hull already full');
    }

    applyBoost(type) {
      if (BOOSTS[type].repair) this.repair(BOOSTS[type].repair);
      else {
        (this.run.boosts[type] ??= []).push(BOOSTS[type].duration);
        this.notify('upgrade', BOOSTS[type].name + ' online');
      }
    }

    setTestDamage(amount) {
      if (!this.testing || !this.run || (amount !== null && (!Number.isSafeInteger(amount) || amount < 0))) return false;
      this.run.testDamage = amount;
      return true;
    }

    tickBoosts(dt) {
      for (const [type, timers] of Object.entries(this.run.boosts)) {
        if (type === 'shield' || type === 'fortress') {
          if (type === 'shield' && this.run.boosts.fortress?.length) continue;
          timers[0] -= dt;
          if (timers[0] <= 0) timers.shift();
        } else {
          this.run.boosts[type] = timers.map(time => time - dt).filter(time => time > 0);
        }
        if (!this.run.boosts[type].length) delete this.run.boosts[type];
      }
    }

    boostCount(type) {
      return this.run.boosts[type]?.length ?? 0;
    }

    shotDamage(includeNose = true, includeTestDamage = true) {
      const run = this.run;
      if (includeTestDamage && this.testing && run.testDamage != null) return run.testDamage;
      return Math.min(Number.MAX_SAFE_INTEGER,
        (run.ship.damage + (includeNose ? this.upgradeEffects().damage : 0)) * 2 ** this.boostCount('doubleDamage'));
    }

    upgradeEffects(ship, mounts = (ship ? this.profile.loadouts[ship] : this.run?.loadout ?? this.profile.loadouts[this.profile.ship]) ?? {}) {
      const effects = { speed: 1, damage: 0, vertical: false, vectors: 0, missile: null, laser: false, magnet: false, boostRelay: null, smoke: 0, radioactive: false, normalSmoke: false, barrels: 1, slimeMounts: [] };
      for (const [slot, id] of Object.entries(mounts)) {
        const upgrade = UPGRADES[id];
        effects.speed += upgrade.speed ?? 0;
        effects.damage += upgrade.damage ?? 0;
        effects.vertical ||= Boolean(upgrade.vertical);
        effects.vectors += Number(Boolean(upgrade.vertical));
        effects.missile ||= upgrade.missile ?? null;
        effects.laser ||= Boolean(upgrade.laser);
        effects.magnet ||= Boolean(upgrade.magnet);
        if (upgrade.boostRelay && (!effects.boostRelay || upgrade.boostRelay.interval < UPGRADES[effects.boostRelay].boostRelay.interval)) {
          effects.boostRelay = id;
        }
        if (upgrade.smoke) {
          effects.smoke++;
          effects.radioactive ||= Boolean(upgrade.radioactive);
          effects.normalSmoke ||= !upgrade.radioactive;
        }
        effects.barrels = Math.max(effects.barrels, upgrade.barrels ?? 1);
        if (upgrade.slime) effects.slimeMounts.push(slot);
      }
      return effects;
    }

    mountUpgrade(ship, slot, type) {
      if (!this.profile.unlocked.includes(ship) || !Object.hasOwn(SLOTS, slot) || (type && !AG.itemAvailable(type))) return false;
      if (!AG.slotAvailable(SHIPS[ship], slot) || !this.canVisitBase()) return false;
      const mounts = this.profile.loadouts[ship] ??= {};
      if (type) {
        if (UPGRADES[type]?.slot !== SLOTS[slot][0] || !this.profile.upgrades[type]) return false;
        const used = Object.entries(mounts).filter(([key, id]) => key !== slot && id === type).length;
        if (used >= this.profile.upgrades[type]) return false;
        mounts[slot] = type;
      } else {
        delete mounts[slot];
      }
      this.save();
      return true;
    }

    itemStock(type) {
      const profile = this.profile;
      if (UPGRADES[type]) return profile.upgrades;
      if (BOOSTS[type]) return profile.boosts;
      if (AG.MATERIALS[type]) return profile.materials;
      return profile.crates;
    }

    itemCount(type) {
      if (type === 'credit') return this.profile.credits;
      if (type === 'gem') return this.profile.gems;
      if (SHIPS[type]) return this.shipCount(type);
      return this.itemStock(type)[type] ?? 0;
    }

    addItem(type, amount) {
      const total = this.itemCount(type) + amount;
      const profile = this.profile;
      if (type === 'credit') profile.credits = total;
      else if (type === 'gem') profile.gems = total;
      else if (SHIPS[type]) {
        if (!profile.unlocked.includes(type)) profile.unlocked.push(type);
        profile.copies[type] = total;
      } else this.itemStock(type)[type] = total;
    }

    grantItem(type, amount = 1, announceDiscovery) {
      if (!Object.hasOwn(AG.ITEMS, type) || !AG.itemAvailable(type) || !Number.isSafeInteger(amount) || amount < 1 ||
          !Number.isSafeInteger(this.itemCount(type) + amount) || this.run?.practice) return false;
      this.addItem(type, amount);
      this.discoverItem(type, announceDiscovery);
      this.save();
      this.notify('loot', { type, amount });
      return true;
    }

    merchantStock(now = this.now()) {
      const saved = this.profile.merchant;
      const ids = Object.keys(AG.merchantCatalog());
      if (saved?.until > now && Array.isArray(saved.ids) && saved.ids.length === 2 && new Set(saved.ids).size === 2 &&
          saved.ids.every(id => ids.includes(id))) {
        if (!Array.isArray(saved.sold)) saved.sold = [];
        return saved;
      }
      const first = ids.splice(Math.floor(this.random() * ids.length), 1)[0];
      const second = ids[Math.floor(this.random() * ids.length)];
      const stock = { ids: [first, second].sort((a, b) => Object.keys(AG.merchantCatalog()).indexOf(a) - Object.keys(AG.merchantCatalog()).indexOf(b)),
        until: now + 300000, sold: [] };
      this.profile.merchant = stock;
      this.save();
      return stock;
    }

    resetMerchant() {
      if (!this.testing) return false;
      this.profile.merchant = null;
      return this.merchantStock();
    }

    premiumUpgradeWait() {
      return Math.max(0, this.profile.boostOverdriveTime + AG.PREMIUM_PURCHASE_COOLDOWN - this.now());
    }

    canBuyPremiumUpgrade(id) {
      const price = UPGRADES[id]?.premium;
      return Boolean(AG.contentActive() && price && this.canVisitBase() && this.profile.gems >= price &&
        this.premiumUpgradeWait() === 0 && Number.isSafeInteger(this.itemCount(id) + 1));
    }

    buyPremiumUpgrade(id) {
      if (!this.canBuyPremiumUpgrade(id)) return false;
      this.profile.gems -= UPGRADES[id].premium;
      this.profile.boostOverdriveTime = this.now();
      return this.grantItem(id);
    }

    buyMerchant(id) {
      const price = AG.merchantCatalog()[id];
      if (!this.canVisitBase() || !Number.isInteger(price) || this.credits < price ||
          !Number.isSafeInteger(this.itemCount(id) + 1)) return false;
      const stock = this.merchantStock();
      if (!stock.ids.includes(id) || stock.sold.includes(id)) return false;
      stock.sold.push(id);
      this.profile.credits -= price;
      return this.grantItem(id);
    }

    setPreset(index, ship, save) {
      if (!this.canVisitBase() || !this.shipCount(ship) || ![0, 1].includes(index)) return false;
      if (save) this.profile.presets[index] = { ...this.profile.loadouts[ship] };
      else {
        const preset = this.profile.presets[index];
        if (!preset) return false;
        this.profile.loadouts[ship] = AG.fitLoadout(SHIPS[ship], preset, this.profile.upgrades);
      }
      this.save();
      return true;
    }

    boostSlotOpen(index) {
      const level = this.canVisitBase() ? this.profile.bestPilotLevel : (this.run?.level ?? 1);
      return [1, 5, 10][index] <= level;
    }

    updateSmoke(dt, lastX, lastY) {
      const run = this.run;
      const effects = this.upgradeEffects();
      const ninjaSmoke = AG.balanceActive() && run.shipId === 'enemySmokeNinja';
      const { radioactive } = effects;
      const normalSmoke = effects.normalSmoke || ninjaSmoke;
      const smoke = effects.smoke + Number(ninjaSmoke);
      for (const puff of run.smoke) puff.life -= dt;
      run.smoke = run.smoke.filter(puff => puff.life > 1e-8);
      run.smokeIn -= dt;
      if (smoke && run.smokeIn <= 0) {
        const { x, y } = run.player;
        const movement = Math.hypot(x - lastX, y - lastY);
        const back = movement > 0 ? 16 / movement : 0;
        const scale = [1, 1, 1.25, 1.375][Math.min(smoke, 3)];
        const emit = (radius, poison, damage, duration) => run.smoke.push({
          x: x + (lastX - x) * back, y: movement > 0 ? y + (lastY - y) * back : y + 14,
          life: duration, duration, size: radius, poison, damage
        });
        if (!AG.contentActive()) emit(66, 0, smoke, 5);
        else {
          if (normalSmoke) emit(80 * scale, 0, 3, 5 * scale);
          if (radioactive) emit(60 * scale, 4 * scale, 4, 5 * scale);
        }
        run.smokeIn = AG.contentActive() ? .15 : .1;
      }
      if (!smoke && !run.smoke.length) return;
      for (let i = run.enemies.length - 1; i >= 0; i--) {
        const enemy = run.enemies[i];
        if (enemy.allied) continue;
        let smokeDamage = 0;
        enemy.poisonTime = Math.max(0, (enemy.poisonTime ?? 0) - dt);
        for (const puff of run.smoke) {
          if (!touches(enemy, puff)) continue;
          if (puff.poison) enemy.poisonTime = Math.max(enemy.poisonTime, puff.poison);
          else smokeDamage = puff.damage;
          if ((!normalSmoke || smokeDamage) && (!radioactive || enemy.poisonTime > 0)) break;
        }
        if (enemy.poisonTime > 1e-8) {
          enemy.poisonExposure = (enemy.poisonExposure ?? 0) + dt;
          if (enemy.poisonExposure + 1e-8 >= .5) {
            enemy.poisonExposure -= .5;
            this.hitEnemy(i, 4, 'poison');
            if (enemy.hp <= 0) continue;
          }
        } else enemy.poisonExposure = 0;
        if (!smokeDamage) continue;
        enemy.smokeExposure = (enemy.smokeExposure ?? 0) + dt;
        if (enemy.smokeExposure + 1e-8 >= .5) {
          enemy.smokeExposure -= .5;
          this.hitEnemy(i, smokeDamage, 'smoke');
        }
      }
    }

    spreadEnemySmoke(enemy) {
      const { enemySmoke } = this.run;
      enemySmoke.push({ x: enemy.x, y: enemy.y, size: 98, life: 10 });
      for (let i = 0; i < 9; i++) {
        enemySmoke.push({ x: (i % 3 + .5) * WIDTH / 3 + (this.random() - .5) * 80,
          y: (Math.floor(i / 3) + .5) * HEIGHT / 3 + (this.random() - .5) * 65,
          size: 92 + this.random() * 30, life: 10 });
      }
      if (enemySmoke.length > 60) enemySmoke.splice(0, enemySmoke.length - 60);
      this.notify('wave', 'Smoke Ninja · Hazardous smoke');
    }

    updateEnemySmoke(dt) {
      const run = this.run;
      const exposed = run.enemySmoke.some(puff => touches(run.player, puff));
      for (const puff of run.enemySmoke) puff.life -= dt;
      run.enemySmoke = run.enemySmoke.filter(puff => puff.life > 1e-8);
      run.smokeDamageIn = Math.max(0, run.smokeDamageIn - dt);
      if (!exposed) {
        run.smokeDamageIn = .5;
        return;
      }
      if (run.smokeDamageIn > 1e-8) return;
      run.smokeDamageIn = .5;
      this.hurt(2, 'Smoke Ninja smoke', true);
    }

    grantTestLevel() {
      if (!this.testing || this.run?.practice) return false;
      const level = this.run?.level ?? this.profile.bestPilotLevel;
      if (level >= 50) return false;
      if (this.run) this.gainXp(xpForLevel(level) - this.run.xp);
      else {
        this.profile.bestPilotLevel++;
        this.profile.pilotXp = 0;
      }
      return true;
    }

    adjustBoostReserve(type, amount, id = 'boostRelay') {
      if (!Object.hasOwn(BOOSTS, type) || ![-1, 1].includes(amount) || this.run?.practice) return false;
      const limits = UPGRADES[id]?.boostRelay;
      if (!limits || !this.canVisitBase() || !this.itemCount(id)) return false;
      const { boosts, boostReserves } = this.profile;
      const boostReserve = boostReserves[id];
      const stored = boostReserve[type] ?? 0;
      const available = boosts[type] ?? 0;
      if (amount > 0 && (!available || stored >= limits.capacity || (!stored && Object.keys(boostReserve).length >= limits.types))) return false;
      if (amount < 0 && (!stored || !Number.isSafeInteger(available + 1))) return false;
      if (stored + amount === 0) delete boostReserve[type];
      else boostReserve[type] = stored + amount;
      boosts[type] = available - amount;
      this.save();
      return true;
    }

    toggleBoostRelay() {
      if (!this.run || this.run.practice || !['playing', 'intermission'].includes(this.state) ||
          !this.upgradeEffects().boostRelay) return false;
      this.run.boostCycleOn = !this.run.boostCycleOn;
      return true;
    }

    updateBoostRelay(dt) {
      const run = this.run;
      run.boostCycleDelay = Math.max(0, run.boostCycleDelay - dt);
      if (!run.boostCycleOn || run.boostCycleDelay > 1e-8 || run.practice ||
          !run.enemies.some(enemy => !enemy.allied && enemy.y > 0)) return;
      const id = this.upgradeEffects().boostRelay;
      if (!id) return;
      const { interval } = UPGRADES[id].boostRelay;
      const reserve = this.profile.boostReserves[id];
      let used = false;
      for (const [type, count] of Object.entries(reserve)) {
        const boost = BOOSTS[type];
        const shield = type === 'shield' || type === 'fortress';
        if (boost.repair ? run.ship.hull - run.player.hp < Math.min(boost.repair, run.ship.hull / 2) :
            this.boostCount(type) || (shield && (this.boostCount('shield') || this.boostCount('fortress')))) continue;
        if (count === 1) delete reserve[type];
        else reserve[type]--;
        this.applyBoost(type);
        used = true;
        run.boostCycleDelay = interval;
        if (interval) break;
      }
      if (used) this.save();
    }

    canUseBoost(type) {
      return Boolean(this.run && !this.run.practice && !this.canVisitBase() && this.run.player.hp > 0 && this.profile.boosts[type] &&
        (!BOOSTS[type].repair || this.run.player.hp < this.run.ship.hull));
    }

    useBoost(type) {
      if (!this.canUseBoost(type)) return false;
      this.profile.boosts[type]--;
      this.applyBoost(type);
      this.save();
      return true;
    }

    cratePurchasePrice(type, count, now = Date.now()) {
      const price = AG.crateUnitPrice(type, now);
      const discount = type === 'enemyCrate' && AG.CRATE_BUY_AMOUNTS.includes(count) && AG.launchDealsActive(now);
      return count * price * (discount ? .75 : 1);
    }

    canBuyCrates(type, count, now = Date.now()) {
      if (!CRATES[type]?.price || !AG.itemAvailable(type) || !this.canVisitBase() ||
          !Number.isSafeInteger(count) || count < 1 ||
          (!this.canBuyCustomCrateAmount && !AG.CRATE_BUY_AMOUNTS.includes(count))) return false;
      return Number.isSafeInteger(this.itemCount(type) + count) && this.cratePurchasePrice(type, count, now) <= this.profile.gems;
    }

    cratePurchaseLimit(type) {
      if (!CRATES[type]?.price || !AG.itemAvailable(type) || !this.canVisitBase()) return 0;
      const regularLimit = Math.min(Math.floor(this.profile.gems / AG.crateUnitPrice(type)),
        Number.MAX_SAFE_INTEGER - this.itemCount(type));
      return Math.max(regularLimit, ...AG.CRATE_BUY_AMOUNTS.filter(count => this.canBuyCrates(type, count)));
    }

    get canBuyCustomCrateAmount() {
      return !AG.contentActive() || this.testing || this.adminUnlocked;
    }

    buyCrates(type, count) {
      const now = Date.now();
      if (!this.canBuyCrates(type, count, now)) return false;
      this.profile.gems -= this.cratePurchasePrice(type, count, now);
      this.grantItem(type, count);
      return true;
    }

    canBuyIntroShipCrate(now = Date.now()) {
      return AG.launchDealsActive(now) && !this.profile.shipCrateOfferUsed && this.canVisitBase() &&
        !this.run?.practice && this.profile.gems >= AG.SHIP_CRATE_OFFER_PRICE &&
        Number.isSafeInteger(this.itemCount('shipCrate') + 1);
    }

    buyIntroShipCrate() {
      if (!this.canBuyIntroShipCrate()) return false;
      this.profile.shipCrateOfferUsed = true;
      this.profile.gems -= AG.SHIP_CRATE_OFFER_PRICE;
      return this.grantItem('shipCrate');
    }

    updateGiftProgress(now = this.now()) {
      const day = AG.updateGiftDay(now);
      if (this.profile.updateGifts.day !== day) this.profile.updateGifts = { version: 2, day, claimed: 0, nextAt: 0 };
      return this.profile.updateGifts;
    }

    claimUpdateGift() {
      const now = this.now();
      if (!AG.contentActive(now) || !this.canVisitBase()) return false;
      const progress = this.updateGiftProgress(now);
      const gift = AG.UPDATE_GIFTS[progress.claimed];
      if (!gift || now < progress.nextAt) return false;
      const rewards = Object.entries(gift.rewards);
      if (rewards.some(([id, count]) => !Number.isSafeInteger(this.itemCount(id) + count))) return false;
      progress.claimed++;
      progress.nextAt = now + (AG.UPDATE_GIFTS[progress.claimed]?.wait ?? 0);
      for (const [id, count] of rewards) this.addItem(id, count);
      for (const [id] of rewards) this.discoverItem(id);
      this.save();
      for (const [type, amount] of rewards) this.notify('loot', { type, amount });
      return true;
    }

    crateBatchLimit() {
      return this.testing || this.adminUnlocked ? 1000000000000 : 10;
    }

    openBundle(type, count = 1) {
      const spec = CRATES[type];
      if (!AG.contentActive() || !spec?.bundle || !this.canVisitBase() || this.run?.practice ||
          !Number.isSafeInteger(count) || count < 1 || count > this.crateBatchLimit() || count > this.itemCount(type)) return false;
      const rewards = AG.bundleTotals(spec, count, this.random);
      if (Object.entries(rewards).some(([id, amount]) => !Number.isSafeInteger(this.itemCount(id) + amount))) return false;
      this.profile.crates[type] -= count;
      for (const [id, amount] of Object.entries(rewards)) {
        this.addItem(id, amount);
        this.discoverItem(id);
        this.notify('loot', { type: id, amount });
      }
      this.save();
      return rewards;
    }

    openCrates(type, count) {
      const crate = CRATES[type];
      const profile = this.profile;
      if (!crate?.outcomes || !AG.itemAvailable(type) || !Number.isSafeInteger(count) || count < 1 || this.run?.practice ||
          count > this.crateBatchLimit() || count > (profile.crates[type] ?? 0)) return false;

      const totals = AG.crateTotals(AG.liveCrate(type), count, this.random);
      const rarityOrder = Object.keys(AG.RARITIES);
      const rank = id => rarityOrder.indexOf(AG.ITEMS[id].rarity ?? 'common');
      const rewards = [...totals].sort(([a], [b]) => rank(b) - rank(a))
        .map(([type, amount]) => ({ type, amount }));
      if (rewards.some(({ type, amount }) => !Number.isSafeInteger(this.itemCount(type) + amount))) return false;

      profile.crates[type] -= count;
      for (const reward of rewards) {
        this.addItem(reward.type, reward.amount);
        reward.discovered = this.discoverItem(reward.type, false);
      }
      this.save();
      return { count, featured: rewards[0], rewards };
    }

    canBuy(type) {
      const run = this.run;
      return Boolean(SUPPLIES[type] && this.state === 'intermission' && run.level >= SUPPLY_LEVEL &&
        this.credits >= SUPPLIES[type].price && (type !== 'heal' || run.player.hp < run.ship.hull));
    }

    buy(type) {
      if (!this.canBuy(type)) return false;
      this.profile.credits -= SUPPLIES[type].price;
      this.applyBoost(type);
      this.save();
      this.notify('loot', { type, amount: 1 });
      return true;
    }

    canVisitBase() {
      return ['home', 'gameover', 'victory', 'quit'].includes(this.state);
    }

    canUnlockShip(id) {
      return this.canVisitBase() && AG.itemAvailable(id) && Object.hasOwn(SHIPS, id) &&
        Number.isFinite(SHIPS[id].price) && !this.shipCount(id) && this.credits >= SHIPS[id].price;
    }

    unlockShip(id) {
      if (!this.canUnlockShip(id)) return false;
      this.profile.credits -= SHIPS[id].price;
      return this.grantItem(id);
    }

    canUnlockFlagship(id) {
      const price = this.flagshipPrice(id);
      return this.canVisitBase() && Number.isSafeInteger(price) && this.profile.gems >= price && this.flagshipWait() === 0;
    }

    unlockFlagship(id) {
      if (!this.canUnlockFlagship(id)) return false;
      this.profile.gems -= this.flagshipPrice(id);
      const copies = this.shipCount(id);
      if (!copies) this.profile.unlocked.push(id);
      this.profile.copies[id] = copies + 1;
      this.profile.flagshipPurchases++;
      this.profile.flagshipTime = this.now();
      this.discoverItem(id);
      this.save();
      this.notify('loot', { type: id, amount: 1 });
      return true;
    }

    equip(id) {
      if (!this.canVisitBase() || !this.profile.unlocked.includes(id)) return false;
      this.profile.ship = id;
      this.save();
      return true;
    }

    spawn(type, extra = false) {
      const run = this.run;
      const spec = ENEMIES[type];
      const boss = BOSSES[type];
      const margin = spec.size + 24;
      const lane = run.spawned % 10;
      let x = boss ? WIDTH / 2 : clamp(90 + lane * 80 + (this.random() - 0.5) * 100, margin, WIDTH - margin);
      const formation = boss || extra || run.practice || run.wave < 12 ? '' :
        run.wave >= 32 && run.spawned % 12 < 4 ? 'diagonal' :
        run.wave >= 22 && run.spawned % 10 < 4 ? 'cluster' :
        run.spawned % 8 < 2 ? 'pair' : '';
      if (formation === 'diagonal') x = 240 + run.spawned % 12 * 110;
      if (formation === 'cluster') x = WIDTH / 2 + (run.spawned % 10 - 1.5) * 34;
      if (formation === 'pair') x = WIDTH / 2 + (run.spawned % 8 ? 45 : -45);
      const hp = boss ? Math.round(spec.hp * run.diff.bossHealth) : Math.ceil(spec.hp * run.diff.health);
      run.enemies.push({
        type, x, origin: x, y: -spec.size, size: spec.size, hp, maxHp: hp,
        speed: run.diff.speed * (spec.speed ?? 0), lane: (run.spawned + 2) % 5, fireIn: 1 + this.random() * run.diff.fire,
        fireDelay: run.diff.fire, damageScale: run.diff.damage, smokeIn: 0, age: 0, bornWave: run.wave, flash: 0, volley: 0, formation,
        escort: Boolean(boss && (run.spawned !== 0 || extra))
      });
      if (extra) run.total++;
      else run.spawned++;
    }

    movePlayer(dt) {
      const player = this.run.player;
      player.invulnerable -= dt;
      if (this.laserActive()) return;
      const effects = this.upgradeEffects();
      const speed = this.run.ship.speed * effects.speed * (1 + .4 * this.overdriveStacks());
      const vertical = effects.vertical;
      const verticalBoost = 1 + Math.max(0, effects.vectors - 1) * .2;
      let x = 0;
      let y = 0;
      for (const key of this.keys) {
        if (!MOVE[key]) continue;
        x += MOVE[key][0];
        if (vertical) y += MOVE[key][1];
      }
      if (this.pointer && !x && !y) {
        x = this.pointer.x - player.x;
        y = vertical ? this.pointer.y - player.y : 0;
        const distance = Math.hypot(x, y);
        const step = distance > 0 ? Math.min(1, speed * dt / distance) : 0;
        player.x += x * step;
        player.y += Math.sign(y) * Math.min(Math.abs(y), Math.abs(y * step * verticalBoost));
      } else {
        const length = Math.max(1, Math.hypot(x, y));
        player.x += x / length * speed * dt;
        player.y += y / length * speed * dt * verticalBoost;
      }
      player.x = clamp(player.x, 25, WIDTH - 25);
      player.y = clamp(player.y, 108, HEIGHT - 24);
    }

    update(dt) {
      if (!['playing', 'intermission'].includes(this.state)) return;
      const run = this.run;
      run.aegisCooldown = Math.max(0, run.aegisCooldown - dt);
      const { x, y } = run.player;
      this.movePlayer(dt);
      this.updateSmoke(dt, x, y);
      this.updateEnergy(dt);
      const barrageWasFiring = Boolean(run.barrage);
      this.updateBarrage(dt);
      this.updateSlime(dt);
      this.updateAsteroids(dt);
      if (this.state === 'intermission') {
        if (run.wave < this.waveLimit) {
          this.updateEnemySmoke(dt);
          if (run.player.hp <= 0) { this.finish('gameover'); return; }
        }
        for (const enemy of run.enemies) if (enemy.allied) this.actAsAlly(enemy, dt, true);
        this.updatePlayerShots(dt);
        this.updateMissiles(dt);
        this.collectDrops(dt);
        run.breakTime -= dt;
        if (run.breakTime <= 0) {
          if (run.wave >= this.waveLimit) this.finish('victory');
          else this.beginWave(run.wave + 1);
        }
        return;
      }

      run.activeSeconds += dt;
      this.tickBoosts(dt);
      this.updateBoostRelay(dt);
      run.spawnIn = Math.max(0, run.spawnIn - dt);
      if (run.pending.length && run.spawnIn === 0) {
        const bossBatch = !!BOSSES[run.pending[0]];
        const limit = bossBatch ? run.diff.bossPack : run.diff.pack;
        let activeBosses = bossBatch ? run.enemies.filter(enemy => BOSSES[enemy.type]).length : 0;
        for (let i = 0; i < limit && run.pending.length; i++) {
          const type = run.pending[0];
          if (Boolean(BOSSES[type]) !== bossBatch || (bossBatch && activeBosses >= run.diff.bossCap)) break;
          run.pending.shift();
          this.spawn(type);
          if (bossBatch) activeBosses++;
        }
        run.spawnIn = bossBatch ? run.diff.bossSpawn : run.diff.spawn;
      }
      if (this.profile.auto && this.canSkip() && run.spawned / run.total >= AUTO_SKIP_AT) this.skip();

      const { player, ship } = run;
      player.fireIn -= dt;
      if (player.fireIn <= 0 && !barrageWasFiring && !run.barrage && !this.laserActive()) {
        const damage = this.shotDamage();
        const { barrels: fittedBarrels } = this.upgradeEffects();
        const barrels = Math.max(fittedBarrels, this.boostCount('salvoAmmo') ? 3 : this.boostCount('quickload') ? 2 : 1);
        const enemyRounds = AG.balanceActive() && Boolean(AG.SHIPS[run.shipId]?.enemyFrame);
        const barrelDelay = AG.balanceActive() && fittedBarrels > 1 ? 2 : 1;
        for (let i = 0; i < barrels; i++) {
          run.shots.push({ x: player.x + (i - (barrels - 1) / 2) * 19,
            y: player.y - 20, vx: 0, vy: enemyRounds ? -205 : -720, size: enemyRounds ? 6 : 5, damage, color: ship.color, enemyRound: enemyRounds });
        }
        player.fireIn = Math.max(.055,
          ship.delay * barrelDelay * .52 ** this.boostCount('rapidFire') * .68 ** this.overdriveStacks());
        this.notify('fire');
      }

      if (!this.laserActive()) {
        this.launchMissile(dt);
        this.launchSlime(dt);
      }
      this.updateAlien(dt);
      this.moveEnemies(dt);
      this.updateEnemySmoke(dt);
      this.updateProjectiles(dt);
      this.updateMissiles(dt);
      this.updateLaser(dt);
      this.collectDrops(dt);
      if (player.hp <= 0) {
        if (run.practice) this.fillPractice(run.practice);
        else this.finish('gameover');
      } else if (!run.pending.length && !run.enemies.some(enemy => !enemy.allied)) {
        if (run.practice) this.fillPractice(run.practice);
        else this.finishWave();
      }
    }

    moveEnemies(dt) {
      const run = this.run;
      const { player } = run;
      for (let index = run.enemies.length - 1; index >= 0; index--) {
        const enemy = run.enemies[index];
        enemy.slimeTime = Math.max(0, (enemy.slimeTime ?? 0) - dt);
        const travel = dt * (enemy.slimeTime > 0 ? .5 : 1);
        enemy.age += enemy.allied ? dt : travel;
        enemy.flash -= dt;
        enemy.coreTime = Math.max(0, (enemy.coreTime ?? 0) - dt);
        enemy.ghostTime = Math.max(0, (enemy.ghostTime ?? 0) - dt);
        if (enemy.allied) { this.actAsAlly(enemy, dt); continue; }
        if (enemy.grips > 0) continue;
        if (run.practice) {
          if (run.practice === 'moving') enemy.x = WIDTH / 2 + 245 * Math.sin(enemy.age * 1.6);
          continue;
        }
        const boss = BOSSES[enemy.type];
        if (boss) {
          enemy.y = Math.min(enemy.y + (68 + boss.tier * 8) * travel, 128 + enemy.lane * 33);
          const center = enemy.bornWave === 10 ? WIDTH / 2 : 120 + enemy.lane * 164;
          enemy.x = clamp(center + (enemy.teleportOffset ?? 0) + Math.sin(enemy.age * (.78 + boss.tier * .18)) * (enemy.bornWave === 10 ? 275 : 90), boss.size + 12, WIDTH - boss.size - 12);
          if (enemy.teleportIn > 0 && (enemy.teleportIn -= dt) <= 0) {
            enemy.ghostX = enemy.x;
            enemy.ghostTime = .6;
            enemy.teleportOffset = enemy.x < WIDTH / 2 ? 165 : -165;
          }
        } else {
          enemy.y += (enemy.formation ? run.diff.speed * .91 : enemy.speed) * travel;
          const diver = enemy.type === 'diver';
          enemy.x = clamp(enemy.origin + Math.sin(enemy.age * (diver ? 4.2 : 1.5)) * (diver ? 73 : 17), enemy.size, WIDTH - enemy.size);
        }

        const recognized = !AG.balanceActive() || Math.hypot(enemy.x - player.x, enemy.y - player.y) <=
          Math.hypot(WIDTH, HEIGHT) * (run.ship.enemyFrame ? .5 : 1);
        if (enemy.type === 'smokeNinja' && enemy.y > 45 && recognized) {
          enemy.smokeIn -= dt;
          if (enemy.smokeIn <= 0) { this.spreadEnemySmoke(enemy); enemy.smokeIn = 12; }
        }
        if (enemy.y > HEIGHT + enemy.size) {
          this.removeEnemy(index, false, true);
          continue;
        }
        if (touches(enemy, player)) {
          this.hurt(Math.round((boss ? 24 : 16) * (enemy.damageScale ?? run.diff.damage)), (boss?.name ?? enemy.type) + ' collision');
          if (!boss) this.removeEnemy(index, false);
          continue;
        }
        if (!recognized || enemy.y < 75 || !boss && !['shooter', 'tank'].includes(enemy.type)) continue;
        enemy.fireIn -= dt;
        if (enemy.fireIn <= 0) {
          const phase = enemy.hp / enemy.maxHp < 0.45;
          this.fireAtPlayer(enemy, boss ? boss.shots + (phase ? 2 : 0) : 1);
          enemy.fireIn = boss ? boss.cadence * (phase ? .72 : 1) : enemy.fireDelay;
        }
      }
    }

    fireAtPlayer(enemy, count) {
      const { player, hostile, enemies } = this.run;
      const boss = BOSSES[enemy.type];
      const volley = enemy.volley++;
      const direct = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const aim = enemy.type === 'dread' && volley % 2 ? Math.PI / 2 : direct;
      const sweep = enemy.type === 'phantom' ? Math.sin(volley * 1.45) * .33 : 0;
      const spread = (boss?.spread ?? .17) * (volley % 2 ? 1.35 : 1);
      const speed = boss ? 220 + boss.tier * 12 : 205;
      if (enemy.type === 'dread' && volley % 2) enemy.coreTime = 1.4;
      if (enemy.type === 'phantom' && volley % 2) {
        enemy.ghostX = enemy.x;
        enemy.ghostTime = .9;
        enemy.teleportIn = .34;
      }
      if (enemy.type === 'nexus' && volley % 2) {
        enemies.filter(other => other !== enemy && BOSSES[other.type] && !other.allied)
          .forEach((other, i) => { other.fireIn = .5 + i * .45; });
        this.notify('upgrade', 'Nexus Overlord · Fleet salvo');
      }
      for (let index = 0; index < count; index++) {
        const offset = index - (count - 1) / 2;
        const angle = aim + sweep + offset * spread;
        const shotSpeed = enemy.type === 'prism' && index % 2 ? speed * 1.32 :
          enemy.type === 'nexus' && index % 2 ? speed * .72 : speed;
        hostile.push({ x: enemy.x, y: enemy.y + 4, size: 6, vx: Math.cos(angle) * shotSpeed,
          vy: Math.sin(angle) * shotSpeed, damage: Math.round((boss ? 12 + boss.tier : 9) * (enemy.damageScale ?? this.run.diff.damage)),
          color: ENEMIES[enemy.type].color, source: (boss?.name ?? enemy.type) + ' fire', splitIn: enemy.type === 'prism' && index % 2 === 0 ? .53 : null });
      }
    }

    pickMissileTarget() {
      const { enemies, player, targetMode } = this.run;
      const score = {
        nearest: enemy => -Math.hypot(enemy.x - player.x, enemy.y - player.y),
        bottom: enemy => enemy.y,
        strongest: enemy => enemy.hp,
        weakest: enemy => -enemy.hp
      }[targetMode];
      let best = null;
      let priority = -Infinity;
      for (const enemy of enemies) {
        if (enemy.allied || enemy.y < 0 || enemy.y > HEIGHT) continue;
        const rating = score(enemy);
        if (rating <= priority) continue;
        priority = rating;
        best = enemy;
      }
      return best;
    }

    launchSlime(dt) {
      const run = this.run;
      run.slimeIn = Math.max(0, run.slimeIn - dt);
      const mounts = this.upgradeEffects().slimeMounts;
      if (run.slimeIn > 0 || !mounts.length) return;
      const target = this.pickMissileTarget();
      if (!target) return;
      for (const mount of mounts) {
        const x = run.player.x + (mount === 'leftWing' ? -22 : 22);
        const y = run.player.y - 13;
        const range = Math.max(1, Math.hypot(target.x - x, target.y - y));
        run.slimeShots.push({ x, y, vx: (target.x - x) / range, vy: (target.y - y) / range, range, size: 6 });
      }
      run.slimeIn = 2;
    }

    updateSlime(dt) {
      const { enemies, slimeShots } = this.run;
      if (!slimeShots.length) return;
      const radius = BOSSES.boss.size / 2;
      this.run.slimeShots = slimeShots.filter(shot => {
        const step = Math.min(shot.range, dt * 540);
        shot.x += shot.vx * step;
        shot.y += shot.vy * step;
        shot.range -= step;
        if (shot.range > 1e-8 && !enemies.some(enemy => !enemy.allied && touches(enemy, shot))) return true;
        for (const enemy of enemies) {
          if (!enemy.allied && (enemy.x - shot.x) ** 2 + (enemy.y - shot.y) ** 2 <= (radius + enemy.size) ** 2) enemy.slimeTime = 4;
        }
        this.notify('blast', { x: shot.x, y: shot.y, radius, color: '#7bfa65' });
        return false;
      });
    }

    summonAsteroidField() {
      const run = this.run;
      if (!AG.contentActive() || !run || run.practice || run.asteroidField || !['playing', 'intermission'].includes(this.state === 'paused' ? this.resumeState : this.state)) return false;
      run.asteroidDelay = null;
      run.asteroidField = { left: 20, next: 0 };
      this.notify('wave', 'Asteroid field incoming');
      return true;
    }

    hitAsteroid(rock, damage) {
      if (rock.hp <= 0) return;
      rock.hp -= damage;
      if (rock.hp > 0) return;
      const multiplier = rock.green ? 3 : 1;
      this.dropItem('credit', rock.x - 15, rock.y, 30 * multiplier);
      this.dropItem('gem', rock.x + 12, rock.y, multiplier);
      if (rock.green) this.dropItem('uranium', rock.x + 40, rock.y, 1 + Math.floor(this.random() * 3));
      this.notify('blast', { x: rock.x, y: rock.y, radius: rock.size + 9, color: rock.green ? '#b5ff62' : '#ffc185' });
    }

    updateAsteroids(dt) {
      const run = this.run;
      if (run.asteroidDelay != null && (run.asteroidDelay -= dt) <= 0) this.summonAsteroidField();
      const field = run.asteroidField;
      if (field?.left && (field.next -= dt) <= 0) {
        const green = this.random() < .05;
        const size = 18 + this.random() * 14;
        run.asteroids.push({ x: 35 + this.random() * (WIDTH - 70), y: -size,
          vx: (this.random() - .5) * 60, vy: 160 + this.random() * 80,
          hp: green ? 3 : 2, size, green, spin: this.random() * 6 });
        field.left--;
        field.next += .23;
      }
      if (!run.asteroids.length) return;
      run.asteroids = run.asteroids.filter(rock => {
        if (rock.hp <= 0) return false;
        rock.x += rock.vx * dt;
        rock.y += rock.vy * dt;
        rock.spin += dt * 1.5;
        for (let i = run.enemies.length - 1; i >= 0; i--) {
          const enemy = run.enemies[i];
          if (enemy.allied || enemy.y < 0 || !touches(rock, enemy)) continue;
          this.hitEnemy(i, BOSSES[enemy.type] ? 35 * run.diff.health : enemy.hp, 'asteroid');
          this.notify('blast', { x: rock.x, y: rock.y, radius: rock.size });
          return false;
        }
        return rock.y < HEIGHT + rock.size;
      });
      if (field?.left === 0 && !run.asteroids.length) run.asteroidField = null;
    }

    launchMissile(dt) {
      const run = this.run;
      const kind = this.upgradeEffects().missile;
      if (!kind) return;
      run.missileIn = Math.max(0, run.missileIn - dt);
      if (run.missileIn > 0) return;
      const target = this.pickMissileTarget();
      if (!target) return;
      const { x, y } = run.player;
      run.missiles.push({ x, y: y - 14, angle: Math.atan2(target.y - y + 14, target.x - x),
        range: Math.hypot(target.x - x, target.y - y + 14), kind, target,
        size: 6, life: 3.5, damage: this.shotDamage() * (kind === 'homing' ? 3 : 2) });
      run.missileIn = kind === 'homing' ? 1.35 : 1.65;
      this.notify('missile');
    }

    updateMissiles(dt) {
      const run = this.run;
      run.missiles = run.missiles.filter(missile => {
        const guided = missile.kind === 'homing';
        if (guided) {
          if (missile.target?.allied || !run.enemies.includes(missile.target)) missile.target = this.pickMissileTarget();
          if (missile.target) {
            const desired = Math.atan2(missile.target.y - missile.y, missile.target.x - missile.x);
            const delta = Math.atan2(Math.sin(desired - missile.angle), Math.cos(desired - missile.angle));
            missile.angle += clamp(delta, -5.5 * dt, 5.5 * dt);
          }
        }
        const step = guided ? 395 * dt : Math.min(510 * dt, missile.range);
        missile.x += Math.cos(missile.angle) * step;
        missile.y += Math.sin(missile.angle) * step;
        missile.range -= step;
        missile.life -= dt;
        const hit = run.enemies.findIndex(enemy => !enemy.allied && touches(missile, enemy));
        const rock = run.asteroids.find(rock => rock.hp > 0 && touches(missile, rock));
        if (guided && rock && hit < 0) { this.hitAsteroid(rock, missile.damage); return false; }
        if (guided && hit >= 0) {
          this.hitEnemy(hit, missile.damage, 'missile');
          this.notify('blast', { x: missile.x, y: missile.y, radius: 22 });
          return false;
        }
        if (!guided && (hit >= 0 || rock || missile.range <= 0)) {
          const radius = 72;
          for (let index = run.enemies.length - 1; index >= 0; index--) {
            const enemy = run.enemies[index];
            if (!enemy.allied && Math.hypot(enemy.x - missile.x, enemy.y - missile.y) <= radius + enemy.size) {
              this.hitEnemy(index, missile.damage, 'missile');
            }
          }
          for (const asteroid of run.asteroids) {
            if (Math.hypot(asteroid.x - missile.x, asteroid.y - missile.y) <= radius + asteroid.size) this.hitAsteroid(asteroid, missile.damage);
          }
          this.notify('blast', { x: missile.x, y: missile.y, radius });
          return false;
        }
        return missile.life > 0 && missile.x >= -35 && missile.x <= WIDTH + 35 && missile.y >= -35 && missile.y <= HEIGHT + 35;
      });
    }

    laserInput(mode) {
      const laser = this.run?.laser;
      if (!laser) return;
      if (mode === 'off') {
        laser.held = laser.toggled = false;
        laser.tick = 0;
        return;
      }
      if (mode === 'release') laser.held = false;
      else if (this.state === 'playing' && this.run.energy + 1e-8 >= 1 && this.upgradeEffects().laser) {
        if (mode === 'hold') {
          laser.held = true;
          laser.toggled = false;
        } else {
          laser.toggled = !laser.toggled;
          laser.held = false;
        }
      }
      if (!this.laserActive()) laser.tick = 0;
    }

    laserActive() {
      const run = this.run;
      return this.state === 'playing' && run.energy + 1e-8 >= 1 && this.upgradeEffects().laser &&
        (run.laser.held || run.laser.toggled);
    }

    laserRay() {
      const { player, laser } = this.run;
      const x = player.x;
      const y = player.y - 13;
      const dx = (laser.aim?.x ?? x) - x;
      const dy = (laser.aim?.y ?? 0) - y;
      const distance = Math.hypot(dx, dy);
      const ux = distance >= 1 ? dx / distance : 0;
      const uy = distance >= 1 ? dy / distance : -1;
      const reach = Math.hypot(WIDTH, HEIGHT);
      return { x, y, ux, uy, reach };
    }

    updateLaser(dt) {
      if (!this.laserActive()) return;
      const run = this.run;
      run.laser.tick += dt;
      if (run.laser.tick + 1e-9 < .1) return;
      run.laser.tick -= .1;
      run.energy = Math.max(0, run.energy - 1);
      const { x, y, ux, uy, reach } = this.laserRay();
      const damage = this.shotDamage() / 2.75;
      for (let index = run.enemies.length - 1; index >= 0; index--) {
        const enemy = run.enemies[index];
        const progress = (enemy.x - x) * ux + (enemy.y - y) * uy;
        const offset = Math.abs((enemy.x - x) * uy - (enemy.y - y) * ux);
        if (!enemy.allied && progress >= 0 && progress <= reach && offset <= enemy.size + 19) this.hitEnemy(index, damage, 'laser');
      }
      for (const rock of run.asteroids) {
        const progress = (rock.x - x) * ux + (rock.y - y) * uy;
        const offset = Math.abs((rock.x - x) * uy - (rock.y - y) * ux);
        if (progress >= 0 && progress <= reach && offset <= rock.size + 19) this.hitAsteroid(rock, damage);
      }
      if (run.energy + 1e-8 < 1) this.laserInput('off');
      if (run.energy === 0) while (this.retractTendril()) {}
    }

    hitEnemy(index, damage, source = 'shot', impactX = null) {
      const enemy = this.run.enemies[index];
      if (enemy.formation === 'pair' && source === 'shot' && !enemy.shieldBroken && Math.abs(impactX - enemy.x) < enemy.size * .65) {
        enemy.shieldBroken = true;
        enemy.flash = .16;
        return;
      }
      if (enemy.coreTime > 0 && ['shot', 'missile', 'laser'].includes(source)) damage *= 1.5;
      enemy.hp -= damage;
      enemy.flash = .09;
      if (source !== 'asteroid') this.alienHit(enemy, source, damage);
      this.notify('enemy-damage', { x: enemy.x, y: enemy.y, size: enemy.size, amount: damage, source });
      if (enemy.hp <= 0) this.removeEnemy(index, true);
    }

    hasSingularityBarrage() {
      const run = this.run;
      return Boolean((this.testing || AG.contentActive()) && run?.ship.barrage && !run.ship.alien && !run.loadout?.special);
    }

    updateBarrage(dt) {
      if (!this.hasSingularityBarrage()) return;
      const run = this.run;
      const spec = run.ship.barrage;
      if (!run.barrage) {
        const remaining = run.total - run.resolved;
        if (this.state !== 'playing' || run.total < 1 || remaining * 3 < run.total * 2 ||
            run.energy + 1e-8 < spec.energy) return;
        run.energy = Math.max(0, run.energy - spec.energy);
        const rateBoost = AG.balanceActive() ? Math.min(4, .52 ** -this.boostCount('rapidFire')) : 1;
        run.barrage = { elapsed: 0, emitted: 0, shots: Math.round(spec.shots * rateBoost), arcDegrees: AG.balanceActive() ? 80 : spec.arcDegrees };
        this.notify('upgrade', spec.name + ' active');
      }
      const barrage = run.barrage;
      barrage.elapsed = Math.min(spec.duration, barrage.elapsed + dt);
      const totalShots = barrage.shots ?? spec.shots;
      const due = Math.min(totalShots, Math.floor(barrage.elapsed * totalShots / spec.duration + 1e-8));
      const damage = (AG.balanceActive() ? this.shotDamage(false, false) : run.ship.damage) * spec.damageScale;
      const { x, y } = run.player;
      while (barrage.emitted < due) {
        const i = barrage.emitted++;
        const progress = i / (totalShots - 1);
        const sweep = Math.cos(progress * spec.sweepPasses * Math.PI);
        const halfArc = (barrage.arcDegrees ?? spec.arcDegrees) * Math.PI / 360;
        const angle = -Math.PI / 2 + sweep * halfArc;
        const vx = Math.cos(angle);
        const vy = Math.sin(angle);
        run.shots.push({ x: x + vx * 16, y: y + vy * 16, vx: vx * 780, vy: vy * 780,
          size: 5, damage, color: '#ffabeb', barrage: true });
      }
      if (barrage.emitted === totalShots) run.barrage = null;
    }

    updatePlayerShots(dt) {
      const run = this.run;
      run.shots = run.shots.filter(shot => {
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        if (shot.barrage) {
          if (shot.x < shot.size || shot.x > WIDTH - shot.size) {
            const wall = shot.x < shot.size ? shot.size : WIDTH - shot.size;
            shot.x = 2 * wall - shot.x;
            shot.vx = -shot.vx;
          }
          const hitEnemies = shot.hitEnemies ??= [];
          for (let index = 0; index < run.enemies.length;) {
            const enemy = run.enemies[index];
            if (!enemy.allied && !hitEnemies.includes(enemy) && touches(shot, enemy)) {
              hitEnemies.push(enemy);
              this.hitEnemy(index, shot.damage, 'shot', shot.x);
              if (hitEnemies.length === 3) return false;
            }
            if (run.enemies[index] === enemy) index++;
          }
        } else {
          const hit = run.enemies.findIndex(enemy => !enemy.allied && touches(shot, enemy));
          if (hit >= 0) {
            this.hitEnemy(hit, shot.damage, 'shot', shot.x);
            return false;
          }
        }
        const rock = run.asteroids.find(rock => rock.hp > 0 && touches(shot, rock));
        if (rock) this.hitAsteroid(rock, shot.damage);
        return !rock && shot.y > -24 && shot.y < HEIGHT + 24 && shot.x > -24 && shot.x < WIDTH + 24;
      });
    }

    updateProjectiles(dt) {
      this.updatePlayerShots(dt);
      const run = this.run;
      const fragments = [];
      run.hostile = run.hostile.filter(shot => {
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        if (shot.splitIn != null && (shot.splitIn -= dt) <= 0) {
          const angle = Math.atan2(shot.vy, shot.vx);
          const speed = Math.hypot(shot.vx, shot.vy);
          for (const offset of [-.35, .35]) fragments.push({ ...shot, splitIn: null,
            vx: Math.cos(angle + offset) * speed, vy: Math.sin(angle + offset) * speed });
          return false;
        }
        const ally = run.enemies.findIndex(enemy => enemy.allied && touches(shot, enemy));
        if (ally >= 0) {
          if ((run.enemies[ally].hp -= shot.damage) <= 0) this.removeEnemy(ally, false);
          return false;
        }
        if (touches(shot, run.player)) {
          this.hurt(shot.damage, shot.source);
          return false;
        }
        return shot.x > -20 && shot.x < WIDTH + 20 && shot.y > -20 && shot.y < HEIGHT + 20;
      });
      run.hostile.push(...fragments);
      run.allyShots = run.allyShots.filter(shot => {
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        const index = run.enemies.findIndex(enemy => !enemy.allied && touches(shot, enemy));
        if (index >= 0) this.hitEnemy(index, shot.damage, 'ally');
        return index < 0 && shot.x > 0 && shot.x < WIDTH && shot.y > 0 && shot.y < HEIGHT;
      });
    }

    hurt(damage, source = 'Enemy fire', damageOverTime = false) {
      const { player, boosts } = this.run;
      if ((this.testing && this.run.godMode) || (!damageOverTime && player.invulnerable > 0) || boosts.shield || boosts.fortress) return;
      const run = this.run;
      const ability = run.ship.ability;
      if (ability && damage > 0 && !run.aegisShield && run.aegisCooldown === 0) {
        run.aegisShield = AG.aegisCapacity(run.ship);
        this.notify('upgrade', ability.name + ' active');
      }
      if (run.aegisShield > 0) {
        const absorbed = Math.min(damage, run.aegisShield);
        run.aegisShield -= absorbed;
        damage -= absorbed;
        if (run.aegisShield === 0) run.aegisCooldown = ability.interval;
      }
      if (!damage) {
        if (!damageOverTime) player.invulnerable = .78;
        return;
      }
      player.hp = Math.max(0, player.hp - damage);
      this.run.stats.lastHit = source;
      if (!damageOverTime) player.invulnerable = 0.78;
      this.notify('hit');
    }

    removeEnemy(index, killed, escaped = false) {
      const run = this.run;
      const [enemy] = run.enemies.splice(index, 1);
      if (!enemy.allied && enemy.bornWave === run.wave) run.resolved++;
      if (!killed) {
        if (escaped) this.hurt(Math.round(5 * (enemy.damageScale ?? run.diff.damage)), 'An escaped enemy');
        return;
      }
      const boss = BOSSES[enemy.type];
      if (run.practice) {
        this.notify('destroy', enemy);
        run.energy = run.energyCap;
        return;
      }
      this.rewardAlien(enemy);
      const score = ENEMIES[enemy.type].score;
      run.score += score;
      this.gainEnergy(1);
      this.notify('destroy', enemy);
      this.dropItem('credit', enemy.x, enemy.y, boss ? 95 + boss.tier * 25 : Math.max(4, Math.ceil(score / 3)));
      if (boss) this.dropItem('gem', enemy.x + 12, enemy.y, 1);
      this.gainXp(boss ? 25 : 2);
      if (this.random() < (boss ? .10 : .014)) {
        const types = Object.keys(BOOSTS).filter(id => !BOOSTS[id].pickupChance);
        this.dropItem(boss ? 'shield' : types[Math.floor(this.random() ** 1.65 * types.length)], enemy.x - 20, enemy.y);
      }
      for (const id of ['quickload', 'salvoAmmo']) {
        if (this.random() < BOOSTS[id].pickupChance) this.dropItem(id, enemy.x - 35, enemy.y + 18);
      }
      const updateLive = AG.contentActive();
      let roll = this.random();
      for (const [type, upgrade] of Object.entries(UPGRADES)) {
        if (updateLive && upgrade.killDropChance) continue;
        roll -= (upgrade.chance ?? 0) / 10;
        if (roll >= 0) continue;
        this.dropItem(type, enemy.x + 21, enemy.y);
        break;
      }
      if (updateLive && this.random() < UPGRADES.cannon.killDropChance) {
        this.dropItem('cannon', enemy.x + 21, enemy.y - 19);
      }
      const lead = boss && !enemy.escort && enemy.bornWave === run.wave && AG.mainBoss(run.wave) === enemy.type;
      if (AG.contentActive() && enemy.type === 'grunt' && this.random() < (AG.balanceActive() ? .024 : .12)) this.dropItem('slime', enemy.x - 20, enemy.y);
      if (AG.contentActive() && this.random() < (boss ? .04 : .002)) {
        this.dropItem(this.random() < .7 ? 'boostBundle' : 'upgradeBundle', enemy.x + 33, enemy.y);
      }
      const ninja = enemy.type === 'smokeNinja';
      if (ninja && this.random() < .6) this.dropItem('smokeBomb', enemy.x + 27, enemy.y);
      const crateChance = ninja ? .45 : lead ? Math.min(.6, (run.wave / 10 + 1) / 10) : boss ? 0 : .0005;
      if (crateChance && this.random() < crateChance) {
        this.dropItem(this.random() < .25 ? 'shipCrate' : 'upgradeCrate', enemy.x - 31, enemy.y);
      }
    }

    dropItem(type, x, y, amount = 1) {
      this.run.drops.push({ type, amount, x: clamp(x, 22, WIDTH - 22),
        y: clamp(y, 22, HEIGHT - 22), age: 0, size: 16 });
    }

    collectDrops(dt) {
      const run = this.run;
      const collected = [];
      const magnet = this.upgradeEffects().magnet;
      run.drops = run.drops.filter(drop => {
        const oldAge = drop.age;
        drop.age += dt;
        if (drop.age + 1e-8 < 1) return true;
        const movingFor = Math.max(0, drop.age - 1);
        const elapsed = Math.min(dt, Math.max(0, drop.age - Math.max(1, oldAge)));
        const speed = Math.min(magnet ? 800 : 140, movingFor * (magnet ? 750 : 180));
        if (magnet) {
          const dx = run.player.x - drop.x;
          const dy = run.player.y - drop.y;
          const distance = Math.hypot(dx, dy);
          const step = Math.min(1, speed * elapsed / Math.max(1, distance));
          drop.x += dx * step;
          drop.y += dy * step;
        } else {
          if (drop.y < FLIGHT_LANE) drop.y = Math.min(FLIGHT_LANE, drop.y + speed * elapsed);
          else if (drop.y > FLIGHT_LANE) drop.y = Math.max(FLIGHT_LANE, drop.y - speed * elapsed);
        }
        if (touches(drop, run.player)) {
          if (drop.type !== 'alienSerum' || !this.profile.serumUsed || !AG.eventActive(this.now())) collected.push(drop);
          return false;
        }
        return magnet || drop.age < 16;
      });
      for (const drop of collected) {
        if (drop.type === 'gem') run.stats.gems += drop.amount;
        const ranks = Object.keys(AG.RARITIES);
        const rank = id => ranks.indexOf(AG.ITEMS[id]?.rarity ?? 'common');
        if (!run.stats.rarest || rank(drop.type) > rank(run.stats.rarest)) run.stats.rarest = drop.type;
        if (Object.hasOwn(BOOSTS, drop.type) && !BOOSTS[drop.type].pickupChance) {
          this.discoverItem(drop.type, true);
          for (let i = 0; i < drop.amount; i++) this.applyBoost(drop.type);
          this.notify('loot', { type: drop.type, amount: drop.amount });
          this.save();
        } else this.grantItem(drop.type, drop.amount, true);
      }
    }
  }

  AG.Game = Game;
})();
