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
    // Regenerate shields (each consumed once to save the creature from dying).
    this.regenerationShields = 0;
    // Persistent modifier: when true, this creature can't consume a regen
    // shield. Cleared at end of turn.
    this.cantRegenThisTurn = false;
    // Sources that have dealt damage to this creature during its current
    // battlefield presence. Used by "killed by X" triggers (e.g., Aunaratha).
    this.dealtDamageBy = new Set();
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

  // All activated/mana abilities visible on this card: its own def abilities
  // plus any granted by attached equipment (staticBuff.grantedAbilities).
  // Iteration order matters because activations are indexed.
  get abilities() {
    const own = this.def.abilities ?? [];
    const granted = [];
    for (const eq of this._attachedEquipment) {
      const list = eq.def.staticBuff?.grantedAbilities ?? [];
      granted.push(...list);
    }
    return granted.length ? [...own, ...granted] : own;
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
    let v = this.basePower
      + (this.counters['+1/+1'] ?? 0)
      + (this.counters['+1/+0'] ?? 0)
      - (this.counters['-1/+1'] ?? 0)
      + this.grantedPower;
    for (const eq of this._attachedEquipment) {
      v += eq.def.staticBuff?.power ?? 0;
    }
    return v;
  }
  get toughness() {
    let v = this.baseToughness
      + (this.counters['+1/+1'] ?? 0)
      + (this.counters['-1/+1'] ?? 0)
      + this.grantedToughness;
    for (const eq of this._attachedEquipment) {
      v += eq.def.staticBuff?.toughness ?? 0;
    }
    return v;
  }
}
