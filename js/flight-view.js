(() => {
  'use strict';

  const AG = window.AG;
  const { WIDTH, HEIGHT, ENEMIES, BOOSTS } = AG;

  function polygon(ctx, points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fill();
  }

  function disc(ctx, x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  class FlightView {
    constructor(canvas) {
      this.ctx = canvas.getContext('2d');
      this.effects = [];
      this.time = 0;
      this.images = {};
      this.stars = Array.from({ length: 125 }, (_, index) => ({
        x: (index * 149.713) % WIDTH,
        y: (index * 227.63) % HEIGHT,
        depth: index % 3 + 1
      }));
      const sets = { spaceships: Object.keys(AG.SHIPS), enemies: Object.keys(ENEMIES),
        boosts: Object.values(BOOSTS).map(boost => boost.file) };
      for (const [folder, names] of Object.entries(sets)) {
        for (const name of names) {
          const image = new Image();
          image.src = 'icons/' + folder + '/' + name + '.png';
          this.images[folder + '/' + name] = image;
        }
      }
      this.backdrop = this.createBackdrop();
    }

    createBackdrop() {
      const background = document.createElement('canvas');
      background.width = WIDTH;
      background.height = HEIGHT;
      const ctx = background.getContext('2d');
      const sky = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      sky.addColorStop(0, '#08151b');
      sky.addColorStop(0.54, '#112e31');
      sky.addColorStop(1, '#050e17');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const glow = ctx.createRadialGradient(675, 375, 26, 675, 375, 365);
      glow.addColorStop(0, '#5e947350');
      glow.addColorStop(1, '#5e947300');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = '#56827b35';
      for (let ring = 0; ring < 4; ring++) {
        ctx.beginPath();
        ctx.ellipse(705, 354, 139 + ring * 45, 102 + ring * 19, -0.56, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(705, 354, 127, 0, Math.PI * 2);
      ctx.clip();
      const planet = ctx.createLinearGradient(590, 245, 760, 449);
      planet.addColorStop(0, '#8ca889');
      planet.addColorStop(0.28, '#426e61');
      planet.addColorStop(0.61, '#142e32');
      planet.addColorStop(1, '#091c24');
      ctx.fillStyle = planet;
      ctx.fillRect(578, 227, 254, 254);
      ctx.strokeStyle = '#96c0a325';
      for (let line = 0; line < 16; line++) {
        ctx.beginPath();
        ctx.ellipse(706, 254 + line * 15, 136, 50, -0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#8ab99c75';
      ctx.beginPath();
      ctx.arc(705, 354, 127, 3.18, 5.65);
      ctx.stroke();
      return background;
    }

    sprite(key, size) {
      const image = this.images[key];
      if (!image?.complete || !image.naturalWidth) return false;
      this.ctx.drawImage(image, -size, -size, size * 2, size * 2);
      return true;
    }

    ship(x, y, color, scale, id) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      if (!this.sprite('spaceships/' + id, 27)) {
        const flame = 29 + Math.sin(this.time * 23) * 5;
        polygon(ctx, [[-7, 12], [0, flame], [7, 12]], '#6be8c6');
        polygon(ctx, [[-4, 14], [0, flame - 9], [4, 14]], '#ecffee');
        polygon(ctx, [[0, -26], [11, -2], [24, 17], [11, 15], [0, 10], [-11, 15], [-24, 17], [-11, -2]], '#314c4e');
        polygon(ctx, [[0, -26], [8, -5], [8, 13], [0, 19], [-8, 13], [-8, -5]], '#e7eee2');
        polygon(ctx, [[-20, 12], [-9, -1], [-10, 11], [-14, 15]], color);
        polygon(ctx, [[20, 12], [9, -1], [10, 11], [14, 15]], color);
        polygon(ctx, [[0, -15], [4, -5], [0, 4], [-4, -5]], '#19373e');
      }
      ctx.restore();
    }

    enemy(enemy) {
      const ctx = this.ctx;
      const { type, size } = enemy;
      const color = enemy.flash > 0 ? '#fffaf3' : ENEMIES[type].color;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      if (!this.sprite('enemies/' + type, size * 1.18)) {
        ctx.scale(size / 20, size / 20);
        const hulls = {
          grunt: [[-19, -5], [-11, -14], [11, -14], [19, -5], [13, 9], [0, 16], [-13, 9]],
          diver: [[-20, -17], [0, -9], [20, -17], [11, 4], [0, 19], [-11, 4]],
          shooter: [[-19, -5], [-9, -17], [9, -17], [19, -5], [16, 12], [0, 16], [-16, 12]],
          tank: [[-20, -9], [-10, -16], [10, -16], [20, -9], [20, 9], [9, 16], [-9, 16], [-20, 9]],
          boss: [[-22, -2], [-15, -11], [-3, -9], [0, -16], [3, -9], [15, -11], [22, -2], [18, 10], [9, 7], [0, 14], [-9, 7], [-18, 10]]
        };
        polygon(ctx, hulls[type], color);
        polygon(ctx, [[-13, -4], [0, -10], [13, -4], [0, 11]], '#29323f');
        disc(ctx, 0, 0, type === 'boss' ? 4.5 : 3.5, color);
        if (type === 'boss') {
          disc(ctx, -15, 0, 2.3, '#fff4cf');
          disc(ctx, 15, 0, 2.3, '#fff4cf');
        }
      }
      ctx.restore();
    }

    burst(enemy) {
      const count = enemy.type === 'boss' ? 40 : 10;
      for (let index = 0; index < count; index++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 38 + Math.random() * 160;
        this.effects.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed, life: 0.25 + Math.random() * 0.45, color: ENEMIES[enemy.type].color });
      }
    }

    draw(game, dt) {
      const ctx = this.ctx;
      this.time += dt;
      ctx.drawImage(this.backdrop, 0, 0);
      for (const star of this.stars) {
        const y = (star.y + this.time * 11 * star.depth) % HEIGHT;
        ctx.fillStyle = ['#bfd9d14a', '#b8ead272', '#d6e9cda1'][star.depth - 1];
        ctx.fillRect(star.x, y, star.depth * 0.66, star.depth * 1.14);
      }
      const run = game.run;
      if (!run || game.state === 'home') {
        const drift = Math.sin(this.time * 1.25) * 11;
        this.ship(685, 321 + drift, '#d5fa74', 2.8, game.profile.ship);
        return;
      }
      for (const shot of run.shots) {
        ctx.fillStyle = '#cafa90';
        ctx.fillRect(shot.x - 2, shot.y - 10, 4, 19);
        ctx.fillStyle = '#f5ffdd';
        ctx.fillRect(shot.x - 1, shot.y - 11, 2, 12);
      }
      for (const shot of run.hostile) {
        disc(ctx, shot.x, shot.y, 7, '#e1516355');
        disc(ctx, shot.x, shot.y, 4, '#ffa280');
      }
      for (const enemy of run.enemies) this.enemy(enemy);
      for (const drop of run.drops) {
        const item = BOOSTS[drop.type] ?? AG.UPGRADES[drop.type];
        ctx.save();
        ctx.translate(drop.x, drop.y);
        if (!item.file || !this.sprite('boosts/' + item.file, 16)) {
          const shape = item.slot ? [[-10, -15], [10, -15], [17, 0], [10, 15], [-10, 15], [-17, 0]] :
            [[0, -15], [15, 0], [0, 15], [-15, 0]];
          polygon(ctx, shape, item.color);
          ctx.font = 'bold 15px system-ui';
          ctx.fillStyle = '#101a20';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.glyph, 0, 0);
        }
        ctx.restore();
      }
      const { player } = run;
      if (run.boosts.shield) {
        ctx.strokeStyle = '#8be8fb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 29, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (player.hp > 0 && (player.invulnerable <= 0 || Math.floor(player.invulnerable * 12) % 2 === 0)) {
        this.ship(player.x, player.y, run.ship.color, 0.84, game.profile.ship);
      }
      this.effects = this.effects.filter(particle => {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        ctx.globalAlpha = Math.max(0, particle.life);
        disc(ctx, particle.x, particle.y, 2.7, particle.color);
        ctx.globalAlpha = 1;
        return particle.life > 0;
      });
    }
  }

  class FlightAudio {
    unlock() {
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        this.context ??= new Audio();
        this.context.resume().catch(() => {});
      } catch {}
    }

    play(type) {
      const context = this.context;
      const tones = {
        fire: [410, 190, 0.085, 0.035], hit: [106, 50, 0.23, 0.095],
        destroy: [165, 46, 0.17, 0.06], upgrade: [370, 650, 0.21, 0.085]
      };
      if (context?.state !== 'running' || !tones[type]) return;
      const [start, end, duration, volume] = tones[type];
      const now = context.currentTime;
      const voice = context.createOscillator();
      const gain = context.createGain();
      voice.type = type === 'hit' || type === 'destroy' ? 'triangle' : 'sine';
      voice.frequency.setValueAtTime(start, now);
      voice.frequency.exponentialRampToValueAtTime(end, now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      voice.connect(gain).connect(context.destination);
      voice.start(now);
      voice.stop(now + duration);
    }
  }

  Object.assign(AG, { FlightView, FlightAudio });
})();
