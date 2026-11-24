(() => {
  'use strict';

  const AG = window.AG;
  const { WIDTH, HEIGHT, LAST_WAVE, SUPPLY_LEVEL, AUTO_SKIP_AT, SHIPS, BOOSTS,
    ENEMIES, SUPPLIES, clamp, difficultyFor, xpForLevel } = AG;
  const MOVE = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
    arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
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
    }

    save() {
      try { this.storage.setItem('alien-shooter.profile.v1', JSON.stringify(this.profile)); } catch {}
    }

    releaseInput() {
      this.keys.clear();
      this.pointer = null;
    }

    start() {
      const ship = SHIPS[this.profile.ship];
      this.releaseInput();
      this.run = {
        wave: 0, level: 1, xp: 0, score: 0, credits: 0, boosts: {}, ship,
        player: { x: WIDTH / 2, y: HEIGHT - 58, size: 13, hp: ship.hull, invulnerable: 0, fireIn: 0.15 },
        enemies: [], shots: [], hostile: [], drops: []
      };
      this.beginWave(1);
    }

    beginWave(number, carryShots = false) {
      const run = this.run;
      const diff = difficultyFor(number);
      run.wave = number;
      run.diff = diff;
      run.pending = [];
      if (diff.boss) run.pending.push('boss');
      const pool = Object.keys(ENEMIES).filter(type => type !== 'boss' && ENEMIES[type].unlock <= number);
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
        run.hostile = [];
      }
      this.state = 'playing';
      this.notify('wave', diff.boss ? 'Mothership incoming' : 'Wave ' + number);
    }

    canSkip() {
      const run = this.run;
      return this.state === 'playing' && !run.diff.boss && run.wave < LAST_WAVE && run.pending.length > 0;
    }

    skip() {
      if (!this.canSkip()) return false;
      this.beginWave(this.run.wave + 1, true);
      return true;
    }

    finishWave() {
      const run = this.run;
      const credits = 18 + run.wave * 2;
      run.credits += credits;
      const before = run.player.hp;
      this.gainXp(12);
      this.repair(8, false);
      const repaired = run.player.hp - before;
      this.notify('reward', '+' + credits + ' credits' + (repaired ? ' · +' + repaired + ' hull' : ''));
      if (run.wave === LAST_WAVE) {
        this.finish('victory');
        return;
      }
      run.breakTime = 4.8;
      run.hostile = [];
      this.state = 'intermission';
      this.notify('wave', 'Wave ' + run.wave + ' clear');
    }

    finish(state) {
      const run = this.run;
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
      if (type === 'heal') {
        this.repair(25);
      } else {
        this.run.boosts[type] = BOOSTS[type].duration;
        this.notify('upgrade', BOOSTS[type].name + ' online');
      }
    }

    canBuy(type) {
      const run = this.run;
      return Boolean(SUPPLIES[type] && this.state === 'intermission' && run.level >= SUPPLY_LEVEL &&
        run.credits >= SUPPLIES[type].price && (type !== 'heal' || run.player.hp < run.ship.hull));
    }

    buy(type) {
      if (!this.canBuy(type)) return false;
      this.run.credits -= SUPPLIES[type].price;
      this.applyBoost(type);
      return true;
    }

    equip(id) {
      const ship = SHIPS[id];
      if (!ship || !['home', 'gameover', 'victory'].includes(this.state)) return false;
      if (!this.profile.unlocked.includes(id)) {
        if (this.profile.gems < ship.price) return false;
        this.profile.gems -= ship.price;
        this.profile.unlocked.push(id);
      }
      this.profile.ship = id;
      this.save();
      return true;
    }

    spawn(type) {
      const run = this.run;
      const spec = ENEMIES[type];
      const boss = type === 'boss';
      const margin = spec.size + 24;
      const lane = run.spawned % 10;
      const x = boss ? WIDTH / 2 : clamp(90 + lane * 80 + (this.random() - 0.5) * 100, margin, WIDTH - margin);
      const hp = boss ? Math.round(spec.hp * (1 + (run.wave - 10) * 0.085)) : Math.ceil(spec.hp * run.diff.health);
      run.enemies.push({
        type, x, origin: x, y: -spec.size, size: spec.size, hp, maxHp: hp,
        speed: run.diff.speed * spec.speed, fireIn: 1 + this.random() * run.diff.fire,
        fireDelay: run.diff.fire, age: 0, bornWave: run.wave, flash: 0, volley: 0
      });
      run.spawned++;
    }

    movePlayer(dt) {
      const player = this.run.player;
      const speed = this.run.ship.speed;
      let x = 0;
      let y = 0;
      for (const key of this.keys) {
        if (!MOVE[key]) continue;
        x += MOVE[key][0];
        y += MOVE[key][1];
      }
      if (this.pointer && !x && !y) {
        x = this.pointer.x - player.x;
        y = this.pointer.y - player.y;
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
      player.invulnerable -= dt;
    }

    update(dt) {
      if (!['playing', 'intermission'].includes(this.state)) return;
      const run = this.run;
      this.movePlayer(dt);
      if (this.state === 'intermission') {
        this.collectDrops(dt);
        run.breakTime -= dt;
        if (run.breakTime <= 0) this.beginWave(run.wave + 1);
        return;
      }

      for (const type of Object.keys(run.boosts)) {
        run.boosts[type] -= dt;
        if (run.boosts[type] <= 0) delete run.boosts[type];
      }
      run.spawnIn -= dt;
      if (run.pending.length && run.spawnIn <= 0) {
        this.spawn(run.pending.shift());
        run.spawnIn += run.diff.spawn;
      }
      if (this.profile.auto && this.canSkip() && run.spawned / run.total >= AUTO_SKIP_AT) this.skip();

      const { player, ship } = run;
      player.fireIn -= dt;
      if (player.fireIn <= 0) {
        const damage = (ship.damage + Math.floor((run.wave - 1) / 7)) * (run.boosts.doubleDamage ? 2 : 1);
        run.shots.push({ x: player.x, y: player.y - 20, vx: 0, vy: -720, size: 5, damage });
        player.fireIn += ship.delay * (run.boosts.rapidFire ? 0.52 : 1);
        this.notify('fire');
      }

      this.moveEnemies(dt);
      this.updateProjectiles(dt);
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
        const boss = enemy.type === 'boss';
        if (boss) {
          enemy.y = Math.min(enemy.y + 70 * dt, 150);
          enemy.x = WIDTH / 2 + Math.sin(enemy.age * 0.78) * 275;
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
        if (enemy.y < 75 || !['boss', 'shooter', 'tank'].includes(enemy.type)) continue;
        enemy.fireIn -= dt;
        if (enemy.fireIn <= 0) {
          const phase = enemy.hp / enemy.maxHp < 0.45;
          this.fireAtPlayer(enemy, boss ? (phase ? 7 : 5) : 1);
          enemy.fireIn = boss ? (phase ? 1.13 : 1.8) : enemy.fireDelay;
        }
      }
    }

    fireAtPlayer(enemy, count) {
      const { player, hostile } = this.run;
      const aim = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const spread = enemy.volley++ % 2 === 0 ? 0.17 : 0.28;
      const speed = enemy.type === 'boss' ? 250 : 205;
      for (let index = 0; index < count; index++) {
        const angle = aim + (index - (count - 1) / 2) * spread;
        hostile.push({ x: enemy.x, y: enemy.y + 4, size: 6, vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed, damage: enemy.type === 'boss' ? 14 : 9 });
      }
    }

    updateProjectiles(dt) {
      const run = this.run;
      run.shots = run.shots.filter(shot => {
        shot.y += shot.vy * dt;
        const hit = run.enemies.findIndex(enemy => touches(shot, enemy));
        if (hit < 0) return shot.y > -24;
        const enemy = run.enemies[hit];
        enemy.hp -= shot.damage;
        enemy.flash = 0.09;
        if (enemy.hp <= 0) this.removeEnemy(hit, true);
        return false;
      });
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
      if (player.invulnerable > 0 || boosts.shield) return;
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
      const boss = enemy.type === 'boss';
      const credits = boss ? 95 : Math.max(3, Math.ceil(ENEMIES[enemy.type].score / 4));
      run.score += ENEMIES[enemy.type].score;
      run.credits += credits;
      this.notify('destroy', enemy);
      this.notify('reward', '+' + credits + ' credits' + (boss ? ' · +1 Star Gem' : ''));
      if (boss) {
        this.profile.gems++;
        this.save();
      }
      this.gainXp(boss ? 25 : 2);
      if (boss || this.random() < 0.14) {
        const types = Object.keys(BOOSTS);
        const type = boss ? 'shield' : types[Math.floor(this.random() * types.length)];
        run.drops.push({ type, x: enemy.x, y: clamp(enemy.y, 100, HEIGHT - 18), age: 0, size: 16 });
      }
    }

    collectDrops(dt) {
      const run = this.run;
      run.drops = run.drops.filter(drop => {
        drop.age += dt;
        drop.y = Math.min(HEIGHT - 20, drop.y + 55 * dt);
        if (touches(drop, run.player)) {
          this.applyBoost(drop.type);
          return false;
        }
        return drop.age < 12;
      });
    }
  }

  AG.Game = Game;
})();
