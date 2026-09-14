import ts from 'typescript';

/** Directives the toolchain reads. Removing one changes what the build does. */
const DIRECTIVE =
  /^\s*(?:\/\/|\/\*)\s*(eslint-|@ts-|prettier-ignore|c8 |v8 |istanbul |#__PURE__|@jsx|@license|@preserve)/;

/** `'use client'` and friends are string literals, not comments, so they are safe. */
export function isDirective(text) {
  return DIRECTIVE.test(text);
}

/** Every comment range in a file, deduped and ordered. */
export function commentRanges(sourceFile, text) {
  const seen = new Map();
  const add = (ranges) => {
    for (const r of ranges ?? []) seen.set(`${r.pos}:${r.end}`, r);
  };

  const walk = (node) => {
    add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(text, node.getEnd()));
    node.forEachChild(walk);
  };
  walk(sourceFile);

  // A comment between two statements attaches to the second one's full start,
  // which `forEachChild` reaches — but one before the first token of a modifier
  // list does not, so every statement is asked directly as well.
  for (const statement of sourceFile.statements) {
    add(ts.getLeadingCommentRanges(text, statement.pos));
    add(ts.getLeadingCommentRanges(text, statement.getFullStart()));
  }

  // Tokens (braces, keywords) can carry comments too.
  const visitTokens = (node) => {
    node.getChildren(sourceFile).forEach((child) => {
      add(ts.getLeadingCommentRanges(text, child.getFullStart()));
      add(ts.getTrailingCommentRanges(text, child.getEnd()));
      visitTokens(child);
    });
  };
  visitTokens(sourceFile);

  return [...seen.values()].sort((a, b) => a.pos - b.pos);
}

/**
 * JSX `{/* … *\/}` containers left empty once their comment goes.
 *
 * A container still holding a directive is **not** empty: `{/* eslint-disable-
 * next-line … *\/}` is the only way to disable a rule on a JSX line, and
 * deleting the container deletes the directive with it.
 */
export function emptyJsxExpressions(sourceFile, text) {
  const out = [];
  const walk = (node) => {
    if (ts.isJsxExpression(node) && node.expression === undefined) {
      const body = text.slice(node.getStart(sourceFile), node.getEnd());
      if (!body.includes('/*') && !body.includes('//')) {
        out.push({ pos: node.getStart(sourceFile), end: node.getEnd() });
      }
    }
    node.forEachChild(walk);
  };
  walk(sourceFile);
  return out;
}

/** The declaration a comment sits above, as a short readable anchor. */
export function anchorFor(sourceFile, text, commentEnd) {
  let best;
  const walk = (node) => {
    const start = node.getStart(sourceFile);
    if (start >= commentEnd && (!best || start < best.getStart(sourceFile))) {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isVariableStatement(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isPropertySignature(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isExportDeclaration(node)
      ) {
        best = node;
      }
    }
    node.forEachChild(walk);
  };
  walk(sourceFile);
  if (!best) return null;

  const line = text.slice(best.getStart(sourceFile)).split('\n')[0].trim();
  return line
    .replace(/\s*\{\s*$/, '')
    .replace(/[;,]$/, '')
    .slice(0, 110);
}

/**
 * TSX only for .tsx. In a .ts file `<A>(x) => …` is a generic arrow, and parsing
 * it as TSX reads the `<A>` as an element and loses the rest of the file.
 */
export function parse(fileName, text) {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
}

/**
 * Kind+text of every real token, for proving only comments moved.
 *
 * JSDoc nodes are skipped because they *are* comments. JSX text is reduced to
 * whether it held anything but whitespace, and a JSX expression container with
 * no expression is skipped whole — in the original that is `{/* … *\/}`, which
 * holds only a comment and renders nothing, and stripping it is the one
 * structural change this migration makes.
 */
export function tokenSignature(text, signatureFileName = 'sig.tsx') {
  const file = parse(signatureFileName, text);
  const out = [];
  const walk = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) {
      return;
    }
    if (ts.isJsxExpression(node) && node.expression === undefined) {
      if (!node.getText(file).match(/\/[*/]/)) return;
    }
    const children = node
      .getChildren(file)
      .filter(
        (child) =>
          !(
            child.kind >= ts.SyntaxKind.FirstJSDocNode && child.kind <= ts.SyntaxKind.LastJSDocNode
          ),
      );
    if (children.length === 0) {
      if (node.kind === ts.SyntaxKind.JsxText) {
        const body = node.getText(file).trim();
        if (body) out.push(`jsxtext:${body.replace(/\s+/g, ' ')}`);
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
