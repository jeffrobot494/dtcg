import mountain from './mountain.js';
import swamp from './swamp.js';
import mountainWarrior from './mountain_warrior.js';
import boil from './boil.js';
import rockeater from './rockeater.js';
import cavernDrake from './cavern_drake.js';
import mightySerpent from './mighty_serpent_of_the_vale.js';
import rockslide from './rockslide.js';
import destroyArtifact from './destroy_artifact.js';
import conflagration from './conflagration.js';
import erupt from './erupt.js';
import beseechTheShadows from './beseech_the_shadows.js';
import chokingFume from './choking_fume.js';
import normalMan from './normal_man.js';
import bigMan from './big_man.js';
import fireServant from './fire_servant.js';
import immolationDeathshaman from './immolation_deathshaman.js';
import blaze from './blaze.js';
import drainLife from './drain_life.js';
import shareBlood from './share_blood.js';

const database = {
  mountain,
  swamp,
  mountain_warrior: mountainWarrior,
  boil,
  rockeater,
  cavern_drake: cavernDrake,
  mighty_serpent_of_the_vale: mightySerpent,
  rockslide,
  destroy_artifact: destroyArtifact,
  conflagration,
  erupt,
  beseech_the_shadows: beseechTheShadows,
  choking_fume: chokingFume,
  normal_man: normalMan,
  big_man: bigMan,
  fire_servant: fireServant,
  immolation_deathshaman: immolationDeathshaman,
  blaze,
  drain_life: drainLife,
  share_blood: shareBlood,
};

export function getCardDef(id) {
  const def = database[id];
  if (!def) throw new Error(`Unknown card id: ${id}`);
  return def;
}

export default database;
