/**
 * Virtual filesystem built from content/manifest.json.
 *
 * Every entry in the manifest becomes a "file" node somewhere in a tree of
 * "dir" nodes, inferred purely from the slashes in its `path`. Nothing here
 * touches the DOM — this module just answers questions about the tree.
 */

const VFS = (() => {
  let root = null;
  let allFiles = []; // flat list of file nodes, for stats/search

  function makeDir(name, path) {
    return { name, path, type: 'dir', children: {} };
  }

  /** Build the tree from the manifest array. Call once at startup. */
  function build(manifest) {
    root = makeDir('', '/');
    allFiles = [];

    for (const entry of manifest) {
      const parts = entry.path.split('/').filter(Boolean);
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const name = parts[i];
        const isLast = i === parts.length - 1;
        const curPath = '/' + parts.slice(0, i + 1).join('/');
        if (isLast) {
          const fileNode = { name, path: curPath, type: 'file', meta: entry };
          node.children[name] = fileNode;
          allFiles.push(fileNode);
        } else {
          if (!node.children[name]) node.children[name] = makeDir(name, curPath);
          node = node.children[name];
        }
      }
    }
    return root;
  }

  /** Normalize a path: collapse "..", ".", repeated slashes, ensure leading "/". */
  function normalize(path) {
    const abs = path.startsWith('/');
    const parts = path.split('/').filter(Boolean);
    const stack = [];
    for (const p of parts) {
      if (p === '.') continue;
      if (p === '..') stack.pop();
      else stack.push(p);
    }
    return '/' + stack.join('/');
  }

  /** Resolve `target` against `base` (a directory path). Returns a normalized absolute path. */
  function resolve(base, target) {
    if (!target || target === '') return base;
    if (target.startsWith('/')) return normalize(target);
    return normalize(base.replace(/\/$/, '') + '/' + target);
  }

  /** Look up a node by absolute path. Returns null if it doesn't exist. */
  function getNode(path) {
    const norm = normalize(path);
    if (norm === '/' || norm === '') return root;
    const parts = norm.split('/').filter(Boolean);
    let node = root;
    for (const p of parts) {
      if (node.type !== 'dir' || !node.children[p]) return null;
      node = node.children[p];
    }
    return node;
  }

  /** Sorted children of a dir node: dirs first (alpha), then files (alpha). */
  function listChildren(node) {
    if (!node || node.type !== 'dir') return [];
    const kids = Object.values(node.children);
    const dirs = kids.filter((k) => k.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
    const files = kids.filter((k) => k.type === 'file').sort((a, b) => a.name.localeCompare(b.name));
    return [...dirs, ...files];
  }

  /** Recursively flatten a dir node into a tree-printable list with depth. */
  function listRecursive(node, depth = 0, out = []) {
    for (const child of listChildren(node)) {
      out.push({ node: child, depth });
      if (child.type === 'dir') listRecursive(child, depth + 1, out);
    }
    return out;
  }

  function getRoot() {
    return root;
  }

  function getAllFiles() {
    return allFiles;
  }

  return { build, resolve, normalize, getNode, listChildren, listRecursive, getRoot, getAllFiles };
})();

export default VFS;