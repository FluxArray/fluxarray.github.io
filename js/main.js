/**
 * Entry point. Loads the manifest, builds the VFS, wires the skin
 * toggle and the dynamic top nav, then hands off to Content and
 * Terminal for everything that happens after.
 */

(async function main() {
  const els = {
    brand: document.getElementById('brand-link'),
    topnav: document.getElementById('topnav'),
    breadcrumb: document.getElementById('breadcrumb'),
    skinToggle: document.getElementById('skin-toggle'),
    contentPane: document.getElementById('content-pane'),
    contentHeader: document.getElementById('content-header'),
    contentBody: document.getElementById('content-body'),
    terminalSheet: document.getElementById('terminal-sheet'),
    terminalOutput: document.getElementById('terminal-output'),
    terminalInput: document.getElementById('terminal-input'),
    terminalFab: document.getElementById('terminal-fab'),
    terminalClose: document.getElementById('terminal-close'),
    terminalPromptLive: document.getElementById('terminal-prompt-live'),
  };

  Skin.init();
  wireSkinToggle();

  let manifest = [];
  try {
    const res = await fetch('content/manifest.json');
    manifest = await res.json();
  } catch (err) {
    els.contentBody.innerHTML =
      '<div class="error-view"><p>Couldn\'t load <code>content/manifest.json</code>.</p>' +
      '<p class="error-hint">If you opened this file directly (file://), serve it with a local server instead — see the README.</p></div>';
    return;
  }

  VFS.build(manifest);
  buildTopNav();

  Content.init({
    pane: els.contentBody,
    header: els.contentHeader,
    breadcrumb: els.breadcrumb,
    scrollContainer: els.contentPane,
  });

  Terminal.init({
    sheet: els.terminalSheet,
    output: els.terminalOutput,
    input: els.terminalInput,
    fab: els.terminalFab,
    closeBtn: els.terminalClose,
    promptLive: els.terminalPromptLive,
  });

  if (els.brand) {
    els.brand.addEventListener('click', (e) => {
      e.preventDefault();
      Content.navigateTo('/home.html');
    });
  }

  function buildTopNav() {
    const root = VFS.getRoot();
    const children = VFS.listChildren(root).filter((c) => !(c.type === 'file' && c.name === 'home.html'));
    els.topnav.innerHTML = children
      .map((c) => {
        const label = c.type === 'dir' ? c.name + '/' : (c.meta && c.meta.title) || c.name;
        return `<button class="topnav-link" data-path="${escapeHtml(c.path)}">${escapeHtml(label)}</button>`;
      })
      .join('');
    els.topnav.querySelectorAll('.topnav-link').forEach((btn) => {
      btn.addEventListener('click', () => Content.navigateTo(btn.dataset.path));
    });
  }

  function wireSkinToggle() {
    const render = () => {
      const current = Skin.get();
      els.skinToggle.textContent = current === 'dark' ? '☀ sunny' : '● dark';
      els.skinToggle.setAttribute('aria-label', `Switch to ${current === 'dark' ? 'sunny' : 'dark'} skin`);
    };
    els.skinToggle.addEventListener('click', () => {
      Skin.set(Skin.get() === 'dark' ? 'sunny' : 'dark');
    });
    document.addEventListener('skinchange', render);
    render();
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
