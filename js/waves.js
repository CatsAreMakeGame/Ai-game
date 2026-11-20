/* ============================================================
   waves.js — plans, spawns and completes waves.
   Difficulty comes entirely from config.difficultyFor(n), so tuning the
   curve never requires editing this file.
   ============================================================ */
(function (global) {
  'use strict';
  var AG = (global.AG = global.AG || {});
  var C = AG.CONFIG;

  AG.WaveManager = function (game) {
    this.game = game;
    this.reset();
  };

  AG.WaveManager.prototype = {
    reset: function () {
      this.wave = 0;
      this.diff = null;
      this.queue = [];
      this.spawnTimer = 0;
      this.active = false;
      this.spawned = 0;
      this.total = 0;
    },

    start: function (wave) {
      this.wave = wave;
      this.diff = AG.difficultyFor(wave);
      this.queue = [];
      this.spawned = 0;

      var count = this.diff.enemyCount;
      if (this.diff.isBossWave) {
        this.queue.push('boss');
        count = Math.max(0, Math.round(count * 0.45));
      }
      for (var i = 0; i < count; i++) {
        this.queue.push(this._pickEnemy(wave));
      }
      this.total = this.queue.length;
      this.spawnTimer = 0.45;
      this.active = true;
    },

    /* Enemy mix unlocks progressively: grunts -> shooters -> divers -> tanks. */
    _pickEnemy: function (wave) {
      var weights = [
        ['grunt', 5],
        ['shooter', wave >= 3 ? 1.6 + wave * 0.03 : 0],
        ['diver', wave >= 5 ? 1.4 + wave * 0.03 : 0],
        ['tank', wave >= 8 ? 0.7 + wave * 0.025 : 0]
      ];
      var sum = 0, i;
      for (i = 0; i < weights.length; i++) sum += weights[i][1];
      var roll = Math.random() * sum;
      for (i = 0; i < weights.length; i++) {
        roll -= weights[i][1];
        if (roll <= 0) return weights[i][0];
      }
      return 'grunt';
    },

    update: function (dt) {
      if (!this.active) return;
      this.spawnTimer -= dt;

      if (this.queue.length && this.spawnTimer <= 0) {
        var key = this.queue.shift();
        var margin = 46;
        var x = margin + Math.random() * (C.canvasWidth - margin * 2);
        this.game.enemies.push(new AG.Enemy(key, x, -56, this.wave, this.diff));
        this.spawned++;
        this.spawnTimer = this.diff.spawnDelay * (0.75 + Math.random() * 0.5);
      }

      if (!this.queue.length && this.game.enemies.length === 0) {
        this.active = false;
        this.game.onWaveCleared(this.wave);
      }
    },

    get progress() {
      if (!this.total) return 0;
      return Math.min(1, (this.total - this.queue.length) / this.total);
    }
  };
})(window);
