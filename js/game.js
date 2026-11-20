/* ============================================================
   game.js — state machine, main loop, collisions and rendering.
   Systems stay small: waves.js decides what spawns, entities.js decides
   how things behave, ui.js decides what is shown. This file wires them.
   ============================================================ */
(function (global) {
  'use strict';
  var AG = (global.AG = global.AG || {});
  var C = AG.CONFIG;

  AG.Game = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assets = new AG.AssetManager(AG.ICON_MANIFEST);
    AG.assets = this.assets;

    this.ui = new AG.UI(this);
    this.waves = new AG.WaveManager(this);

    // Movement is hold-left-click only, horizontal only. Vertical movement is
    // intentionally earned later — do not restore keyboard/free movement here.
    this.input = {
      left: false, right: false, up: false, down: false,
      holding: false, pointerX: C.canvasWidth / 2, pointerActive: false
    };

    this.state = 'menu';
    this.prevState = 'menu';
    this.shopReturnState = 'menu';
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.particles = [];
    this.stars = [];

    this.score = 0;
    this.credits = 0;
    this.gems = 0;
    this.level = 1;
    this.xp = 0;
    this.kills = 0;
    this.wave = 0;
    this.time = 0;
    this.shake = 0;
    this.breakTimer = 0;
    this.lastTime = 0;
    this.autoSkip = false;
    this._pendingCoins = 0;
    this._coinNotifyTimer = 0;
    this.loop = this.loop.bind(this);

    this._makeStars();
    this._bindInput();
    this._bindButtons();
    this.ui.setShopEnabled(true);

    this.bgGradient = this.ctx.createLinearGradient(0, 0, 0, C.canvasHeight);
    this.bgGradient.addColorStop(0, '#060b1a');
    this.bgGradient.addColorStop(0.55, '#050816');
    this.bgGradient.addColorStop(1, '#0a0718');
  };

  AG.Game.prototype = {
    /* ---------- lifecycle ---------- */
    start: function () {
      var self = this;
      this.assets.loadAll(
        function () {},
        function () {
          self.lastTime = performance.now();
          requestAnimationFrame(self.loop);
        }
      );
    },

    newRun: function () {
      this.score = 0;
      this.credits = 0;
      this.gems = 0;
      this.level = 1;
      this.xp = 0;
      this.kills = 0;
      this.wave = 0;
      this.shake = 0;
      this.autoSkip = false;
      this._pendingCoins = 0;
      this._coinNotifyTimer = 0;
      this.enemies = [];
      this.bullets = [];
      this.enemyBullets = [];
      this.powerups = [];
      this.particles = [];
      this.player = new AG.Player(AG.SPACESHIPS[0]);
      this.waves.reset();
      this.ui.hideOverlay();
      this.ui.setHudVisible(true);
      this.ui.setRunControlsVisible(true);
      this.ui.setAutoSkip(false);
      this.ui.setShopEnabled(false);
      this.ui._roundShopUnlocked = null;
      this.state = 'playing';
      this.startWave(1);
    },

    startWave: function (n) {
      this.wave = n;
      this.waves.start(n);
      this.state = 'playing';
      this.ui.setRunControlsVisible(true);
      this.ui.setShopEnabled(false);
      var d = AG.difficultyFor(n);
      this.ui.showBanner(
        'WAVE ' + n,
        d.isBossWave ? 'MOTHERSHIP INBOUND' : (n === 1 ? 'INCOMING' : 'HOSTILES INCOMING'),
        d.isBossWave
      );
      if (d.isBossWave) this.shake = 8;
    },

    onWaveCleared: function (wave) {
      if (wave >= C.maxWaves) {
        this.victory();
        return;
      }
      var bonus = 25 + wave * 5;
      this.addCredits(bonus);
      this.addXp(C.leveling.xpPerWave);
      var healed = 0;
      if (this.player) {
        var before = this.player.health;
        this.player.health = Math.min(this.player.maxHealth, before + C.wave.interWaveHeal);
        healed = Math.round(this.player.health - before);
      }
      if (healed > 0) this.notifyRepair(healed);
      this.state = 'waveclear';
      this.breakTimer = C.wave.breakTime;
      this.ui.showBanner('WAVE ' + wave + ' CLEAR', '+' + bonus + ' CREDITS · HULL REPAIRED', false, 1.5, true);
    },

    isBossWave: function () {
      return this.wave % 10 === 0;
    },

    addXp: function (amount) {
      this.xp += amount;
      var L = C.leveling;
      while (this.level < L.maxLevel && this.xp >= AG.xpForLevel(this.level)) {
        this.xp -= AG.xpForLevel(this.level);
        this.level++;
        if (this.player) {
          this.player.health = Math.min(this.player.maxHealth, this.player.health + L.levelUpHeal);
        }
        this.ui.notify('LEVEL ' + this.level, {
          icon: AG.BOOSTS.shield.icon, glyph: '★', color: AG.CURRENCIES.gem.color
        });
      }
    },

    /* Skipping stops future spawns but leaves field enemies alive. Boss fights
       cannot be skipped by any route (manual or auto). */
    skipWave: function () {
      if (this.state !== 'playing' && this.state !== 'waveclear') return false;
      if (this.isBossWave()) {
        this.ui.notify('BOSS FIGHT — CANNOT SKIP', {
          icon: 'ui.shadedLock', glyph: '×', color: '#ff5d7a'
        });
        return false;
      }
      this.waves.active = false;
      this.waves.queue = [];
      this.onWaveCleared(this.wave);
      return true;
    },

    toggleAutoSkip: function () {
      this.autoSkip = !this.autoSkip;
      this.ui.setAutoSkip(this.autoSkip);
      this.ui.notify('AUTO SKIP ' + (this.autoSkip ? 'ON' : 'OFF'), {
        color: AG.CURRENCIES.credit.color
      });
    },

    /* ---------- currency + notifications ---------- */
    addCredits: function (amount) {
      this.credits += amount;
      this._pendingCoins += amount;
    },

    flushCoins: function (dt) {
      this._coinNotifyTimer -= dt;
      if (this._pendingCoins > 0 && this._coinNotifyTimer <= 0) {
        var credit = AG.CURRENCIES.credit;
        this.ui.notify('+' + this._pendingCoins.toLocaleString() + ' CREDITS', {
          icon: credit.icon, glyph: credit.glyph, color: credit.color
        });
        this._pendingCoins = 0;
        this._coinNotifyTimer = 1.1;
      }
    },

    notifyRepair: function (amount) {
      var b = AG.BOOSTS.heal;
      this.ui.notify('HULL REPAIRED +' + Math.round(amount), {
        icon: b.icon, glyph: b.glyph, color: b.color
      });
    },

    notifyUpgrade: function (key) {
      var b = AG.BOOSTS[key];
      if (!b) return;
      this.ui.notify(b.name.toUpperCase() + ' ACQUIRED', {
        icon: b.icon, glyph: b.glyph, color: b.color
      });
    },

    buy: function (id) {
      var item = null;
      AG.SHOP_ITEMS.forEach(function (i) { if (i.id === id) item = i; });
      if (!item || !item.available) return false;
      var curKey = item.currency || 'credit';
      var have = curKey === 'gem' ? this.gems : this.credits;
      if (have < item.cost) return false;
      if (curKey === 'gem') this.gems -= item.cost;
      else this.credits -= item.cost;

      if (id === 'hull_repair' && this.player) {
        var before = this.player.health;
        this.player.health = Math.min(this.player.maxHealth, before + AG.BOOSTS.heal.amount);
        this.notifyRepair(this.player.health - before);
      } else if (id === 'boost_rapid' && this.player) {
        this.player.applyBoost('rapidFire');
        this.notifyUpgrade('rapidFire');
      } else {
        this.ui.notify(item.name.toUpperCase() + ' UNLOCKED', { color: AG.CURRENCIES.gem.color });
      }
      return true;
    },

    onEnemyKilled: function (enemy) {
      this.score += enemy.score;
      this.addCredits(Math.max(1, Math.round(enemy.score / 4)));
      this.addXp(enemy.type.boss ? C.leveling.xpPerBoss : C.leveling.xpPerKill);
      if (enemy.type.boss) {
        this.gems += 1;
        var gem = AG.CURRENCIES.gem;
        this.ui.notify('+1 STAR GEM', { icon: gem.icon, glyph: gem.glyph, color: gem.color });
      }
      this.kills++;
      this.shake = Math.max(this.shake, enemy.type.boss ? 12 : 3);
      this.sparks(enemy.cx, enemy.cy, enemy.type.color, enemy.type.boss ? 46 : 14, enemy.type.boss ? 260 : 150);
      if (enemy.type.boss) this.shake = 16;

      if (Math.random() < C.drops.chance) {
        var keys = Object.keys(AG.BOOSTS);
        this.powerups.push(new AG.PowerUp(enemy.cx - 11, enemy.cy - 11, keys[Math.floor(Math.random() * keys.length)]));
      }
    },

    gameOver: function () {
      if (this.state === 'gameover') return;
      this.state = 'gameover';
      this.ui.setHudVisible(false);
      this.ui.setRunControlsVisible(false);
      this.ui.setShopEnabled(true);
      this.ui.showStats('gameover-stats', this);
      this.ui.showScreen('gameover');
      this.shake = 18;
    },

    victory: function () {
      this.state = 'victory';
      this.ui.setHudVisible(false);
      this.ui.setRunControlsVisible(false);
      this.ui.setShopEnabled(true);
      this.ui.showStats('victory-stats', this);
      this.ui.showScreen('victory');
    },

    toMenu: function () {
      this.state = 'menu';
      this.input.holding = false;
      this.enemies = [];
      this.bullets = [];
      this.enemyBullets = [];
      this.powerups = [];
      this.particles = [];
      this.player = null;
      this.ui.setHudVisible(false);
      this.ui.setRunControlsVisible(false);
      this.ui.setShopEnabled(true);
      this.ui.showScreen('menu');
    },

    togglePause: function () {
      if (this.state === 'playing' || this.state === 'waveclear') {
        this.prevState = this.state;
        this.state = 'paused';
        this.input.holding = false;
        this.ui.showScreen('paused');
      } else if (this.state === 'paused') {
        this.state = this.prevState;
        this.ui.hideOverlay();
      } else if (this.state === 'shop') {
        this.leaveShop();
      } else if (this.state === 'roundShop') {
        this.ui.closeRoundShop();
        this.state = this.prevState === 'playing' ? 'playing' : 'waveclear';
      }
    },

    leaveShop: function () {
      var back = this.shopReturnState || 'menu';
      this.state = back;
      if (back === 'menu' || back === 'gameover' || back === 'victory') {
        this.ui.showScreen(back);
        this.ui.setHudVisible(false);
        this.ui.setRunControlsVisible(false);
        this.ui.setShopEnabled(true);
      } else {
        this.ui.hideOverlay();
        this.ui.setHudVisible(true);
        this.ui.setRunControlsVisible(true);
        this.ui.setShopEnabled(false);
      }
    },

    /* ---------- effects ---------- */
    sparks: function (x, y, color, count, speed) {
      for (var i = 0; i < count; i++) {
        this.particles.push(new AG.Particle(x, y, color, speed, 3, 0.35 + Math.random() * 0.45));
      }
    },

    /* ---------- input ---------- */
    _bindInput: function () {
      var self = this;
      var keyMap = {
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right',
        ArrowUp: 'up', KeyW: 'up',
        ArrowDown: 'down', KeyS: 'down'
      };
      window.addEventListener('keydown', function (e) {
        var dir = keyMap[e.code];
        if (dir) {
          self.input[dir] = true;
          e.preventDefault();
        } else if (e.code === 'Enter') {
          if (self.state === 'menu' || self.state === 'gameover' || self.state === 'victory') {
            self.newRun();
          }
          e.preventDefault();
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
          self.togglePause();
          e.preventDefault();
        } else if (e.code === 'KeyR' && (self.state === 'gameover' || self.state === 'victory')) {
          self.newRun();
        }
      });
      window.addEventListener('keyup', function (e) {
        var dir = keyMap[e.code];
        if (dir) self.input[dir] = false;
      });

      var canvas = this.canvas;
      var updatePointer = function (e) {
        var rect = canvas.getBoundingClientRect();
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        self.input.pointerX = (clientX - rect.left) * (C.canvasWidth / rect.width);
        self.input.pointerActive = true;
      };
      canvas.addEventListener('pointermove', updatePointer);
      canvas.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        updatePointer(e);
        self.input.holding = true;
        e.preventDefault();
      });
      window.addEventListener('pointerup', function () { self.input.holding = false; });
      window.addEventListener('pointercancel', function () { self.input.holding = false; });
      window.addEventListener('blur', function () { self.input.holding = false; });
      canvas.addEventListener('touchmove', function (e) { updatePointer(e); e.preventDefault(); }, { passive: false });
    },

    _bindButtons: function () {
      var self = this;
      var bind = function (id, fn) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
      };
      bind('btn-start', function () { self.newRun(); });
      bind('btn-retry', function () { self.newRun(); });
      bind('btn-play-again', function () { self.newRun(); });
      bind('btn-resume', function () { self.togglePause(); });
      bind('btn-quit', function () { self.toMenu(); });
      bind('btn-shop', function () {
        if (self.state === 'playing' || self.state === 'waveclear' || self.state === 'paused') return;
        self.shopReturnState = self.state;
        self.prevState = self.state;
        self.state = 'shop';
        self.input.holding = false;
        var backScreen = self.shopReturnState === 'gameover' ? 'screen-gameover'
          : self.shopReturnState === 'victory' ? 'screen-victory' : 'screen-menu';
        self.ui.openShop(backScreen, self.shopReturnState);
      });
      bind('btn-shop-close', function () { self.leaveShop(); });
      bind('btn-skip-wave', function () { self.skipWave(); });
      bind('btn-auto-skip', function () { self.toggleAutoSkip(); });
      bind('btn-round-shop', function () {
        if (self.level < C.leveling.shopUnlock) return;
        if (self.state !== 'playing' && self.state !== 'waveclear') return;
        self.prevState = self.state;
        self.state = 'roundShop';
        self.input.holding = false;
        self.ui.openRoundShop();
      });
      bind('btn-round-shop-close', function () {
        self.state = self.prevState === 'playing' ? 'playing' : 'waveclear';
        self.ui.closeRoundShop();
      });
    },

    _makeStars: function () {
      for (var i = 0; i < C.starCount; i++) {
        this.stars.push({
          x: Math.random() * C.canvasWidth,
          y: Math.random() * C.canvasHeight,
          size: Math.random() * 1.8 + 0.4,
          speed: Math.random() * 42 + 12,
          alpha: Math.random() * 0.6 + 0.2
        });
      }
    },

    /* ---------- loop ---------- */
    loop: function (now) {
      var dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      if (!isFinite(dt) || dt < 0) dt = 0;
      dt = Math.min(dt, 0.033);
      this.time += dt;
      this.update(dt);
      this.render();
      requestAnimationFrame(this.loop);
    },

    update: function (dt) {
      var i, j;
      var active = this.state === 'playing' || this.state === 'waveclear';
      // Shop/Hangar stay locked while a wave is active.
      this.ui.setRunControlsVisible(active);
      this.ui.setShopEnabled(!active);
      this.ui.setSkipEnabled(this.state === 'playing' && !this.isBossWave());
      this.ui.setAutoSkipEnabled(!this.isBossWave());

      // stars and particles keep moving on menus for a living backdrop
      for (i = 0; i < this.stars.length; i++) {
        var s = this.stars[i];
        s.y += s.speed * dt;
        if (s.y > C.canvasHeight) { s.y = -2; s.x = Math.random() * C.canvasWidth; }
      }
      this.shake = Math.max(0, this.shake - dt * C.screenShakeDecay);

      this.particles = this.particles.filter(function (p) {
        p.update(dt); return p.active;
      });

      this.flushCoins(dt);
      if (!active) return;

      this.player.update(dt, this.input, this);
      this.waves.update(dt);

      if (this.autoSkip && this.state === 'playing' && !this.isBossWave() &&
          this.waves.total > 0 &&
          this.waves.spawned / this.waves.total >= C.wave.autoSkipAt) {
        this.skipWave();
      }

      for (i = 0; i < this.enemies.length; i++) this.enemies[i].update(dt, this);
      for (i = 0; i < this.bullets.length; i++) this.bullets[i].update(dt);
      for (i = 0; i < this.enemyBullets.length; i++) this.enemyBullets[i].update(dt);
      for (i = 0; i < this.powerups.length; i++) this.powerups[i].update(dt);

      // player bullets -> enemies
      for (i = 0; i < this.bullets.length; i++) {
        var b = this.bullets[i];
        if (!b.active) continue;
        for (j = 0; j < this.enemies.length; j++) {
          var e = this.enemies[j];
          if (!e.active || !b.hits(e)) continue;
          b.active = false;
          var dead = e.damage(b.damage);
          this.sparks(e.cx, e.cy, e.type.color, dead ? 14 : 4, dead ? 150 : 70);
          if (dead) this.onEnemyKilled(e);
          break;
        }
      }

      // enemy bullets -> player
      for (i = 0; i < this.enemyBullets.length; i++) {
        var eb = this.enemyBullets[i];
        if (!eb.active || !eb.hits(this.player)) continue;
        eb.active = false;
        var blocked = this.player.hasBoost('shield') || this.player.invulnerable > 0;
        if (this.player.hit(eb.damage)) {
          this.sparks(this.player.cx, this.player.cy, '#ff5d7a', 16, 150);
          this.shake = Math.max(this.shake, 7);
        } else if (blocked) {
          this.sparks(this.player.cx, this.player.cy, AG.BOOSTS.shield.color, 6, 90);
        }
      }

      // enemies ramming the player
      for (i = 0; i < this.enemies.length; i++) {
        var r = this.enemies[i];
        if (!r.active || !r.hits(this.player)) continue;
        r.active = false;
        this.sparks(r.cx, r.cy, r.type.color, r.type.boss ? 40 : 16, 170);
        if (this.player.hit(r.type.boss ? 32 : 18)) this.shake = Math.max(this.shake, 10);
      }

      // pickups
      for (i = 0; i < this.powerups.length; i++) {
        var pu = this.powerups[i];
        if (!pu.active || !pu.hits(this.player)) continue;
        pu.active = false;
        var healed = this.player.applyBoost(pu.boostKey);
        this.sparks(pu.cx, pu.cy, AG.BOOSTS[pu.boostKey].color, 12, 110);
        if (pu.boostKey === 'heal' && healed > 0) this.notifyRepair(healed);
        else this.notifyUpgrade(pu.boostKey);
      }

      var isActive = function (o) { return o.active; };
      this.bullets = this.bullets.filter(isActive);
      this.enemyBullets = this.enemyBullets.filter(isActive);
      this.enemies = this.enemies.filter(isActive);
      this.powerups = this.powerups.filter(isActive);

      if (this.state === 'waveclear') {
        this.breakTimer -= dt;
        if (this.breakTimer <= 0) this.startWave(this.wave + 1);
      }

      if (this.player.health <= 0) this.gameOver();
      this.ui.update(dt);
    },

    render: function () {
      var ctx = this.ctx;
      ctx.clearRect(0, 0, C.canvasWidth, C.canvasHeight);
      ctx.fillStyle = this.bgGradient;
      ctx.fillRect(0, 0, C.canvasWidth, C.canvasHeight);

      for (var i = 0; i < this.stars.length; i++) {
        var s = this.stars[i];
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = '#cfe8ff';
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      ctx.save();
      if (this.shake > 0.1) {
        ctx.translate((Math.random() - 0.5) * this.shake * 2, (Math.random() - 0.5) * this.shake * 2);
      }

      for (i = 0; i < this.powerups.length; i++) this.powerups[i].draw(ctx);
      for (i = 0; i < this.enemies.length; i++) this.enemies[i].draw(ctx);
      for (i = 0; i < this.bullets.length; i++) this.bullets[i].draw(ctx);
      for (i = 0; i < this.enemyBullets.length; i++) this.enemyBullets[i].draw(ctx);
      if (this.player) this.player.draw(ctx);
      for (i = 0; i < this.particles.length; i++) this.particles[i].draw(ctx);
      ctx.restore();

      if (this.state === 'playing' || this.state === 'waveclear') {
        var p = this.waves.completion;
        ctx.fillStyle = 'rgba(110,240,255,.12)';
        ctx.fillRect(0, C.canvasHeight - 3, C.canvasWidth, 3);
        ctx.fillStyle = 'rgba(110,240,255,.75)';
        ctx.fillRect(0, C.canvasHeight - 3, C.canvasWidth * p, 3);
      }
    }
  };
})(window);
