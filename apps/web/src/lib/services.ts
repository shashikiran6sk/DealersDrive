/**
 * The services list, as the wire carries it and as the schema wants it.
 *
 * `specialities` is `string[]` in the contract and one comma-separated string
 * on the wire, because that is what a form field can hold. This is the single
 * parse between the two, and it is a module rather than a private function
 * because it had been written **three** times — in `auth/actions.ts`, in
 * `dealer/profile-actions.ts` and in `admin/dealer-profile-editor.tsx` — which
 * is exactly how two screens start disagreeing about what
 * `In-house workshop, RC transfer` means.
 *
 * Repeats and case are **not** handled here. Merging is a read-side rule
 * (**R18**) and de-duplication is an editing affordance the chip input owns
 * (**R37**); a parse that silently dropped entries would make the box the
 * dealer is looking at disagree with the value it submits.
 */
export function servicesOf(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
