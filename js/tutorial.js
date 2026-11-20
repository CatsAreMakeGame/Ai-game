/* ============================================================
   tutorial.js — home-screen slideshow. Self-contained: owns its DOM,
   navigation and first-run flag; no gameplay state is touched.
   ============================================================ */
(function (global) {
  'use strict';
  var AG = (global.AG = global.AG || {});
  var $ = function (id) { return document.getElementById(id); };

  var SLIDES = [
    { glyph: '◉', title: 'MOVE', text: 'Use the arrow keys or WASD to fly. You can also hold left-click to steer left and right.' },
    { glyph: '✦', title: 'FIRE', text: 'Weapons fire automatically. Stay mobile and line up your shots with the invaders.' },
    { glyph: '⬢', title: 'WAVES', text: 'Survive 50 waves. A Mothership boss attacks on every 10th wave.' },
    { glyph: '↷', title: 'SKIP', text: 'Skip Wave and Auto Skip work on normal waves. Boss fights can never be skipped.' },
    { glyph: '★', title: 'LEVEL UP', text: 'Kills earn credits, star gems and XP. Reach player level 5 to unlock the in-round shop.' },
    { glyph: '▮', title: 'PAUSE', text: 'Press P or Escape at any time to pause your run.' }
  ];

  var STORE_KEY = 'ag_tutorial_seen';

  function Tutorial() {
    this.root = $('tutorial');
    this.index = 0;
    if (!this.root) return;
    this.title = $('tutorial-title');
    this.text = $('tutorial-text');
    this.glyph = $('tutorial-glyph');
    this.dots = $('tutorial-dots');
    this.prev = $('tutorial-prev');
    this.next = $('tutorial-next');
    this._buildDots();
    this._bind();
    this.show(0);
  }

  Tutorial.prototype = {
    _buildDots: function () {
      var self = this;
      this.dots.textContent = '';
      SLIDES.forEach(function (slide, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'tutorial-dot';
        dot.setAttribute('aria-label', 'Slide ' + (i + 1));
        dot.addEventListener('click', function () { self.show(i); });
        self.dots.appendChild(dot);
      });
    },

    _bind: function () {
      var self = this;
      $('tutorial-close').addEventListener('click', function () { self.close(); });
      this.prev.addEventListener('click', function () { self.show(self.index - 1); });
      this.next.addEventListener('click', function () { self.show(self.index + 1); });
      $('btn-tutorial').addEventListener('click', function () { self.open(); });
      document.addEventListener('keydown', function (e) {
        if (self.root.classList.contains('hidden')) return;
        if (e.key === 'Escape') { self.close(); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { self.show(self.index + 1); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { self.show(self.index - 1); e.preventDefault(); }
      });
    },

    show: function (i) {
      this.index = Math.max(0, Math.min(SLIDES.length - 1, i));
      var slide = SLIDES[this.index];
      this.glyph.textContent = slide.glyph;
      this.title.textContent = slide.title;
      this.text.textContent = slide.text;
      this.prev.disabled = this.index === 0;
      this.next.disabled = this.index === SLIDES.length - 1;
      Array.prototype.forEach.call(this.dots.children, function (dot, n) {
        dot.classList.toggle('active', n === this.index);
      }, this);
    },

    open: function () {
      this.root.classList.remove('hidden');
      this.show(0);
      this._markSeen();
    },

    close: function () {
      this.root.classList.add('hidden');
      this._markSeen();
    },

    _markSeen: function () {
      try { global.localStorage.setItem(STORE_KEY, '1'); } catch (e) { /* file:// may block storage */ }
    },

    isOpen: function () { return !this.root.classList.contains('hidden'); }
  };

  AG.Tutorial = Tutorial;

  function init() {
    AG.tutorial = new Tutorial();
    var seen = false;
    try { seen = !!global.localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ }
    if (!seen && AG.tutorial.isOpen) global.setTimeout(function () { AG.tutorial.open(); }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
