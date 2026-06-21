import { SceneManager } from './scenes/SceneManager.js';
import { BattleScene } from './scenes/BattleScene.js';
import { DeckEditorScene } from './scenes/DeckEditorScene.js';
import { initDeckLibrary } from './state/DeckLibrary.js';

await initDeckLibrary();

const sm = new SceneManager(document.getElementById('app'));
sm.register('battle', 'Battle', (root, mgr) => new BattleScene(root, mgr));
sm.register('decks',  'Decks',  (root, mgr) => new DeckEditorScene(root, mgr));
sm.switchTo('battle');
