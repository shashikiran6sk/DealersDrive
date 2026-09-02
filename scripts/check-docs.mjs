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
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const verbose = process.argv.includes('--list');

/**
 * The files a newcomer is told to read. ARCHITECTURE.md and
 * ENGINEER-ONBOARDING.md are excluded on purpose: they are design narrative
 * that discusses paths which do not exist yet and commands as illustrations,
 * so checking them would produce failures that are not defects.
 */
const DOCS = [
  'README.md',
  'CONTEXT.md',
  'docs/CLAUDE.md',
  'docs/DEPLOYMENT.md',
  'deploy/README.md',
  'deploy/aws/README.md',
  'deploy/terraform/README.md',
];

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
 * Both entries below are load-bearing prose: one records a file that was
 * referenced and never written, the other is the next adapter to build. Neither
 * is rot, and silencing them one by one — with the reason written down — is
 * better than loosening the check until it stops finding anything.
 *
 * Add to this only when the absence is the point. If a path is missing because
 * something was renamed, fix the document.
 */
const KNOWN_ABSENT = new Map([
  ['docs/MVP-SCOPE.md', 'CONTEXT.md records it as referenced-but-absent, on purpose'],
  [
    'platform/payments/razorpay.provider.ts',
    'CONTEXT.md names it as the next adapter to write against PaymentProvider',
  ],
]);

function resolvesAnywhere(candidate) {
  if (KNOWN_ABSENT.has(candidate)) return true;
  return BASES.some((base) => existsSync(join(root, base, candidate)));
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
  `checked ${checked.scripts} script reference(s) and ${checked.paths} path(s) across ${DOCS.length} document(s)`,
);

if (problems.length > 0) {
  console.error(`\n${problems.length} stale reference(s):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nEither fix the document or fix the thing it names.');
  process.exit(1);
}

console.log('no stale references');
