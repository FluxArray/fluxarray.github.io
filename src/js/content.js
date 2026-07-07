import MD from './markdown.js';
import VFS from './vfs.js';

const Content = (() => {
  const SITE = { name: 'guest@blog' };
  let paneEl, headerEl, breadcrumbEl, scrollEl, mathJaxRequested = false;
  let currentPath = '/home.html';

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function setLoading(isLoading) {
    paneEl.classList.toggle('is-loading', isLoading);
  }

  function ensureMathJax() {
    if (mathJaxRequested) return window.__mathJaxReady || Promise.resolve();
    mathJaxRequested = true;
    window.MathJax = {
      tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']] },
      chtml: { displayAlign: 'left' },
      options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
    };
    window.__mathJaxReady = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
    return window.__mathJaxReady;
  }

  function typesetMaybe(container, rawBody) {
    if (!/\$|\\\(|\\\[/.test(rawBody)) return;
    ensureMathJax().then(() => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([container]).catch(() => { });
      }
    });
  }

  function renderBreadcrumb(path) {
    const parts = path.split('/').filter(Boolean);
    let acc = '';

    // The '~' always links to the root directory view ('/')
    const segs = [{ label: '~', path: '/' }];

    for (let i = 0; i < parts.length; i++) {
      const isFileSeg = i === parts.length - 1;
      acc += '/' + parts[i];
      if (isFileSeg) {
        const label = parts[i].replace(/\.html$/, '');
        segs.push({ label, path: acc, current: true });
      } else {
        segs.push({ label: parts[i], path: acc, dir: true });
      }
    }

    breadcrumbEl.innerHTML = segs
      .map((s) =>
        s.current
          ? `<span class="crumb crumb-current">${escapeHtml(s.label)}</span>`
          : `<button class="crumb" data-path="${escapeHtml(s.path)}">${escapeHtml(s.label)}</button>`
      )
      .join('<span class="crumb-sep">/</span>');
  }

  function renderDir(node, path) {
    document.title = `Index of ${path} — ${SITE.name}`;
    headerEl.innerHTML = '';

    const children = VFS.listChildren(node);
    let html = `<div class="dirlist-view">`;
    html += `<ul class="dirlist">`;

    for (const c of children) {
      const isDir = c.type === 'dir';
      const icon = isDir ? '📁' : '📄';
      const displayName = isDir ? c.name + '/' : c.name.replace(/\.html$/, '');
      const childPath = path === '/' ? '/' + c.name : path + '/' + c.name;

      html += `
        <li class="dirlist-row">
          <span class="dirlist-icon">${icon}</span>
          <button class="dirlist-name ${isDir ? 'is-dir' : 'is-file'}" data-path="${escapeHtml(childPath)}">
            ${escapeHtml(displayName)}
          </button>
        </li>`;
    }

    html += `</ul></div>`;
    paneEl.innerHTML = html;
  }

  async function renderFile(node) {
    setLoading(true);
    try {
      const res = await fetch('/content/' + node.meta.file);
      if (!res.ok) throw new Error('fetch failed: ' + res.status);
      const raw = await res.text();
      const { frontmatter, html } = MD.render(raw);

      const title = frontmatter.title || node.meta.title || node.name;
      const date = frontmatter.date || node.meta.date;
      const tags = (frontmatter.tags && frontmatter.tags.length ? frontmatter.tags : node.meta.tags) || [];

      document.title = `${title} — ${SITE.name}`;

      headerEl.innerHTML = `
        <header class="blog-header">
          <h1 class="blog-title">${escapeHtml(title)}</h1>
          ${date ? `<p class="blog-date">${escapeHtml(date)}</p>` : ''}
          ${tags.length ? `<ul class="blog-tags">${tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
        </header>`;

      paneEl.innerHTML = `<article class="prose">${html}</article>`;

      typesetMaybe(paneEl, raw);
    } catch (err) {
      headerEl.innerHTML = '';
      paneEl.innerHTML = `<div class="error-view"><p>Couldn't load this page.</p><p class="error-detail">${escapeHtml(String(err.message || err))}</p></div>`;
    } finally {
      setLoading(false);
    }
  }

  function notFound(path) {
    headerEl.innerHTML = '';
    paneEl.innerHTML = `<div class="error-view"><p><strong>${escapeHtml(path)}</strong> doesn't exist.</p></div>`;
    document.title = `Not found — ${SITE.name}`;
  }

  function render(path) {
    const norm = (path === '/' || path === '') ? '/' : VFS.normalize(path);
    const node = VFS.getNode(norm);
    currentPath = norm;

    // Toggle state classes
    document.body.classList.toggle('is-home-page', norm === '/home.html');
    document.body.classList.toggle('is-about-page', norm.endsWith('about.html'));

    renderBreadcrumb(norm);

    if (!node) notFound(norm);
    else if (node.type === 'file') renderFile(node);
    else if (node.type === 'dir') renderDir(node, norm); // Execute Dir Render

    if (scrollEl) scrollEl.scrollTop = 0;
  }

  function navigateTo(path) {
    const norm = (path === '/' || path === '') ? '/' : VFS.normalize(path);
    if ('#' + norm === location.hash) {
      render(norm);
      return;
    }
    location.hash = norm;
  }

  function init({ pane, header, breadcrumb, scrollContainer }) {
    paneEl = pane;
    headerEl = header;
    breadcrumbEl = breadcrumb;
    scrollEl = scrollContainer || pane;

    // --- NEW: Event Delegation for Clicks ---
    // Listen for breadcrumb clicks
    breadcrumbEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button.crumb');
      if (btn) navigateTo(btn.dataset.path);
    });

    // Listen for directory file/folder clicks
    paneEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button.dirlist-name');
      if (btn) navigateTo(btn.dataset.path);
    });
    // ----------------------------------------

    window.addEventListener('hashchange', () => {
      render(location.hash.slice(1) || '/home.html');
    });

    render(location.hash.slice(1) || '/home.html');
  }

  return { init, navigateTo };
})();

export default Content;