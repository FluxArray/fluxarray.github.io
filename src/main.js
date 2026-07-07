import './css/style.css';
import VFS from './js/vfs.js';
import Skin from './js/skin.js';
import TermUI from './js/terminal.js';
import Content from './js/content.js'; // <-- Import Content

Skin.init();
document.getElementById('skin-toggle').addEventListener('click', () => {
  Skin.set(Skin.get() === 'dark' ? 'sunny' : 'dark');
  document.getElementById('skin-toggle').textContent = Skin.get() === 'dark' ? '☀ sunny' : '● dark';
});

async function boot() {
  try {
    const res = await fetch('/content/manifest.json');
    const manifest = await res.json();
    VFS.build(manifest);

    // Initialize the content pane before the terminal
    Content.init({
      pane: document.getElementById('content-body'),
      header: document.getElementById('content-header'),
      breadcrumb: document.getElementById('breadcrumb'),
      scrollContainer: document.getElementById('content-pane'),
    });

    TermUI.init();
  } catch (err) {
    console.error("Failed to load manifest.", err);
  }
}

document.addEventListener('DOMContentLoaded', boot);