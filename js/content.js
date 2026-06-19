/**
 * Router + content renderer.
 */

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
      script.onerror = () => resolve(); // fail quietly — math just won't typeset
      document.head.appendChild(script);
    });
    return window.__mathJaxReady;
  }

  function typesetMaybe(container, rawBody) {
    if (!/\$|\\\(|\\\[/.test(rawBody)) return;
    ensureMathJax().then(() => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([container]).catch(() => {});
      }
    });
  }

  function executeInlineScripts(container) {
    container.querySelectorAll('script').forEach((old) => {
      const fresh = document.createElement('script');
      for (const attr of old.attributes) fresh.setAttribute(attr.name, attr.value);
      fresh.textContent = old.textContent;
      old.replaceWith(fresh);
    });
  }

  function renderBreadcrumb(path) {
    const parts = path.split('/').filter(Boolean);
    let acc = '';
    const isMobile = window.innerWidth <= 1024;
    const segs = [{ label: '~', path: isMobile ? '/' : '/home.html' }];
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
      .map((s, i) =>
        s.current
          ? `<span class="crumb crumb-current">${escapeHtml(s.label)}</span>`
          : `<button class="crumb" data-path="${escapeHtml(s.path)}">${escapeHtml(s.label)}</button>`
      )
      .join('<span class="crumb-sep">/</span>');
  }

  function iconFor(node) {
    return node.type === 'dir' ? '📁' : '📄';
  }

  function renderDirectory(node) {
    setLoading(false);
    headerEl.innerHTML = '';
    const children = VFS.listChildren(node);
    const isRoot = node.path === '/';
    const upRow = isRoot
      ? ''
      : `<li><button class="dirlist-row" data-path="${escapeHtml(parentPath(node.path))}"><span class="dirlist-icon">⬑</span><span class="dirlist-name">..</span></button></li>`;

    const rows = children
      .map((c) => {
        const meta = c.type === 'file' ? c.meta : null;
        const dateStr = meta && meta.date ? `<span class="dirlist-date">${escapeHtml(meta.date)}</span>` : '';
        const label = c.type === 'dir' ? c.name + '/' : (meta && meta.title) || c.name;
        return `<li><button class="dirlist-row" data-path="${escapeHtml(c.path)}">
            <span class="dirlist-icon">${iconFor(c)}</span>
            <span class="dirlist-name ${c.type === 'dir' ? 'is-dir' : 'is-file'}">${escapeHtml(label)}</span>
            ${dateStr}
          </button></li>`;
      })
      .join('');

    paneEl.innerHTML = `
      <div class="dirlist-view">
        <h1 class="dirlist-title">${node.path === '/' ? '~' : node.path + '/'}</h1>
        <ul class="dirlist">${upRow}${rows}</ul>
      </div>`;
    document.title = `${node.path === '/' ? '~' : node.name} — ${SITE.name}`;
  }

  function parentPath(path) {
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return '/' + parts.join('/');
  }

  async function renderFile(node) {
    setLoading(true);
    try {
      const res = await fetch('content/' + node.meta.file);
      if (!res.ok) throw new Error('fetch failed: ' + res.status);
      const raw = await res.text();
      const { frontmatter, html } = MD.render(raw);
      const isBlog = (frontmatter.displayMode || node.meta.displayMode) === 'blog';
      const title = frontmatter.title || node.meta.title || node.name;
      const date = frontmatter.date || node.meta.date;
      const tags = (frontmatter.tags && frontmatter.tags.length ? frontmatter.tags : node.meta.tags) || [];

      document.title = `${title} — ${SITE.name}`;

      if (isBlog) {
        headerEl.innerHTML = `
          <header class="blog-header">
            <h1 class="blog-title">${escapeHtml(title)}</h1>
            ${date ? `<p class="blog-date">${escapeHtml(formatDate(date))}</p>` : ''}
            ${tags.length ? `<ul class="blog-tags">${tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
          </header>`;
        paneEl.innerHTML = `<article class="prose">${html}</article>`;
      } else {
        headerEl.innerHTML = '';
        paneEl.innerHTML = `<article class="prose plain-page">${html}</article>`;
      }

      executeInlineScripts(paneEl);
      if (window.hljs) paneEl.querySelectorAll('pre code').forEach((b) => hljs.highlightElement(b));
      typesetMaybe(paneEl, raw);
    } catch (err) {
      headerEl.innerHTML = '';
      paneEl.innerHTML = `<div class="error-view"><p>Couldn't load this page.</p><p class="error-detail">${escapeHtml(
        String(err.message || err)
      )}</p></div>`;
    } finally {
      setLoading(false);
    }
  }

  function notFound(path) {
    headerEl.innerHTML = '';
    paneEl.innerHTML = `<div class="error-view"><p><strong>${escapeHtml(path)}</strong> doesn't exist.</p><p class="error-hint">Try <code>ls</code> from the terminal, or use the menu above.</p></div>`;
    document.title = `Not found — ${SITE.name}`;
  }

  function formatDate(d) {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function getCurrentPath() {
    return currentPath;
  }

  function render(path) {
    const norm = (path === '/' || path === '') ? '/' : VFS.normalize(path);
    const node = VFS.getNode(norm);
    currentPath = norm;
    document.body.classList.toggle('is-home-page', norm === '/home.html');
    document.body.classList.toggle('is-about-page', norm.endsWith('about.html'));
    renderBreadcrumb(norm);
    updateTopNavActive(norm);
    if (!node) {
      notFound(norm);
    } else if (node.type === 'dir') {
      renderDirectory(node);
    } else {
      renderFile(node);
    }
    window.scrollTo?.(0, 0);
    if (scrollEl) scrollEl.scrollTop = 0;
    document.dispatchEvent(new CustomEvent('navigated', { detail: { path: norm } }));
  }

  function updateTopNavActive(path) {
    document.querySelectorAll('.topnav-link').forEach((el) => {
      el.classList.toggle('active', el.dataset.path === path);
    });
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

    breadcrumbEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.crumb[data-path]');
      if (btn) navigateTo(btn.dataset.path);
    });
    paneEl.addEventListener('click', (e) => {
      const row = e.target.closest('.dirlist-row[data-path]');
      if (row) navigateTo(row.dataset.path);
    });

    window.addEventListener('hashchange', () => {
      render(location.hash.slice(1) || '/home.html');
    });

    render(location.hash.slice(1) || '/home.html');
  }

  return { init, navigateTo, getCurrentPath, SITE };
})();