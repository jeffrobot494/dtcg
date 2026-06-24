// Owns the persistent nav bar and a single scene-root that scenes mount into.
// Scenes are registered with (id, label, factory) where factory takes
// (sceneRoot, manager) and returns a Scene with optional mount()/unmount().

export class SceneManager {
  constructor(root) {
    this.root = root;
    this.scenes = new Map();
    this.current = null;
    this.currentId = null;

    this.root.innerHTML = `
      <div id="navbar"></div>
      <div id="scene-root"></div>
    `;
    this.navbar = this.root.querySelector('#navbar');
    this.sceneRoot = this.root.querySelector('#scene-root');
  }

  register(id, label, factory) {
    this.scenes.set(id, { id, label, factory, hidden: false });
    this._renderNav();
  }

  // Sub-scenes reached only via in-game navigation (not the nav bar).
  registerHidden(id, factory) {
    this.scenes.set(id, { id, label: null, factory, hidden: true });
  }

  async switchTo(id, context = {}) {
    // Scenes may guard against being left mid-flow (e.g., active battle).
    if (this.current?.canLeave && !this.current.canLeave()) return false;
    if (this.current?.unmount) {
      try { this.current.unmount(); } catch (e) { console.error(e); }
    }
    this.sceneRoot.innerHTML = '';
    this.currentId = id;
    this._renderNav();
    const entry = this.scenes.get(id);
    if (!entry) return false;
    this.current = entry.factory(this.sceneRoot, this, context);
    if (this.current?.mount) await this.current.mount();
    return true;
  }

  _renderNav() {
    const btns = [...this.scenes.values()]
      .filter(s => !s.hidden)
      .map(s =>
        `<button data-scene-id="${s.id}" class="${this.currentId === s.id ? 'active' : ''}">${s.label}</button>`
      ).join('');
    this.navbar.innerHTML = btns;
    this.navbar.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => this.switchTo(btn.dataset.sceneId);
    });
  }
}
