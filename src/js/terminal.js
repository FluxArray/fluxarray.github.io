import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import VFS from './vfs.js';
import Skin from './skin.js';
import Content from './content.js';

const TermUI = (() => {
  let term;
  let fitAddon;
  let currentInput = '';
  let cursorPos = 0;
  let cwd = '/';
  let cmdHistory = [];
  let histIndex = -1;

  // Master list of commands for autocomplete
  const COMMANDS = ['ls', 'cd', 'open', 'cskins', 'cskin', 'tskins', 'tskin', 'pop', 'clear', 'help', 'pwd', 'whoami'];

  // ANSI Colors mapped to your theme
  const cRed = '\x1b[1;31m';
  const cDim = '\x1b[90m';
  const cReset = '\x1b[0m';
  const cWhite = '\x1b[37m';
  const cBold = '\x1b[1m';

  function init() {
    const container = document.getElementById('terminal-container');
    term = new Terminal({
      cursorBlink: true,
      fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'Monaco', monospace",
      fontSize: 16.7,
      fontWeight: 'normal',
      theme: {
        background: '#000000',
        foreground: '#D7D0C5',
        cursor: '#D81F26',
        selectionBackground: '#262626'
      }
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();
    window.addEventListener('resize', () => fitAddon.fit());

    setupShortcuts();

    term.writeln('Type "help" for a list of commands.');
    term.writeln('');

    // ENABLE REVERSE WRAPAROUND (Allows \b to wrap backward up the screen)
    term.write('\x1b[?45h');
    prompt();

    handleInput();
  }

  function setupShortcuts() {
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        const sheetEl = document.getElementById('terminal-sheet');

        if (window.innerWidth > 1024) {
          if (e.shiftKey && e.key === 'ArrowRight') {
            e.preventDefault();
            sheetEl.classList.add('is-collapsed');
            term.blur();
            return false;
          } else if (e.shiftKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            sheetEl.classList.remove('is-collapsed');
            setTimeout(() => fitAddon.fit(), 300);
            return false;
          }
        }

        if (e.shiftKey && e.key === 'ArrowUp') {
          e.preventDefault();
          term.blur();
          return false;
        }
      }
      return true;
    });

    document.addEventListener('keydown', (e) => {
      const sheetEl = document.getElementById('terminal-sheet');
      const isCollapsed = sheetEl.classList.contains('is-collapsed');
      const isTermFocused = document.activeElement && document.activeElement.classList.contains('xterm-helper-textarea');

      if (!isTermFocused && window.innerWidth > 1024) {
        if (e.shiftKey && e.key === 'ArrowRight') {
          e.preventDefault();
          sheetEl.classList.add('is-collapsed');
        } else if (e.shiftKey && e.key === 'ArrowLeft') {
          e.preventDefault();
          sheetEl.classList.remove('is-collapsed');
          setTimeout(() => {
            fitAddon.fit();
            term.focus();
          }, 300);
        }
      }

      if (!isTermFocused || isCollapsed) {
        const pane = document.getElementById('content-pane');
        const step = 100;

        if (e.key === 'j') pane.scrollBy({ top: step, behavior: 'smooth' });
        else if (e.key === 'k') pane.scrollBy({ top: -step, behavior: 'smooth' });
        else if (e.key === 'h') pane.scrollBy({ left: -step, behavior: 'smooth' });
        else if (e.key === 'l') pane.scrollBy({ left: step, behavior: 'smooth' });
      }
    });
  }

  function prompt() {
    term.write(`${cRed}${cwd}${cReset} > `);
  }

  // --- AUTOCOMPLETE & GHOST TEXT ENGINE ---
  function getCompletionCandidates(token, isFirstToken) {
    if (isFirstToken) {
      return COMMANDS.filter(c => c.startsWith(token));
    }
    const lastSlash = token.lastIndexOf('/');
    const head = lastSlash === -1 ? '' : token.slice(0, lastSlash + 1);
    const prefix = lastSlash === -1 ? token : token.slice(lastSlash + 1);
    const dirPath = VFS.resolve(cwd, head || '.');
    const node = VFS.getNode(dirPath);

    if (!node || node.type !== 'dir') return [];

    return VFS.listChildren(node)
      .filter(c => c.name.startsWith(prefix))
      .map(c => head + c.name + (c.type === 'dir' ? '/' : ''));
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

  // The Bulletproof Multi-Line Redraw
  function refreshTail() {
    // 1. Clear everything from cursor to the end of the screen (wipes old ghost text safely)
    term.write('\x1b[0J');

    // 2. Save the absolute cursor position!
    term.write('\x1b7');

    // 3. Write remainder
    const remainder = currentInput.slice(cursorPos);
    term.write(remainder);

    // 4. Write Ghost text if at end
    if (cursorPos === currentInput.length && currentInput.length > 0) {
      const tokens = currentInput.split(/\s+/);
      const token = tokens[tokens.length - 1];
      if (token) {
        const cands = getCompletionCandidates(token, tokens.length <= 1);
        if (cands.length > 0) {
          const ghost = cands[0].slice(token.length);
          if (ghost) term.write(`${cDim}${ghost}${cReset}`);
        }
      }
    }

    // 5. Instantly restore cursor to the saved position! No counting needed.
    term.write('\x1b8');
  }

  function handleTab() {
    const upToCursor = currentInput.slice(0, cursorPos);
    const tokens = upToCursor.split(/\s+/);
    const token = tokens[tokens.length - 1];
    const isFirstToken = tokens.length <= 1;

    if (!token && isFirstToken) return;

    const candidates = getCompletionCandidates(token, isFirstToken);
    if (candidates.length === 0) return;

    const prefix = longestCommonPrefix(candidates);

    if (prefix.length > token.length) {
      const before = currentInput.slice(0, cursorPos - token.length);
      const after = currentInput.slice(cursorPos);

      currentInput = before + prefix + after;
      cursorPos = (before + prefix).length;

      term.write('\x1b[2K\r');
      prompt();
      term.write(currentInput.slice(0, cursorPos));
      refreshTail();

    } else if (candidates.length > 1) {
      term.write('\r\n');
      const coloredCandidates = candidates.map(c => `${cDim}${c}${cReset}`);
      term.writeln(coloredCandidates.join('  '));
      prompt();
      term.write(currentInput.slice(0, cursorPos));
      refreshTail();
    }
  }

  function handleInput() {
    term.onData((data) => {
      const code = data.charCodeAt(0);

      if (code === 13) { // Enter
        term.write('\x1b[0J'); // Wipe ghost text before moving down
        term.write('\r\n');
        let isCleared = false;
        if (currentInput.trim()) {
          cmdHistory.push(currentInput);
          histIndex = cmdHistory.length;
          isCleared = dispatch(currentInput.trim());
        }
        currentInput = '';
        cursorPos = 0;
        if (!isCleared) term.writeln('');
        prompt();
        term.scrollToBottom();
      }
      else if (code === 127 || code === 8) { // Backspace
        if (cursorPos > 0) {
          currentInput = currentInput.slice(0, cursorPos - 1) + currentInput.slice(cursorPos);
          cursorPos--;
          term.write('\b'); // Reverse wrap handles this beautifully now
          refreshTail();
        }
      }
      else if (data === '\x1b[D') { // Left Arrow
        if (cursorPos > 0) {
          cursorPos--;
          term.write('\b'); // Force the left arrow to use backspace so it wraps up
          refreshTail();
        }
      }
      else if (data === '\x1b[C') { // Right Arrow
        if (cursorPos < currentInput.length) {
          // Write the character we are stepping over to advance the cursor naturally (handles down-wrapping perfectly)
          const charToStepOver = currentInput[cursorPos];
          term.write(charToStepOver);
          cursorPos++;
          refreshTail();
        } else if (cursorPos === currentInput.length && currentInput.length > 0) {
          // ACCEPT GHOST TEXT
          const tokens = currentInput.split(/\s+/);
          const token = tokens[tokens.length - 1];
          if (token) {
            const cands = getCompletionCandidates(token, tokens.length <= 1);
            if (cands.length > 0) {
              const ghost = cands[0].slice(token.length);
              if (ghost) {
                currentInput += ghost;
                cursorPos = currentInput.length;
                term.write('\x1b[2K\r');
                prompt();
                term.write(currentInput);
              }
            }
          }
        }
      }
      else if (data === '\x1b[A') { // Up Arrow
        if (histIndex > 0) {
          histIndex--;
          replaceInput(cmdHistory[histIndex]);
        }
      }
      else if (data === '\x1b[B') { // Down Arrow
        if (histIndex < cmdHistory.length - 1) {
          histIndex++;
          replaceInput(cmdHistory[histIndex]);
        } else {
          histIndex = cmdHistory.length;
          replaceInput('');
        }
      }
      else if (code === 9) { // Tab
        handleTab();
      }
      else if (code >= 32 && code <= 126) { // Typing
        currentInput = currentInput.slice(0, cursorPos) + data + currentInput.slice(cursorPos);
        cursorPos++;
        term.write(data);
        refreshTail();
      }
    });
  }

  function replaceInput(newInput) {
    term.write('\x1b[2K\r');
    prompt();
    currentInput = newInput;
    cursorPos = currentInput.length;
    term.write(currentInput);
    refreshTail();
  }

  function printHelp() {
    const helpLines = [
      `${cBold}COMMANDS${cReset}`,
      `${cRed}ls [-r] [-d|-dl|-de] [-v] [path]${cReset}`,
      `  ${cDim}list directory${cReset}`,
      `${cRed}cd <dir>${cReset}`,
      `  ${cDim}change directory${cReset}`,
      `${cRed}open <file>${cReset}`,
      `  ${cDim}open file in content pane${cReset}`,
      `${cRed}cskins / cskin <name>${cReset}`,
      `  ${cDim}list / set content pane skin${cReset}`,
      `${cRed}tskins / tskin <name>${cReset}`,
      `  ${cDim}list / set terminal theme${cReset}`,
      `${cRed}pop${cReset}`,
      `  ${cDim}go back${cReset}`,
      `${cRed}clear${cReset}`,
      `  ${cDim}clear terminal${cReset}`,
      `${cRed}help${cReset}`,
      `  ${cDim}this message${cReset}`,
      ``,
      `${cBold}SHORTCUTS${cReset}`,
      `${cRed}Tab${cReset}`,
      `  ${cDim}accept autocomplete${cReset}`,
      `${cRed}Shift+Tab${cReset}`,
      `  ${cDim}cycle suggestions${cReset}`,
      `${cRed}\u2190 / \u2192${cReset}`,
      `  ${cDim}move cursor left/right${cReset}`,
      `${cRed}Shift+\u2192${cReset}`,
      `  ${cDim}collapse terminal${cReset}`,
      `${cRed}Shift+\u2190${cReset}`,
      `  ${cDim}expand / focus terminal${cReset}`,
      `${cRed}Shift+\u2191${cReset}`,
      `  ${cDim}focus content pane${cReset}`,
      `${cRed}h/j/k/l${cReset}`,
      `  ${cDim}scroll focused content pane${cReset}`
    ];
    term.writeln(helpLines.join('\r\n'));
  }

  function dispatch(raw) {
    const parts = raw.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'clear':
        term.write('\x1b[2J\x1b[3J\x1b[H');
        return true;
      case 'pwd':
        term.writeln(cwd);
        break;
      case 'whoami':
        term.writeln('guest');
        break;
      case 'tskins':
      case 'cskins':
        term.writeln(Skin.list().map(s => (s === Skin.get() ? `* ${s}` : `  ${s}`)).join('\r\n'));
        break;
      case 'tskin':
      case 'cskin':
        if (!args[0]) term.writeln(`${cRed}error: specify a skin${cReset}`);
        else if (Skin.set(args[0])) term.writeln(`${cDim}skin -> ${args[0]}${cReset}`);
        else term.writeln(`${cRed}error: unknown skin${cReset}`);
        break;
      case 'cd':
        const targetCd = VFS.resolve(cwd, args[0] || '/');
        const nodeCd = VFS.getNode(targetCd);
        if (!nodeCd) term.writeln(`${cRed}cd: ${args[0]}: no such directory${cReset}`);
        else if (nodeCd.type !== 'dir') term.writeln(`${cRed}cd: ${args[0]}: not a directory${cReset}`);
        else cwd = targetCd;
        break;
      case 'ls':
        const targetLs = VFS.resolve(cwd, args[0] || '.');
        const nodeLs = VFS.getNode(targetLs);
        if (!nodeLs) {
          term.writeln(`${cRed}ls: no such directory${cReset}`);
          return false;
        }
        if (nodeLs.type === 'file') {
          term.writeln(nodeLs.name);
          return false;
        }
        const children = VFS.listChildren(nodeLs);
        if (!children.length) {
          term.writeln(`${cDim}(empty)${cReset}`);
        } else {
          children.forEach((c, index) => {
            const isLast = index === children.length - 1;
            const prefix = isLast ? '└── ' : '├── ';
            const color = c.type === 'dir' ? cRed : cWhite;
            term.writeln(`${cWhite}${prefix}${cReset}${color}${c.name}${cReset}`);
          });
        }
        break;
      case 'help':
        printHelp();
        break;
      case 'pop':
        window.history.back();
        break;
      case 'open':
        if (!args[0]) {
          term.writeln(`${cRed}open: missing file operand${cReset}`);
          break;
        }
        const resolved = VFS.resolve(cwd, args[0]);
        const node = VFS.getNode(resolved);
        if (!node) term.writeln(`${cRed}open: ${args[0]}: no such file${cReset}`);
        else if (node.type === 'dir') term.writeln(`${cRed}open: ${args[0]} is a directory — try: cd ${args[0]}${cReset}`);
        else Content.navigateTo(resolved);
        break;
      default:
        term.writeln(`${cRed}Unknown command:${cReset} ${cmd}`);
    }
    return false;
  }

  return { init, focusInput: () => term.focus() };
})();

export default TermUI;