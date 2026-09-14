import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { parse } from './comment-tools.mjs';
import ts from 'typescript';

/**
 * Every token a runtime can see, including JSX text reduced the way JSX itself
 * reduces it: lines trimmed, whitespace-only lines dropped, the rest joined with
 * a single space. A whitespace change that JSX would render is a difference;
 * indentation is not.
 */
function runtimeSignature(fileName, text) {
  const file = parse(fileName, text);
  const out = [];
  const walk = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode)
      return;
    // A JSX container with no expression holds only a comment and renders
    // nothing, so its removal is not a runtime difference.
    if (ts.isJsxExpression(node) && node.expression === undefined) return;
    const children = node.getChildren(file);
    if (children.length === 0) {
      if (node.kind === ts.SyntaxKind.JsxText) {
        const rendered = node
          .getText(file)
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .join(' ');
        if (rendered) out.push(`jsx:${rendered}`);
        return;
      }
      out.push(`${node.kind}:${node.getText(file)}`);
      return;
    }
    children.forEach(walk);
  };
  walk(file);
  return out;
}

const base = process.argv[2] ?? 'HEAD';
const files = execSync(`git diff --name-only ${base} -- apps`, { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /^apps\/[^/]+\/src\/.+\.tsx?$/.test(f) && fs.existsSync(f));

let differing = 0;
for (const file of files) {
  let before;
  try {
    before = execFileSync('git', ['show', `${base}:${file}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    continue;
  }
  const after = fs.readFileSync(file, 'utf8');
  const a = runtimeSignature(file, before);
  const b = runtimeSignature(file, after);
  if (a.length !== b.length || a.some((t, i) => t !== b[i])) {
    differing += 1;
    console.log(`DIFFERS  ${file}`);
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) {
        console.log(`   before: ${JSON.stringify(a[i]?.slice(0, 90))}`);
        console.log(`   after : ${JSON.stringify(b[i]?.slice(0, 90))}`);
        break;
      }
    }
  }
}
console.log(`\nchecked ${files.length} changed source files; ${differing} differ beyond comments`);
