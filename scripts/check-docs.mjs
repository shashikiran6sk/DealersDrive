#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Documentation freshness check.
//
// This repository carries roughly 900 KB of Markdown, and nothing verified any
// of it. Documentation that size does not rot loudly — it rots one renamed
// script at a time, and the first person to notice is a new engineer who runs a
// command that does not exist and quietly stops trusting the rest of the file.
//
// So this checks the two claims that go stale fastest and can be checked
// mechanically:
//
//   1. Every `pnpm <script>` named in a documented file actually exists in some
//      package.json in the workspace.
//   2. Every file path named in backticks resolves somewhere in the workspace.
//      Documents write paths relative to whichever package they are discussing
//      — `tests/harness.ts` means `apps/api/tests/harness.ts` — so a candidate
//      is stale only when it exists under none of the known roots.
//
// It deliberately does NOT try to verify prose, section numbers or intent.
// A check that guesses produces noise, and a noisy check gets skipped.
//
//   node scripts/check-docs.mjs          report and exit non-zero on a problem
//   node scripts/check-docs.mjs --list   also print everything it verified
// ---------------------------------------------------------------------------
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const verbose = process.argv.includes('--list');

/**
 * The files a newcomer is told to read.
 *
 * `docs/project/**` is excluded on purpose, for the same reason ARCHITECTURE.md
 * always was: those four documents are the *plan*. Naming paths that do not
 * exist yet is what they are for, and checking them would report the plan as
 * rot. They are reviewed by a human instead.
 */
const DOCS = ['README.md', 'CONTEXT.md', 'CLAUDE.md'];

/** Every script name declared anywhere in the workspace. */
function knownScripts() {
  const names = new Set();
  const manifests = [
    'package.json',
    'apps/api/package.json',
    'apps/web/package.json',
    'packages/contracts/package.json',
    'packages/config/package.json',
  ];

  for (const manifest of manifests) {
    const path = join(root, manifest);
    if (!existsSync(path)) continue;
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    for (const name of Object.keys(parsed.scripts ?? {})) names.add(name);
  }
  return names;
}

/**
 * Paths that look like files but are not, and never will be — placeholders,
 * globs, and the two directories a fresh clone does not have.
 */
function isCheckable(candidate) {
  if (candidate.includes('<') || candidate.includes('*') || candidate.includes('$')) return false;
  if (candidate.startsWith('/') || candidate.startsWith('~')) return false;
  if (candidate.startsWith('http')) return false;
  // Only check things that look like a path into this repository.
  if (!candidate.includes('/')) return false;
  if (!/^[A-Za-z0-9._/-]+$/.test(candidate)) return false;
  // Build output and installed dependencies are absent from a fresh checkout.
  if (/^(node_modules|dist|\.next|coverage|\.turbo)\//.test(candidate)) return false;
  if (candidate.includes('/node_modules/') || candidate.includes('/dist/')) return false;
  return /\.[a-z0-9]{1,6}$/i.test(candidate) || candidate.endsWith('/');
}

/**
 * The directories a documented path may be relative to.
 *
 * Order is irrelevant — a path is stale only when it resolves under none of
 * them. Being permissive here is the right trade: the check exists to catch a
 * renamed file, not to police which prefix an author chose.
 */
const BASES = [
  '.',
  'apps/api',
  'apps/api/src',
  'apps/api/src/modules',
  'apps/api/src/platform',
  'apps/web',
  'apps/web/src',
  'packages/contracts',
  'packages/contracts/src',
  'packages/config',
  'docs',
  'deploy',
  'deploy/aws',
];

/**
 * Paths a document names *because* they do not exist.
 *
 * Add to this only when the absence is the point. If a path is missing because
 * something was renamed, fix the document.
 */
const KNOWN_ABSENT = new Map([
  [
    'apps/sandbox/src/registry.ts',
    'CLAUDE.md names the component sandbox, which is built at sandbox step S0',
  ],
]);

/**
 * The baseline this repository is reconstructing.
 *
 * Almost every path CLAUDE.md and CONTEXT.md name is a *forward* reference:
 * `apps/api/src/routes.ts` does not exist yet and will not until F002. Listing
 * each one by hand would mean editing this file on nearly every PR, and the
 * list would be stale a week later.
 *
 * So the rule is stricter than an allowlist rather than looser: a path is
 * acceptable when it exists **now, or in the baseline we are re-delivering**.
 * A typo satisfies neither. A path that is simply not built yet satisfies the
 * second, and stops being a forward reference the moment its feature lands.
 *
 * If the baseline ref is unreachable — a shallow CI clone, or a fresh clone of
 * a remote that does not carry it — the check degrades to today's worktree and
 * says so, rather than failing on every forward reference.
 */
const BASELINE_REF = process.env.DOCS_BASELINE_REF ?? 'legacy/pre-reorg';
let baselineFiles = null;
let baselineNote = '';

try {
  const listing = execFileSync('git', ['ls-tree', '-r', '--name-only', BASELINE_REF], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 32 * 1024 * 1024,
  });
  baselineFiles = new Set(listing.split('\n').filter(Boolean));
} catch {
  baselineNote = `  (baseline ref '${BASELINE_REF}' unreachable — forward references not verified)`;
}

