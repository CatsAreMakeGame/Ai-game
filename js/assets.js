/* ============================================================
   assets.js — icon loading + procedural placeholder art.
   All art is drawn through here so swapping a placeholder for a real
   icon-pack PNG never requires touching entity code.
   ============================================================ */
(function (global) {
  'use strict';
  var AG = (global.AG = global.AG || {});

  AG.AssetManager = function (manifest) {
    this.manifest = manifest || {};
    this.images = Object.create(null);
    this.missing = Object.create(null);
  };

  AG.AssetManager.prototype = {
    loadAll: function (onProgress, onDone) {
      var self = this;
      var keys = Object.keys(this.manifest);
      var done = 0;
      if (!keys.length) { if (onDone) onDone(); return; }
      keys.forEach(function (key) {
        var img = new Image();
        img.onload = function () {
          self.images[key] = img;
          self._tick(++done, keys.length, onProgress, onDone);
        };
        img.onerror = function () {
          self.missing[key] = true;
          self._tick(++done, keys.length, onProgress, onDone);
        };
        img.src = self.manifest[key];
      });
    },

    _tick: function (done, total, onProgress, onDone) {
      if (onProgress) onProgress(done, total);
      if (done === total && onDone) onDone();
    },

    has: function (key) { return !!this.images[key]; },

    /* Draw a registered icon if available, otherwise run the fallback fn. */
    draw: function (key, ctx, x, y, w, h, fallback, rotation) {
      var img = this.images[key];
      if (img) {
        ctx.save();
        if (rotation) {
          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate(rotation);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else {
          ctx.drawImage(img, x, y, w, h);
        }
        ctx.restore();
      } else if (fallback) {
        fallback(ctx, x, y, w, h);
      }
    }
  };

  /* ---- Procedural shapes used until real assets are dropped into /icons ---- */
  AG.Art = {
    drawShape: function (ctx, shape, x, y, w, h, color, time, variant) {
      var cx = x + w / 2, cy = y + h / 2;
      var t = time || 0;

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      if (shape === 'ship') {
        var g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#e9f9ff');
        g.addColorStop(0.42, color || '#6ef0ff');
        g.addColorStop(1, '#10213c');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(x + w, y + h * 0.52);
        ctx.lineTo(x + w * 0.74, y + h);
        ctx.lineTo(x + w * 0.26, y + h);
        ctx.lineTo(x, y + h * 0.52);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a1730';
        ctx.beginPath();
        ctx.ellipse(cx, y + h * 0.42, w * 0.17, h * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#bff8ff';
        ctx.beginPath();
        ctx.arc(cx, y + h * 0.40, w * 0.075, 0, Math.PI * 2);
        ctx.fill();
        // engine flare
        ctx.fillStyle = '#ffb45c';
        ctx.shadowColor = '#ff9b3c';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.30, y + h);
        ctx.lineTo(x + w * 0.36, y + h + 9 + Math.sin(t * 24) * 3);
        ctx.lineTo(x + w * 0.45, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + w * 0.55, y + h);
        ctx.lineTo(x + w * 0.64, y + h + 9 + Math.sin(t * 24 + 1) * 3);
        ctx.lineTo(x + w * 0.70, y + h);
        ctx.closePath();
        ctx.fill();

      } else if (shape === 'bullet') {
        if (variant === 'enemy') {
          ctx.beginPath();
          ctx.moveTo(cx, y + h);
          ctx.lineTo(x + w, cy);
          ctx.lineTo(cx, y);
          ctx.lineTo(x, cy);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = '#eaffff';
          ctx.fillRect(x + 1, y, w - 2, h);
          ctx.globalAlpha = 0.45;
          ctx.fillRect(x, y + h * 0.55, w, h * 0.5);
        }

      } else if (shape === 'invader') {
        var bob = Math.sin(t * 5) * 1.5;
        ctx.translate(0, bob);
        ctx.beginPath();
        ctx.moveTo(cx, y + h * 0.15);
        ctx.lineTo(x + w * 0.18, y + h * 0.28);
        ctx.lineTo(x + w * 0.10, y + h * 0.62);
        ctx.lineTo(x + w * 0.28, y + h * 0.62);
        ctx.lineTo(x + w * 0.22, y + h * 0.92);
        ctx.lineTo(x + w * 0.42, y + h * 0.72);
        ctx.lineTo(x + w * 0.58, y + h * 0.72);
        ctx.lineTo(x + w * 0.78, y + h * 0.92);
        ctx.lineTo(x + w * 0.72, y + h * 0.62);
        ctx.lineTo(x + w * 0.90, y + h * 0.62);
        ctx.lineTo(x + w * 0.82, y + h * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#07131c';
        ctx.fillRect(x + w * 0.28, y + h * 0.38, w * 0.14, h * 0.12);
        ctx.fillRect(x + w * 0.58, y + h * 0.38, w * 0.14, h * 0.12);

      } else if (shape === 'dart') {
        ctx.beginPath();
        ctx.moveTo(cx, y + h);
        ctx.lineTo(x + w, y + h * 0.2);
        ctx.lineTo(x + w * 0.62, y + h * 0.32);
        ctx.lineTo(x + w * 0.38, y + h * 0.32);
        ctx.lineTo(x, y + h * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#2a0e18';
        ctx.beginPath();
        ctx.arc(cx, y + h * 0.48, w * 0.11, 0, Math.PI * 2);
        ctx.fill();

      } else if (shape === 'hex') {
        ctx.beginPath();
        for (var i = 0; i < 6; i++) {
          var a = Math.PI / 6 + i * Math.PI / 3;
          var px = cx + Math.cos(a) * w * 0.5;
          var py = cy + Math.sin(a) * h * 0.5;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, w * 0.20, 0, Math.PI * 2);
        ctx.stroke();

      } else if (shape === 'block') {
        var r = 7;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(12,18,32,.75)';
        ctx.fillRect(x + w * 0.18, y + h * 0.30, w * 0.64, h * 0.24);
        ctx.fillStyle = '#fff3c4';
        ctx.fillRect(x + w * 0.28, y + h * 0.62, w * 0.12, h * 0.12);
        ctx.fillRect(x + w * 0.60, y + h * 0.62, w * 0.12, h * 0.12);

      } else if (shape === 'boss') {
        var bg = ctx.createLinearGradient(x, y, x, y + h);
        bg.addColorStop(0, '#ff9ab5');
        bg.addColorStop(0.5, color);
        bg.addColorStop(1, '#4a0f2a');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(cx, y + h * 0.18);
        ctx.lineTo(x + w * 0.92, y + h * 0.42);
        ctx.lineTo(x + w, y + h * 0.80);
        ctx.lineTo(x + w * 0.66, y + h * 0.66);
        ctx.lineTo(x + w * 0.34, y + h * 0.66);
        ctx.lineTo(x, y + h * 0.80);
        ctx.lineTo(x + w * 0.08, y + h * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#2b0718';
        ctx.beginPath();
        ctx.ellipse(cx, y + h * 0.42, w * 0.18, h * 0.17, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd75c';
        var pulse = 0.55 + Math.sin(t * 7) * 0.45;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(cx, y + h * 0.42, w * 0.085, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffd75c';
        for (var j = 0; j < 5; j++) {
          ctx.fillRect(x + w * (0.16 + j * 0.17), y + h * 0.78, w * 0.06, h * 0.08);
        }

      } else if (shape === 'pickup') {
        ctx.translate(cx, cy);
        ctx.rotate(t * 1.8);
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(w / 2, 0);
        ctx.lineTo(0, h / 2);
        ctx.lineTo(-w / 2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.rotate(-t * 1.8);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#08121f';
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(variant || '+'), 0, 1);
      }

      ctx.restore();
    }
  };
})(window);
