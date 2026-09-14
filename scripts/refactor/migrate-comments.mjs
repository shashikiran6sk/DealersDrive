import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  anchorFor,
  commentRanges,
  emptyJsxExpressions,
  isDirective,
  parse,
  tokenSignature,
} from './comment-tools.mjs';

const REPO = process.cwd();
const APPS = [
  { app: 'web', src: 'apps/web/src' },
  { app: 'api', src: 'apps/api/src' },
  { app: 'sandbox', src: 'apps/sandbox/src' },
];
const DOCS = 'docs/code';

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out.sort();
}

/** The code line a comment attaches to: the one it precedes, or its own if trailing. */
function anchorLine(text, range) {
  const lineStart = text.lastIndexOf('\n', range.pos) + 1;
  const before = text.slice(lineStart, range.pos).trim();
  const trailing = before.replace(/[;,{]\s*$/, '').trim();
  if (trailing) return trailing.slice(0, 120);

  let i = range.end;
  while (i < text.length) {
    const nl = text.indexOf('\n', i);
    const line = text.slice(i, nl === -1 ? text.length : nl).trim();
    // Skip the tail of the comment's own line (`*/}`) and any pure closer.
    const isCloser = /^[})\]\s]*$/.test(line) || /^\*\/[})\]\s]*$/.test(line);
    if (
      line &&
      !isCloser &&
      !line.startsWith('*') &&
      !line.startsWith('//') &&
      !line.startsWith('/*')
    ) {
      return line
        .replace(/\s*[{(]\s*$/, '')
        .replace(/[;,]$/, '')
        .slice(0, 120);
    }
    if (nl === -1) break;
    i = nl + 1;
  }
  return null;
}

function cleanCommentText(raw) {
  if (raw.startsWith('//')) return raw.replace(/^\/\/\s?/, '').trimEnd();

  const lines = raw
    .replace(/^\/\*\*?/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^(\s*)\*\s?/, '$1').trimEnd());

  // A `/* … */` block keeps the indentation it had in the file, which markdown
  // would read as a code fence. Strip the common indent.
  // The first line sits right after `/*` and so has no indent of its own; it
  // must not drag the common indent to zero.
  const measured = lines.slice(1).filter((l) => l.trim());
  const indents = measured.map((l) => l.match(/^ */)[0].length);
  const common = indents.length ? Math.min(...indents) : 0;
  return lines
    .map((line, i) => (i === 0 ? line.trimStart() : line.slice(common)))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

/** Blank-line tidy-up after removal, so prettier has less to do. */
function collapse(text) {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\{\n\n/g, '{\n')
    .replace(/\n\n(\s*[}\)])/g, '\n$1');
}

function stripFile(file) {
  const text = readSource(file);
  const sf = parse(file, text);
  const ranges = commentRanges(sf, text);

  const notes = [];
  const cuts = [];

  for (const range of ranges) {
    const raw = text.slice(range.pos, range.end);
    if (isDirective(raw)) continue;

    const body = cleanCommentText(raw);
    if (body.trim()) {
      notes.push({
        line: sf.getLineAndCharacterOfPosition(range.pos).line + 1,
        anchor: anchorLine(text, range) ?? anchorFor(sf, text, range.end),
        body,
      });
    }
    cuts.push({ pos: range.pos, end: range.end });
  }

  if (cuts.length === 0) return { text, notes: [], changed: false };

  // Extend each cut over the whitespace that only existed to sit around it.
  const extended = cuts.map(({ pos, end }) => {
    let start = pos;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    if (!text.slice(lineStart, pos).trim()) start = lineStart;
    let stop = end;
    const nl = text.indexOf('\n', end);
    if (nl !== -1 && !text.slice(end, nl).trim()) stop = nl + 1;
    return { pos: start, end: stop };
  });

  let out = text;
  for (const { pos, end } of [...extended].sort((a, b) => b.pos - a.pos)) {
    out = out.slice(0, pos) + out.slice(end);
  }

  // Drop JSX containers that held nothing but the comment just removed.
  const after = parse(file, out);
  const empties = emptyJsxExpressions(after, out);
  for (const { pos, end } of [...empties].sort((a, b) => b.pos - a.pos)) {
    let start = pos;
    const lineStart = out.lastIndexOf('\n', pos - 1) + 1;
    if (!out.slice(lineStart, pos).trim()) start = lineStart;
    let stop = end;
    const nl = out.indexOf('\n', end);
    if (nl !== -1 && !out.slice(end, nl).trim()) stop = nl + 1;
    out = out.slice(0, start) + out.slice(stop);
  }

  return { text: collapse(out), notes, changed: true };
}

function docPathFor(app, srcRoot, file) {
  const rel = path.relative(srcRoot, file);
  const dir = path.dirname(rel);
  return dir === '.' ? path.join(DOCS, app, 'index.md') : path.join(DOCS, app, `${dir}.md`);
}

