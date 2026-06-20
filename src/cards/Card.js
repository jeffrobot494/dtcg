let nextInstanceId = 1;

export class Card {
  constructor(def, owner) {
    this.iid = nextInstanceId++;
    this.def = def;
    this.owner = owner;
    this.controller = owner;
    this.zone = null;
    this.tapped = false;
    this.damage = 0;
    this.counters = {};
    this.summoningSick = false;
    this.markedForDeath = false;
  }

  // Single API for keyword lookup. Today only checks static def.keywords;
  // when granted-keyword support lands, this also reads a runtime set.
  hasKeyword(name) {
    return this.def.keywords?.includes(name) ?? false;
  }

  get name() { return this.def.name; }
  get type() { return this.def.type; }
  get cost() { return this.def.cost; }
  get isCreature() { return this.def.type === 'creature'; }
  get isLand() { return this.def.type === 'land'; }
  get isArtifact() { return this.def.type === 'artifact'; }
  get isEnchantment() { return this.def.type === 'enchantment'; }
  get basePower() { return this.def.power ?? 0; }
  get baseToughness() { return this.def.toughness ?? 0; }
  get power() { return this.basePower + (this.counters['+1/+1'] ?? 0); }
  get toughness() { return this.baseToughness + (this.counters['+1/+1'] ?? 0); }
}
