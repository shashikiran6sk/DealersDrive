# One-off migration tools

These ran once, for the refactor that moved every comment out of `apps/*/src`
into [`docs/code`](../../docs/code/README.md). They are kept because the second
one is how a reviewer checks the claim.

| Script                   | What it does                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `comment-tools.mjs`      | Comment ranges, anchors and a token signature, all off the TypeScript parser rather than regex |
| `migrate-comments.mjs`   | Writes the doc pages and strips the source. `--from <ref>` reads the source from git instead   |
| `strip-css-comments.mjs` | The same for the two stylesheets                                                               |
| `verify-strip.mjs`       | **The proof.** Compares every changed file against a ref, token by token                       |

## Checking the claim

```bash
node scripts/refactor/verify-strip.mjs <ref-before-the-strip>
```

It parses both versions and compares every token a runtime can see — JSX text
reduced the way JSX reduces it, JSDoc skipped because it _is_ a comment, and a
JSX expression container holding only a comment skipped because it renders
nothing. Anything it prints is a real difference and wants explaining in the PR.