/** Does this path exist in the baseline, under any of the known bases? */
function existsInBaseline(candidate) {
  if (baselineFiles === null) return true;
  const trimmed = candidate.replace(/\/$/, '');
  for (const base of BASES) {
    const full = base === '.' ? trimmed : `${base}/${trimmed}`;
    if (baselineFiles.has(full)) return true;
    // A directory reference: accept it when the baseline has anything beneath it.
    const prefix = `${full}/`;
    for (const file of baselineFiles) {
      if (file.startsWith(prefix)) return true;
    }
  }
  return false;
}

function resolvesAnywhere(candidate) {
  if (KNOWN_ABSENT.has(candidate)) return true;
  if (BASES.some((base) => existsSync(join(root, base, candidate)))) return true;
  return existsInBaseline(candidate);
}

const scripts = knownScripts();
const problems = [];
const checked = { scripts: 0, paths: 0 };

for (const doc of DOCS) {
  const path = join(root, doc);
  if (!existsSync(path)) {
    problems.push(`${doc}: listed in check-docs.mjs but does not exist`);
    continue;
  }

  const text = readFileSync(path, 'utf8');

  // `pnpm foo` / `pnpm run foo` / `pnpm --filter x foo`
  for (const match of text.matchAll(/`pnpm (?:run )?(?:--filter [@\w/-]+ )?([a-z][\w:-]*)`/g)) {
    const name = match[1];
    // Not scripts — pnpm's own verbs.
    const PNPM_VERBS = [
      'install',
      'add',
      'remove',
      'exec',
      'dlx',
      'why',
      'update',
      'store',
      'audit',
      'list',
      'outdated',
      'link',
      'publish',
      'pack',
      'init',
      'create',
    ];
    if (PNPM_VERBS.includes(name)) continue;
    checked.scripts += 1;
    if (!scripts.has(name)) {
      problems.push(`${doc}: \`pnpm ${name}\` is documented but no package.json declares it`);
    } else if (verbose) {
      console.log(`  ok  ${doc}  pnpm ${name}`);
    }
  }

  // Repository-relative paths in backticks.
  for (const match of text.matchAll(/`([^`\s]+)`/g)) {
    const candidate = match[1].replace(/[.,;:]$/, '');
    if (!isCheckable(candidate)) continue;
    checked.paths += 1;
    if (!resolvesAnywhere(candidate)) {
      problems.push(`${doc}: \`${candidate}\` resolves to nothing in the workspace`);
    } else if (verbose) {
      console.log(`  ok  ${doc}  ${candidate}`);
    }
  }
}

console.log(
  `checked ${checked.scripts} script reference(s) and ${checked.paths} path(s) across ${DOCS.length} document(s)${baselineNote}`,
);

if (problems.length > 0) {
  console.error(`\n${problems.length} stale reference(s):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nEither fix the document or fix the thing it names.');
  process.exit(1);
}

console.log('no stale references');
