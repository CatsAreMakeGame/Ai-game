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
  const armory = { inventoryTab: 'ships', shopTab: 'ships', autoOpen: false, result: '', part: '', ship: '', ingredient: '', grid: Array(9).fill('') };
  const armoryPanels = ['hangar', 'shop', 'inventory', 'outfit', 'craft', 'recipes'];
  const panelHistory = [];
  let mindAim = false;
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
    ['Fight the Mothership', 'Choose Easy, Medium, Hard or Endless. Every tenth wave adds a new boss and brings back the earlier bosses. Collect the Star Gems they drop.'],
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
    if (type === 'blast') view.blast(value);
    if (type === 'magnet-pickup') view.magnetPickup(value);
    if (type === 'enemy-damage') view.addDamageNumber(value);
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
    if (type === 'skip') {
      setText(banner, 'Wave ' + value.wave + ' skipped · ' + value.spawned + '/' + value.total + ' spawned · ' + value.resolved + ' cleared');
      waveUntil = now + 2600;
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
    if (!$('home').hidden) {
      const seconds = Math.max(0, Math.ceil((AG.EVENT_END - Date.now()) / 1000));
      const time = [Math.floor(seconds / 86400) + 'd', Math.floor(seconds / 3600) % 24 + 'h',
        Math.floor(seconds / 60) % 60 + 'm', seconds % 60 + 's'].join(' ');
      setText($('event-time'), seconds ? time + ' left' : 'Event ended');
    }
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
    const boss = active && run.enemies.find(enemy => (run.practice ? AG.BOSSES[enemy.type] : enemy.type === AG.mainBoss(run.wave) && !enemy.escort) && enemy.y > 65 && !enemy.allied);
    $('boss').hidden = !boss;
    $('boosts').hidden = !active || !Object.keys(run.boosts).length;
    $('ship-ability').hidden = !active || !(run.ship.ability || run.ship.alien);
    if (!active) return;
    if (run.ship.ability) {
      const state = run.aegisCooldown > 0 ? Math.ceil(run.aegisCooldown) + 's' : 'Ready';
      setText($('ship-ability'), run.ship.ability.name + ' · ' + state);
    }
    if (run.ship.alien) setText($('ship-ability'), run.tendrils.length + ' tendrils' + (game.profile.serumUsed ? ' · Mind control ' + (run.mindCooldown > 0 ? Math.ceil(run.mindCooldown) + 's' : 'ready') : ''));
    if (now >= rewardUntil && now < creditUntil) setText(alert, '+' + creditBatch + ' credits');
    if (boss) {
      setText($('boss-name'), AG.BOSSES[boss.type].name);
      setText($('boss-hp'), boss.hp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' / ' + boss.maxHp.toLocaleString() + ' HP');
      const health = $('boss-health');
      health.max = boss.maxHp;
      health.value = boss.hp;
    }
    setText($('wave'), run.practice ? 'Practice' : game.waveLabel);
    const effects = game.upgradeEffects();
    $('energy-hud').hidden = !effects.laser && !run.ship.alien;
    $('energy').value = run.energy;
    setText($('energy-value'), run.energy + '%');
    $('energy-hud').classList.toggle('energy-full', run.energy === 100);
    $('target-control').hidden = !effects.missile;
    $('target-mode').disabled = Boolean(panelKind);
    if ($('target-mode').value !== run.targetMode) $('target-mode').value = run.targetMode;
    $('laser-toggle').hidden = !effects.laser;
    $('laser-toggle').disabled = Boolean(panelKind) || game.state !== 'playing' || run.energy < 3;
    $('laser-toggle').setAttribute('aria-pressed', String(game.laserActive()));
    $('laser-toggle').title = 'Right-click or hold ' + game.profile.bindings.laser.toUpperCase();
    const relay = $('relay-toggle');
    relay.hidden = !effects.boostRelay || !!run.practice;
    relay.disabled = Boolean(panelKind) || !['playing', 'intermission'].includes(game.state);
    relay.setAttribute('aria-pressed', String(run.boostRelayOn));
    relay.title = 'Toggle with ' + game.profile.bindings.relay.toUpperCase();
    setText(relay, 'Auto boosts · ' + (run.boostRelayOn ? 'On' : 'Off'));
    $('alien-actions').hidden = !run.ship.alien;
    $('tendril-extend').disabled = Boolean(panelKind) || game.state !== 'playing' || run.energy < 1;
    $('tendril-retract').disabled = Boolean(panelKind) || !run.tendrils.length;
    $('mind-toggle').hidden = !game.profile.serumUsed;
    $('mind-toggle').disabled = Boolean(panelKind) || game.state !== 'playing' || run.mindCooldown > 0;
    $('mind-toggle').setAttribute('aria-pressed', String(mindAim));
    setText($('mind-toggle'), mindAim ? 'Tap an enemy' : 'Mind control');
    for (let i = 0; i < 2; i++) {
      const id = game.profile.favoriteBoosts[i];
      const quick = $('boost-favorite-' + i);
      quick.hidden = !id;
      if (!id) continue;
      quick.disabled = Boolean(panelKind) || !game.canUseBoost(id);
      if (quick.dataset.item !== id) {
        quick.dataset.item = id;
        quick.replaceChildren(AG.itemGraphic(id), element('span'));
        quick.title = AG.BOOSTS[id].name;
        quick.setAttribute('aria-label', AG.BOOSTS[id].name);
      }
      setText(quick.lastElementChild, '×' + (game.profile.boosts[id] ?? 0));
    }
    setText($('hull-value'), Number(run.player.hp.toFixed(1)) + '/' + run.ship.hull);
    setText($('level'), 'LV ' + run.level);
    setText($('score'), run.score.toLocaleString());
    setText($('credits'), game.credits.toLocaleString());
    setText($('gems'), game.profile.gems);
    $('hull').value = 100 * run.player.hp / run.ship.hull;
    $('xp').value = run.level === 50 ? 100 : 100 * run.xp / AG.xpForLevel(run.level);
    const percent = Math.round(100 * run.resolved / run.total);
    $('completion').value = percent;
    setText($('completion-value'), run.spawned + '/' + run.total + ' spawned · ' + run.resolved + ' cleared');
    setText($('boosts'), Object.entries(run.boosts).map(([key, timers]) => {
      const seconds = key === 'shield' || key === 'fortress' ?
        timers.reduce((sum, time) => sum + time, 0) : Math.max(...timers);
      return AG.BOOSTS[key].name + (timers.length > 1 ? ' ×' + timers.length : '') + ' ' + Math.ceil(seconds) + 's';
    }).join(' · '));
    $('skip').disabled = !game.canSkip() || Boolean(panelKind);
    syncAutoSkip();
    const levelLocked = run.level < AG.SUPPLY_LEVEL;
    const icon = levelLocked ? AG.ICONS.locked : AG.ICONS.supplies;
    if ($('supply-icon').getAttribute('src') !== icon) $('supply-icon').src = icon;
    setText($('supply-label'), levelLocked ? 'Supplies · Lv 5' : 'Supplies');
    $('supplies').disabled = !!run.practice || levelLocked || game.state !== 'intermission' || Boolean(panelKind);
    $('supplies').title = levelLocked ? 'Unlocks at pilot level 5' : 'Available between cleared waves';
    $('inventory').disabled = Boolean(panelKind) || !!run.practice;
    $('pause').disabled = Boolean(panelKind);
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
    const wave = game.profile.modeRecords[game.profile.mode] ?? (game.profile.mode === 'hard' ? game.profile.bestWave : 0);
    $('record').hidden = !wave;
    $('mode').value = game.profile.mode;
    $('continue').hidden = !game.canContinue();
    if (!$('continue').hidden) setText($('continue'), 'Continue · Wave ' + (game.profile.checkpoint.wave + 1).toLocaleString());
    setText($('record'), 'BEST WAVE ' + wave.toLocaleString() + '  ·  HIGH SCORE ' + game.profile.bestScore.toLocaleString());
  }

  function showHome() {
    panelHistory.length = 0;
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
    panelHistory.length = 0;
    game.newRun();
    resumeFlight();
  }

  function resumeFlight() {
    mindAim = false;
    panelHistory.length = 0;
    if (game.profile.sound) audio.unlock();
    adminReturn = null;
    panelKind = '';
    panel.hidden = overlay.hidden = true;
    view.effects.length = 0;
    view.damageNumbers.length = 0;
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

  function navigate(kind, values = {}) {
    if (kind !== panelKind) panelHistory.push({
      kind: panelKind, inventoryTab: armory.inventoryTab, shopTab: armory.shopTab,
      part: armory.part, ship: armory.ship, focus: document.activeElement?.textContent
    });
    open(kind, false);
    if (Object.keys(values).length) {
      Object.assign(armory, values);
      drawPanel();
    }
  }

  function dismiss() {
    const kind = panelKind;
    mindAim = false;
    if (kind === 'craft') { armory.grid.fill(''); armory.ingredient = ''; }
    if ((armoryPanels.includes(kind) || kind === 'settings' || kind === 'keybinds') && panelHistory.length) {
      const parent = panelHistory.pop();
      resetPanelDraft();
      Object.assign(armory, { inventoryTab: parent.inventoryTab, shopTab: parent.shopTab, part: parent.part, ship: parent.ship });
      if (!parent.kind) closePanel();
      else {
        panelKind = parent.kind;
        drawPanel();
        ([...body.querySelectorAll('button')].find(control => !control.disabled && control.textContent === parent.focus) ?? $('close')).focus();
      }
      return;
    }
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
    if (armoryPanels.includes(kind) && ['gameover', 'victory'].includes(game.state)) {
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
    if (normalReturn) normalReturn.history = panelHistory.splice(0);
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
    view.damageNumbers.length = 0;
    rewardUntil = creditUntil = announcementUntil = waveUntil = 0;
    panelHistory.splice(0, panelHistory.length, ...(normalReturn?.history ?? []));
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
    } else if (armoryPanels.includes(panelKind)) {
      const titles = { hangar: 'Hangar', shop: 'Shop', inventory: 'Inventory', outfit: 'Outfitting', craft: 'Crafting', recipes: 'Recipes' };
      setText(title, titles[panelKind]);
      AG.renderArmory({ kind: panelKind, state: armory, game, body, button, element, dismiss,
        open: navigate, refresh: () => drawPanel(true), practice: kind => {
          game.startPractice(kind);
          resumeFlight();
        } });
    } else if (panelKind === 'settings') {
      setText(title, 'Settings');
      const actions = element('div', '', 'home-actions');
      actions.append(AG.menuIcon(button('Keybinds', () => navigate('keybinds')), 'keybinds'), button('Back', dismiss));
      body.append(actions);
    } else if (panelKind === 'keybinds') {
      setText(title, 'Keybinds');
      const status = element('p', '', 'panel-note');
      status.setAttribute('role', 'status');
      function binding(id, name) {
        const label = element('label', name);
        const input = element('input');
        input.maxLength = 1;
        input.value = game.profile.bindings[id].toUpperCase();
        input.addEventListener('change', () => {
          const saved = game.setBinding(id, input.value.toLowerCase());
          input.value = game.profile.bindings[id].toUpperCase();
          status.textContent = saved ? name + ' key saved.' : 'Choose an unused letter. WASD, P and I are reserved.';
        });
        label.append(input);
        return label;
      }
      for (const [name, bindings] of [
        ['Alien Spaceship', [['extend', 'Extend tendril'], ['retract', 'Retract tendril']]],
        ['Equipment', [['laser', 'Lightning Beacon'], ['relay', 'Toggle Boost Relay']]]
      ]) {
        const section = element('section', '', 'keybind-section');
        const grid = element('div', '', 'settings-grid');
        for (const [id, label] of bindings) grid.append(binding(id, label));
        section.append(element('h3', name), grid);
        body.append(section);
      }
      body.append(status, button('Back', dismiss));
    } else if (panelKind === 'admin') {
      setText(title, 'Admin testing');
      AG.renderAdmin({ body, game, button, element, dismiss, resumeFlight, enterTesting, exitTesting,
        refresh: () => drawPanel(true), shop: () => navigate('shop'),
        inventory: () => navigate('inventory') });
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
      setText(note, 'Wave ' + game.waveLabel + '  ·  Score ' + game.run.score.toLocaleString());
      note.hidden = false;
      const actions = element('div', '', 'home-actions');
      if (paused) actions.append(button('Resume', dismiss, { primary: true }), button('Admin', openAdmin));
      else {
        const stats = game.run.stats;
        const bosses = Object.entries(stats.bossKills).map(([id, count]) => AG.BOSSES[id].name + ' ×' + count).join(' · ');
        const summary = element('ul', '', 'run-summary');
        for (const entry of [game.state === 'gameover' ? 'Final hit · ' + (stats.lastHit || 'Unknown') : '',
          'Bosses defeated · ' + (bosses || 'None'), 'Star Gems collected · ' + stats.gems,
          'Rarest pickup · ' + (AG.ITEMS[stats.rarest]?.name ?? 'None')]) if (entry) summary.append(element('li', entry));
        body.append(summary);
        actions.append(button('Launch again', start, { primary: true }),
          button('Hangar', () => navigate('hangar')), button('Shop', () => navigate('shop')), button('Inventory', () => navigate('inventory')));
      }
      actions.append(game.run.practice ? button('Exit practice', () => {
        showHome();
        open('hangar');
      }) : button('Main menu', showHome));
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
  $('continue').addEventListener('click', () => { if (game.continueRun()) resumeFlight(); });
  $('mode').addEventListener('change', () => { game.profile.mode = $('mode').value; game.save(); refreshRecord(); });
  $('settings').addEventListener('click', () => {
    if (panelKind === 'settings') dismiss();
    else if (panelKind) navigate('settings');
    else open('settings');
  });
  $('outfit-open').addEventListener('click', () => { armory.ship = game.profile.ship; open('outfit'); });
  $('craft-open').addEventListener('click', () => open('craft'));
  $('hangar-open').addEventListener('click', () => open('hangar'));
  $('shop-open').addEventListener('click', () => open('shop'));
  $('admin').addEventListener('click', openAdmin);
  function openInventory() {
    if (panelKind === 'inventory') dismiss();
    else if (!panelKind && !game.run?.practice && (game.canVisitBase() || ['playing', 'intermission'].includes(game.state))) open('inventory');
  }
  $('inventory').addEventListener('click', openInventory);
  $('inventory-home').addEventListener('click', openInventory);
  $('help').addEventListener('click', () => { tutorialIndex = 0; open('tutorial'); });
  $('close').addEventListener('click', dismiss);
  $('skip').addEventListener('click', () => game.skip());
  function syncAutoSkip() {
    const toggle = $('auto');
    const enabled = game.profile.auto;
    toggle.setAttribute('aria-pressed', String(enabled));
    setText($('auto-state'), enabled ? 'On' : 'Off');
    toggle.title = game.run?.diff.boss
      ? 'Boss waves cannot be skipped. This setting applies to later waves.'
      : 'Automatically advance after 60% of the wave has spawned.';
  }
  $('auto').addEventListener('click', () => {
    game.profile.auto = !game.profile.auto;
    game.save();
    syncAutoSkip();
  });
  $('supplies').addEventListener('click', () => {
    if (game.state === 'intermission' && game.run.level >= AG.SUPPLY_LEVEL) open('supplies');
  });
  $('pause').addEventListener('click', pause);
  $('tendril-extend').addEventListener('click', () => { if (!panelKind) game.extendTendril(); });
  $('tendril-retract').addEventListener('click', () => { if (!panelKind) game.retractTendril(); });
  $('mind-toggle').addEventListener('click', () => { mindAim = !mindAim; });
  for (let i = 0; i < 2; i++) $('boost-favorite-' + i).addEventListener('click', () => {
    const id = game.profile.favoriteBoosts[i];
    if (!panelKind && id) game.useBoost(id);
  });
  $('target-mode').addEventListener('change', () => {
    const choice = $('target-mode').value;
    if (game.run && Object.hasOwn(AG.TARGET_MODES, choice)) game.run.targetMode = choice;
    canvas.focus({ preventScroll: true });
  });
  $('laser-toggle').addEventListener('click', () => {
    if (!panelKind) game.laserInput('toggle');
    canvas.focus({ preventScroll: true });
  });

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

  function trackAim(event) {
    if (!game.run || panelKind) return;
    const box = canvas.getBoundingClientRect();
    const point = { x: (event.clientX - box.left) / box.width * AG.WIDTH,
      y: (event.clientY - box.top) / box.height * AG.HEIGHT };
    game.run.laser.aim = point;
    return point;
  }
  canvas.addEventListener('contextmenu', event => {
    if (!panelKind && game.state === 'playing' && game.upgradeEffects().laser) event.preventDefault();
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointerId !== null || panelKind || !['playing', 'intermission'].includes(game.state)) return;
    const point = trackAim(event);
    if ((event.pointerType === 'mouse' || mindAim) && game.mindControl(point)) { mindAim = false; return; }
    if (mindAim) return;
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    game.pointer = point;
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 2 || panelKind) return;
    trackAim(event);
    game.laserInput('toggle');
  });
  canvas.addEventListener('pointermove', event => {
    const aim = trackAim(event);
    if (aim && event.pointerId === pointerId) game.pointer = aim;
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
    const bindings = game.profile.bindings;
    if (key === bindings.relay && !panelKind && !event.repeat && game.toggleBoostRelay()) {
      event.preventDefault();
    } else if (key === bindings.laser && !panelKind && game.state === 'playing' && game.upgradeEffects().laser) {
      event.preventDefault();
      if (!event.repeat) game.laserInput('hold');
    } else if (!panelKind && !event.repeat && game.run?.ship.alien && (key === bindings.extend || key === bindings.retract)) {
      if (key === bindings.extend) game.extendTendril();
      else game.retractTendril();
    } else if (key === 'i' && !event.repeat && (!panelKind || panelKind === 'inventory')) {
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
  window.addEventListener('keyup', event => {
    const key = event.key.toLowerCase();
    game.keys.delete(key);
    if (key === game.profile.bindings.laser) game.laserInput('release');
  });
  window.addEventListener('blur', () => {
    game.releaseInput();
    pointerId = null;
    pause();
  });

  $('relay-toggle').addEventListener('click', () => { if (!panelKind) game.toggleBoostRelay(); });

  let previous = performance.now();
  let accumulated = 0;
  const tick = 1 / 120;
  function frame(now) {
    const dt = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    const gameDt = dt * game.simulationSpeed;
    accumulated += panelKind ? 0 : gameDt;
    while (accumulated >= tick) {
      if (!panelKind) game.update(tick);
      accumulated -= tick;
    }
    if (!panelKind && ['gameover', 'victory'].includes(game.state)) open('result');
    view.draw(game, panelKind && game.run ? 0 : game.run ? gameDt : dt);
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
