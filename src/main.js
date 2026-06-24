import { SceneManager } from './scenes/SceneManager.js';
import { BattleScene } from './scenes/BattleScene.js';
import { DeckEditorScene } from './scenes/DeckEditorScene.js';
import { TuningScene } from './scenes/TuningScene.js';
import { MapScene } from './scenes/MapScene.js';
import { CampScene } from './scenes/CampScene.js';
import { MerchantScene } from './scenes/MerchantScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { initDeckLibrary } from './state/DeckLibrary.js';
import { initTuning } from './state/Tuning.js';
import { initCampaign } from './state/Campaign.js';

await initDeckLibrary();
initTuning();
initCampaign();

const sm = new SceneManager(document.getElementById('app'));
sm.register('map',      'Map',     (root, mgr, ctx) => new MapScene(root, mgr, ctx));
sm.register('battle',   'Battle',  (root, mgr, ctx) => new BattleScene(root, mgr, ctx));
sm.register('decks',    'Decks',   (root, mgr, ctx) => new DeckEditorScene(root, mgr, ctx));
sm.register('tuning',   'Tuning',  (root, mgr, ctx) => new TuningScene(root, mgr, ctx));
// Camp and GameOver are sub-scenes reached only via in-game navigation; they
// stay off the nav bar.
sm.registerHidden('camp',     (root, mgr, ctx) => new CampScene(root, mgr, ctx));
sm.registerHidden('merchant', (root, mgr, ctx) => new MerchantScene(root, mgr, ctx));
sm.registerHidden('gameover', (root, mgr, ctx) => new GameOverScene(root, mgr, ctx));

sm.switchTo('map');
