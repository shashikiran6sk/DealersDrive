import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LEGAL_DOCUMENTS } from '../packages/contracts/dist/index.js';
const sections = [
  '# Legal documents — draft review packet',
  '',
  'These documents are not effective, approved by counsel or authorized for production publication. Resolve the release blockers in OPEN_LEGAL_DECISIONS.md before activating an approved version. Generated from the immutable shared snapshots; edit a new version rather than this packet. Regenerate with node scripts/export-legal-documents.mjs after building contracts.',
  '',
];
for (const document of Object.values(LEGAL_DOCUMENTS)) {
  sections.push(
    `## ${document.title}`,
    '',
    `Version: ${document.version}. Effective date: not assigned. Status: REVIEW_REQUIRED.`,
    '',
    `Snapshot SHA-256: ${createHash('sha256').update(JSON.stringify(document)).digest('hex')}`,
    '',
    `Preview route: ${document.route}`,
    '',
  );
  for (const [index, section] of document.sections.entries())
    sections.push(
      `### ${index + 1}. ${section.heading}`,
      '',
      ...section.paragraphs.flatMap((paragraph) => [paragraph, '']),
    );
}
writeFileSync(
  new URL('../docs/legal/DRAFT_DOCUMENTS.md', import.meta.url),
  `${sections.join('\n')}\n`,
);
