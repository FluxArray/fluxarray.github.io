import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Reconstruct __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Points to your content directory
const CONTENT_DIR = path.join(__dirname, 'public', 'content');
const MANIFEST_PATH = path.join(__dirname, 'public', 'content', 'manifest.json');

function parseFrontmatter(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return {};

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (!key) continue;

    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, '');
    }
    frontmatter[key] = val;
  }
  return frontmatter;
}

// find all .md files
function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walkDir(filePath, fileList);
    } else if (filePath.endsWith('.md')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function buildManifest() {
  const mdFiles = walkDir(CONTENT_DIR);
  const manifest = [];

  for (const filePath of mdFiles) {
    // .split(path.sep).join('/') ensures forward slashes even on Windows
    const relFilePath = path.relative(CONTENT_DIR, filePath).split(path.sep).join('/');

    // Convert to lowercase HTML URL path
    const urlPath = '/' + relFilePath.replace(/\.md$/, '.html').toLowerCase();

    const content = fs.readFileSync(filePath, 'utf-8');
    const meta = parseFrontmatter(content);

    // Build the entry object
    const entry = {
      path: urlPath,
      file: relFilePath,
      title: meta.title || path.basename(filePath, '.md')
    };

    if (meta.date) entry.date = meta.date;
    if (meta.tags) entry.tags = meta.tags;
    if (meta.displayMode) entry.displayMode = meta.displayMode;

    manifest.push(entry);
  }

  // Write the file
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Manifest successfully built with ${manifest.length} files!`);
}

buildManifest();