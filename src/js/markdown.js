import { marked } from 'marked';
import hljs from 'highlight.js';

const MD = (() => {
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  marked.use({
    gfm: true,
    breaks: false,
    renderer: {
      code(codeOrToken, langOrUndefined) {
        const text = typeof codeOrToken === 'string' ? codeOrToken : codeOrToken.text;
        const lang = typeof codeOrToken === 'string' ? langOrUndefined : (codeOrToken.lang || '');

        if (lang && hljs.getLanguage(lang)) {
          try {
            const highlighted = hljs.highlight(text, { language: lang }).value;
            return `<pre><code class="hljs language-${escapeHtml(lang)}">${highlighted}</code></pre>\n`;
          } catch (e) {
          }
        }
        return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>\n`;
      }
    }
  });

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
      val = val.replace(/^["']|["']$/g, '');
      if (val.startsWith('[[') && val.endsWith(']]')) {
        val = val.slice(2, -2).trim();
      } 
      else if (val.startsWith('[') && val.endsWith(']')) {
        val = val
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter((s) => s.length > 0);
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

  function render(raw) {
    let { frontmatter, body } = parseFrontmatter(raw);
    body = body.replace(/==([^=]+)==/g, '<mark>$1</mark>');
    body = body.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, filename, caption) => {
      if (caption) {
        return `\n\n<figure class="blog-figure">\n  <img src="/images/${filename}" alt="${caption}">\n  <figcaption>${caption}</figcaption>\n</figure>\n\n`;
      }
      return `![image](/images/${filename})`;
    });
    body = body.replace(/^:::spoiler\s+(.*?)\n([\s\S]*?)\n:::/gm, '<details class="spoiler">\n<summary class="spoiler-summary">$1</summary>\n<div class="spoiler-content">\n\n$2\n\n</div>\n</details>');
    const { replaced, store } = protectMath(body);
    let html = marked.parse(replaced);
    html = restoreMath(html, store);
    return { frontmatter, html };
  }

  return { render, parseFrontmatter };
})();

export default MD;