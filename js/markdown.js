/**
 * Frontmatter parsing + Markdown rendering.
 *
 * Frontmatter parser is intentionally tiny: `key: value` pairs, optional
 * quotes, and one-line `[a, b, c]` lists. That's the entire surface the
 * content in this site uses, so there's no need for a real YAML library.
 *
 * Markdown rendering uses marked.js + highlight.js (both loaded from a CDN
 * in index.html). Math segments ($...$, $$...$$, \(...\), \[...\]) are
 * swapped out for placeholder tokens before marked sees the text and put
 * back afterwards, verbatim, so markdown never mistakes "_" inside an
 * equation for emphasis. MathJax (also CDN, loaded lazily) then typesets
 * whatever's left looking like math.
 */

const MD = (() => {
  let configured = false;

  function ensureConfigured() {
    if (configured) return;
    if (window.marked && window.hljs) {
      marked.setOptions({
        gfm: true,
        breaks: false,
        highlight(code, lang) {
          if (lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (e) {
              /* fall through to escaped, unhighlighted code */
            }
          }
          return escapeHtml(code);
        },
      });
      configured = true;
    }
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function parseFrontmatter(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: raw };

    const frontmatter = {};
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (!key) continue;

      if (val.startsWith('[') && val.endsWith(']')) {
        val = val
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter((s) => s.length > 0);
      } else {
        val = val.replace(/^["']|["']$/g, '');
      }
      frontmatter[key] = val;
    }
    return { frontmatter, body: match[2] };
  }

  const MATH_PATTERN = /\$\$[\s\S]+?\$\$|\$(?:\\.|[^$\n])+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g;

  function protectMath(src) {
    const store = [];
    const replaced = src.replace(MATH_PATTERN, (match) => {
      store.push(match);
      return `\u0000MATH${store.length - 1}\u0000`;
    });
    return { replaced, store };
  }

  function restoreMath(html, store) {
    return html.replace(/\u0000MATH(\d+)\u0000/g, (_, i) => escapeHtml(store[Number(i)]));
  }

  /** raw markdown string -> { frontmatter, html } */
  function render(raw) {
    ensureConfigured();
    let { frontmatter, body } = parseFrontmatter(raw);

    // 1. Convert ==highlights== to standard HTML <mark> tags
    body = body.replace(/==([^=]+)==/g, '<mark>$1</mark>');
    
    // 2. Convert ![[image.png]] to standard markdown images
    body = body.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, filename, caption) => {
      if (caption) {
        return `\n\n<figure class="blog-figure">\n  <img src="images/${filename}" alt="${caption}">\n  <figcaption>${caption}</figcaption>\n</figure>\n\n`;
      }
      return `![image](images/${filename})`;
    });

    if (!window.marked) {
      // Markdown library hasn't finished loading yet — show plain text
      // rather than nothing.
      return { frontmatter, html: `<pre>${escapeHtml(body)}</pre>` };
    }

    const { replaced, store } = protectMath(body);
    let html = marked.parse(replaced);
    html = restoreMath(html, store);
    return { frontmatter, html };
  }

  return { render, parseFrontmatter };
})();
