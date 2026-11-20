/* ============================================================
   data.js — content registries.
   Adding a ship, enemy type, boost, currency or shop item means adding
   one entry here. Art is referenced by a flat "category.name" icon key;
   if the matching file is missing, procedural art is used instead.
   ============================================================ */
(function (global) {
  'use strict';
  var AG = (global.AG = global.AG || {});

  /* Optional image assets. Each path is relative to index.html. */
  AG.ICON_MANIFEST = {
    'spaceships.scout':    'icons/spaceships/scout.png',
    'spaceships.falcon':   'icons/spaceships/falcon.png',
    'enemies.grunt':       'icons/enemies/grunt.png',
    'enemies.diver':       'icons/enemies/diver.png',
    'enemies.shooter':     'icons/enemies/shooter.png',
    'enemies.tank':        'icons/enemies/tank.png',
    'enemies.boss':        'icons/enemies/boss.png',
    'currency.credit':     'icons/currency/credit_gold.png',
    'currency.gem':        'icons/currency/star_gem.png',
    'boosts.heal':         'icons/boosts/heal.png',
    'boosts.rapidFire':    'icons/boosts/rapid-fire.png',
    'boosts.doubleDamage': 'icons/boosts/double-damage.png',
    'boosts.shield':       'icons/boosts/shield.png',
    'shop.locked':         'icons/shop/locked.png',
    'ui.heart':            'icons/ui/heart.png',
    'ui.shadedLock':       'icons/ui/shaded_lock.png',
    'ui.inRoundShop':      'icons/ui/in_round_shop.png'
  };

  /* Only one ship is playable now. The array shape means more can be added
     later without touching the game loop — just push another definition and
     let the shop/menu pick AG.SPACESHIPS[n]. */
  AG.SPACESHIPS = [
    {
      id: 'scout',
      name: 'Scout',
      icon: 'spaceships.scout',
      unlocked: true,
      description: 'Balanced starter ship. Fast, reliable, no frills.',
      stats: { speed: 315, maxHealth: 100, fireDelay: 0.28, damage: 1 }
    }
  ];

  AG.ENEMY_TYPES = {
    grunt: {
      name: 'Grunt', icon: 'enemies.grunt',
      w: 30, h: 30, health: 1, speedMul: 1.0, score: 10,
      color: '#8dff6a', shape: 'invader', fires: false
    },
    diver: {
      name: 'Diver', icon: 'enemies.diver',
      w: 26, h: 26, health: 1, speedMul: 1.9, score: 18,
      color: '#ff7b6b', shape: 'dart', fires: false, sine: true
    },
    shooter: {
      name: 'Shooter', icon: 'enemies.shooter',
      w: 32, h: 32, health: 2, speedMul: 0.82, score: 28,
      color: '#c08bff', shape: 'hex', fires: true
    },
    tank: {
      name: 'Tank', icon: 'enemies.tank',
      w: 46, h: 40, health: 5, speedMul: 0.55, score: 55,
      color: '#ffc24d', shape: 'block', fires: true
    },
    boss: {
      name: 'Mothership', icon: 'enemies.boss',
      w: 104, h: 74, health: 1, speedMul: 0.34, score: 600,
      color: '#ff4d7e', shape: 'boss', fires: true, boss: true
    }
  };

  AG.BOOSTS = {
    heal:         { name: 'Repair',        icon: 'boosts.heal',         color: '#5cffa8', duration: 0,  amount: 25, glyph: '+' },
    rapidFire:    { name: 'Rapid Fire',    icon: 'boosts.rapidFire',    color: '#ffd75c', duration: 9,  fireDelayMul: 0.55, glyph: '»' },
    doubleDamage: { name: 'Double Damage', icon: 'boosts.doubleDamage', color: '#ff8a5c', duration: 9,  damageMul: 2, glyph: '×' },
    shield:       { name: 'Shield',        icon: 'boosts.shield',       color: '#5cd6ff', duration: 10, glyph: '◈' }
  };

  AG.CURRENCIES = {
    credit: { name: 'Credits',   icon: 'currency.credit', color: '#ffd75c', glyph: '●' },
    gem:    { name: 'Star Gems', icon: 'currency.gem',  color: '#6ef0ff', glyph: '◆' }
  };

  /* Shop entries are data only for now. Buying/equipping is a later feature;
     renderShop() in ui.js already reads this list and resolves each icon. */
  AG.SHOP_ITEMS = [
    { id: 'ship_falcon', name: 'Falcon', category: 'spaceships', icon: 'spaceships.falcon',
      cost: 1, currency: 'gem', available: false,
      description: 'A faster, heavily armed second ship.' },
    { id: 'boost_rapid', name: 'Rapid Fire+', category: 'boosts', icon: 'boosts.rapidFire',
      cost: 350, currency: 'credit', available: true, inRound: true,
      description: 'Faster firing for the next 9 seconds.' },
    { id: 'hull_repair', name: 'Hull Repair', category: 'boosts', icon: 'boosts.heal',
      cost: 150, currency: 'credit', available: true, inRound: true,
      description: 'Restore 25 hull, instantly.' }
  ];
})(window);
