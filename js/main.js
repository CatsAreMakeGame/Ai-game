/* ============================================================
   main.js — bootstrap. Everything else is namespaced under window.AG.
   ============================================================ */
(function (global) {
  'use strict';
  var init = function () {
    var canvas = document.getElementById('game-canvas');
    if (!canvas) {
      console.error('[Alien Shooter] canvas #game-canvas not found');
      return;
    }
    var game = new global.AG.Game(canvas);
    global.AG.game = game;   // handy for debugging in the console
    game.start();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
