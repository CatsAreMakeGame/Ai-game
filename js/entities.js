/* ============================================================
   entities.js — player, enemies, projectiles, pickups, particles.
   Every entity is self-contained: give it state, it updates and draws
   itself. New enemy types / ships are added in data.js, not here.
   ============================================================ */
(function (global) {
  'use strict';
  var AG = (global.AG = global.AG || {});
  var C = AG.CONFIG;

  /* ---------- base ---------- */
  function Entity(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.active = true;
  }
  Object.defineProperty(Entity.prototype, 'cx', { get: function () { return this.x + this.w / 2; } });
  Object.defineProperty(Entity.prototype, 'cy', { get: function () { return this.y + this.h / 2; } });
  Entity.prototype.hits = function (o) {
    return Math.abs(this.cx - o.cx) < (this.w + o.w) / 2 &&
           Math.abs(this.cy - o.cy) < (this.h + o.h) / 2;
  };
  AG.Entity = Entity;

  /* ---------- projectile ---------- */
  AG.Bullet = function (x, y, team, damage, speed) {
    var enemy = team === 'enemy';
    Entity.call(this, x, y,
      enemy ? C.bullet.enemyWidth : C.bullet.width,
      enemy ? C.bullet.enemyHeight : C.bullet.height);
    this.team = team;
    this.damage = damage;
    this.vy = enemy ? speed : -speed;
    this.color = enemy ? '#ff5d7a' : '#8ef6ff';
  };
  AG.Bullet.prototype = Object.create(Entity.prototype);
  AG.Bullet.prototype.constructor = AG.Bullet;
  AG.Bullet.prototype.update = function (dt) {
    this.y += this.vy * dt;
    if (this.y < -40 || this.y > C.canvasHeight + 40) this.active = false;
  };
  AG.Bullet.prototype.draw = function (ctx) {
    /* Bullets are effects, not icon-driven objects — always procedural. */
    AG.Art.drawShape(ctx, 'bullet', this.x, this.y, this.w, this.h, this.color, 0, this.team);
  };

  /* ---------- enemy ---------- */
  AG.Enemy = function (typeKey, x, y, wave, diff) {
    var t = AG.ENEMY_TYPES[typeKey];
    Entity.call(this, x, y, t.w, t.h);
    this.typeKey = typeKey;
    this.type = t;
    this.baseX = x;
    this.phase = Math.random() * Math.PI * 2;
    this.age = 0;
    this.maxHealth = t.boss
      ? Math.round(28 + wave * 3.2)
      : Math.max(1, Math.round(t.health * diff.healthScale));
    this.health = this.maxHealth;
    this.vy = diff.speedScale * t.speedMul;
    this.score = t.score;
    this.fireDelay = diff.fireDelay;
    this.fireTimer = diff.fireDelay * (0.5 + Math.random() * 0.8);
    this.canFire = !!t.fires;
    this.hitFlash = 0;
  };
  AG.Enemy.prototype = Object.create(Entity.prototype);
  AG.Enemy.prototype.constructor = AG.Enemy;

  AG.Enemy.prototype.update = function (dt, game) {
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 5);

    if (this.type.sine) {
      this.x = this.baseX + Math.sin(this.age * 2.3 + this.phase) * 72;
    } else if (this.type.boss) {
      this.x = this.baseX + Math.sin(this.age * 0.75 + this.phase) * 110;
    }
    this.x = Math.max(8, Math.min(C.canvasWidth - this.w - 8, this.x));
    this.y += this.vy * dt;

    if (this.canFire && this.y > 16 && this.y < C.canvasHeight * 0.74) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = this.fireDelay * (0.7 + Math.random() * 0.6);
        var shots = this.type.boss ? 3 : 1;
        for (var i = 0; i < shots; i++) {
          game.enemyBullets.push(new AG.Bullet(
            this.cx - C.bullet.enemyWidth / 2, this.cy,
            'enemy', C.bullet.enemyDamage, C.bullet.enemySpeed
          ));
        }
      }
    }

    if (this.y > C.canvasHeight + 60) this.active = false;
  };

  AG.Enemy.prototype.damage = function (amount) {
    this.health -= amount;
    this.hitFlash = 1;
    if (this.health <= 0) {
      this.active = false;
      return true;
    }
    return false;
  };

  AG.Enemy.prototype.draw = function (ctx) {
    var self = this;
    var t = this.type;
    AG.assets.draw(t.icon, ctx, this.x, this.y, this.w, this.h, function (c, x, y, w, h) {
      AG.Art.drawShape(c, t.shape, x, y, w, h, t.color, self.age);
    });
    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.hitFlash * 0.65;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.restore();
    }
    // health pip for tougher enemies
    if (!t.boss && this.maxHealth > 2) {
      var ratio = Math.max(0, this.health / this.maxHealth);
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(this.x, this.y - 7, this.w, 3);
      ctx.fillStyle = '#8dff6a';
      ctx.fillRect(this.x, this.y - 7, this.w * ratio, 3);
    }
  };

  /* ---------- player ---------- */
  AG.Player = function (ship) {
    ship = ship || AG.SPACESHIPS[0];
    Entity.call(this,
      C.canvasWidth / 2 - C.player.width / 2,
      C.canvasHeight - 90,
      C.player.width, C.player.height);
    this.ship = ship;
    this.maxHealth = C.player.maxHealth;
    this.health = this.maxHealth;
    this.fireTimer = 0;
    this.invulnerable = 0;
    this.age = 0;
    this.boosts = Object.create(null);
  };
  AG.Player.prototype = Object.create(Entity.prototype);
  AG.Player.prototype.constructor = AG.Player;

  AG.Player.prototype.hasBoost = function (key) { return (this.boosts[key] || 0) > 0; };

  AG.Player.prototype.applyBoost = function (key) {
    var b = AG.BOOSTS[key];
    if (!b) return;
    if (b.duration > 0) {
      this.boosts[key] = Math.max(this.boosts[key] || 0, b.duration);
    }
    if (key === 'heal') {
      this.health = Math.min(this.maxHealth, this.health + b.amount);
    }
  };

  AG.Player.prototype.update = function (dt, input, game) {
    var p = C.player;
    this.age += dt;
    var dx = 0, dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;

    if (dx || dy) {
      input.usePointer = false;
      var len = Math.sqrt(dx * dx + dy * dy);
      this.x += (dx / len) * p.speed * dt;
      this.y += (dy / len) * p.speed * dt;
    } else if (input.usePointer && input.pointerActive) {
      var tx = input.pointerX - this.w / 2;
      var ty = input.pointerY - this.h / 2;
      var ease = Math.min(1, dt * 13);
      this.x += (tx - this.x) * ease;
      this.y += (ty - this.y) * ease;
    }

    this.x = Math.max(6, Math.min(C.canvasWidth - this.w - 6, this.x));
    this.y = Math.max(C.canvasHeight * 0.42, Math.min(C.canvasHeight - this.h - 10, this.y));

    this.invulnerable = Math.max(0, this.invulnerable - dt);
    Object.keys(this.boosts).forEach(function (key) {
      this.boosts[key] = Math.max(0, this.boosts[key] - dt);
    }, this);

    // Automatic fire. 'shooting' input is kept for future manual-fire modes.
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fire(game);
      var mul = this.hasBoost('rapidFire') ? AG.BOOSTS.rapidFire.fireDelayMul : 1;
      this.fireTimer = p.fireDelay * mul;
    }
  };

  AG.Player.prototype.fire = function (game) {
    var damage = AG.playerDamageFor(game.wave);
    if (this.hasBoost('doubleDamage')) damage *= AG.BOOSTS.doubleDamage.damageMul;
    game.bullets.push(new AG.Bullet(
      this.cx - C.bullet.width / 2, this.y - 4,
      'player', damage, C.player.bulletSpeed
    ));
  };

  AG.Player.prototype.hit = function (amount) {
    if (this.invulnerable > 0 || this.hasBoost('shield')) return false;
    this.health -= amount;
    this.invulnerable = C.player.hitInvulnerability;
    if (this.health < 0) this.health = 0;
    return true;
  };

  AG.Player.prototype.draw = function (ctx) {
    var self = this;
    var saved = false;
    if (this.invulnerable > 0 && Math.floor(this.invulnerable * 18) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      saved = true;
    }
    AG.assets.draw(this.ship.icon, ctx, this.x, this.y, this.w, this.h, function (c, x, y, w, h) {
      AG.Art.drawShape(c, 'ship', x, y, w, h, '#6ef0ff', self.age || 0);
    });
    if (this.hasBoost('shield')) {
      ctx.save();
      ctx.strokeStyle = AG.BOOSTS.shield.color;
      ctx.globalAlpha = 0.55 + Math.sin(Date.now() / 130) * 0.25;
      ctx.shadowColor = AG.BOOSTS.shield.color;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.w * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (saved) ctx.restore();
  };

  /* ---------- pickup ---------- */
  AG.PowerUp = function (x, y, boostKey) {
    Entity.call(this, x, y, 22, 22);
    this.boostKey = boostKey;
    this.vy = 66;
    this.age = 0;
  };
  AG.PowerUp.prototype = Object.create(Entity.prototype);
  AG.PowerUp.prototype.constructor = AG.PowerUp;
  AG.PowerUp.prototype.update = function (dt) {
    this.age += dt;
    this.y += this.vy * dt;
    if (this.age > C.drops.lifetime || this.y > C.canvasHeight + 30) this.active = false;
  };
  AG.PowerUp.prototype.draw = function (ctx) {
    var b = AG.BOOSTS[this.boostKey];
    var self = this;
    AG.assets.draw(b.icon, ctx, this.x - 3, this.y - 3, this.w + 6, this.h + 6, function (c, x, y, w, h) {
      AG.Art.drawShape(c, 'pickup', x, y, w, h, b.color, self.age, b.glyph);
    });
  };

  /* ---------- particle ---------- */
  AG.Particle = function (x, y, color, speed, size, life) {
    this.x = x; this.y = y;
    this.color = color;
    var a = Math.random() * Math.PI * 2;
    var s = speed * (0.35 + Math.random() * 0.65);
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.size = size * (0.5 + Math.random() * 0.8);
    this.life = life;
    this.maxLife = life;
    this.active = true;
  };
  AG.Particle.prototype.update = function (dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.985;
    this.vy *= 0.985;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  };
  AG.Particle.prototype.draw = function (ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.restore();
  };
})(window);
