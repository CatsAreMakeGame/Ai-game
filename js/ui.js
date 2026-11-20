/* ============================================================
   ui.js — DOM overlay, HUD, banners and the icon-driven shop scaffold.
   UI reads game state; it never mutates gameplay.
   ============================================================ */
(function (global) {
  'use strict';
  var AG = (global.AG = global.AG || {});
  var $ = function (id) { return document.getElementById(id); };

  AG.UI = function (game) {
    this.game = game;
    this.bannerTimer = 0;
    this.shopReturn = 'screen-menu';
    this.el = {
      hud: $('hud'),
      wave: $('hud-wave'),
      score: $('hud-score'),
      credits: $('hud-credits'),
      hullFill: $('hud-hull-fill'),
      hullText: $('hud-hull-text'),
      boosts: $('hud-boosts'),
      overlay: $('overlay'),
      banner: $('wave-banner'),
      bannerTitle: $('banner-title'),
      bannerSub: $('banner-sub'),
      screens: {
        menu: $('screen-menu'),
        paused: $('screen-paused'),
        gameover: $('screen-gameover'),
        victory: $('screen-victory'),
        shop: $('screen-shop')
      }
    };
    this._buildCreditsIcon();
    this._renderShop();
  };

  AG.UI.prototype = {
    /* Builds an icon element that gracefully falls back to a glyph. */
    makeIcon: function (key, glyph) {
      var span = document.createElement('span');
      span.className = 'icon';
      var fallback = document.createElement('span');
      fallback.className = 'icon-fallback';
      fallback.textContent = glyph || '◆';
      span.appendChild(fallback);

      var path = AG.ICON_MANIFEST[key];
      if (path) {
        var img = document.createElement('img');
        img.alt = '';
        img.onload = function () { fallback.style.display = 'none'; };
        img.onerror = function () { img.remove(); };
        img.src = path;
        span.appendChild(img);
      }
      return span;
    },

    _buildCreditsIcon: function () {
      var holder = this.el.credits.parentNode;
      var icon = this.makeIcon(AG.CURRENCIES.credit.icon, AG.CURRENCIES.credit.glyph);
      holder.insertBefore(icon, this.el.credits);
    },

    showScreen: function (name) {
      Object.keys(this.el.screens).forEach(function (key) {
        this.el.screens[key].classList.toggle('active', key === name);
      }, this);
      this.el.overlay.classList.remove('hidden');
    },

    hideOverlay: function () {
      this.el.overlay.classList.add('hidden');
      Object.keys(this.el.screens).forEach(function (key) {
        this.el.screens[key].classList.remove('active');
      }, this);
    },

    setHudVisible: function (visible) {
      this.el.hud.classList.toggle('hidden', !visible);
    },

    showBanner: function (title, sub, danger, duration) {
      var b = this.el.banner;
      this.el.bannerTitle.textContent = title;
      this.el.bannerSub.textContent = sub;
      b.classList.toggle('danger', !!danger);
      b.classList.remove('hidden');
      // restart the entrance animation
      b.style.animation = 'none';
      void b.offsetWidth;
      b.style.animation = '';
      this.bannerTimer = duration || AG.CONFIG.wave.bannerTime;
    },

    update: function (dt) {
      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) this.el.banner.classList.add('hidden');
      }
      var g = this.game;
      var p = g.player;
      if (!p) return;
      this.el.wave.textContent = Math.min(g.wave, AG.CONFIG.maxWaves) + ' / ' + AG.CONFIG.maxWaves;
      this.el.score.textContent = g.score.toLocaleString();
      this.el.credits.textContent = g.credits.toLocaleString();

      var ratio = Math.max(0, p.health / p.maxHealth);
      this.el.hullFill.style.width = (ratio * 100) + '%';
      this.el.hullFill.classList.toggle('warn', ratio <= 0.5 && ratio > 0.25);
      this.el.hullFill.classList.toggle('crit', ratio <= 0.25);
      this.el.hullText.textContent = Math.ceil(p.health) + ' / ' + p.maxHealth;
      this._renderBoosts(p);
    },

    _renderBoosts: function (player) {
      var keys = Object.keys(player.boosts).filter(function (k) { return player.boosts[k] > 0; });
      var sig = keys.map(function (k) { return k + Math.ceil(player.boosts[k]); }).join('|');
      if (sig === this._boostSig) return;
      this._boostSig = sig;
      var host = this.el.boosts;
      host.textContent = '';
      keys.forEach(function (key) {
        var b = AG.BOOSTS[key];
        var chip = document.createElement('span');
        chip.className = 'boost-chip';
        chip.style.color = b.color;
        chip.style.borderColor = b.color;
        chip.appendChild(this.makeIcon(b.icon, b.glyph));
        chip.appendChild(document.createTextNode(b.name + ' ' + Math.ceil(player.boosts[key]) + 's'));
        host.appendChild(chip);
      }, this);
    },

    showStats: function (targetId, game) {
      var host = $(targetId);
      host.textContent = '';
      var rows = [
        ['SCORE', game.score.toLocaleString()],
        ['WAVE', game.wave + ' / ' + AG.CONFIG.maxWaves],
        ['KILLS', game.kills.toLocaleString()]
      ];
      rows.forEach(function (row) {
        var box = document.createElement('div');
        box.className = 'stat';
        var label = document.createElement('div');
        label.className = 'stat-label';
        label.textContent = row[0];
        var value = document.createElement('div');
        value.className = 'stat-value';
        value.textContent = row[1];
        box.appendChild(label);
        box.appendChild(value);
        host.appendChild(box);
      });
    },

    openShop: function (returnScreen) {
      this.shopReturn = returnScreen || 'screen-menu';
      this.showScreen('shop');
    },

    closeShop: function () {
      this.showScreen(this.shopReturn);
    },

    /* Reads AG.SHOP_ITEMS — adding a new item in data.js makes it appear here
       automatically, with its icon resolved through the same registry. */
    _renderShop: function () {
      var grid = $('shop-grid');
      if (!grid) return;
      grid.textContent = '';
      var credit = AG.CURRENCIES.credit;
      AG.SHOP_ITEMS.forEach(function (item) {
        var card = document.createElement('div');
        card.className = 'shop-item';
        card.appendChild(this.makeIcon(item.icon, '◆'));
        var h = document.createElement('h4');
        h.textContent = item.name;
        card.appendChild(h);
        var p = document.createElement('p');
        p.textContent = item.description;
        card.appendChild(p);
        var cost = document.createElement('div');
        cost.className = 'shop-cost';
        cost.appendChild(this.makeIcon(credit.icon, credit.glyph));
        cost.appendChild(document.createTextNode(' ' + item.cost.toLocaleString() + (item.available ? '' : ' · locked')));
        card.appendChild(cost);
        grid.appendChild(card);
      }, this);
    }
  };
})(window);
