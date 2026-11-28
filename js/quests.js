(() => {
  'use strict';
  const AG = window.AG;
  const { Game, HEIGHT, WIDTH } = AG;
  const objectives = [
    { key: 'kills', label: 'Defeat enemies', targets: [10, 30, 60, 100, 160, 250] },
    { key: 'pickups', label: 'Collect loot', targets: [5, 15, 30, 55, 90, 140] },
    { key: 'waves', label: 'Clear waves', targets: [2, 5, 10, 16, 25, 40] },
    { key: 'depth', label: 'Clear wave', targets: [3, 7, 12, 20, 30, 50] },
    { key: 'bosses', label: 'Defeat bosses', targets: [1, 2, 3, 5, 8, 12] }
  ];
  const QUESTS = Array.from({ length: 30 }, (_, i) => {
    const objective = objectives[i % objectives.length];
    const tier = Math.floor(i / objectives.length);
    const reward = i === 19 ? ['goldenTrident', 1] : i % 10 === 9 ? ['gem', 1] : ['credit', 20 + tier * 5];
    return { id: i + 1, key: objective.key, label: objective.label, target: objective.targets[tier], reward };
  });

  Object.assign(Game.prototype, {
    questDay() {
      const day = AG.updateGiftDay(this.now());
      if (this.profile.quests?.day !== day || !Array.isArray(this.profile.quests.claimed) || !this.profile.quests.progress) {
        this.profile.quests = { day, progress: {}, claimed: [] };
      }
      return this.profile.quests;
    },

    questLimit() {
      const level = Math.max(this.profile.bestPilotLevel, this.run?.level ?? 1);
      return level >= 20 ? 30 : 10 + Math.max(0, level - 1);
    },

    questCount() {
      return new Set(this.questDay().claimed.filter(id => Number.isInteger(id) && id >= 1 && id <= 30)).size;
    },

    recordQuest(key, amount = 1) {
      if (!AG.questsActive(this.now()) || !this.run || this.run.practice) return;
      const { progress } = this.questDay();
      progress[key] = key === 'depth' ? Math.max(progress[key] ?? 0, amount) : (progress[key] ?? 0) + amount;
    },

    claimQuest(id, test = false) {
      if (!AG.questsActive(this.now())) return false;
      const quest = QUESTS[id - 1];
      const daily = this.questDay();
      if (!quest || quest.id > this.questLimit() || daily.claimed.includes(id) ||
          (!(test && this.testing) && (daily.progress[quest.key] ?? 0) < quest.target)) return false;
      const [item, count] = quest.reward;
      if (!Number.isSafeInteger(this.itemCount(item) + count) || this.run?.practice) return false;
      daily.claimed.push(id);
      return this.grantItem(item, count);
    },

    finishTestQuest() {
      if (!this.testing) return false;
      const claimed = this.questDay().claimed;
      const quest = QUESTS.find(q => q.id <= this.questLimit() && !claimed.includes(q.id));
      return quest ? this.claimQuest(quest.id, true) : false;
    },

    canClaimQuestSupernova() {
      return this.now() >= AG.SNOW_START && this.questCount() === 30 && this.itemCount('energyCore') > 0 &&
        !this.run?.practice && this.now() - this.profile.questSupernovaTime >= 86400000 &&
        Number.isSafeInteger(this.itemCount('supernova') + 1);
    },

    claimQuestSupernova() {
      if (!this.canClaimQuestSupernova()) return false;
      this.profile.materials.energyCore--;
      this.profile.questSupernovaTime = this.now();
      return this.grantItem('supernova');
    },

    coreBoss() {
      const run = this.run;
      return run?.wave === 50 && run.enemies.find(enemy =>
        enemy.type === 'nexus' && enemy.bornWave === 50 && !enemy.escort && !enemy.allied && enemy.y >= 30);
    },

    canFireCoreWeapon() {
      const boss = this.coreBoss();
      return AG.questsActive(this.now()) && this.state === 'playing' && Boolean(boss && !boss.coreCharged);
    },

    fireCoreWeapon() {
      if (!this.canFireCoreWeapon()) return false;
      const run = this.run;
      const boss = this.coreBoss();
      run.coreBeam = { x: run.player.x, y: run.player.y, boss, targets: [], life: .85 };
      run.resolved += run.pending.length;
      run.spawned = run.total;
      run.pending.length = 0;
      boss.hp /= 1.5;
      boss.maxHp /= 1.5;
      boss.damageScale = (boss.damageScale ?? run.diff.damage) * 1.5;
      boss.coreCharged = true;
      for (let i = run.enemies.length - 1; i >= 0; i--) {
        const enemy = run.enemies[i];
        if (enemy === boss || enemy.allied) continue;
        run.coreBeam.targets.push({ x: enemy.x, y: enemy.y });
        this.removeEnemy(i, true);
      }
      run.hostile.length = 0;
      this.notify('upgrade', 'Golden Trident · Energy Core exposed');
      return true;
    },

    dropEnergyCore(enemy) {
      this.run.drops.push({ type: 'energyCore', amount: 1, size: 18, age: 0,
        x: Math.max(20, Math.min(WIDTH - 20, enemy.x)), y: Math.max(20, Math.min(HEIGHT - 20, enemy.y)), fallDelay: 0 });
    }
  });
  AG.QUESTS = QUESTS;
})();
