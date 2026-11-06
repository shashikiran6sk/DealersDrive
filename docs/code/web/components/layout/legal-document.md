# web / components/layout/legal-document

Parent: [web/components/layout](README.md)

## `apps/web/src/components/layout/legal-document/legal-document.tsx`

### `export function LegalDocument({ document }: LegalDocumentProps)`

Renders one versioned policy. The effective date and the operator details come
from `LEGAL_V1_PUBLICATION`, the confirmed V1 publication record. A revised
document such as Terms 1.1 carries its own `effectiveDate`, because "Updated
Terms will identify their version and effective date" (Terms §15), and a
`changeSummary` shown under the version so a returning reader can see what
changed without comparing texts. A document without them, today the Privacy
Policy, keeps the V1 date. `/terms` renders `TERMS_V1_1`; `TERMS_V1` is kept,
unchanged, as the record of what earlier acceptances agreed to, and is shown in
the sandbox.
