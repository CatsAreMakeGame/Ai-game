/* ============================================================
   ui.js — DOM overlay, HUD, banners, notifications and shops.
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
    this.shopReturnState = 'menu';
    this._boostSig = '';
    this._roundShopUnlocked = null;
    this.el = {
      hud: $('hud'),
      wave: $('hud-wave'),
      score: $('hud-score'),
      credits: $('hud-credits'),
      gems: $('hud-gems'),
      level: $('hud-level'),
      xpFill: $('hud-xp-fill'),
      hullFill: $('hud-hull-fill'),
      hullText: $('hud-hull-text'),
      boosts: $('hud-boosts'),
      overlay: $('overlay'),
      banner: $('wave-banner'),
      bannerTitle: $('banner-title'),
      bannerSub: $('banner-sub'),
      waveProgress: $('wave-progress'),
      waveProgressFill: $('wave-progress-fill'),
      waveProgressText: $('wave-progress-text'),
      hudActions: $('hud-actions'),
      actionBar: $('action-bar'),
      roundShopIcon: $('round-shop-icon'),
      roundShopLabel: $('round-shop-label'),
      btnShop: $('btn-shop'),
      btnSkip: $('btn-skip-wave'),
      btnAutoSkip: $('btn-auto-skip'),
      screens: {
        menu: $('screen-menu'),
        paused: $('screen-paused'),
        gameover: $('screen-gameover'),
        victory: $('screen-victory'),
        shop: $('screen-shop'),
        roundShop: $('screen-round-shop')
      }
    };
    this._buildCurrencyIcons();
    this._renderShop('shop-grid', AG.SHOP_ITEMS, false);
    this._renderShop('round-shop-grid', AG.SHOP_ITEMS.filter(function (i) { return i.inRound; }), true);
  };

  AG.UI.prototype = {
    /* Builds an icon element with a glyph fallback tinted to its own colour. */
    makeIcon: function (key, glyph, color) {
      var span = document.createElement('span');
      span.className = 'icon';
      var fallback = document.createElement('span');
      fallback.className = 'icon-fallback';
      fallback.textContent = glyph || '◆';
      if (color) fallback.style.color = color;
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

    _buildCurrencyIcons: function () {
      var credit = AG.CURRENCIES.credit;
      var gem = AG.CURRENCIES.gem;
      this.el.credits.parentNode.insertBefore(
        this.makeIcon(credit.icon, credit.glyph, credit.color), this.el.credits);
      this.el.gems.parentNode.insertBefore(
        this.makeIcon(gem.icon, gem.glyph, gem.color), this.el.gems);
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

    setRunControlsVisible: function (visible) {
      this.el.hudActions.classList.toggle('hidden', !visible);
      this.el.waveProgress.classList.toggle('hidden', !visible);
    },

    setShopEnabled: function (enabled) {
      if (this.el.btnShop) this.el.btnShop.disabled = !enabled;
    },

    setAutoSkip: function (on) {
      this.el.btnAutoSkip.setAttribute('aria-pressed', on ? 'true' : 'false');
      this.el.btnAutoSkip.textContent = 'AUTO SKIP: ' + (on ? 'ON' : 'OFF');
    },

    setSkipEnabled: function (enabled) {
      this.el.btnSkip.disabled = !enabled;
    },

    setAutoSkipEnabled: function (enabled) {
      this.el.btnAutoSkip.disabled = !enabled;
    },

    showBanner: function (title, sub, danger, duration, compact) {
      var b = this.el.banner;
      this.el.bannerTitle.textContent = title;
      this.el.bannerSub.textContent = sub;
      b.classList.toggle('danger', !!danger);
      b.classList.toggle('compact', !!compact);
      b.classList.remove('hidden');
      b.style.animation = 'none';
      void b.offsetWidth;
      b.style.animation = '';
      this.bannerTimer = duration || AG.CONFIG.wave.bannerTime;
    },

    /* Bottom action-bar toast: upgrades, coins, repairs. */
    notify: function (text, opts) {
      opts = opts || {};
      var toast = document.createElement('div');
      toast.className = 'toast';
      toast.style.setProperty('--toast-color', opts.color || AG.CURRENCIES.credit.color);
      if (opts.icon) {
        toast.appendChild(this.makeIcon(opts.icon, opts.glyph, opts.color));
      }
      toast.appendChild(document.createTextNode(text));
      this.el.actionBar.appendChild(toast);
      global.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 2500);
      // keep the action bar short
      while (this.el.actionBar.children.length > 4) {
        this.el.actionBar.removeChild(this.el.actionBar.firstChild);
      }
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
      this.el.gems.textContent = g.gems.toLocaleString();
      this.el.level.textContent = g.level;
      this.el.xpFill.style.width =
        Math.min(100, Math.round((g.xp / AG.xpForLevel(g.level)) * 100)) + '%';

      var pct = Math.round(g.waves.completion * 100);
      this.el.waveProgressFill.style.width = pct + '%';
      this.el.waveProgressText.textContent = pct + '%';

      var ratio = Math.max(0, p.health / p.maxHealth);
      this.el.hullFill.style.width = (ratio * 100) + '%';
      this.el.hullFill.classList.toggle('warn', ratio <= 0.5 && ratio > 0.25);
      this.el.hullFill.classList.toggle('crit', ratio <= 0.25);
      this.el.hullText.textContent = Math.ceil(p.health) + ' / ' + p.maxHealth;
      this._renderBoosts(p);
      this._updateRoundShopIcon();
      this._updateBuyButtons();
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
        chip.appendChild(this.makeIcon(b.icon, b.glyph, b.color));
        chip.appendChild(document.createTextNode(b.name + ' ' + Math.ceil(player.boosts[key]) + 's'));
        host.appendChild(chip);
      }, this);
    },

    _updateRoundShopIcon: function () {
      var g = this.game;
      var unlocked = g.level >= AG.CONFIG.leveling.shopUnlock;
      if (unlocked === this._roundShopUnlocked) return;
      this._roundShopUnlocked = unlocked;
      var host = this.el.roundShopIcon;
      host.textContent = '';
      var key = unlocked ? 'ui.inRoundShop' : 'ui.shadedLock';
      var glyph = unlocked ? '▣' : '▤';
      var color = unlocked ? AG.CURRENCIES.credit.color : '#7c8ba8';
      host.appendChild(this.makeIcon(key, glyph, color));
      this.el.roundShopLabel.textContent = unlocked ? 'IN-ROUND SHOP' : 'SHOP LOCKED';
    },

    _updateBuyButtons: function () {
      var g = this.game;
      this._buyCards.forEach(function (card) {
        var cur = card.item.currency || 'credit';
        var have = cur === 'gem' ? g.gems : g.credits;
        card.btn.disabled = !card.item.available || have < card.item.cost;
      });
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

    openShop: function (returnScreen, returnState) {
      this.shopReturn = returnScreen || 'screen-menu';
      this.shopReturnState = returnState || 'menu';
      this.showScreen('shop');
    },

    closeShop: function () {
      this.showScreen(this.shopReturn);
    },

    openRoundShop: function () {
      this.showScreen('roundShop');
    },

    closeRoundShop: function () {
      this.hideOverlay();
    },

    /* Shared card renderer: the manifest resolves every icon. */
    _renderShop: function (gridId, items, allowBuy) {
      this._buyCards = this._buyCards || [];
      var grid = $(gridId);
      if (!grid) return;
      grid.textContent = '';
      items.forEach(function (item) {
        var card = document.createElement('div');
        card.className = 'shop-item' + (item.available ? ' buyable' : '');
        card.appendChild(this.makeIcon(item.icon, '◆'));
        var h = document.createElement('h4');
        h.textContent = item.name;
        card.appendChild(h);
        var p = document.createElement('p');
        p.textContent = item.description;
        card.appendChild(p);
        var cur = AG.CURRENCIES[item.currency || 'credit'];
        var cost = document.createElement('div');
        cost.className = 'shop-cost';
        cost.style.color = cur.color;
        cost.appendChild(this.makeIcon(cur.icon, cur.glyph, cur.color));
        cost.appendChild(document.createTextNode(' ' + item.cost.toLocaleString() + (item.available ? '' : ' · locked')));
        card.appendChild(cost);
        if (allowBuy && item.available) {
          var self = this;
          var btn = document.createElement('button');
          btn.className = 'buy-btn';
          btn.type = 'button';
          btn.textContent = 'BUY';
          btn.addEventListener('click', function () { self.game.buy(item.id); });
          card.appendChild(btn);
          this._buyCards.push({ item: item, btn: btn });
        }
        grid.appendChild(card);
      }, this);
    }
  };
})(window);
