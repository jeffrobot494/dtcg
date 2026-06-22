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
    // Runtime-granted state (until end of turn unless explicitly persistent).
    this.grantedKeywords = new Set();
    this.grantedPower = 0;
    this.grantedToughness = 0;
    // For equipment: which creature this is attached to (null if unattached).
    this.attachedTo = null;
  }

  // Single API for keyword lookup. Checks the static card definition, any
  // runtime-granted keywords, and keywords contributed by attached equipment.
  hasKeyword(name) {
    if (this.def.keywords?.includes(name)) return true;
    if (this.grantedKeywords.has(name)) return true;
    for (const eq of this._attachedEquipment) {
      if (eq.def.staticBuff?.keywords?.includes(name)) return true;
    }
    return false;
  }

  // Equipment currently attached to this card (live lookup over the battlefield).
  get _attachedEquipment() {
    if (!this.controller?.battlefield) return [];
    return this.controller.battlefield.cards.filter(c =>
      c.def.subtype === 'equipment' && c.attachedTo === this
    );
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
  get power() {
    let v = this.basePower + (this.counters['+1/+1'] ?? 0) + this.grantedPower;
    for (const eq of this._attachedEquipment) {
      v += eq.def.staticBuff?.power ?? 0;
    }
    return v;
  }
  get toughness() {
    let v = this.baseToughness + (this.counters['+1/+1'] ?? 0) + this.grantedToughness;
    for (const eq of this._attachedEquipment) {
      v += eq.def.staticBuff?.toughness ?? 0;
    }
    return v;
  }
}
