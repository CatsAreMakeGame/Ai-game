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
  const QUEST_CRATES = ['shipCrate', 'upgradeCrate', 'enemyCrate'];
  const QUESTS = Array.from({ length: 30 }, (_, i) => {
    const objective = objectives[i % objectives.length];
    const tier = Math.floor(i / objectives.length);
    const id = i + 1;
    const reward = id === 10 ? { credit: 250, gem: 3, upgradeBundle: 2, boostBundle: 2, randomCrate: 1 } :
      id === 20 ? { credit: 500, gem: 5, upgradeBundle: 5, boostBundle: 5, shipCrate: 1, upgradeCrate: 1, enemyCrate: 1, goldenTrident: 1 } :
      id === 30 ? { credit: 1500, gem: 15, upgradeBundle: 20, boostBundle: 20, shipCrate: 3, upgradeCrate: 3, enemyCrate: 3 } :
      id > 10 ? { credit: 20 + tier * 5, gem: 1 } : { credit: 20 + tier * 5 };
    const target = objective.targets[tier] - (tier && objective.key !== 'depth' ? objective.targets[tier - 1] : 0);
    return { id, key: objective.key, label: objective.label, target, reward };
  });

  Object.assign(Game.prototype, {
    questDay() {
      const day = AG.updateGiftDay(this.now());
      if (this.profile.quests?.day !== day || !Array.isArray(this.profile.quests.claimed) || this.profile.quests.progress == null) {
        this.profile.quests = { day, progress: 0, completed: 0, claimed: [] };
      }
      const daily = this.profile.quests;
      if (!Number.isInteger(daily.completed)) {
        daily.completed = 0;
        while (daily.completed < 30 && daily.claimed.includes(daily.completed + 1)) daily.completed++;
        daily.progress = 0;
      }
      return daily;
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
      const daily = this.questDay();
      const quest = QUESTS[daily.completed];
      if (!quest || quest.id > this.questLimit() || quest.key !== key) return;
      daily.progress = key === 'depth' ? Math.max(daily.progress, amount) : daily.progress + amount;
      if (daily.progress >= quest.target) this.completeCurrentQuest(daily);
    },

    completeCurrentQuest(daily) {
      daily.completed++;
      daily.progress = 0;
      this.save();
    },

    claimQuest(id) {
      if (!AG.questsActive(this.now())) return false;
      const quest = QUESTS[id - 1];
      const daily = this.questDay();
      if (!quest || id > daily.completed || daily.claimed.includes(id) || this.run?.practice) return false;
      const reward = { ...quest.reward };
      if (reward.randomCrate) {
        reward[this.rewardPick(QUEST_CRATES)] = reward.randomCrate;
        delete reward.randomCrate;
      }
      const entries = Object.entries(reward);
      if (entries.some(([item, count]) => !Number.isSafeInteger(this.itemCount(item) + count))) return false;
      daily.claimed.push(id);
      for (const [item, count] of entries) this.grantItem(item, count);
      return true;
    },

    claimAllQuests() {
      const { completed, claimed } = this.questDay();
      let count = 0;
      for (let id = 1; id <= completed; id++) {
        if (!claimed.includes(id) && this.claimQuest(id)) count++;
      }
      return count;
    },

    finishTestQuest() {
      if (!this.testing || !AG.questsActive(this.now())) return false;
      const daily = this.questDay();
      if (daily.completed >= this.questLimit()) return false;
      this.completeCurrentQuest(daily);
      return true;
    },

    canClaimQuestSupernova() {
      return this.now() >= AG.SNOW_START && this.questDay().completed === 30 && this.itemCount('energyCore') > 0 &&
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
        enemy.type === 'nexus' && enemy.bornWave === 50 && !enemy.escort && !enemy.allied);
    },

    canFireCoreWeapon() {
      const run = this.run;
      if (!AG.questsActive(this.now()) || this.state !== 'playing' || (!this.itemCooldownsSkipped() && run.tridentCooldown > 0)) return false;
      if (run.wave === 50) {
        const boss = this.coreBoss();
        return Boolean(boss && boss.y >= 0 && !boss.coreCharged);
      }
      return run.enemies.some(enemy => !enemy.allied);
    },

    fireCoreWeapon() {
      if (!this.canFireCoreWeapon()) return false;
      const run = this.run;
      run.tridentCooldown = 100;
      const boss = this.coreBoss();
      const targets = run.enemies.filter(enemy => !enemy.allied);
      run.coreBeam = { x: run.player.x, y: run.player.y, targets, life: .85 };
      if (boss) {
        boss.damageScale = (boss.damageScale ?? run.diff.damage) * 1.5;
        boss.coreCharged = true;
      }
      for (let index = run.enemies.length - 1; index >= 0; index--) {
        const enemy = run.enemies[index];
        if (enemy.allied) continue;
        const damage = boss && enemy !== boss ? enemy.hp : enemy.hp / 2;
        if (!boss) enemy.tridentBar = { time: 1, before: enemy.hp / enemy.maxHp };
        this.hitEnemy(index, damage, 'trident');
      }
      this.notify('upgrade', boss?.coreCharged ? 'Golden Trident · Energy Core exposed' : 'Golden Trident · Enemy health halved');
      return true;
    },

    dropEnergyCore(enemy) {
      this.run.drops.push({ type: 'energyCore', amount: 1, size: 18, age: 0,
        x: Math.max(20, Math.min(WIDTH - 20, enemy.x)), y: Math.max(20, Math.min(HEIGHT - 20, enemy.y)), fallDelay: 0 });
    }
  });
  Object.assign(AG, { QUESTS, QUEST_CRATES });
})();