const write = process.argv.includes('--write');
const fromRef = (() => {
  const at = process.argv.indexOf('--from');
  return at === -1 ? null : process.argv[at + 1];
})();
function readSource(file) {
  if (!fromRef) return fs.readFileSync(file, 'utf8');
  try {
    return execFileSync('git', ['show', `${fromRef}:${path.relative(REPO, file)}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return fs.readFileSync(file, 'utf8');
  }
}
const pages = new Map();
let totalNotes = 0;
let totalFiles = 0;

for (const { app, src } of APPS) {
  for (const file of sourceFiles(path.join(REPO, src))) {
    const relFile = path.relative(REPO, file);
    const { text, notes, changed } = stripFile(file);
    if (!changed && notes.length === 0) continue;

    if (write && !fromRef) {
      const before = tokenSignature(readSource(file), file);
      const afterSig = tokenSignature(text, file);
      if (before.length !== afterSig.length || before.some((t, i) => t !== afterSig[i])) {
        throw new Error(`token stream changed in ${relFile} — refusing to write`);
      }
      fs.writeFileSync(file, text);
      totalFiles += 1;
    }

    if (notes.length === 0) continue;
    totalNotes += notes.length;
    const page = docPathFor(app, path.join(REPO, src), file);
    if (!pages.has(page)) pages.set(page, []);
    pages.get(page).push({ file: relFile, notes });
  }
}

function titleOf(rel) {
  return rel === 'index' ? 'index' : rel.split(path.sep).join('/');
}

const writeDocs = write;
if (writeDocs) {
  for (const [page, files] of pages) {
    const rel = path.relative(DOCS, page).replace(/\.md$/, '');
    const parts = rel.split(path.sep);
    const app = parts[0];
    const within = parts.slice(1).join('/') || 'index';
    const up = `${'../'.repeat(parts.length - 1)}README.md`;

    const lines = [`# ${app} / ${within}`, ''];
    lines.push(`Parent: [${parts.length === 1 ? 'docs/code' : app}](${up})`, '');
    lines.push(
      `The notes below belonged to the files named under each heading. Each heading is the`,
      `declaration the note sat above.`,
      '',
    );
    for (const { file, notes } of files) {
      lines.push(`## \`${file}\``, '');
      for (const note of notes) {
        lines.push(`### ${note.anchor ? `\`${note.anchor}\`` : `line ${note.line}`}`, '');
        lines.push(note.body, '');
      }
    }
    fs.mkdirSync(path.dirname(page), { recursive: true });
    fs.writeFileSync(page, lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n');
  }

  // One README per level, so a reader can walk down from docs/code to a file.
  const dirs = new Map();
  for (const page of pages.keys()) {
    let dir = path.dirname(page);
    while (dir.startsWith(DOCS)) {
      if (!dirs.has(dir)) dirs.set(dir, { pages: [], dirs: new Set() });
      const parent = path.dirname(dir);
      if (parent.startsWith(DOCS) && parent !== dir) {
        if (!dirs.has(parent)) dirs.set(parent, { pages: [], dirs: new Set() });
        dirs.get(parent).dirs.add(dir);
      }
      if (dir === DOCS) break;
      dir = parent;
    }
    dirs.get(path.dirname(page)).pages.push(page);
  }

  for (const [dir, node] of dirs) {
    const rel = path.relative(DOCS, dir);
    const depth = rel === '' ? 0 : rel.split(path.sep).length;
    const heading =
      rel === '' ? 'docs/code — the engineering record' : `${rel.split(path.sep).join('/')}`;
    const lines = [`# ${heading}`, ''];

    if (rel === '') {
      lines.push(
        'Every note that used to be a comment in `apps/*/src`, moved out of the code and',
        'kept here. `src` carries no prose: a file is what it does, and why it does it is',
        'a page below, addressed by the source path it came from.',
        '',
        'Walk down from here. Each page names the source files it documents and links back',
        'to its parent.',
        '',
      );
    } else {
      lines.push(
        `Parent: [${depth === 1 ? 'docs/code' : path.dirname(rel).split(path.sep).join('/')}](../README.md)`,
        '',
      );
    }

    const childDirs = [...node.dirs].sort();
    if (childDirs.length) {
      lines.push('## Sections', '');
      for (const child of childDirs) {
        lines.push(`- [${path.relative(dir, child)}](${path.relative(dir, child)}/README.md)`);
      }
      lines.push('');
    }
    const childPages = [...node.pages].sort();
    if (childPages.length) {
      lines.push('## Pages', '');
      for (const child of childPages) {
        const name = path.basename(child, '.md');
        lines.push(`- [${name}](${path.relative(dir, child)})`);
      }
      lines.push('');
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'README.md'), lines.join('\n') + '\n');
  }
}

console.log(
  `${write ? 'wrote' : 'would write'}: ${pages.size} doc pages, ${totalNotes} notes` +
    (write ? `, stripped ${totalFiles} source files` : ''),
);
