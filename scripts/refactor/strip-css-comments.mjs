import fs from 'node:fs';

/** Comment ranges in CSS, skipping anything inside a string. */
function ranges(text) {
  const out = [];
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'") {
      const quote = c;
      i += 1;
      while (i < text.length && text[i] !== quote) i += text[i] === '\\' ? 2 : 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) break;
      out.push({ pos: i, end: end + 2 });
      i = end + 1;
    }
  }
  return out;
}

const notes = [];
let stripped = 0;

for (const file of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
  const text = fs.readFileSync(file, 'utf8');
  const found = ranges(text);
  if (found.length === 0) continue;

  for (const r of found) {
    const line = text.slice(0, r.pos).split('\n').length;
    const body = text
      .slice(r.pos + 2, r.end - 2)
      .split('\n')
      .map((l) => l.replace(/^\s*\*?\s?/, '').trimEnd())
      .join('\n')
      .trim()
      .replace(/^[─\s]+$|[─\s]+$/g, '')
      .trim();
    let anchor = null;
    let i = r.end;
    while (i < text.length) {
      const nl = text.indexOf('\n', i);
      const candidate = text.slice(i, nl === -1 ? text.length : nl).trim();
      if (candidate) {
        anchor = candidate.replace(/\s*\{$/, '').slice(0, 100);
        break;
      }
      if (nl === -1) break;
      i = nl + 1;
    }
    if (body) notes.push({ file, line, anchor, body });
  }

  let out = text;
  for (const { pos, end } of [...found].sort((a, b) => b.pos - a.pos)) {
    let start = pos;
    const lineStart = out.lastIndexOf('\n', pos - 1) + 1;
    if (!out.slice(lineStart, pos).trim()) start = lineStart;
    let stop = end;
    const nl = out.indexOf('\n', end);
    if (nl !== -1 && !out.slice(end, nl).trim()) stop = nl + 1;
    out = out.slice(0, start) + out.slice(stop);
  }
  out = out.replace(/\n{3,}/g, '\n\n');

  if (process.argv.includes('--write')) {
    fs.writeFileSync(file, out);
    stripped += 1;
  }
}

if (process.argv.includes('--write') && notes.length) {
  const byFile = new Map();
  for (const note of notes) {
    if (!byFile.has(note.file)) byFile.set(note.file, []);
    byFile.get(note.file).push(note);
  }
  const lines = ['# web / styles', '', 'Parent: [web](../README.md)', ''];
  lines.push(
    'The notes below belonged to the files named under each heading. Each heading is the',
    'rule the note sat above.',
    '',
  );
  for (const [file, fileNotes] of byFile) {
    lines.push(`## \`${file}\``, '');
    for (const note of fileNotes) {
      lines.push(`### ${note.anchor ? `\`${note.anchor}\`` : `line ${note.line}`}`, '');
      lines.push(note.body, '');
    }
  }
  fs.mkdirSync('docs/code/web', { recursive: true });
  fs.writeFileSync('docs/code/web/styles.md', lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n');
}

console.log(
  `css: ${notes.length} notes across ${new Set(notes.map((n) => n.file)).size} files, stripped ${stripped}`,
);
