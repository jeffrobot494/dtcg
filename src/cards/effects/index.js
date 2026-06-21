// Side-effect import: each effect file calls defineEffect at load time,
// populating the registry. Add new effect modules here.
import './damage.js';
import './destroy.js';
import './draw.js';
import './life.js';
import './aoe_damage.js';
import './heal.js';

export { getEffect, defineEffect } from './registry.js';
