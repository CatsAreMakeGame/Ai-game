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

  const frames = {
    dart: [0,-28, 11,-2, 25,16, 11,12, 0,17,-11,12,-25,16,-11,-2],
    swept: [0,-26, 8,-9, 32,5, 29,-8, 27,19, 9,11, 0,19,-9,11,-27,19,-29,-8,-32,5,-8,-9],
    block: [0,-23, 13,-18, 13,-8, 28,-7, 28,18, 11,15, 0,22,-11,15,-28,18,-28,-7,-13,-8,-13,-18],
    split: [0,-21, 8,-1, 26,-27, 31,-7, 22,20, 10,14, 0,21,-10,14,-22,20,-31,-7,-26,-27,-8,-1],
    crescent: [0,-27, 9,-9, 25,-4, 33,-19, 30,11, 16,17, 0,13,-16,17,-30,11,-33,-19,-25,-4,-9,-9],
    delta: [0,-32, 29,14, 21,22, 0,15,-21,22,-29,14],
    hex: [0,-25, 18,-22, 30,-7, 30,11, 17,22,-17,22,-30,11,-30,-7,-18,-22],
    arrow: [0,-34, 16,-11, 33,14, 14,9, 12,24, 0,17,-12,24,-14,9,-33,14,-16,-11],
    needle: [0,-35, 7,-9, 28,14, 25,23, 8,13, 0,24,-8,13,-25,23,-28,14,-7,-9],
    fang: [0,-22, 13,-10, 33,-20, 27,18, 10,22, 0,12,-10,22,-27,18,-33,-20,-13,-10],
    supernova: [0,-36,9,-25,13,-13,29,-22,34,-4,26,2,32,16,17,22,10,16,0,25,-10,16,-17,22,-32,16,-26,2,-34,-4,-29,-22,-13,-13,-9,-25],
    star: [0,-34, 13,-11, 33,-6, 21,8, 22,25, 0,16,-22,25,-21,8,-33,-6,-13,-11]
  };
  function paintShip(ctx, spec, flame = 26) {
    const outline = frames[spec.frame];
    const points = Array.from({ length: outline.length / 2 }, (_, i) => [outline[i * 2], outline[i * 2 + 1]]);
    for (let i = 0; i < spec.engines; i++) {
      const x = (i - (spec.engines - 1) / 2) * 11;
      polygon(ctx, [[x - 4, 12], [x, flame], [x + 4, 12]], spec.color);
    }
    polygon(ctx, points, '#30495b');
    polygon(ctx, points.map(([x,y]) => [x * .83, y * .87 - 1]), spec.color);
    polygon(ctx, [[0,-24],[8,-2],[7,15],[0,20],[-7,15],[-8,-2]], '#e2f2f6');
    polygon(ctx, [[0,-16],[5,-4],[0,3],[-5,-4]], '#14283c');
    if (spec.alien) {
      disc(ctx, 0, 4, 8, '#263946');
      disc(ctx, 0, 4, 5, '#e0ff91');
      for (const x of [-13, 13]) disc(ctx, x, 3, 3, '#34475c');
    }
    if (spec.ability) {
      disc(ctx, 0, 4, 8, '#593cba');
      disc(ctx, 0, 4, 5, '#f8ddff');
      for (const side of [-1, 1]) {
        polygon(ctx, [[side * 10,-7],[side * 24,-14],[side * 28,-7],[side * 19,1]], '#514097');
      }
    }
  }
  function shipGraphic(id) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    canvas.className = 'ship-graphic';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    ctx.translate(64, 66);
    ctx.scale(1.67, 1.67);
    paintShip(ctx, AG.SHIPS[id]);
    return canvas;
  }

  class FlightView {
    constructor(canvas) {
      this.ctx = canvas.getContext('2d');
      this.effects = [];
      this.damageNumbers = [];
      this.damageOffset = 0;
      this.time = 0;
      this.images = {};
      this.stars = Array.from({ length: 125 }, (_, index) => ({
        x: (index * 149.713) % WIDTH,
        y: (index * 227.63) % HEIGHT,
        depth: index % 3 + 1
      }));
      const sets = { spaceships: Object.keys(AG.SHIPS), enemies: Object.keys(ENEMIES),
        boosts: Object.values(BOOSTS).map(boost => boost.file).filter(Boolean) };
      for (const [folder, names] of Object.entries(sets)) {
        for (const name of names) {
          const image = new Image();
          image.src = 'icons/' + folder + '/' + name + '.png';
          this.images[folder + '/' + name] = image;
        }
      }
      for (const id of Object.keys(AG.ITEMS).filter(id => AG.ITEMS[id].icon || ['credit', 'gem'].includes(id))) {
        const image = new Image();
        image.src = AG.ITEMS[id].icon ?? AG.ITEMS[id].file;
        this.images[id] = image;
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
      if (!this.sprite('spaceships/' + id, 27)) paintShip(ctx, AG.SHIPS[id], 29 + Math.sin(this.time * 23) * 4);
      ctx.restore();
    }

    enemy(enemy) {
      const ctx = this.ctx;
      const { type, size } = enemy;
      const color = enemy.allied ? '#9ff387' : enemy.flash > 0 ? '#fffaf3' : ENEMIES[type].color;
      ctx.save();
      if (enemy.ghostTime > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(.45, enemy.ghostTime);
        disc(ctx, enemy.ghostX, enemy.y, size, '#a8ffe6');
        ctx.restore();
      }
      ctx.translate(enemy.x, enemy.y);
      if ((enemy.formation === 'pair' && !enemy.shieldBroken) || enemy.allied || enemy.coreTime > 0) {
        ctx.strokeStyle = enemy.allied ? '#9ff387' : enemy.coreTime > 0 ? '#ffe99c' : '#6dceff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, size + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (!this.sprite('enemies/' + type, size * 1.18)) {
        ctx.scale(size / 20, size / 20);
        const hulls = {
          grunt: [[-19, -5], [-11, -14], [11, -14], [19, -5], [13, 9], [0, 16], [-13, 9]],
          diver: [[-20, -17], [0, -9], [20, -17], [11, 4], [0, 19], [-11, 4]],
          shooter: [[-19, -5], [-9, -17], [9, -17], [19, -5], [16, 12], [0, 16], [-16, 12]],
          tank: [[-20, -9], [-10, -16], [10, -16], [20, -9], [20, 9], [9, 16], [-9, 16], [-20, 9]],
          prism: [[0,-21],[21,-6],[16,13],[0,7],[-16,13],[-21,-6]],
          dread: [[-23,-11],[-13,-16],[13,-16],[23,-11],[23,12],[13,15],[-13,15],[-23,12]],
          phantom: [[-24,-16],[0,-6],[24,-16],[15,10],[0,20],[-15,10]],
          nexus: [[0,-22],[8,-12],[24,-17],[18,0],[24,12],[0,18],[-24,12],[-18,0],[-24,-17],[-8,-12]],
          boss: [[-22, -2], [-15, -11], [-3, -9], [0, -16], [3, -9], [15, -11], [22, -2], [18, 10], [9, 7], [0, 14], [-9, 7], [-18, 10]]
        };
        polygon(ctx, hulls[type], color);
        polygon(ctx, [[-13, -4], [0, -10], [13, -4], [0, 11]], '#29323f');
        disc(ctx, 0, 0, AG.BOSSES[type] ? 4.5 : 3.5, color);
        if (AG.BOSSES[type]) {
          disc(ctx, -15, 0, 2.3, '#fff4cf');
          disc(ctx, 15, 0, 2.3, '#fff4cf');
        }
      }
      ctx.restore();
      if (AG.BOSSES[type] && enemy.y > 75) {
        ctx.fillStyle = '#131921';
        ctx.fillRect(enemy.x - 32, enemy.y + size + 4, 64, 4);
        ctx.fillStyle = ENEMIES[type].color;
        ctx.fillRect(enemy.x - 32, enemy.y + size + 4, 64 * enemy.hp / enemy.maxHp, 4);
        ctx.save();
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#10131e';
        ctx.fillStyle = '#fff4f4';
        const label = Number(enemy.hp.toFixed(2)) + '/' + enemy.maxHp + ' HP';
        ctx.strokeText(label, enemy.x, enemy.y + size + 10);
        ctx.fillText(label, enemy.x, enemy.y + size + 10);
        ctx.restore();
      }
    }

    addDamageNumber({ x, y, size, amount, source }) {
      const laser = source === 'laser';
      const offset = (this.damageOffset++ % 5 - 2) * 5;
      this.damageNumbers.push({
        x: x + offset, y: Math.max(103, y - size - 3),
        label: amount.toLocaleString(), size: laser ? 23 : 17,
        color: laser ? '#ff5267' : source === 'missile' ? '#ffc185' : '#fff0cf',
        life: laser ? .78 : .64, age: 0
      });
    }

    drawDamageNumbers(dt) {
      const ctx = this.ctx;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#111320';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      this.damageNumbers = this.damageNumbers.filter(number => {
        number.age += dt;
        if (number.age >= number.life) return false;
        ctx.font = 'bold ' + number.size + 'px ui-monospace, monospace';
        const margin = Math.min(64, ctx.measureText(number.label).width / 2) + 5;
        const x = AG.clamp(number.x, margin, WIDTH - margin);
        const y = number.y - 61 * number.age;
        ctx.globalAlpha = Math.min(1, (number.life - number.age) / .2);
        ctx.fillStyle = number.color;
        ctx.strokeText(number.label, x, y, 128);
        ctx.fillText(number.label, x, y, 128);
        return true;
      });
      ctx.restore();
    }

    burst(enemy) {
      const count = AG.BOSSES[enemy.type] ? 40 : 10;
      for (let index = 0; index < count; index++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 38 + Math.random() * 160;
        this.effects.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed, life: 0.25 + Math.random() * 0.45, color: ENEMIES[enemy.type].color });
      }
    }

    blast({ x, y, radius }) {
      for (let i = 0; i < 22; i++) {
        const angle = i * Math.PI * 2 / 22;
        const speed = radius * (1.2 + (i % 4) * .32);
        this.effects.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: .33 + (i % 3) * .12, color: i % 3 ? '#ffb376' : '#fff3cc' });
      }
    }

    missile(shot) {
      const ctx = this.ctx;
      const guided = shot.kind === 'homing';
      const color = guided ? '#72dcff' : '#ffc581';
      ctx.save();
      ctx.translate(shot.x, shot.y);
      ctx.rotate(shot.angle);
      const flicker = 17 + Math.sin(this.time * 52) * 4;
      polygon(ctx, [[-4,-4],[-flicker,0],[-4,4]], color);
      polygon(ctx, [[9,0],[2,-4],[-6,-3],[-6,3],[2,4]], '#f6fbff');
      ctx.restore();
    }

    beacon(game) {
      const ctx = this.ctx;
      const { x, y, ux, uy, reach } = game.laserRay();
      const length = Math.min(reach,
        ux > 0 ? (WIDTH + 24 - x) / ux : ux < 0 ? (-24 - x) / ux : Infinity,
        uy > 0 ? (HEIGHT + 24 - y) / uy : uy < 0 ? (-24 - y) / uy : Infinity);
      const t = this.time;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(uy, ux));
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      function strand(color, width, amplitude, phase) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let distance = 16; distance < length; distance += 16) {
          const noise = Math.sin(distance * .19 + phase + t * 31) * .58 +
            Math.sin(distance * .065 - phase - t * 19) * .42;
          ctx.lineTo(distance, noise * amplitude);
        }
        ctx.lineTo(length, 0);
        ctx.stroke();
      }

      strand('#216aff38', 66, 5, 0);
      strand('#508dff58', 44, 4, 0);
      strand('#72c6ffe0', 21, 3, 0);
      strand('#e8faff', 7, 2, 0);
      strand('#338fff88', 2, 23, 3);
      strand('#78daffb5', 2, 18, 6);
      for (let i = 0; i < 24; i++) {
        const progress = (i * 37 + t * (130 + (i % 4) * 65)) % Math.max(1, length);
        const side = i % 2 ? -1 : 1;
        const width = side * (13 + (i * 3 % 24) + Math.sin(t * 15 + i) * 8);
        ctx.strokeStyle = i % 3 ? '#5eb8ffad' : '#e6faff';
        ctx.lineWidth = i % 3 ? 1 : 2;
        ctx.beginPath();
        ctx.moveTo(progress - 6, width * .68);
        ctx.lineTo(progress, width);
        ctx.lineTo(progress + 8, width * .87);
        ctx.stroke();
      }
      disc(ctx, 0, 0, 13 + Math.sin(t * 33) * 3, '#8fdcff');
      disc(ctx, 0, 0, 5, '#effcff');
      ctx.restore();
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
      for (const shot of run.allyShots) disc(ctx, shot.x, shot.y, 5, '#a8ff71');
      for (const tendril of run.tendrils) {
        ctx.save();
        ctx.strokeStyle = '#7cf766';
        ctx.shadowColor = '#5dfa9e';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(tendril.x, tendril.y);
        ctx.bezierCurveTo(tendril.x - 42, tendril.y - 90, tendril.x + 40, tendril.top + 85, tendril.x, tendril.top);
        ctx.stroke();
        ctx.lineWidth = 3;
        for (const enemy of tendril.captures.keys()) {
          ctx.beginPath();
          ctx.moveTo(tendril.x, enemy.y);
          ctx.lineTo(enemy.x, enemy.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      for (const enemy of run.enemies) this.enemy(enemy);
      if (game.upgradeEffects().missile) {
        const target = game.pickMissileTarget();
        if (target) {
          ctx.save();
          ctx.translate(target.x, target.y);
          ctx.strokeStyle = '#a3ebff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, target.size + 12, 0, Math.PI * 2);
          ctx.stroke();
          this.sprite('seeker', 9);
          ctx.restore();
        }
      }
      for (const drop of run.drops) {
        const item = AG.ITEMS[drop.type];
        ctx.save();
        ctx.translate(drop.x, drop.y);
        if (AG.SHIPS[drop.type]) {
          ctx.scale(.44, .44);
          paintShip(ctx, AG.SHIPS[drop.type]);
        } else if (!this.sprite(drop.type, 16) && !this.sprite('boosts/' + item.file, 16)) {
          const shape = item.slot ? [[-10, -15], [10, -15], [17, 0], [10, 15], [-10, 15], [-17, 0]] :
            [[0, -15], [15, 0], [0, 15], [-15, 0]];
          polygon(ctx, shape, AG.RARITIES[item.rarity ?? 'common']);
          ctx.font = 'bold 15px system-ui';
          ctx.fillStyle = '#101a20';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.glyph, 0, 0);
        }
        ctx.restore();
      }
      for (const shot of run.missiles) this.missile(shot);
      if (game.laserActive()) this.beacon(game);
      const { player } = run;
      if (run.boosts.shield || run.boosts.fortress) {
        ctx.strokeStyle = '#8be8fb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 29, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (run.aegisFlash > 0) {
        ctx.save();
        ctx.globalAlpha = run.aegisFlash / .46;
        ctx.strokeStyle = '#ccb2ff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 32 + (1 - run.aegisFlash / .46) * 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (player.hp > 0 && (player.invulnerable <= 0 || Math.floor(player.invulnerable * 12) % 2 === 0)) {
        this.ship(player.x, player.y, run.ship.color, 0.84, run.shipId);
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
      this.drawDamageNumbers(dt);
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
        destroy: [165, 46, 0.17, 0.06], upgrade: [370, 650, 0.21, 0.085],
        missile: [255, 115, .15, .055], blast: [110, 42, .22, .07]
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

  Object.assign(AG, { FlightView, FlightAudio, shipGraphic });
})();
