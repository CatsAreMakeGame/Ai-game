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
  const armory = { inventoryTab: 'ships', shopTab: 'ships', result: '', part: '', ship: '', ingredient: '', grid: Array(9).fill('') };
  const armoryPanels = ['hangar', 'shop', 'inventory', 'outfit', 'craft', 'recipes', 'merchant', 'shipPicker', 'autoBoost'];
  const panelHistory = [];
  let mindAim = false;
  let hideTopMenu = false;
  let abandonedRewards = [];
  let panelRender = 0;
  let hoveredDrop = null;
  const sideNotices = [];
  let shopSeen = false;
  let merchantHintSent = false;
  let flightSeconds = 0;
  let nextMerchantCheck = 0;
  let nextQuestCheck = 0;
  const loot = new Map();
  let adminUnlocked = false;
  try { adminUnlocked = sessionStorage.getItem('alien-shooter.admin') === 'yes'; } catch {}
  game.adminUnlocked = adminUnlocked;
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
    ['Use your inventory', 'Fly into drops to store them. Between runs, open Inventory for boosts or Ship Loadout for upgrades.'],
    ['Fly the Falcon', 'Spend Credits on the Falcon, or use Star Gems for a crate. Equip ships in the Hangar. Both menus are available before or after a run.']
  ];

  function getStorage() {
    try { return window.localStorage; } catch { return null; }
  }

  function setText(element, text) {
    const value = String(text);
    if (element.textContent !== value) element.textContent = value;
  }

  function sideNotice(title, value, graphic) {
    const node = element('div', '', 'side-notice');
    const label = element('div');
    label.append(element('strong', title), element('small', value));
    if (graphic) node.append(graphic);
    node.append(label);
    $('side-notices').append(node);
    sideNotices.push({ node, until: performance.now() + 5500 });
    if (sideNotices.length > 4) sideNotices.shift().node.remove();
  }

  function notify(type, value) {
    const now = performance.now();
    if (game.profile.sound) audio.play(type);
    if (type === 'destroy') view.burst(value);
    if (type === 'blast') view.blast(value);
    if (type === 'enemy-damage') view.addDamageNumber(value);
    if (type === 'discovery') {
      const category = AG.SHIPS[value] ? 'ship' : AG.UPGRADES[value] ? 'upgrade' :
        AG.CRATES[value] ? 'crate' : AG.BOOSTS[value] ? 'boost' : 'item';
      sideNotice('New ' + category, AG.itemName(value), AG.itemGraphic(value, false));
    }
    if (type === 'milestone') sideNotice('Wave milestone', value);
    if (type === 'loot') {
      const { type: id, amount } = value;
      const strip = $('loot-strip');
      let entry = loot.get(id);
      if (!entry) {
        const item = AG.ITEMS[id];
        const tile = element('div', '', 'loot-tile');
        tile.style.setProperty('--rarity', AG.RARITIES[item.rarity ?? 'common']);
        const count = element('strong');
        tile.append(AG.itemGraphic(id), element('span', AG.itemName(id)), count);
        strip.append(tile);
        entry = { tile, count, amount: 0 };
        loot.set(id, entry);
      }
      entry.amount += amount;
      entry.until = now + 2800;
      setText(entry.count, '×' + (id === 'credit' || id === 'gem' ? AG.formatCurrency(entry.amount) : entry.amount));
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

  function renderActiveBoosts(run) {
    const display = $('boosts');
    const ids = run ? Object.keys(run.boosts) : [];
    if (run && game.hasEnergyOverdriveBoost()) ids.push('energyOverdrive');
    display.hidden = !ids.length;
    const signature = ids.join('|');
    if (display.dataset.effects !== signature) {
      display.dataset.effects = signature;
      display.replaceChildren(...ids.map(id => {
      const icon = AG.itemGraphic(id);
      icon.tabIndex = 0;
      icon.removeAttribute('aria-hidden');
      icon.setAttribute('aria-label', AG.itemName(id));
        const row = element('div', '', 'active-boost-row');
        row.append(icon, element('small'));
        return row;
      }));
    }
    for (const [index, id] of ids.entries()) {
      const timers = run.boosts[id] ?? [];
      const seconds = id === 'energyOverdrive' ? (run.energy - run.energyCap / 4) / 6 :
        timers.reduce((sum, time) => sum + time, 0);
      setText(display.children[index].lastElementChild, Math.ceil(Math.max(0, seconds)) + 's');
    }
  }

  let questPanelSignature = '';
  function rotateQuestCrateIcon(drawer) {
    const slot = drawer.querySelector('[data-quest-crate]');
    if (!slot) return;
    const index = Math.floor(performance.now() / 1000) % AG.QUEST_CRATES.length;
    const id = AG.QUEST_CRATES[index];
    if (slot.dataset.questCrate === id) return;
    slot.dataset.questCrate = id;
    slot.replaceChildren(AG.itemGraphic(id, false));
  }

  function questDescription(quest) {
    const count = quest.target;
    const plural = count === 1 ? '' : 's';
    if (quest.key === 'kills') return 'Defeat ' + count + (count === 1 ? ' enemy' : ' enemies');
    if (quest.key === 'pickups') return 'Collect ' + count + ' loot drop' + plural;
    if (quest.key === 'waves') return 'Clear ' + count + ' wave' + plural;
    if (quest.key === 'depth') return 'Clear wave ' + count;
    return 'Defeat ' + count + (count === 1 ? ' boss' : ' bosses');
  }

  function renderQuestPanel() {
    const anchor = $('quest-anchor');
    const drawer = $('quest-panel');
    anchor.hidden = !AG.questsActive(game.now()) || Boolean(panelKind) || game.state !== 'home';
    if (anchor.hidden || drawer.hidden) return;
    const daily = game.questDay();
    const completed = daily.completed;
    const unlocked = game.questLimit();
    const retirement = game.now() >= AG.SNOW_START;
    const available = game.canClaimQuestSupernova();
    const key = [daily.day, unlocked, completed, daily.claimed.join(','), JSON.stringify(daily.progress), retirement, available, game.itemCount('energyCore'), game.profile.questSupernovaTime].join('|');
    if (key === questPanelSignature) { rotateQuestCrateIcon(drawer); return; }
    questPanelSignature = key;
    const scroll = drawer.scrollTop;
    drawer.replaceChildren(element('h2', 'Quests'), element('p', completed + '/30 completed · ' + unlocked + ' unlocked', 'panel-note'));
    const claimAll = button('Claim All', () => { if (game.claimAllQuests()) renderQuestPanel(); }, { primary: true, disabled: completed <= daily.claimed.filter(id => id <= completed).length });
    drawer.append(claimAll);
    for (const quest of AG.QUESTS) {
      const locked = quest.id > unlocked;
      const done = daily.claimed.includes(quest.id);
      const finished = quest.id <= completed;
      const progress = finished ? quest.target : quest.id === completed + 1 ? Math.min(quest.target, daily.progress) : 0;
      const row = element('article', '', 'quest-row');
      row.append(element('strong', quest.id + '. ' + questDescription(quest)),
        element('small', locked ? 'Locked' : done ? 'Claimed' : finished ? 'Ready to claim' : quest.id > completed + 1 ? 'Complete previous quest' : progress + '/' + quest.target));
      const reward = element('div', '', 'quest-reward');
      for (const [item, quantity] of Object.entries(quest.reward)) {
        const entry = element('span', '', 'quest-reward-entry');
        if (item === 'randomCrate') {
          const rotatingIcon = element('span');
          rotatingIcon.dataset.questCrate = '';
          rotatingIcon.setAttribute('aria-hidden', 'true');
          entry.append(rotatingIcon, element('span', quantity + ' × Random crate'));
        }
        else entry.append(AG.itemGraphic(item), element('span', quantity + ' × ' + AG.itemName(item)));
        reward.append(entry);
      }
      row.append(reward);
      if (!locked && !done && finished) row.append(button('Claim', () => {
        if (game.claimQuest(quest.id)) renderQuestPanel();
      }));
      drawer.append(row);
    }
    const prize = element('section', '', 'quest-prize');
    const cooldown = game.now() - game.profile.questSupernovaTime < 86400000;
    const copy = !retirement ? 'Available when Premium Shop stock ends on 1 December.' :
      cooldown ? 'You can claim another Supernova 24 hours after your last claim.' :
        'Complete all 30 quests today and trade 1 Energy Core.';
    prize.append(AG.itemGraphic('supernova'), element('h3', 'Supernova'), element('p', copy),
      element('small', 'Energy Cores owned: ' + game.itemCount('energyCore')),
      button('Claim for 1 Energy Core', () => {
        if (game.claimQuestSupernova()) renderQuestPanel();
      }, { primary: true, disabled: !available }));
    drawer.append(prize);
    rotateQuestCrateIcon(drawer);
    drawer.scrollTop = scroll;
  }

  $('quest-toggle').addEventListener('click', () => {
    const drawer = $('quest-panel');
    drawer.hidden = !drawer.hidden;
    $('quest-toggle').setAttribute('aria-expanded', String(!drawer.hidden));
    renderQuestPanel();
  });

  function renderHUD(now) {
    while (sideNotices.length && sideNotices[0].until <= now) sideNotices.shift().node.remove();
    if (!$('home').hidden) {
      const credits = game.credits;
      const gems = game.profile.gems;
      setText($('home-credits'), AG.formatCurrency(credits));
      setText($('home-gems'), AG.formatCurrency(gems));
      $('home-credits').title = credits.toLocaleString();
      $('home-gems').title = gems.toLocaleString();
      const release = $('update-time');
      const wallTime = game.now();
      const christmasLive = AG.snowSeason(wallTime);
      const nextUpdate = [
        [AG.TRAILS_START, 'Trails Update', 'trails'],
        [AG.ALIEN_TOKEN_START, 'Alien Token Update', 'token']
      ]
        .find(([date]) => wallTime < date);
      const updateBanner = $('update-banner');
      const theme = nextUpdate?.[2] ?? 'christmas';
      if (updateBanner.dataset.theme !== theme) updateBanner.dataset.theme = theme;
      const target = nextUpdate?.[0] ?? (christmasLive ? AG.SNOW_END : AG.SNOW_START);
      const datetime = new Date(target).toISOString();
      if (release.dateTime !== datetime) release.dateTime = datetime;
      setText($('update-title'), nextUpdate?.[1] ?? 'Christmas Event');
      const left = Math.max(0, Math.ceil((target - wallTime) / 1000));
      const hours = Math.floor(left / 3600);
      const minutes = Math.floor(left / 60) % 60;
      const clock = left >= 86400 ? Math.floor(hours / 24) + 'd ' + hours % 24 + 'h' :
        hours + 'h ' + minutes + 'm' + (left <= 43200 ? ' ' + left % 60 + 's' : '');
      setText(release, !nextUpdate && wallTime >= AG.SNOW_END ? 'Event ended' : (christmasLive ? 'Ends in ' : 'Starts in ') + clock);
      const seconds = Math.max(0, Math.ceil((AG.EVENT_END - game.now()) / 1000));
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
    hud.hidden = controls.hidden = $('wave-actions').hidden = $('boost-dock').hidden = !active;
    const topToggle = $('hud-toggle');
    topToggle.hidden = !active;
    topToggle.setAttribute('aria-pressed', String(hideTopMenu));
    topToggle.setAttribute('aria-label', hideTopMenu ? 'Show top menu' : 'Hide top menu');
    setText(topToggle, hideTopMenu ? '▴' : '▾');
    $('flight-layout').classList.toggle('top-menu-hidden', active && hideTopMenu);
    $('flight-layout').classList.toggle('compact-energy', active && hideTopMenu && AG.balanceActive());
    $('flight-layout').classList.toggle('boost-left', game.profile.boostSide === 'left');
    $('combat-rim').hidden = !active;
    $('flight-layout').classList.toggle('snow-active', active && run.snowfall > 0);
    setText($('admin'), game.testing ? 'Admin · Testing' : 'Admin');
    alert.hidden = !active || Boolean(panelKind) || now >= Math.max(rewardUntil, creditUntil);
    banner.hidden = !active || Boolean(panelKind) || now >= waveUntil;
    const boss = active && run.enemies.find(enemy => (run.practice ? AG.BOSSES[enemy.type] : enemy.type === AG.mainBoss(run.wave) && !enemy.escort) && enemy.y > 65 && !enemy.allied);
    $('boss').hidden = !boss;
    renderActiveBoosts(active ? run : null);
    $('ship-ability').hidden = !active || !(run.ship.ability || run.ship.alien || ((game.testing || AG.contentActive()) && run.ship.barrage));
    if (!active) return;
    if (run.ship.ability) {
      const state = run.aegisShield > 0 ? Number(run.aegisShield.toFixed(1)) + ' shield' : run.aegisCooldown > 0 ? Math.ceil(run.aegisCooldown) + 's' : 'Ready';
      setText($('ship-ability'), run.ship.ability.name + ' · ' + state);
    }
    if ((game.testing || AG.contentActive()) && !run.ship.alien && run.ship.barrage) {
      const spec = run.ship.barrage;
      const state = !game.hasSingularityBarrage() ? 'Disabled by fitted ultimate' :
        run.barrage ? Math.max(0, spec.duration - run.barrage.elapsed).toFixed(1) + 's firing' :
        run.energy >= spec.energy ? 'Charged · waiting for enemies' : 'Charges at ' + spec.energy + '%';
      setText($('ship-ability'), spec.name + ' · ' + state);
    }
    if (run.ship.alien) setText($('ship-ability'), run.tendrils.length + ' tendrils' + (run.ship.mindControl ? ' · Mind control ' + (run.mindCooldown > 0 ? Math.ceil(run.mindCooldown) + 's' : 'ready') : ''));
    if (now >= rewardUntil && now < creditUntil) setText(alert, '+' + AG.formatCurrency(creditBatch) + ' credits');
    if (boss) {
      setText($('boss-name'), AG.BOSSES[boss.type].name);
      setText($('boss-hp'), boss.hp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' / ' + boss.maxHp.toLocaleString() + ' HP');
      const health = $('boss-health');
      health.max = boss.maxHp;
      health.value = boss.hp;
    }
    setText($('wave'), run.practice ? 'Practice' : game.waveLabel);
    const effects = game.upgradeEffects();
    $('energy').max = run.energyCap;
    $('energy').value = run.energy;
    setText($('energy-value'), Number(run.energy.toFixed(1)) + '% / ' + run.energyCap + '%');
    $('energy-hud').classList.toggle('energy-full', run.energy >= run.energyCap);
    $('target-control').hidden = !effects.missile;
    $('target-mode').disabled = Boolean(panelKind);
    if ($('target-mode').value !== run.targetMode) $('target-mode').value = run.targetMode;
    $('laser-toggle').hidden = !effects.laser;
    $('laser-toggle').disabled = Boolean(panelKind) || game.state !== 'playing' || run.energy + 1e-8 < 1;
    $('laser-toggle').setAttribute('aria-pressed', String(game.laserActive()));
    $('laser-toggle').title = 'Right-click or hold ' + game.profile.bindings.laser.toUpperCase();
    const relay = $('relay-toggle');
    relay.hidden = !effects.boostRelay || !!run.practice;
    relay.disabled = Boolean(panelKind) || !['playing', 'intermission'].includes(game.state);
    relay.setAttribute('aria-pressed', String(run.boostCycleOn));
    relay.title = 'Toggle with ' + game.profile.bindings.relay.toUpperCase();
    setText(relay, 'Auto · ' + (run.boostCycleOn ? 'On' : 'Off'));
    $('alien-actions').hidden = !run.serumAim && (!run.ship.alien || !run.ship.mindControl);
    setText($('mind-countdown'), run.serumAim ? 'Alien Mind Serum · Select an enemy' : !run.ship.mindControl ? '' :
      run.mindCooldown > 0 ? 'Mind control · ' + Math.ceil(run.mindCooldown) + 's' : 'Mind control · Ready');
    $('mind-toggle').hidden = run.serumAim || !run.ship.mindControl || run.mindCooldown > 0;
    $('mind-toggle').disabled = Boolean(panelKind) || game.state !== 'playing' || run.mindCooldown > 0;
    $('mind-toggle').setAttribute('aria-pressed', String(mindAim));
    setText($('mind-toggle'), mindAim ? 'Tap an enemy' : 'Choose a target');
    for (let i = 0; i < 3; i++) {
      const id = game.profile.boostSlots[i];
      const slot = $('flight-boost-' + i);
      const ready = game.boostSlotOpen(i);
      slot.disabled = Boolean(panelKind) || !ready || !id || !game.canUseBoost(id);
      const cooldown = game.itemCooldownsSkipped() ? 0 : id === 'snowCrystal' ? run.snowCooldown : id === 'goldenTrident' ? run.tridentCooldown : 0;
      const caption = !ready ? 'Lv ' + [1, 5, 10][i] : cooldown > 0 ? Math.ceil(cooldown) + 's' : id ? '×' + game.itemCount(id) : 'Empty';
      if (slot.dataset.item !== (ready ? id : 'locked')) {
        slot.dataset.item = ready ? id : 'locked';
        const lock = element('img', '', 'boost-lock');
        lock.src = AG.BOOST_LOCK;
        lock.alt = 'Locked';
        slot.replaceChildren(...(!ready ? [lock] : id ? [AG.itemGraphic(id)] : []), element('small'));
      }
      setText(slot.lastElementChild, caption);
      const name = ready ? (AG.ITEMS[id]?.name ?? 'Empty item slot') : 'Unlocks at pilot level ' + [1, 5, 10][i];
      slot.title = name;
      slot.setAttribute('aria-label', name);
    }
    const maxHull = game.maxHull();
    const health = run.player.hp / maxHull;
    const rim = $('combat-rim');
    rim.style.setProperty('--hurt', health <= .3 ? Math.max(.32, 1 - health * 2) : 0);
    rim.style.setProperty('--shield', run.aegisShield > 0 ? Math.max(.17, run.aegisShield / AG.aegisCapacity(run.ship)) :
      run.boosts.shield || run.boosts.fortress ? .65 : 0);
    rim.classList.toggle('nova-rim', run.aegisShield > 0);
    rim.classList.toggle('critical-health', health < .1);
    setText($('hull-value'), Number(run.player.hp.toFixed(1)) + '/' + maxHull);
    setText($('level'), 'LV ' + run.level);
    setText($('score'), run.score.toLocaleString());
    setText($('credits'), AG.formatCurrency(game.credits));
    $('credits').title = game.credits.toLocaleString() + ' Credits';
    setText($('gems'), AG.formatCurrency(game.profile.gems));
    $('gems').title = game.profile.gems.toLocaleString() + ' Star Gems';
    $('hull').max = maxHull;
    $('hull').value = run.player.hp;
    $('xp').value = run.level >= 50 ? 100 : 100 * run.xp / AG.xpForLevel(run.level);
    const percent = Math.round(100 * run.resolved / run.total);
    $('completion').value = percent;
    setText($('completion-value'), run.spawned + '/' + run.total + ' spawned · ' + run.resolved + ' cleared');
    $('skip').disabled = !game.canSkip() || Boolean(panelKind);
    syncAutoSkip();
    const levelLocked = run.level < AG.SUPPLY_LEVEL;
    const icon = levelLocked ? AG.ICONS.locked : AG.ICONS.supplies;
    if ($('supply-icon').getAttribute('src') !== icon) $('supply-icon').src = icon;
    setText($('supply-label'), levelLocked ? 'Supplies · Lv 5' : 'Supplies');
    $('supplies').disabled = !!run.practice || levelLocked || game.state !== 'intermission' || Boolean(panelKind);
    $('supplies').title = levelLocked ? 'Unlocks at pilot level 5' : 'Available between cleared waves';
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
    $('continue').hidden = !game.canContinue();
    if (!$('continue').hidden) {
      const saved = game.profile.checkpoint;
      setText($('continue'), 'Continue saved run');
      $('continue').title = saved.mode[0].toUpperCase() + saved.mode.slice(1) + ' · Next wave ' + (saved.wave + 1).toLocaleString();
    }
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
    if (Object.keys(game.profile.pendingMilestones).length || (AG.balanceActive() && game.canContinue())) {
      abandonedRewards = game.abandonSavedRun();
      open('queuedRewards');
      return;
    }
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
    armory.result = '';
    armory.part = '';
  }

  function open(kind, rememberFocus = true) {
    if (kind === 'merchant' || kind === 'shop') shopSeen = true;
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
    if (kind === 'craft') { armory.grid.fill(''); armory.missing = []; armory.ingredient = ''; armory.ingredientScroll = 0; }
    if ((armoryPanels.includes(kind) || kind === 'settings' || kind === 'changelog' || kind === 'keybinds' || kind === 'uiSettings' || kind === 'launchMode' || kind === 'tutorial' || kind === 'rewards') && panelHistory.length) {
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
    if (kind === 'result' || kind === 'queuedRewards') {
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
    AG.hideItemTooltip();
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
    game.adminUnlocked = adminUnlocked = true;
    try { sessionStorage.setItem('alien-shooter.admin', 'yes'); } catch {}
    syncAudio();
    open('admin', false);
  }

  function exitTesting() {
    game.leaveTesting();
    $('loot-strip').replaceChildren();
    for (const { node } of sideNotices.splice(0)) node.remove();
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

  function appendMilestoneRewards(rewards) {
    if (!rewards?.length) return;
    const list = element('ul', '', 'milestone-results');
    for (const [id, amount] of rewards) {
      const row = element('li');
      row.append(AG.itemGraphic(id), element('span', AG.itemName(id)), element('strong', '×' + amount.toLocaleString()));
      list.append(row);
    }
    body.append(element('h3', 'Milestone rewards'), list);
  }

  function drawPanel(restoreFocus = false) {
    const revision = ++panelRender;
    AG.hideItemTooltip();
    const buttonIndex = [...body.querySelectorAll('button')].indexOf(document.activeElement);
    const priorScroll = overlay.scrollTop;
    const panelScroll = panel.scrollTop;
    const partsScroll = body.querySelector('.outfit-parts')?.scrollTop;
    overlay.hidden = panel.hidden = false;
    $('home').hidden = true;
    note.hidden = true;
    body.replaceChildren();
    const title = $('panel-title');
    if (panelKind === 'rewards') {
      setText(title, 'Rewards');
      const ended = ['gameover', 'victory', 'quit'].includes(game.state);
      const earned = ended ? (game.run?.milestoneRewards ?? []) : Object.entries(game.profile.lastRewards);
      if (earned.length) appendMilestoneRewards(earned);
      else body.append(element('p', 'End a run to collect rewards based on the wave you reached.', 'panel-note'));
      body.append(button('Back', dismiss));
    } else if (panelKind === 'queuedRewards') {
      setText(title, 'Previous run ended');
      appendMilestoneRewards(abandonedRewards);
      body.append(button('Launch', start, { primary: true }), button('Main menu', showHome));
    } else if (panelKind === 'tutorial') {
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
      const titles = { hangar: 'Hangar', shop: 'Shop', inventory: 'Inventory', outfit: 'Ship Loadout', craft: 'Crafting', recipes: 'Recipes', shipPicker: 'Select a ship', merchant: 'Merchant', autoBoost: AG.itemName(armory.relayItem ?? 'boostRelay') };
      setText(title, titles[panelKind]);
      AG.renderArmory({ kind: panelKind, state: armory, game, body, button, element, dismiss,
        open: navigate, refresh: () => drawPanel(true) });
    } else if (panelKind === 'launchMode') {
      setText(title, 'Choose a mode');
      const modes = element('div', '', 'mode-carousel');
      for (const [id, title, waves, recommendation] of [
        ['easy', 'Easy', '20 waves', 'Common or higher'], ['medium', 'Medium', '30 waves', 'Rare or higher'],
        ['hard', 'Hard', '50 waves', 'Epic or higher'], ['endless', 'Endless', 'Unlimited waves', 'Legendary or higher']
      ]) {
        const card = element('article', '', 'mode-card');
        card.append(element('h3', title), element('p', waves), element('p', 'Recommended ship · ' + recommendation),
          button('Launch ' + title, () => { game.profile.mode = id; start(); }, { primary: true }));
        modes.append(card);
      }
      modes.tabIndex = 0;
      modes.addEventListener('wheel', event => {
        if (modes.scrollWidth <= modes.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
        event.preventDefault();
        const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? modes.clientWidth : 1;
        modes.scrollLeft += event.deltaY * scale;
      }, { passive: false });
      modes.setAttribute('aria-label', 'Flight modes, scroll sideways');
      const arrows = element('div', '', 'home-actions');
      arrows.append(button('← Previous', () => modes.scrollBy({ left: -215, behavior: 'smooth' })),
        button('Next →', () => modes.scrollBy({ left: 215, behavior: 'smooth' })), button('Back', dismiss));
      body.append(modes, arrows);
    } else if (panelKind === 'settings') {
      setText(title, 'Settings');
      const actions = element('div', '', 'home-actions');
      actions.append(AG.menuIcon(button('Keybinds', () => navigate('keybinds')), 'keybinds'),
        button('UI Settings', () => navigate('uiSettings')), button('Changelog', () => navigate('changelog')), button('How to play', () => { tutorialIndex = 0; navigate('tutorial'); }), button('Back', dismiss));
      body.append(actions);
    } else if (panelKind === 'changelog') {
      setText(title, 'Changelog');
      for (const [date, message, url] of AG.CHANGELOG) {
        if (Date.parse(date) > game.now()) continue;
        const entry = element('article', '', 'card');
        const copy = element('div');
        const [heading, ...details] = message.split('\n');
        copy.append(element('strong', heading), element('small', new Date(date).toLocaleDateString('en-AU', { timeZone: 'Australia/Melbourne' })));
        for (const line of details.filter(Boolean)) copy.append(element('p', line));
        if (url) {
          const link = element('a', 'View change');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener';
          copy.append(link);
        }
        entry.append(copy);
        body.append(entry);
      }
      body.append(button('Back', dismiss));
    } else if (panelKind === 'uiSettings') {
      setText(title, 'UI Settings');
      const side = element('label', 'In-game boost buttons ');
      const select = element('select');
      for (const [id, name] of [['right', 'Right'], ['left', 'Left']]) {
        const option = element('option', name);
        option.value = id;
        select.append(option);
      }
      select.value = game.profile.boostSide;
      select.addEventListener('change', () => { game.profile.boostSide = select.value; game.save(); });
      side.append(select);
      const styles = { original: 'Original names', roman: 'Roman numerals', numeric: 'Numbers' };
      const names = button('Upgrade names · ' + styles[game.profile.nameStyle], () => {
        const ids = Object.keys(styles);
        game.profile.nameStyle = ids[(ids.indexOf(game.profile.nameStyle) + 1) % ids.length];
        game.save();
        drawPanel(true);
      });
      const actions = element('div', '', 'home-actions');
      actions.append(names, button('Back', dismiss));
      const crateLabel = element('label', ' Allow skipping Mythical and Godly crate animations', 'crate-switch');
      const rareSkip = element('input');
      rareSkip.type = 'checkbox';
      rareSkip.checked = game.profile.allowRareCrateSkip;
      rareSkip.addEventListener('change', () => { game.profile.allowRareCrateSkip = rareSkip.checked; game.save(); });
      crateLabel.prepend(rareSkip);
      body.append(side, crateLabel, actions);
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
        ['Alien Spaceship', [['extend', 'Extend tendril'], ['retract', 'Release controlled ship or retract tendril']]],
        ['Equipment', [['laser', 'Lightning Beacon'], ['relay', 'Toggle Auto Boost']]]
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
        inventory: () => { if (game.canVisitBase()) navigate('inventory'); } });
    } else if (panelKind === 'supplies') {
      setText(title, 'Flight supplies');
      setText(note, 'Credits available  ·  ' + AG.formatCurrency(game.credits));
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
      setText(title, paused ? 'Flight paused' : game.state === 'victory' ? 'Sector secured' : game.state === 'quit' ? 'Run ended' : 'Ship lost');
      setText(note, 'Wave ' + game.waveLabel + '  ·  Score ' + game.run.score.toLocaleString());
      note.hidden = false;
      const actions = element('div', '', 'home-actions');
      if (paused) actions.append(button('Resume', dismiss, { primary: true }), button('Settings', () => navigate('settings')), button('Admin', openAdmin));
      else {
        const stats = game.run.stats;
        const bosses = Object.entries(stats.bossKills).map(([id, count]) => AG.BOSSES[id].name + ' ×' + count).join(' · ');
        const summary = element('ul', '', 'run-summary');
        for (const entry of [game.state === 'gameover' ? 'Final hit · ' + (stats.lastHit || 'Unknown') : '',
          'Bosses defeated · ' + (bosses || 'None'), 'Star Gems collected · ' + AG.formatCurrency(stats.gems),
          'Rarest pickup · ' + (stats.rarest ? AG.itemName(stats.rarest) : 'None')]) if (entry) summary.append(element('li', entry));
        body.append(summary);
        appendMilestoneRewards(game.run.milestoneRewards);
        actions.append(button('Launch again', () => navigate('launchMode'), { primary: true }),
          button('Rewards', () => navigate('rewards')));
      }
      actions.append(game.run.practice ? button('Exit practice', () => {
        showHome();
        open('hangar');
      }) : paused ? button('Quit run', () => { game.finish('quit'); open('result'); }) : button('Main menu', showHome));
      body.append(actions);
    }
    if (restoreFocus) {
      const candidate = body.querySelectorAll('button')[buttonIndex];
      (candidate && !candidate.disabled ? candidate : $('close')).focus({ preventScroll: true });
      const restoreScroll = () => {
        overlay.scrollTop = priorScroll;
        panel.scrollTop = panelScroll;
        const parts = body.querySelector('.outfit-parts');
        if (parts && partsScroll !== undefined) parts.scrollTop = partsScroll;
      };
      restoreScroll();
      if (panelKind === 'craft' || partsScroll !== undefined) requestAnimationFrame(() => {
        if (revision === panelRender) restoreScroll();
      });
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

  $('launch').addEventListener('click', () => open('launchMode'));
  $('continue').addEventListener('click', () => { if (game.continueRun()) resumeFlight(); });
  $('settings').addEventListener('click', () => {
    if (panelKind === 'settings') dismiss();
    else if (panelKind) navigate('settings');
    else open('settings');
  });
  $('merchant-open').addEventListener('click', () => { if (game.canVisitBase()) open('merchant'); });
  $('hud-toggle').addEventListener('click', () => { hideTopMenu = !hideTopMenu; });
  $('outfit-open').addEventListener('click', () => open('shipPicker'));
  $('craft-open').addEventListener('click', () => open('craft'));
  $('hangar-open').addEventListener('click', () => open('hangar'));
  $('shop-open').addEventListener('click', () => open('shop'));
  $('admin').addEventListener('click', openAdmin);
  function openInventory() {
    if (panelKind === 'inventory') dismiss();
    else if (!panelKind && game.canVisitBase()) { armory.showItemDetails = false; open('inventory'); }
  }
  $('inventory-home').addEventListener('click', openInventory);
  $('close').addEventListener('click', dismiss);
  $('skip').addEventListener('click', () => game.skip());
  function syncAutoSkip() {
    const toggle = $('auto');
    const enabled = game.profile.auto;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled ? 'Auto Skip on' : 'Auto Skip off');
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
  $('mind-toggle').addEventListener('click', () => { mindAim = !mindAim; });
  for (let i = 0; i < 3; i++) $('flight-boost-' + i).addEventListener('click', () => {
    const id = game.profile.boostSlots[i];
    if (!panelKind && id && game.boostSlotOpen(i)) game.useBoost(id);
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
    if ((event.pointerType === 'mouse' || mindAim || game.run.serumAim) && game.mindControl(point)) { mindAim = false; return; }
    if (mindAim || game.run.serumAim) return;
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    game.pointer = point;
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 2 || panelKind) return;
    trackAim(event);
    game.laserInput('toggle');
  });
  canvas.addEventListener('pointerleave', () => {
    if (hoveredDrop) AG.hideItemTooltip();
    hoveredDrop = null;
  });
  function hoverFlightDrop(event, aim) {
    const drop = aim && event.pointerType !== 'touch' && !panelKind && game.run?.drops.find(item => {
      const rare = item.type === 'alienChest' || AG.CRATES[item.type] || ['legendary', 'mythical', 'godly'].includes(AG.ITEMS[item.type]?.rarity);
      return (!(event.buttons & 1) || rare || !game.isDiscovered(item.type)) &&
        Math.hypot(aim.x - item.x, aim.y - item.y) <= item.size;
    });
    if (drop) AG.showItemTooltip(canvas, drop.type, event.clientX, event.clientY);
    else if (hoveredDrop) AG.hideItemTooltip();
    hoveredDrop = drop || null;
  }
  canvas.addEventListener('pointerdown', event => hoverFlightDrop(event, trackAim(event)));
  canvas.addEventListener('pointerup', event => hoverFlightDrop(event, trackAim(event)));
  canvas.addEventListener('pointermove', event => {
    const aim = trackAim(event);
    hoverFlightDrop(event, aim);
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
      else if (!game.releaseMindControl()) game.retractTendril();
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
      navigate('launchMode');
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
  let contentLive = AG.contentActive();
  let launchDealsLive = AG.launchDealsActive();
  let balanceLive = AG.balanceActive();
  const cosmeticShopState = time => [
    AG.trailsActive(time), AG.alienTokenActive(time), time < game.profile.alienTokenUntil,
    game.profile.alienTokenUntil > time ? AG.updateGiftDay(time) : ''
  ].join('|');
  let cosmeticState = cosmeticShopState(game.now());
  let nextCosmeticCheck = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    const wallTime = Date.now();
    const unlocked = AG.contentActive(wallTime);
    const contentChanged = unlocked !== contentLive;
    if (contentChanged) {
      contentLive = unlocked;
      if (armoryPanels.includes(panelKind) || panelKind === 'admin') drawPanel(true);
    }
    const balance = AG.balanceActive(wallTime);
    if (balance !== balanceLive) {
      balanceLive = balance;
      if (armoryPanels.includes(panelKind) && !contentChanged) drawPanel(true);
    }
    const sale = AG.launchDealsActive(wallTime);
    if (sale !== launchDealsLive) {
      launchDealsLive = sale;
      if (panelKind === 'shop' && armory.shopTab === 'crates' && !contentChanged) drawPanel(true);
    }
    if (wallTime >= nextCosmeticCheck) {
      const current = cosmeticShopState(game.now());
      if (current !== cosmeticState) {
        cosmeticState = current;
        if (armoryPanels.includes(panelKind) || panelKind === 'admin') drawPanel(true);
      }
      nextCosmeticCheck = wallTime + 500;
    }
    if (wallTime >= nextQuestCheck) {
      renderQuestPanel();
      nextQuestCheck = wallTime + 250;
    }
    if (wallTime >= nextMerchantCheck) {
      game.merchantStock(game.now());
      nextMerchantCheck = wallTime + 1000;
    }
    if (!panelKind && ['playing', 'intermission'].includes(game.state)) flightSeconds += dt;
    if (!shopSeen && !merchantHintSent && flightSeconds >= 120 && game.run?.level >= 10) {
      sideNotice('Merchant available', 'Visit the Merchant from the main menu for useful upgrades.');
      merchantHintSent = true;
    }
    const gameDt = dt * game.simulationSpeed;
    if (!panelKind && ['playing', 'intermission'].includes(game.state)) accumulated += gameDt;
    else accumulated = 0;
    const started = performance.now();
    let steps = 0;
    while (accumulated >= tick) {
      if (!panelKind) game.update(tick);
      accumulated -= tick;
      steps++;
      if (game.simulationSpeed > 10 && steps % 16 === 0 && performance.now() - started > 10) {
        accumulated %= tick;
        break;
      }
    }
    if (!panelKind && ['gameover', 'victory'].includes(game.state)) open('result');
    view.draw(game, panelKind && game.run ? 0 : game.run ? (game.simulationSpeed > 10 ? steps * tick : gameDt) : dt);
    renderHUD(now);
    if (hoveredDrop && !game.run?.drops.includes(hoveredDrop)) { hoveredDrop = null; AG.hideItemTooltip(); }
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
  $('brand-ship').append(AG.shipGraphic('scout'));
  refreshRecord();
  syncAudio();
  if (!game.profile.tutorialSeen) {
    returnFocus = $('launch');
    open('tutorial', false);
  }
  requestAnimationFrame(frame);
})();
