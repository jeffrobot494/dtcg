// Side-effect import: each effect file calls defineEffect at load time,
// populating the registry. Add new effect modules here.
import './damage.js';
import './destroy.js';
import './draw.js';
import './life.js';
import './aoe_damage.js';
import './heal.js';
import './grant.js';
import './mana.js';
import './attach.js';
import './exile.js';
import './tokens.js';
import './return.js';
import './regenerate.js';
import './incinerate.js';
import './read_the_scars.js';
import './counters.js';
import './drain_life.js';

export { getEffect, defineEffect } from './registry.js';
