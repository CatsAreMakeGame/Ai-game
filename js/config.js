/* ============================================================
   config.js — all tunable numbers in one place.
   Nothing here draws or mutates state; it is pure configuration.
   ============================================================ */
(function (global) {
  'use strict';
  var AG = (global.AG = global.AG || {});

  AG.CONFIG = {
    canvasWidth: 900,
    canvasHeight: 640,
    maxWaves: 50,
    starCount: 110,
    screenShakeDecay: 7,

    /* Exponential difficulty curve.
       Each wave n uses pow(growth, n-1) as its tier multiplier.
       Individual systems use their own growth rates and safety caps so the
       game stays winnable while still becoming exponentially harder. */
    difficulty: {
      growth: 1.12,
      count:   { base: 6,  growth: 1.05,  cap: 70 },
      health:  { base: 1,  growth: 1.045, cap: 16 },
      speed:   { base: 42, growth: 1.03,  cap: 205 },
      spawn:   { base: 0.90, growth: 0.965, min: 0.18 },   // seconds between spawns
      fire:    { base: 3.40, growth: 0.955, min: 0.50 }    // enemy fire interval
    },

    player: {
      width: 34, height: 40,
      speed: 315,
      maxHealth: 100,
      fireDelay: 0.155,
      bulletSpeed: 560,
      bulletDamage: 1,
      hitInvulnerability: 1.05,
     /*The pilot's damage grows with the wave so the exponential enemy health
        curve stays fair. Later this can be replaced by an upgrade system. */
      damagePerWaves: 8
    },

    bullet: {
      width: 5, height: 16,
      enemyWidth: 7, enemyHeight: 14,
      enemySpeed: 235,
      enemyDamage: 9
    },

    wave: { breakTime: 2.6, bannerTime: 1.9, interWaveHeal: 8 },
    drops: { chance: 0.11, lifetime: 12 }
  };

  /** Compute all scaling values for a given wave (1-indexed). */
  AG.difficultyFor = function (wave) {
    var d = AG.CONFIG.difficulty;
    var t = Math.max(0, wave - 1);
    var limit = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };

    return {
      tier: Math.pow(d.growth, t),
      enemyCount: Math.min(d.count.cap, Math.ceil(d.count.base * Math.pow(d.count.growth, t))),
      healthScale: limit(d.health.base * Math.pow(d.health.growth, t), 1, d.health.cap),
      speedScale: limit(d.speed.base * Math.pow(d.speed.growth, t), d.speed.base, d.speed.cap),
      spawnDelay: Math.max(d.spawn.min, d.spawn.base * Math.pow(d.spawn.growth, t)),
      fireDelay: Math.max(d.fire.min, d.fire.base * Math.pow(d.fire.growth, t)),
      isBossWave: wave % 10 === 0
    };
  };

  /** Player damage at a given wave — foundation for a future upgrade system. */
  AG.playerDamageFor = function (wave) {
    return AG.CONFIG.player.bulletDamage + Math.floor((wave - 1) / AG.CONFIG.player.damagePerWaves);
  };
})(window);
