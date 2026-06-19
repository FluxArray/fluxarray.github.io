/**
 * The terminal: a small custom shell (not a real PTY/xterm just enough
 * of one) wired to the VFS and the content router. Lives on desktop (docked sidebar)
 */

const Terminal = (() => {
  const COMMANDS = ['ls', 'cd', 'open', 'cat', 'pop', 'clear', 'tskin', 'tskins', 'pwd', 'whoami', 'stats', 'help', 'home'];

  let cwd = '/';
  let outputEl, inputEl, sheetEl, fabEl, promptLiveEl, liveLineEl;
  let cmdHistory = [];
  let histIndex = -1;
  let navCount = 0;
  let completion = null; // { options, index, head, tail, token }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // line builders
  const line = (cls, html) => `<div class="term-line ${cls}">${html}</div>`;
  const errLine = (text) => line('term-error', esc(text));
  const mutedLine = (text) => line('term-muted', esc(text));
  const plainLine = (text) => line('term-text', esc(text).replace(/\n/g, '<br>'));
  const promptEcho = (cmd) => line('term-echo', `<span class="term-prompt-sym">${promptText()}</span> ${esc(cmd)}`);

  function promptText() {
    return `<span class="term-cwd">${esc('' + cwd)}</span> $`;
  }

  // VFS helper
  function resolve(arg) {
    return VFS.resolve(cwd, arg || '.');
  }

  // commands and shortcuts
function cmdHelp() {
    const commands = [
      ['ls [-r] [-d | -dl | -de] [-v] [path]', 'list directory'],
      ['cd <dir>', 'change directory'],
      ['open <file>', 'open file in content pane'],
      ['tskins / tskin <name>', 'list / set terminal skin'],
      ['pop', 'go back'],
      ['clear', 'clear terminal'],
      ['help', 'this message'],
    ];

    const shortcuts = [
      ['Tab', 'accept autocomplete'],
      ['Shift+Tab', 'cycle suggestions'],
      ['← / →', 'move cursor left/right'],
      ['Shift+→', 'collapse terminal'],
      ['Shift+←', 'expand / focus terminal'],
      ['Shift+↑', 'focus content pane'],
      ['h/j/k/l', 'scroll focused content pane'],
    ];

    // helper function to build each section
    const renderSection = (title, items) => {
      const rows = items
        .map(([cmd, desc]) => `
          <div class="help-row" style="margin-bottom: 2px;">
            <div class="help-cmd" style="padding-left: 10px;">${esc(cmd)}</div>
            <div class="help-desc" style="padding-left: 20px; opacity: 0.7;">${esc(desc)}</div>
          </div>
        `)
        .join('');
      
      return `
        <div class="help-section-title" style="color: var(--text); font-weight: bold; margin-top: 12px; margin-bottom: 4px;">
          ${esc(title)}
        </div>
        ${rows}
      `;
    };

    const body = renderSection('COMMANDS', commands) + renderSection('SHORTCUTS', shortcuts);
    return [line('term-help', body)];
  }
  function cmdLs(args) {
    let recursive = false,
      showDates = false,
      sortByDate = false,
      pathArg = null;
    for (const a of args) {
      if (a === '-r') recursive = true;
      else if (a === '-v') showDates = true;
      else if (a === '-t') sortByDate = true;
      else if (/^-[rvt]+$/.test(a)) {
        if (a.includes('r')) recursive = true;
        if (a.includes('v')) showDates = true;
        if (a.includes('t')) sortByDate = true;
      } else pathArg = a;
    }
    const targetPath = resolve(pathArg);
    const node = VFS.getNode(targetPath);
    if (!node) return [errLine(`ls: ${pathArg}: no such file or directory`)];
    
    // single file edge-case
    if (node.type === 'file') return [renderEntry(node, showDates, true, 0)];

    // recursive directory list (ls -r)
    if (recursive) {
      const entries = VFS.listRecursive(node);
      if (!entries.length) return [mutedLine('(empty)')];
      return entries.map((e, i) => {
        const isLast = i === entries.length - 1;
        return renderEntry(e.node, showDates, isLast, e.depth);
      });
    }

    // standard directory list
    let children = VFS.listChildren(node);
    if (sortByDate) {
      children = children.slice().sort((a, b) => {
        const da = (a.meta && a.meta.date) || '';
        const db = (b.meta && b.meta.date) || '';
        if (da === db) return a.name.localeCompare(b.name);
        if (!da) return 1;
        if (!db) return -1;
        return db.localeCompare(da);
      });
    }
    if (!children.length) return [mutedLine('(empty)')];
    
    // standard map with isLast calculation
    return children.map((c, i) => {
      const isLast = i === children.length - 1;
      return renderEntry(c, showDates, isLast, 0);
    });
  }

  function renderEntry(node, showDates, isLast = false, depth = 0) {
    let indent = '';
    if (depth > 0) {
      indent = '│   '.repeat(depth);
    }
    const branch = isLast ? '└── ' : '├── ';
    const treeSym = `<span class="term-tree">${indent}${branch}</span>`;
    const isDir = node.type === 'dir';
    const name = node.name; 
    const cls = isDir ? 'term-dir' : 'term-file';
    const dateStr = showDates && node.meta && node.meta.date ? `<span class="term-date">${esc(node.meta.date)}</span>` : '';

    return line('term-entry', `${treeSym}<span class="${cls}">${esc(name)}</span>${dateStr}`);
  }

  function cmdCd(args) {
    const resolved = resolve(args[0] === undefined ? '/' : args[0]);
    const node = VFS.getNode(resolved);
    if (!node) return [errLine(`cd: ${args[0]}: no such directory`)];
    if (node.type !== 'dir') return [errLine(`cd: ${args[0]}: not a directory`)];
    cwd = resolved;
    return [];
  }

  function cmdOpen(args) {
    if (!args[0]) return [errLine('open: missing file operand')];
    const resolved = resolve(args[0]);
    const node = VFS.getNode(resolved);
    if (!node) return [errLine(`open: ${args[0]}: no such file`)];
    if (node.type === 'dir') return [errLine(`open: ${args[0]} is a directory — try: cd ${args[0]}`)];
    Content.navigateTo(resolved);
    return [];
  }

  function cmdPop() {
    if (navCount <= 1) return [mutedLine('nothing to go back to')];
    window.history.back();
    return [];
  }

  function cmdtskin(args) {
    if (!args[0]) return [errLine('tskin: specify a name — try: tskin sunny')];
    const ok = Skin.set(args[0]);
    if (!ok) return [errLine(`tskin: unknown skin "${args[0]}" — available: ${Skin.list().join(', ')}`)];
    return [mutedLine(`skin → ${args[0]}`)];
  }

  function cmdtskins() {
    return [plainLine(Skin.list().map((s) => (s === Skin.get() ? `* ${s}` : `  ${s}`)).join('\n'))];
  }

  function cmdStats() {
    const files = VFS.getAllFiles().filter((f) => f.meta.displayMode === 'blog');
    const tagCounts = {};
    let min = null,
      max = null;
    files.forEach((f) => {
      (f.meta.tags || []).forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1));
      if (f.meta.date) {
        if (!min || f.meta.date < min) min = f.meta.date;
        if (!max || f.meta.date > max) max = f.meta.date;
      }
    });
    const tagLine = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t}(${n})`)
      .join('  ');
    const lines = [`${files.length} post${files.length === 1 ? '' : 's'} on record`];
    if (min) lines.push(`spanning ${min} → ${max}`);
    if (tagLine) lines.push(`tags: ${tagLine}`);
    return [plainLine(lines.join('\n'))];
  }

  function cmdWhoami() {
    return [plainLine('idk')];
  }

  function dispatch(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return { lines: [] };
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        return { lines: cmdHelp() };
      case 'ls':
        return { lines: cmdLs(args) };
      case 'cd':
        return { lines: cmdCd(args) };
      case 'open':
      case 'cat':
        return { lines: cmdOpen(args) };
      case 'home':
        Content.navigateTo('/home.html');
        return { lines: [] };
      case 'pop':
        return { lines: cmdPop() };
      case 'clear':
        return { lines: [], clear: true };
      case 'tskin':
        return { lines: cmdtskin(args) };
      case 'tskins':
        return { lines: cmdtskins() };
      case 'pwd':
        return { lines: [plainLine(cwd)] };
      case 'stats':
        return { lines: cmdStats() };
      case 'whoami':
        return { lines: cmdWhoami() };
      default:
        return { lines: [errLine(`unknown command: ${cmd}`)] };
    }
  }

  // everything gets inserted *before* the live line, never after — that's
  // what keeps the prompt+input pinned to the bottom of the buffer while
  // history scrolls up above it, like a real terminal.
  function append(html) {
    liveLineEl.insertAdjacentHTML('beforebegin', html);
  }

  function scrollToBottom() {
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function updatePromptLive() {
    if (promptLiveEl) promptLiveEl.innerHTML = promptText();
  }

  function runLine(raw) {
    append(promptEcho(raw));
    completion = null;
    if (raw.trim()) {
      cmdHistory.push(raw);
      histIndex = cmdHistory.length;
    }
    const result = dispatch(raw);
    if (result.clear) {
      outputEl.innerHTML = '';
      outputEl.appendChild(liveLineEl);
    } else {
      result.lines.forEach((l) => append(l));
    }
    updatePromptLive();
    scrollToBottom();
    focusInput();
  }

  function getCompletionCandidates(token, isFirstToken) {
    if (isFirstToken) {
      return COMMANDS.filter((c) => c.startsWith(token));
    }
    const lastSlash = token.lastIndexOf('/');
    const head = lastSlash === -1 ? '' : token.slice(0, lastSlash + 1);
    const prefix = lastSlash === -1 ? token : token.slice(lastSlash + 1);
    const dirPath = resolve(head || '.');
    const node = VFS.getNode(dirPath);
    if (!node || node.type !== 'dir') return [];
    return VFS.listChildren(node)
      .filter((c) => c.name.startsWith(prefix))
      .map((c) => head + c.name + (c.type === 'dir' ? '/' : ''));
  }

  function longestCommonPrefix(strs) {
    if (!strs.length) return '';
    let p = strs[0];
    for (const s of strs.slice(1)) {
      let i = 0;
      while (i < p.length && i < s.length && p[i] === s[i]) i++;
      p = p.slice(0, i);
    }
    return p;
  }

  function handleTab(backwards) {
    const value = inputEl.value;
    const upToCursor = value.slice(0, inputEl.selectionStart);
    const tokens = upToCursor.split(/\s+/);
    const token = tokens[tokens.length - 1] || '';
    const isFirstToken = tokens.length <= 1;
    const before = value.slice(0, inputEl.selectionStart - token.length);
    const after = value.slice(inputEl.selectionStart);

    if (completion && completion.before === before && completion.after === after) {
      completion.index = (completion.index + (backwards ? -1 : 1) + completion.options.length) % completion.options.length;
      const choice = completion.options[completion.index];
      inputEl.value = before + choice + after;
      inputEl.selectionStart = inputEl.selectionEnd = (before + choice).length;
      return;
    }

    const options = getCompletionCandidates(token, isFirstToken);
    if (!options.length) return;
    if (options.length === 1) {
      const choice = options[0];
      inputEl.value = before + choice + after;
      inputEl.selectionStart = inputEl.selectionEnd = (before + choice).length;
      completion = null;
      return;
    }
    const common = longestCommonPrefix(options);
    const useChoice = common.length > token.length ? common : options[0];
    inputEl.value = before + useChoice + after;
    inputEl.selectionStart = inputEl.selectionEnd = (before + useChoice).length;
    completion = { options, index: 0, before, after, token };
  }

  function bootSequence(onDone) {
    const banner = ['Type help for command list.'];
    let i = 0;
    let skipped = false;
    const skip = () => {
      if (skipped) return;
      skipped = true;
      while (outputEl.firstChild && outputEl.firstChild !== liveLineEl) {
        outputEl.removeChild(outputEl.firstChild);
      }
      liveLineEl.insertAdjacentHTML('beforebegin', banner.map((b) => mutedLine(b)).join(''));
      onDone();
    };
    const tick = () => {
      if (skipped) return;
      if (i >= banner.length) {
        onDone();
        return;
      }
      append(mutedLine(banner[i]));
      i++;
      setTimeout(tick, 220);
    };
    sheetEl.addEventListener('click', skip, { once: true });
    document.addEventListener('keydown', skip, { once: true });
    setTimeout(tick, 150);
  }

  function focusInput() {
    inputEl.focus();
  }

  function setOpen(isOpen) {
    sheetEl.classList.toggle('is-open', isOpen);
    fabEl.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) setTimeout(focusInput, 50);
  }

  function init({ sheet, output, input, fab, closeBtn, promptLive }) {
    sheetEl = sheet;
    outputEl = output;
    inputEl = input;
    fabEl = fab;
    promptLiveEl = promptLive;
    liveLineEl = outputEl.querySelector('#terminal-live-line');

    document.addEventListener('keydown', (e) => {
      // Check if the terminal is currently collapsed
      const isCollapsed = sheetEl.classList.contains('is-collapsed');

      // Desktop-only terminal collapse shortcuts
      if (window.innerWidth > 1024) {
        if (e.shiftKey && e.key === 'ArrowRight') {
          e.preventDefault();
          sheetEl.classList.add('is-collapsed');
          inputEl.blur();
        } else if (e.shiftKey && e.key === 'ArrowLeft') {
          e.preventDefault();
          sheetEl.classList.remove('is-collapsed');
          setTimeout(focusInput, 800); 
        }
      }

      // Shift + UpArrow to drop terminal focus and enter "Normal Mode"
      if (e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        inputEl.blur(); 
      }

      // Vim bindings (h/j/k/l) 
      if (document.activeElement !== inputEl || isCollapsed) {
        const pane = document.getElementById('content-pane');
        const step = 100; 
        
        if (e.key === 'j') {
          e.preventDefault();
          pane.scrollBy({ top: step, behavior: 'smooth' });
        } else if (e.key === 'k') {
          e.preventDefault();
          pane.scrollBy({ top: -step, behavior: 'smooth' });
        } else if (e.key === 'h') {
          e.preventDefault();
          pane.scrollBy({ left: -step, behavior: 'smooth' });
        } else if (e.key === 'l') {
          e.preventDefault();
          pane.scrollBy({ left: step, behavior: 'smooth' });
        }
      }
    });

    document.addEventListener('navigated', () => {
      navCount++;
    });

    sheetEl.addEventListener('click', (e) => {
      if (e.target === outputEl || outputEl.contains(e.target)) focusInput();
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = inputEl.value;
        inputEl.value = '';
        runLine(v);
      } else if (e.key === 'ArrowUp' && !e.shiftKey) {
        e.preventDefault();
        if (histIndex > 0) {
          histIndex--;
          inputEl.value = cmdHistory[histIndex] || '';
        }
      } else if (e.key === 'ArrowDown' && !e.shiftKey) {
        e.preventDefault();
        if (histIndex < cmdHistory.length) {
          histIndex++;
          inputEl.value = cmdHistory[histIndex] || '';
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleTab(e.shiftKey);
      } else if (e.key !== 'Shift') {
        completion = null;
      }
    });

    fabEl.addEventListener('click', () => setOpen(!sheetEl.classList.contains('is-open')));
    if (closeBtn) closeBtn.addEventListener('click', () => setOpen(false));

    bootSequence(() => {
      focusInput();
    });
    updatePromptLive();
  }

  return { init, focusInput, setOpen };
})();
