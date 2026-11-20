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

    this.input = {
      left: false, right: false, up: false, down: false,
      shooting: false, pointerActive: false, usePointer: false,
      pointerX: 0, pointerY: 0
    };

    this.state = 'menu';
    this.prevState = 'menu';
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.particles = [];
    this.stars = [];

    this.score = 0;
    this.credits = 0;
    this.kills = 0;
    this.wave = 0;
    this.time = 0;
    this.shake = 0;
    this.breakTimer = 0;
    this.lastTime = 0;
    this.loop = this.loop.bind(this);

    this._makeStars();
    this._bindInput();
    this._bindButtons();

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
      this.kills = 0;
      this.wave = 0;
      this.shake = 0;
      this.enemies = [];
      this.bullets = [];
      this.enemyBullets = [];
      this.powerups = [];
      this.particles = [];
      this.player = new AG.Player(AG.SPACESHIPS[0]);
      this.waves.reset();
      this.ui.hideOverlay();
      this.ui.setHudVisible(true);
      this.state = 'playing';
      this.startWave(1);
    },

    startWave: function (n) {
      this.wave = n;
      this.waves.start(n);
      this.state = 'playing';
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
      this.credits += bonus;
      if (this.player) {
        this.player.health = Math.min(this.player.maxHealth, this.player.health + C.wave.interWaveHeal);
      }
      this.state = 'waveclear';
      this.breakTimer = C.wave.breakTime;
      this.ui.showBanner('WAVE ' + wave + ' CLEAR', '+' + bonus + ' CREDITS · HULL REPAIRED', false, 2.2);
    },

    onEnemyKilled: function (enemy) {
      this.score += enemy.score;
      this.credits += Math.max(1, Math.round(enemy.score / 4));
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
      this.ui.showStats('gameover-stats', this);
      this.ui.showScreen('gameover');
      this.shake = 18;
    },

    victory: function () {
      this.state = 'victory';
      this.ui.setHudVisible(false);
      this.ui.showStats('victory-stats', this);
      this.ui.showScreen('victory');
    },

    toMenu: function () {
      this.state = 'menu';
      this.enemies = [];
      this.bullets = [];
      this.enemyBullets = [];
      this.powerups = [];
      this.particles = [];
      this.player = null;
      this.ui.setHudVisible(false);
      this.ui.showScreen('menu');
    },

    togglePause: function () {
      if (this.state === 'playing' || this.state === 'waveclear') {
        this.prevState = this.state;
        this.state = 'paused';
        this.ui.showScreen('paused');
      } else if (this.state === 'paused') {
        this.state = this.prevState;
        this.ui.hideOverlay();
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
          self.input.usePointer = false;
          e.preventDefault();
        } else if (e.code === 'Space') {
          self.input.shooting = true;
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
        if (e.code === 'Space') self.input.shooting = false;
      });

      var canvas = this.canvas;
      var updatePointer = function (e) {
        var rect = canvas.getBoundingClientRect();
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        var clientY = e.touches ? e.touches[0].clientY : e.clientY;
        self.input.pointerX = (clientX - rect.left) * (C.canvasWidth / rect.width);
        self.input.pointerY = (clientY - rect.top) * (C.canvasHeight / rect.height);
        self.input.pointerActive = true;
        self.input.usePointer = true;
      };
      canvas.addEventListener('pointermove', updatePointer);
      canvas.addEventListener('pointerdown', function (e) { updatePointer(e); self.input.shooting = true; });
      window.addEventListener('pointerup', function () { self.input.shooting = false; });
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
        self.prevState = self.state;
        self.state = 'shop';
        self.ui.openShop('screen-menu');
      });
      bind('btn-shop-close', function () {
        self.state = 'menu';
        self.ui.closeShop();
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

      if (!active) return;

      this.player.update(dt, this.input, this);
      this.waves.update(dt);

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
        this.player.applyBoost(pu.boostKey);
        this.sparks(pu.cx, pu.cy, AG.BOOSTS[pu.boostKey].color, 12, 110);
        this.ui.showBanner(AG.BOOSTS[pu.boostKey].name.toUpperCase(), 'BOOST ACQUIRED', false, 1.1);
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

      // starfield
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

      // wave progress rail
      if (this.state === 'playing' || this.state === 'waveclear') {
        var p = this.waves.progress;
        ctx.fillStyle = 'rgba(110,240,255,.12)';
        ctx.fillRect(0, C.canvasHeight - 3, C.canvasWidth, 3);
        ctx.fillStyle = 'rgba(110,240,255,.75)';
        ctx.fillRect(0, C.canvasHeight - 3, C.canvasWidth * p, 3);
      }
    }
  };
})(window);
