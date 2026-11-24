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
      this.keys = new Set();
      this.pointer = null;
      this.state = 'home';
      this.run = null;
      this.testing = false;
      this.liveSession = null;
      this.testProfile = null;
    }

    get credits() { return this.profile.credits; }
    get waveLimit() { return this.testing ? MAX_WAVE : LAST_WAVE; }
    get waveLabel() {
      const wave = this.run.wave;
      return wave.toLocaleString() + ' / ' + (wave === MAX_WAVE ? MAX_WAVE : LAST_WAVE).toLocaleString();
    }

    save() {
      if (this.testing) return;
      try { this.storage.setItem('alien-shooter.profile.v1', JSON.stringify(this.profile)); } catch {}
    }

    enterTesting() {
      if (this.testing) return;
      this.liveSession = {
        profile: this.profile, run: this.run, state: this.state, resumeState: this.resumeState
      };
      this.profile = this.testProfile ?? JSON.parse(JSON.stringify(this.profile));
      this.testing = true;
      this.run = null;
      this.state = 'home';
    }

    leaveTesting() {
      if (!this.testing) return;
      const { profile, run, state, resumeState } = this.liveSession;
      this.testProfile = this.profile;
      this.profile = profile;
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
      this.testProfile = this.profile;
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

    start() {
      const ship = SHIPS[this.profile.ship];
      this.releaseInput();
      this.run = {
        wave: 0, level: 1, xp: 0, score: 0, boosts: {}, ship,
        player: { x: WIDTH / 2, y: FLIGHT_LANE, size: 13, hp: ship.hull, invulnerable: 0, fireIn: 0.15 },
        enemies: [], shots: [], hostile: [], drops: [],
        missiles: [], missileIn: 0, targetMode: 'nearest', energy: 0,
        laser: { held: false, toggled: false, tick: 0, aim: null }
      };
      this.beginWave(1);
    }

    beginWave(number, carryShots = false) {
      const run = this.run;
      number = clamp(Math.trunc(number) || 1, 1, this.waveLimit);
      const diff = difficultyFor(number);
      run.wave = number;
      run.diff = diff;
      run.pending = AG.bossLineup(number);
      const pool = Object.keys(ENEMIES).filter(type => !BOSSES[type] && ENEMIES[type].unlock <= number);
      const count = diff.boss ? Math.ceil(diff.count * 0.42) : diff.count;
      for (let index = 0; index < count; index++) {
        run.pending.push(pool[Math.floor(this.random() * pool.length)]);
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
      this.notify('wave', diff.boss ? (BOSSES[run.pending[Math.min(4, number / 10 - 1)]].name + ' incoming') : 'Wave ' + number.toLocaleString());
    }

    canSkip() {
      const run = this.run;
      return this.state === 'playing' && !run.diff.boss && run.wave < this.waveLimit && run.pending.length > 0;
    }

    skip() {
      if (!this.canSkip()) return false;
      this.beginWave(this.run.wave + 1, true);
      return true;
    }

    finishWave() {
      const run = this.run;
      const credits = 18 + Math.min(500, run.wave * 2);
      this.profile.credits += credits;
      this.save();
      const before = run.player.hp;
      this.gainXp(12);
      this.repair(8, false);
      const repaired = run.player.hp - before;
      this.notify('reward', '+' + credits + ' credits' + (repaired ? ' · +' + repaired + ' hull' : ''));
      this.laserInput('off');
      run.breakTime = run.wave === this.waveLimit ? 7 : 4.8;
      run.hostile = [];
      this.state = 'intermission';
      this.notify('wave', 'Wave ' + run.wave + ' clear');
    }

    finish(state) {
      const run = this.run;
      run.shots = [];
      run.missiles = [];
      run.hostile = [];
      this.profile.bestScore = Math.max(this.profile.bestScore, run.score);
      this.profile.bestWave = Math.max(this.profile.bestWave, run.wave);
      this.save();
      this.releaseInput();
      this.state = state;
    }

    gainXp(amount) {
      const run = this.run;
      run.xp += amount;
      while (run.level < 50 && run.xp >= xpForLevel(run.level)) {
        run.xp -= xpForLevel(run.level);
        run.level++;
        this.repair(10, false);
        this.notify('upgrade', run.level === SUPPLY_LEVEL ? 'Level 5 · Supplies unlocked' : 'Pilot level ' + run.level);
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

    shotDamage() {
      const run = this.run;
      if (this.testing && run.testDamage != null) return run.testDamage;
      const waveBonus = Math.floor((Math.min(run.wave, 50) - 1) / 7);
      return Math.min(Number.MAX_SAFE_INTEGER,
        (run.ship.damage + waveBonus + this.upgradeEffects().damage) * 2 ** this.boostCount('doubleDamage'));
    }

    upgradeEffects() {
      const mounts = this.profile.loadouts[this.profile.ship] ?? {};
      const effects = { speed: 1, damage: 0, vertical: false, missile: null, laser: false };
      for (const id of Object.values(mounts)) {
        const upgrade = UPGRADES[id];
        effects.speed += upgrade.speed ?? 0;
        effects.damage += upgrade.damage ?? 0;
        effects.vertical ||= Boolean(upgrade.vertical);
        effects.missile ||= upgrade.missile ?? null;
        effects.laser ||= Boolean(upgrade.laser);
      }
      return effects;
    }

    mountUpgrade(ship, slot, type) {
      if (!this.profile.unlocked.includes(ship) || !Object.hasOwn(SLOTS, slot)) return false;
      if (slot.startsWith('engine') && +slot.slice(-1) > SHIPS[ship].engines) return false;
      const mounts = this.profile.loadouts[ship] ??= {};
      if (type) {
        if (UPGRADES[type]?.slot !== SLOTS[slot][0] || !this.profile.upgrades[type]) return false;
        const used = Object.entries(mounts).filter(([key, id]) => key !== slot && id === type).length;
        if (used >= this.profile.upgrades[type]) return false;
        mounts[slot] = type;
      } else {
        delete mounts[slot];
      }
      if (this.run && !this.canVisitBase() && ship === this.profile.ship && !this.upgradeEffects().vertical) {
        this.run.player.y = FLIGHT_LANE;
      }
      this.save();
      return true;
    }

    grantItem(type, amount = 1) {
      if (!Object.hasOwn(AG.ITEMS, type)) return false;
      const profile = this.profile;
      if (type === 'credit') profile.credits += amount;
      else if (type === 'gem') profile.gems += amount;
      else if (SHIPS[type]) {
        if (profile.unlocked.includes(type)) return false;
        profile.unlocked.push(type);
      } else {
        const stock = UPGRADES[type] ? profile.upgrades : BOOSTS[type] ? profile.boosts : profile.crates;
        stock[type] = (stock[type] ?? 0) + amount;
      }
      this.save();
      this.notify('loot', { type, amount });
      return true;
    }

    canUseBoost(type) {
      return Boolean(this.run && !this.canVisitBase() && this.run.player.hp > 0 && this.profile.boosts[type] &&
        (!BOOSTS[type].repair || this.run.player.hp < this.run.ship.hull));
    }

    useBoost(type) {
      if (!this.canUseBoost(type)) return false;
      this.profile.boosts[type]--;
      this.applyBoost(type);
      this.save();
      return true;
    }

    buyCrate(type, autoOpen = false) {
      const crate = CRATES[type];
      if (!this.canVisitBase() || !crate || this.profile.gems < crate.price) return false;
      this.profile.gems -= crate.price;
      this.grantItem(type);
      return autoOpen ? this.openCrate(type) : true;
    }

    openCrate(type) {
      if (!this.profile.crates[type] || !CRATES[type]) return false;
      const crate = CRATES[type];
      let roll = this.random() * 100;
      const outcome = crate.outcomes.find(entry => (roll -= entry.weight) < 0) ?? crate.outcomes.at(-1);
      const id = outcome.items[Math.floor(this.random() * outcome.items.length)];
      this.profile.crates[type]--;
      if (!this.grantItem(id)) {
        this.grantItem('credit', 250);
        return { type: 'credit', rolled: id, text: 'Duplicate ' + SHIPS[id].name + ' converted to 250 Credits.' };
      }
      return { type: id, rolled: id, text: AG.ITEMS[id].name + ' · ' + outcome.rarity };
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
      return ['home', 'gameover', 'victory'].includes(this.state);
    }

    canUnlockShip(id) {
      return this.canVisitBase() && Object.hasOwn(SHIPS, id) &&
        SHIPS[id].price > 0 && !this.profile.unlocked.includes(id) && this.credits >= SHIPS[id].price;
    }

    unlockShip(id) {
      if (!this.canUnlockShip(id)) return false;
      this.profile.credits -= SHIPS[id].price;
      return this.grantItem(id);
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
      const x = boss ? WIDTH / 2 : clamp(90 + lane * 80 + (this.random() - 0.5) * 100, margin, WIDTH - margin);
      const hp = boss ? Math.round(spec.hp * (1 + .25 * Math.max(0, Math.log10(run.wave / 50)))) : Math.ceil(spec.hp * run.diff.health);
      run.enemies.push({
        type, x, origin: x, y: -spec.size, size: spec.size, hp, maxHp: hp,
        speed: run.diff.speed * (spec.speed ?? 0), lane: run.spawned % 5, fireIn: 1 + this.random() * run.diff.fire,
        fireDelay: run.diff.fire, age: 0, bornWave: run.wave, flash: 0, volley: 0
      });
      if (extra) run.total++;
      else run.spawned++;
    }

    movePlayer(dt) {
      const player = this.run.player;
      player.invulnerable -= dt;
      if (this.laserActive()) return;
      const effects = this.upgradeEffects();
      const speed = this.run.ship.speed * effects.speed * (1 + .4 * this.boostCount('overdrive'));
      const vertical = effects.vertical;
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
        player.y += y * step;
      } else {
        const length = Math.max(1, Math.hypot(x, y));
        player.x += x / length * speed * dt;
        player.y += y / length * speed * dt;
      }
      player.x = clamp(player.x, 25, WIDTH - 25);
      player.y = clamp(player.y, 108, HEIGHT - 24);
    }

    update(dt) {
      if (!['playing', 'intermission'].includes(this.state)) return;
      const run = this.run;
      this.movePlayer(dt);
      if (this.state === 'intermission') {
        this.updatePlayerShots(dt);
        this.updateMissiles(dt);
        this.collectDrops(dt);
        run.breakTime -= dt;
        if (run.breakTime <= 0) {
          if (run.wave === this.waveLimit) this.finish('victory');
          else this.beginWave(run.wave + 1);
        }
        return;
      }

      this.tickBoosts(dt);
      run.spawnIn = Math.max(0, run.spawnIn - dt);
      if (run.pending.length && run.spawnIn === 0 &&
        (!BOSSES[run.pending[0]] || run.enemies.filter(enemy => BOSSES[enemy.type]).length < 5)) {
        const type = run.pending.shift();
        this.spawn(type);
        run.spawnIn = BOSSES[type] ? 1.35 : run.diff.spawn;
      }
      if (this.profile.auto && this.canSkip() && run.spawned / run.total >= AUTO_SKIP_AT) this.skip();

      const { player, ship } = run;
      player.fireIn -= dt;
      if (player.fireIn <= 0 && !this.laserActive()) {
        const damage = this.shotDamage();
        run.shots.push({ x: player.x, y: player.y - 20, vx: 0, vy: -720, size: 5, damage });
        player.fireIn = Math.max(.055,
          ship.delay * .52 ** this.boostCount('rapidFire') * .68 ** this.boostCount('overdrive'));
        this.notify('fire');
      }

      if (!this.laserActive()) this.launchMissile(dt);
      this.moveEnemies(dt);
      this.updateProjectiles(dt);
      this.updateMissiles(dt);
      this.updateLaser(dt);
      this.collectDrops(dt);
      if (player.hp <= 0) {
        this.finish('gameover');
      } else if (!run.pending.length && !run.enemies.length) {
        this.finishWave();
      }
    }

    moveEnemies(dt) {
      const run = this.run;
      const { player } = run;
      for (let index = run.enemies.length - 1; index >= 0; index--) {
        const enemy = run.enemies[index];
        enemy.age += dt;
        enemy.flash -= dt;
        const boss = BOSSES[enemy.type];
        if (boss) {
          enemy.y = Math.min(enemy.y + (68 + boss.tier * 8) * dt, 128 + enemy.lane * 33);
          const center = enemy.bornWave === 10 ? WIDTH / 2 : 120 + enemy.lane * 164;
          enemy.x = clamp(center + Math.sin(enemy.age * (.78 + boss.tier * .18)) * (enemy.bornWave === 10 ? 275 : 90), boss.size + 12, WIDTH - boss.size - 12);
        } else {
          enemy.y += enemy.speed * dt;
          const diver = enemy.type === 'diver';
          enemy.x = clamp(enemy.origin + Math.sin(enemy.age * (diver ? 4.2 : 1.5)) * (diver ? 73 : 17), enemy.size, WIDTH - enemy.size);
        }

        if (enemy.y > HEIGHT + enemy.size) {
          this.removeEnemy(index, false, true);
          continue;
        }
        if (touches(enemy, player)) {
          this.hurt(boss ? 24 : 16);
          if (!boss) this.removeEnemy(index, false);
          continue;
        }
        if (enemy.y < 75 || !boss && !['shooter', 'tank'].includes(enemy.type)) continue;
        enemy.fireIn -= dt;
        if (enemy.fireIn <= 0) {
          const phase = enemy.hp / enemy.maxHp < 0.45;
          this.fireAtPlayer(enemy, boss ? boss.shots + (phase ? 2 : 0) : 1);
          enemy.fireIn = boss ? boss.cadence * (phase ? .72 : 1) : enemy.fireDelay;
        }
      }
    }

    fireAtPlayer(enemy, count) {
      const { player, hostile } = this.run;
      const boss = BOSSES[enemy.type];
      const volley = enemy.volley++;
      const direct = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const aim = enemy.type === 'dread' && volley % 2 ? Math.PI / 2 : direct;
      const sweep = enemy.type === 'phantom' ? Math.sin(volley * 1.45) * .33 : 0;
      const spread = (boss?.spread ?? .17) * (volley % 2 ? 1.35 : 1);
      const speed = boss ? 220 + boss.tier * 12 : 205;
      for (let index = 0; index < count; index++) {
        const offset = index - (count - 1) / 2;
        const angle = aim + sweep + offset * spread;
        const shotSpeed = enemy.type === 'prism' && index % 2 ? speed * 1.32 :
          enemy.type === 'nexus' && index % 2 ? speed * .72 : speed;
        hostile.push({ x: enemy.x, y: enemy.y + 4, size: 6, vx: Math.cos(angle) * shotSpeed,
          vy: Math.sin(angle) * shotSpeed, damage: boss ? 12 + boss.tier : 9 });
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
        if (enemy.y < 0 || enemy.y > HEIGHT) continue;
        const rating = score(enemy);
        if (rating <= priority) continue;
        priority = rating;
        best = enemy;
      }
      return best;
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
          if (!run.enemies.includes(missile.target)) missile.target = this.pickMissileTarget();
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
        const hit = run.enemies.findIndex(enemy => touches(missile, enemy));
        if (guided && hit >= 0) {
          this.hitEnemy(hit, missile.damage);
          this.notify('blast', { x: missile.x, y: missile.y, radius: 22 });
          return false;
        }
        if (!guided && (hit >= 0 || missile.range <= 0)) {
          const radius = 72;
          for (let index = run.enemies.length - 1; index >= 0; index--) {
            const enemy = run.enemies[index];
            if (Math.hypot(enemy.x - missile.x, enemy.y - missile.y) <= radius + enemy.size) {
              this.hitEnemy(index, missile.damage);
            }
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
      else if (this.state === 'playing' && this.run.energy >= 3 && this.upgradeEffects().laser) {
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
      return this.state === 'playing' && run.energy >= 3 && this.upgradeEffects().laser &&
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
      if (run.laser.tick + 1e-9 < .3) return;
      run.laser.tick -= .3;
      run.energy -= 3;
      const { x, y, ux, uy, reach } = this.laserRay();
      const damage = this.shotDamage() * 2;
      for (let index = run.enemies.length - 1; index >= 0; index--) {
        const enemy = run.enemies[index];
        const progress = (enemy.x - x) * ux + (enemy.y - y) * uy;
        const offset = Math.abs((enemy.x - x) * uy - (enemy.y - y) * ux);
        if (progress >= 0 && progress <= reach && offset <= enemy.size + 19) this.hitEnemy(index, damage);
      }
      if (run.energy < 3) this.laserInput('off');
    }

    hitEnemy(index, damage) {
      const enemy = this.run.enemies[index];
      enemy.hp -= damage;
      enemy.flash = .09;
      if (enemy.hp <= 0) this.removeEnemy(index, true);
    }

    updatePlayerShots(dt) {
      const run = this.run;
      run.shots = run.shots.filter(shot => {
        shot.y += shot.vy * dt;
        const hit = run.enemies.findIndex(enemy => touches(shot, enemy));
        if (hit < 0) return shot.y > -24;
        this.hitEnemy(hit, shot.damage);
        return false;
      });
    }

    updateProjectiles(dt) {
      this.updatePlayerShots(dt);
      const run = this.run;
      run.hostile = run.hostile.filter(shot => {
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        if (touches(shot, run.player)) {
          this.hurt(shot.damage);
          return false;
        }
        return shot.x > -20 && shot.x < WIDTH + 20 && shot.y > -20 && shot.y < HEIGHT + 20;
      });
    }

    hurt(damage) {
      const { player, boosts } = this.run;
      if ((this.testing && this.run.godMode) || player.invulnerable > 0 || boosts.shield || boosts.fortress) return;
      player.hp = Math.max(0, player.hp - damage);
      player.invulnerable = 0.78;
      this.notify('hit');
    }

    removeEnemy(index, killed, escaped = false) {
      const run = this.run;
      const [enemy] = run.enemies.splice(index, 1);
      if (enemy.bornWave === run.wave) run.resolved++;
      if (!killed) {
        if (escaped) this.hurt(5);
        return;
      }
      const boss = BOSSES[enemy.type];
      const score = ENEMIES[enemy.type].score;
      run.score += score;
      run.energy = Math.min(100, run.energy + (boss ? 22 : 5));
      this.notify('destroy', enemy);
      this.dropItem('credit', enemy.x, enemy.y, boss ? 95 + boss.tier * 25 : Math.max(4, Math.ceil(score / 3)));
      if (boss) this.dropItem('gem', enemy.x + 12, enemy.y, 1);
      this.gainXp(boss ? 25 : 2);
      if (boss || this.random() < .14) {
        const types = Object.keys(BOOSTS);
        this.dropItem(boss ? 'shield' : types[Math.floor(this.random() ** 1.65 * types.length)], enemy.x - 20, enemy.y);
      }
      let roll = this.random();
      for (const [type, upgrade] of Object.entries(UPGRADES)) {
        roll -= upgrade.chance ?? 0;
        if (roll >= 0) continue;
        this.dropItem(type, enemy.x + 21, enemy.y);
        break;
      }
      const crateRoll = this.random();
      if (crateRoll < (boss ? .06 : .001)) this.dropItem('shipCrate', enemy.x - 31, enemy.y);
      else if (crateRoll < (boss ? .17 : .004)) this.dropItem('upgradeCrate', enemy.x - 31, enemy.y);
    }

    dropItem(type, x, y, amount = 1) {
      this.run.drops.push({ type, amount, x: clamp(x, 22, WIDTH - 22),
        y: clamp(y, 100, FLIGHT_LANE), age: 0, size: 16 });
    }

    collectDrops(dt) {
      const run = this.run;
      run.drops = run.drops.filter(drop => {
        drop.age += dt;
        drop.y = Math.min(FLIGHT_LANE, drop.y + 140 * dt);
        if (touches(drop, run.player)) {
          this.grantItem(drop.type, drop.amount);
          return false;
        }
        return drop.age < 16;
      });
    }
  }

  AG.Game = Game;
})();
