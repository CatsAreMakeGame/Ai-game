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
    snowman: [-12,-28,12,-28,12,-20,7,-20,7,-15,15,-13,19,-4,16,4,24,11,22,23,-22,23,-24,11,-16,4,-19,-4,-15,-13,-7,-15,-7,-20,-12,-20],
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
    zenith: [0,-35, 13,-20, 18,-10, 32,-14, 26,10, 14,20, 8,16, 0,24,-8,16,-14,20,-26,10,-32,-14,-18,-10,-13,-20],
    enemyGrunt: [0,-22, 20,-13, 29,8, 17,20,-17,20,-29,8,-20,-13],
    enemyShooter: [0,-24, 23,-18, 29,7, 14,23,-14,23,-29,7,-23,-18],
    enemyDiver: [0,-29, 16,-7, 31,23, 0,12,-31,23,-16,-7],
    enemyTank: [0,-25, 16,-25, 31,-14, 31,14, 17,24,-17,24,-31,14,-31,-14,-16,-25],
    enemySmokeNinja: [0,-14, 21,-24, 13,-1, 32,10, 17,24, 0,29,-17,24,-32,10,-13,-1,-21,-24],
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
      if (!enemy.allied && (enemy.slimeTime > 0 || enemy.poisonTime > 0)) {
        disc(ctx, 0, 0, size + 6, enemy.poisonTime > 0 ? '#9aff514d' : '#5ddf4f4d');
      }
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
          smokeNinja: [[-22,-7], [-12,-17], [0,-21], [12,-17], [22,-7], [9,0], [15,16], [0,10], [-15,16], [-9,0]],
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
        label: amount.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), size: laser ? 23 : 17,
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
      const boss = AG.BOSSES[enemy.type];
      if (boss && AG.balanceActive()) {
        const pieces = boss.tier % 2 ? 2 : 3;
        for (let i = 0; i < pieces; i++) {
          const offset = i - (pieces - 1) / 2;
          this.effects.push({ x: enemy.x + offset * enemy.size * .48, y: enemy.y, vx: offset * 46,
            vy: 115 + i * 20, life: Infinity, debris: enemy.size * .46, spin: (i % 2 ? -1 : 1) * 1.6,
            angle: i * .9, color: boss.color });
        }
      }
      const count = boss ? 40 : 10;
      for (let index = 0; index < count; index++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 38 + Math.random() * 160;
        this.effects.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed, life: 0.25 + Math.random() * 0.45, color: ENEMIES[enemy.type].color });
      }
    }

    blast({ x, y, radius, color = '#ffb376' }) {
      for (let i = 0; i < 22; i++) {
        const angle = i * Math.PI * 2 / 22;
        const speed = radius * (1.2 + (i % 4) * .32);
        this.effects.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: .33 + (i % 3) * .12, color: i % 3 ? color : '#fff3cc' });
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

      const pulse = (Math.sin(t * 22) + 1) / 2;
      strand('#4520bf24', 104 + pulse * 12, 8, 0);
      strand('#216aff55', 73, 6, 0);
      strand('#4594ff80', 43, 4, 0);
      strand('#77d8ffee', 25 + pulse * 3, 3, 0);
      strand('#f0fdff', 9, 1.5, 0);
      strand('#8177ff9c', 2.5, 32, 2);
      strand('#3b9affb8', 2.5, 23, 4);
      strand('#a8f6ffbd', 1.5, 17, 6);
      for (let i = 0; i < 34; i++) {
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
      const flare = ctx.createRadialGradient(0, 0, 2, 0, 0, 38);
      flare.addColorStop(0, '#ffffff');
      flare.addColorStop(.35, '#86ddffbd');
      flare.addColorStop(1, '#318aff00');
      disc(ctx, 0, 0, 38, flare);
      disc(ctx, 0, 0, 14 + pulse * 3, '#8fdcff');
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
      ctx.save();
      if (dt > 0 && game.laserActive() && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        ctx.translate(Math.sin(this.time * 43) * 1.65, Math.cos(this.time * 37) * 1.25);
      }
      for (const puff of run.enemySmoke) {
        const haze = ctx.createRadialGradient(puff.x, puff.y, puff.size * .13, puff.x, puff.y, puff.size);
        haze.addColorStop(0, '#9f73c274');
        haze.addColorStop(.65, '#784a9c59');
        haze.addColorStop(1, '#5e3f7900');
        ctx.save();
        ctx.globalAlpha = Math.min(1, puff.life);
        disc(ctx, puff.x, puff.y, puff.size, haze);
        ctx.restore();
      }
      for (const puff of run.smoke) {
        ctx.save();
        ctx.globalAlpha = .23 * puff.life / puff.duration;
        const haze = ctx.createRadialGradient(puff.x, puff.y, 2, puff.x, puff.y, puff.size);
        haze.addColorStop(0, puff.poison ? '#b8ff62' : '#c9d8ac');
        haze.addColorStop(.55, puff.poison ? '#5be14c' : '#9da88d');
        haze.addColorStop(1, '#79836d00');
        disc(ctx, puff.x, puff.y, puff.size, haze);
        ctx.restore();
      }
      for (const rock of run.asteroids) {
        if (rock.hp <= 0) continue;
        ctx.save();
        ctx.translate(rock.x, rock.y);
        const r = rock.size;
        polygon(ctx, [[-r * .76, 0], [-r * .6 - rock.vx * .12, -r * 3.3], [r * .8, 0]],
          rock.green ? '#80fc4a56' : '#fc995355');
        ctx.rotate(rock.spin);
        ctx.shadowColor = rock.green ? '#98ff61' : '#ffad79';
        ctx.shadowBlur = rock.green ? 18 : 6;
        polygon(ctx, [[-r, .1 * r], [-.67 * r, -.7 * r], [.17 * r, -r], [.89 * r, -.42 * r],
          [r, .28 * r], [.3 * r, .93 * r], [-.63 * r, .65 * r]], rock.green ? '#72cb3a' : '#79606c');
        ctx.shadowBlur = 0;
        disc(ctx, r * .22, r * .1, r * .28, rock.green ? '#c5ff77' : '#a58a87');
        disc(ctx, -r * .43, -r * .24, r * .17, rock.green ? '#427439' : '#543e51');
        ctx.restore();
      }
      for (const shot of run.slimeShots) {
        disc(ctx, shot.x - shot.vx * 8, shot.y - shot.vy * 8, 4, '#65d75188');
        disc(ctx, shot.x, shot.y, 6, '#65d751');
        disc(ctx, shot.x + 1, shot.y - 2, 2, '#c4ff8e');
      }
      for (const shot of run.hostile) {
        disc(ctx, shot.x, shot.y, 7, '#e1516355');
        disc(ctx, shot.x, shot.y, 4, '#ffa280');
      }
      for (const shots of [run.shots, run.allyShots]) {
        for (const shot of shots) {
          if (shot.snowball) {
            if (shot.snowCrystal) polygon(ctx, [[shot.x, shot.y - 10], [shot.x + 7, shot.y], [shot.x, shot.y + 10], [shot.x - 7, shot.y]], '#78ddff');
            else disc(ctx, shot.x, shot.y, 5, '#f4fdff');
            continue;
          }
          if (shot.enemyRound) {
            disc(ctx, shot.x, shot.y, 7, '#e1516355');
            disc(ctx, shot.x, shot.y, 4, '#ffa280');
            continue;
          }
          ctx.save();
          ctx.translate(shot.x, shot.y);
          ctx.rotate(Math.atan2(shot.vy, shot.vx) + Math.PI / 2);
          ctx.fillStyle = shot.color ?? run.ship.color;
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = shot.barrage ? 0 : 6;
          if (shot.barrage) ctx.fillRect(-1.5, -19, 3, 38);
          else ctx.fillRect(-2, -9, 4, 18);
          ctx.restore();
        }
      }
      const tendrilVisuals = new Map();
      for (const { anchorX, anchorY, captures } of run.tendrils) {
        const key = anchorX + ':' + anchorY;
        if (!tendrilVisuals.has(key)) tendrilVisuals.set(key, { anchorX, anchorY, captures: new Set() });
        const visual = tendrilVisuals.get(key);
        for (const enemy of captures.keys()) visual.captures.add(enemy);
      }
      const detailedTendrils = tendrilVisuals.size <= 12;
      for (const tendril of tendrilVisuals.values()) {
        const dx = run.player.x - tendril.anchorX;
        const dy = run.player.y - tendril.anchorY;
        const length = Math.hypot(dx, dy);
        if (!length) continue;
        const nx = -dy / length;
        const ny = dx / length;
        const segments = Math.max(8, Math.ceil(length / (detailedTendrils ? 20 : 48)));
        const point = (t, shift = 0) => {
          const twist = Math.sin(t * 28 - this.time * 7 + shift) * Math.sin(Math.PI * t) * 3;
          return [tendril.anchorX + dx * t + nx * twist, tendril.anchorY + dy * t + ny * twist];
        };
        const strand = (shift, color, width) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(tendril.anchorX, tendril.anchorY);
          for (let i = 1; i <= segments; i++) ctx.lineTo(...point(i / segments, shift));
          ctx.stroke();
        };
        ctx.save();
        ctx.lineCap = 'round';
        ctx.shadowColor = '#57ed98';
        ctx.shadowBlur = detailedTendrils ? 10 : 0;
        strand(0, '#236b4e', 10);
        ctx.shadowBlur = 2;
        strand(0, '#86ec7a', 4);
        if (detailedTendrils) strand(Math.PI, '#cfed87', 1.35);
        for (let i = 1; detailedTendrils && i < segments; i += 3) {
          const [x, y] = point(i / segments);
          const direction = i % 2 ? 1 : -1;
          ctx.strokeStyle = '#8df597aa';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + nx * 10 * direction, y + ny * 10 * direction,
            x + nx * 7 * direction + dx / length * 7, y + ny * 7 * direction + dy / length * 7);
          ctx.stroke();
        }
        const anchorX = tendril.anchorX === 0 ? 4 : WIDTH - 4;
        disc(ctx, anchorX, tendril.anchorY, 8, '#28694f');
        disc(ctx, anchorX, tendril.anchorY, 4, '#c9ff9c');
        for (const enemy of tendril.captures.keys()) {
          const t = AG.clamp(((enemy.x - tendril.anchorX) * dx + (enemy.y - tendril.anchorY) * dy) / (length * length), 0, 1);
          ctx.strokeStyle = '#98fca9';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(...point(t));
          ctx.lineTo(enemy.x, enemy.y);
          ctx.arc(enemy.x, enemy.y, enemy.size + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
      for (const enemy of run.enemies) {
        this.enemy(enemy);
        if (enemy.frozen > 0) {
          disc(ctx, enemy.x, enemy.y, enemy.size, '#65bbff7a');
          ctx.font = 'bold 12px system-ui';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#b8ecff';
          ctx.fillText('Frozen', enemy.x, enemy.y - enemy.size - 8);
        }
      }
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
      if (run.snowfall > 0) {
        for (let i = 0; i < 30; i++) {
          const x = (i * 137.5 + Math.sin(this.time + i) * 12 + WIDTH) % WIDTH;
          const y = (i * 83 + this.time * (34 + i % 9)) % HEIGHT;
          disc(ctx, x, y, 1 + i % 3 * .35, '#dff5ff77');
        }
      }
      for (const drop of run.drops) {
        const item = AG.ITEMS[drop.type];
        ctx.save();
        ctx.translate(drop.x, drop.y);
        if (AG.CRATES[drop.type] || ['legendary', 'mythical', 'godly'].includes(item.rarity)) {
          const pulse = .5 + .5 * Math.sin(this.time * 6 + drop.x);
          const light = drop.type === 'snowman' ? '#fff' : AG.RARITIES[item.rarity ?? 'legendary'];
          ctx.globalAlpha = .22 + pulse * .25;
          ctx.shadowColor = light;
          ctx.shadowBlur = 15;
          ctx.strokeStyle = light;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 22 + pulse * 3, 0, Math.PI * 2);
          ctx.stroke();
          for (let i = 0; i < 3; i++) {
            const angle = this.time * 1.7 + i * Math.PI * 2 / 3;
            const x = Math.cos(angle) * 25;
            const y = Math.sin(angle) * 25;
            disc(ctx, x, y, 1.5 + pulse, '#fff9ce');
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
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
      if (run.aegisShield > 0) {
        ctx.save();
        const strength = run.aegisShield / AG.aegisCapacity(run.ship);
        const glow = ctx.createLinearGradient(player.x - 32, player.y - 30, player.x + 32, player.y + 30);
        glow.addColorStop(0, '#9d66ff');
        glow.addColorStop(.5, '#e6c6ff');
        glow.addColorStop(1, '#7a57e7');
        ctx.globalAlpha = .26 + .57 * strength;
        ctx.strokeStyle = glow;
        ctx.lineWidth = 2 + strength * 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha *= .53;
        ctx.beginPath();
        const phase = this.time * 1.6;
        ctx.arc(player.x, player.y, 34, phase, phase + .9);
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
        if (particle.debris) {
          const r = particle.debris;
          particle.vy += 150 * dt;
          particle.angle += particle.spin * dt;
          ctx.save();
          ctx.translate(particle.x, particle.y);
          ctx.rotate(particle.angle);
          polygon(ctx, [[-r, -.2 * r], [-.3 * r, -r], [.9 * r, -.4 * r], [.45 * r, .25 * r], [.65 * r, .85 * r], [-.65 * r, .6 * r]], particle.color);
          polygon(ctx, [[-.55 * r, -.13 * r], [-.1 * r, -.63 * r], [.45 * r, -.33 * r], [.1 * r, .35 * r]], '#433248');
          ctx.restore();
          return particle.y < HEIGHT + r;
        }
        ctx.globalAlpha = Math.max(0, particle.life);
        disc(ctx, particle.x, particle.y, 2.7, particle.color);
        ctx.globalAlpha = 1;
        return particle.life > 0;
      });
      this.drawDamageNumbers(dt);
      ctx.restore();
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
