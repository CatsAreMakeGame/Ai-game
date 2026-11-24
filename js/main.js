(() => {
  'use strict';

  const AG = window.AG;
  const $ = id => document.getElementById(id);
  const canvas = $('sky');
  const view = new AG.FlightView(canvas);
  const audio = new AG.FlightAudio();
  const game = new AG.Game(getStorage(), notify);
  const controls = $('controls');
  const hud = $('hud');
  const overlay = $('overlay');
  const panel = $('panel');
  const body = $('panel-body');
  const note = $('panel-note');
  const alert = $('alert');
  const banner = $('wave-message');
  let panelKind = '';
  let returnFocus = $('launch');
  let tutorialIndex = 0;
  const armory = { inventoryTab: 'ships', shopTab: 'ships', autoOpen: false, result: '', part: '' };
  const loot = new Map();
  let adminUnlocked = false;
  try { adminUnlocked = sessionStorage.getItem('alien-shooter.admin') === 'yes'; } catch {}
  let adminReturn = null;
  let normalReturn = null;
  let announcementUntil = 0;
  let rewardUntil = 0;
  let waveUntil = 0;
  let creditBatch = 0;
  let creditUntil = 0;
  let pointerId = null;

  const tutorial = [
    ['Steer your ship', 'Move left and right with A/D, the arrow keys, or a held drag. Find and equip the rare Vector Engine to move up and down.'],
    ['Fire automatically', 'Your ship fires whenever a wave is active. Line up with enemies and dodge incoming fire.'],
    ['Fight the Mothership', 'Survive 50 waves. Every tenth wave adds a new boss and brings back the earlier bosses. Collect the Star Gems they drop.'],
    ['Skip reinforcements', 'Skip Wave advances to the next wave and enemies already on the field stay in play. Auto Skip waits for 60% to spawn. Boss waves must be cleared.'],
    ['Level up and resupply', 'Earn pilot XP from combat. At level 5, spend Credits on repairs and rapid fire between cleared waves.'],
    ['Use your inventory', 'Fly into drops to store them. Open Inventory or press I to view Ships, Upgrades, Boosts and Crates. Fit parts in Outfit ship.'],
    ['Fly the Falcon', 'Spend Credits on the Falcon, or use Star Gems for a crate. Equip ships in the Hangar. Both menus are available before or after a run.']
  ];

  function getStorage() {
    try { return window.localStorage; } catch { return null; }
  }

  function setText(element, text) {
    const value = String(text);
    if (element.textContent !== value) element.textContent = value;
  }

  function notify(type, value) {
    const now = performance.now();
    if (game.profile.sound) audio.play(type);
    if (type === 'destroy') view.burst(value);
    if (type === 'loot') {
      const { type: id, amount } = value;
      const strip = $('loot-strip');
      let entry = loot.get(id);
      if (!entry) {
        const item = AG.ITEMS[id];
        const tile = element('div', '', 'loot-tile');
        tile.style.setProperty('--rarity', AG.RARITIES[item.rarity ?? 'common']);
        const count = element('strong');
        tile.append(AG.itemGraphic(id), element('span', item.name), count);
        strip.append(tile);
        entry = { tile, count, amount: 0 };
        loot.set(id, entry);
      }
      entry.amount += amount;
      entry.until = now + 2800;
      setText(entry.count, '×' + entry.amount);
    }
    if (type === 'wave') {
      setText(banner, value);
      waveUntil = now + 1600;
    }
    if (type === 'upgrade') {
      setText(alert, value);
      announcementUntil = now + 1700;
      rewardUntil = announcementUntil;
    }
    if (type === 'reward') {
      const credits = /^\+(\d+) credits$/.exec(value);
      if (credits) {
        creditBatch = (creditUntil > now ? creditBatch : 0) + Number(credits[1]);
        creditUntil = now + 950;
      }
      if (now >= announcementUntil && !credits) {
        setText(alert, value);
        rewardUntil = now + 1350;
      }
    }
  }

  function renderHUD(now) {
    for (const [id, entry] of loot) {
      if (entry.until > now) continue;
      entry.tile.remove();
      loot.delete(id);
    }
    const run = game.run;
    const active = ['playing', 'intermission', 'paused'].includes(game.state);
    hud.hidden = controls.hidden = !active;
    setText($('admin'), game.testing ? 'Admin · Testing' : 'Admin');
    alert.hidden = !active || Boolean(panelKind) || now >= Math.max(rewardUntil, creditUntil);
    banner.hidden = !active || Boolean(panelKind) || now >= waveUntil;
    const boss = active && run.enemies.find(enemy => AG.BOSSES[enemy.type] && enemy.y > 65);
    $('boss').hidden = !boss;
    $('boosts').hidden = !active || !Object.keys(run.boosts).length;
    if (!active) return;
    if (now >= rewardUntil && now < creditUntil) setText(alert, '+' + creditBatch + ' credits');
    if (boss) {
      setText($('boss-name'), AG.BOSSES[boss.type].name);
      $('boss-health').value = 100 * boss.hp / boss.maxHp;
    }
    setText($('wave'), run.wave.toLocaleString() + ' / ' + game.waveLimit.toLocaleString());
    setText($('hull-value'), run.player.hp + '/' + run.ship.hull);
    setText($('level'), 'LV ' + run.level);
    setText($('score'), run.score.toLocaleString());
    setText($('credits'), game.credits.toLocaleString());
    setText($('gems'), game.profile.gems);
    $('hull').value = 100 * run.player.hp / run.ship.hull;
    $('xp').value = run.level === 50 ? 100 : 100 * run.xp / AG.xpForLevel(run.level);
    const percent = Math.round(100 * run.resolved / run.total);
    $('completion').value = percent;
    setText($('completion-value'), percent + '%');
    setText($('boosts'), Object.entries(run.boosts).map(([key, seconds]) =>
      AG.BOOSTS[key].name + ' ' + Math.ceil(seconds) + 's').join(' · '));
    $('skip').disabled = !game.canSkip() || Boolean(panelKind);
    $('auto').disabled = run.diff.boss || Boolean(panelKind);
    $('auto').setAttribute('aria-pressed', String(game.profile.auto));
    $('auto').title = run.diff.boss ? 'Boss waves must be cleared' : 'Advance at 60% spawned';
    const levelLocked = run.level < AG.SUPPLY_LEVEL;
    const icon = levelLocked ? AG.ICONS.locked : AG.ICONS.supplies;
    if ($('supply-icon').getAttribute('src') !== icon) $('supply-icon').src = icon;
    setText($('supply-label'), levelLocked ? 'Supplies · Lv 5' : 'Supplies');
    $('supplies').disabled = levelLocked || game.state !== 'intermission' || Boolean(panelKind);
    $('supplies').title = levelLocked ? 'Unlocks at pilot level 5' : 'Available between cleared waves';
    $('inventory').disabled = $('pause').disabled = Boolean(panelKind);
  }

  function button(label, action, options = {}) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.addEventListener('click', action);
    if (options.primary) element.className = 'primary';
    element.disabled = Boolean(options.disabled);
    return element;
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function card(name, description, action) {
    const row = element('div', '', 'card');
    const copy = element('div');
    copy.append(element('strong', name), element('small', description));
    row.append(copy, action);
    return row;
  }

  function refreshRecord() {
    $('record').hidden = !game.profile.bestWave;
    setText($('record'), 'BEST WAVE ' + game.profile.bestWave + '  ·  HIGH SCORE ' + game.profile.bestScore.toLocaleString());
  }

  function showHome() {
    game.state = 'home';
    game.run = null;
    game.releaseInput();
    panelKind = '';
    panel.hidden = true;
    overlay.hidden = false;
    $('home').hidden = false;
    refreshRecord();
    $('launch').focus();
  }

  function start() {
    game.start();
    resumeFlight();
  }

  function resumeFlight() {
    if (game.profile.sound) audio.unlock();
    adminReturn = null;
    panelKind = '';
    panel.hidden = overlay.hidden = true;
    view.effects.length = 0;
    rewardUntil = creditUntil = announcementUntil = 0;
    canvas.tabIndex = -1;
    canvas.focus({ preventScroll: true });
  }

  function resetPanelDraft() {
    armory.autoOpen = false;
    armory.result = '';
    armory.part = '';
  }

  function open(kind, rememberFocus = true) {
    if (panelKind !== kind) resetPanelDraft();
    if (rememberFocus) returnFocus = document.activeElement;
    game.releaseInput();
    pointerId = null;
    panelKind = kind;
    drawPanel();
    (kind === 'result' ? body.querySelector('button') : $('close')).focus({ preventScroll: true });
  }

  function dismiss() {
    const kind = panelKind;
    resetPanelDraft();
    if (kind === 'tutorial') {
      game.profile.tutorialSeen = true;
      game.save();
    }
    if (kind === 'pause') game.state = game.resumeState;
    if (kind === 'result') {
      showHome();
      return;
    }
    if (kind === 'admin') {
      const previous = adminReturn;
      adminReturn = null;
      restorePanel(previous);
      return;
    }
    if (['hangar', 'shop', 'inventory', 'outfit'].includes(kind) && ['gameover', 'victory'].includes(game.state)) {
      open('result', false);
      return;
    }
    closePanel();
  }

  function closePanel() {
    panelKind = '';
    panel.hidden = true;
    overlay.hidden = game.state !== 'home';
    $('home').hidden = game.state !== 'home';
    if (game.state === 'home') refreshRecord();
    const target = returnFocus?.isConnected && !returnFocus.disabled && returnFocus !== document.body ? returnFocus : canvas;
    target.focus({ preventScroll: true });
  }

  function restorePanel(previous) {
    if (previous) returnFocus = previous.focus;
    if (previous?.kind && previous.state === game.state) {
      open(previous.kind, false);
    } else if (['gameover', 'victory'].includes(game.state)) {
      open('result', false);
    } else {
      closePanel();
    }
  }

  function openAdmin() {
    if (panelKind === 'admin') {
      dismiss();
      return;
    }
    adminReturn = { kind: panelKind, state: game.state, focus: panelKind ? returnFocus : document.activeElement };
    if (!game.testing && adminUnlocked) enterTesting();
    else open('admin', false);
    body.querySelector('input')?.focus({ preventScroll: true });
  }

  function enterTesting() {
    normalReturn = adminReturn;
    adminReturn = null;
    game.enterTesting();
    adminUnlocked = true;
    try { sessionStorage.setItem('alien-shooter.admin', 'yes'); } catch {}
    syncAudio();
    open('admin', false);
  }

  function exitTesting() {
    game.leaveTesting();
    $('loot-strip').replaceChildren();
    loot.clear();
    syncAudio();
    adminReturn = null;
    view.effects.length = 0;
    rewardUntil = creditUntil = announcementUntil = waveUntil = 0;
    restorePanel(normalReturn);
    normalReturn = null;
  }

  function drawPanel(restoreFocus = false) {
    const buttonIndex = [...body.querySelectorAll('button')].indexOf(document.activeElement);
    const priorScroll = overlay.scrollTop;
    overlay.hidden = panel.hidden = false;
    $('home').hidden = true;
    note.hidden = true;
    body.replaceChildren();
    const title = $('panel-title');
    if (panelKind === 'tutorial') {
      setText(title, 'Flight training');
      const [name, copy] = tutorial[tutorialIndex];
      const slide = element('article', '', 'tutorial-slide');
      slide.append(element('h3', name), element('p', copy));
      const nav = element('div', '', 'tutorial-nav');
      const dots = element('div', '', 'dots');
      tutorial.forEach((_, index) => {
        const dot = button(index === tutorialIndex ? '●' : '·', () => showSlide(index));
        dot.setAttribute('aria-label', 'Slide ' + (index + 1) + ' of ' + tutorial.length);
        dot.setAttribute('aria-pressed', String(index === tutorialIndex));
        dots.append(dot);
      });
      nav.append(button('Previous', () => showSlide(tutorialIndex - 1), { disabled: tutorialIndex === 0 }),
        dots, button(tutorialIndex === tutorial.length - 1 ? 'Done' : 'Next',
          () => tutorialIndex === tutorial.length - 1 ? dismiss() : showSlide(tutorialIndex + 1), { primary: true }));
      body.append(slide, nav);
    } else if (['hangar', 'shop', 'inventory', 'outfit'].includes(panelKind)) {
      const titles = { hangar: 'Hangar', shop: 'Shop', inventory: 'Inventory', outfit: 'Outfit ship' };
      setText(title, titles[panelKind]);
      AG.renderArmory({ kind: panelKind, state: armory, game, body, button, element, dismiss,
        open: kind => open(kind, false), refresh: () => drawPanel(true) });
    } else if (panelKind === 'admin') {
      setText(title, 'Admin testing');
      AG.renderAdmin({ body, game, button, element, dismiss, resumeFlight, enterTesting, exitTesting,
        refresh: () => drawPanel(true), shop: () => open('shop', false),
        inventory: () => open('inventory', false) });
    } else if (panelKind === 'supplies') {
      setText(title, 'Flight supplies');
      setText(note, 'Credits available  ·  ' + game.credits);
      note.hidden = false;
      const cards = element('div', '', 'cards');
      for (const [type, supply] of Object.entries(AG.SUPPLIES)) {
        const full = type === 'heal' && game.run.player.hp === game.run.ship.hull;
        cards.append(card(supply.name, supply.description, button(full ? 'Hull full' : supply.price + ' Credits', () => {
          game.buy(type);
          drawPanel(true);
        }, { disabled: !game.canBuy(type) })));
      }
      body.append(cards, button('Back to flight', dismiss, { primary: true }));
    } else {
      const paused = panelKind === 'pause';
      setText(title, paused ? 'Flight paused' : game.state === 'victory' ? 'Sector secured' : 'Ship lost');
      setText(note, 'Wave ' + game.run.wave.toLocaleString() + ' / ' + game.waveLimit.toLocaleString() + '  ·  Score ' + game.run.score.toLocaleString());
      note.hidden = false;
      const actions = element('div', '', 'home-actions');
      if (paused) actions.append(button('Resume', dismiss, { primary: true }), button('Admin', openAdmin));
      else actions.append(button('Launch again', start, { primary: true }),
        button('Hangar', () => open('hangar')), button('Shop', () => open('shop')),
        button('Inventory', () => open('inventory')));
      actions.append(button('Main menu', showHome));
      body.append(actions);
    }
    if (restoreFocus) {
      const candidate = body.querySelectorAll('button')[buttonIndex];
      (candidate && !candidate.disabled ? candidate : $('close')).focus({ preventScroll: true });
      overlay.scrollTop = priorScroll;
    } else {
      overlay.scrollTop = 0;
    }
  }

  function showSlide(index) {
    tutorialIndex = AG.clamp(index, 0, tutorial.length - 1);
    drawPanel(true);
  }

  function pause() {
    if (!['playing', 'intermission'].includes(game.state) || panelKind) return;
    game.resumeState = game.state;
    game.state = 'paused';
    open('pause');
  }

  $('launch').addEventListener('click', start);
  $('hangar-open').addEventListener('click', () => open('hangar'));
  $('shop-open').addEventListener('click', () => open('shop'));
  $('admin').addEventListener('click', openAdmin);
  function openInventory() {
    if (panelKind === 'inventory') dismiss();
    else if (!panelKind && (game.canVisitBase() || ['playing', 'intermission'].includes(game.state))) open('inventory');
  }
  $('inventory').addEventListener('click', openInventory);
  $('inventory-home').addEventListener('click', openInventory);
  $('help').addEventListener('click', () => { tutorialIndex = 0; open('tutorial'); });
  $('close').addEventListener('click', dismiss);
  $('skip').addEventListener('click', () => game.skip());
  $('auto').addEventListener('click', () => {
    game.profile.auto = !game.profile.auto;
    game.save();
  });
  $('supplies').addEventListener('click', () => {
    if (game.state === 'intermission' && game.run.level >= AG.SUPPLY_LEVEL) open('supplies');
  });
  $('pause').addEventListener('click', pause);

  function syncAudio() {
    $('sound').setAttribute('aria-pressed', String(game.profile.sound));
    setText($('sound'), game.profile.sound ? 'Sound on' : 'Sound off');
  }
  $('sound').addEventListener('click', () => {
    game.profile.sound = !game.profile.sound;
    if (game.profile.sound) audio.unlock();
    game.save();
    syncAudio();
  });

  function trackPointer(event) {
    const box = canvas.getBoundingClientRect();
    game.pointer = { x: (event.clientX - box.left) / box.width * AG.WIDTH,
      y: (event.clientY - box.top) / box.height * AG.HEIGHT };
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointerId !== null || panelKind || !['playing', 'intermission'].includes(game.state)) return;
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    trackPointer(event);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId === pointerId) trackPointer(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      game.pointer = null;
    });
  }

  const moveKeys = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd']);
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || document.querySelector('.crate-reveal[open]')) return;
    const key = event.key.toLowerCase();
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) && key !== 'escape') return;
    if (key === 'i' && !event.repeat && (!panelKind || panelKind === 'inventory')) {
      openInventory();
    } else if (key === 'escape' || key === 'p') {
      event.preventDefault();
      if (event.repeat) return;
      if (panelKind) dismiss();
      else pause();
    } else if (panelKind === 'tutorial' && ['arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
      showSlide(tutorialIndex + (key === 'arrowleft' ? -1 : 1));
    } else if (key === 'enter' && !event.repeat && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'A'
      && (!panelKind && game.state === 'home' || panelKind === 'result')) {
      event.preventDefault();
      start();
    } else if (!panelKind && ['playing', 'intermission'].includes(game.state) && moveKeys.has(key)) {
      event.preventDefault();
      game.keys.add(key);
    }
  });
  window.addEventListener('keyup', event => game.keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => {
    game.releaseInput();
    pointerId = null;
    pause();
  });

  let previous = performance.now();
  let accumulated = 0;
  const tick = 1 / 120;
  function frame(now) {
    const dt = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    accumulated += dt;
    while (accumulated >= tick) {
      if (!panelKind) game.update(tick);
      accumulated -= tick;
    }
    if (!panelKind && ['gameover', 'victory'].includes(game.state)) open('result');
    view.draw(game, panelKind && game.run ? 0 : dt);
    renderHUD(now);
    requestAnimationFrame(frame);
  }

  for (const [id, symbol] of [['credits', '●'], ['gems', '◆']]) {
    const icon = $(id).previousElementSibling;
    const fallback = () => {
      const text = element('span', symbol);
      text.setAttribute('aria-label', icon.alt);
      icon.replaceWith(text);
    };
    icon.addEventListener('error', fallback, { once: true });
    if (icon.complete && !icon.naturalWidth) fallback();
  }

  AG.game = game;
  refreshRecord();
  syncAudio();
  if (!game.profile.tutorialSeen) {
    returnFocus = $('launch');
    open('tutorial', false);
  }
  requestAnimationFrame(frame);
})();
