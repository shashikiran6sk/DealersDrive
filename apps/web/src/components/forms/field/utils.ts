/** The error element's id, derived from the control's so callers need no second convention. */
export function errorId(id: string): string {
  return `${id}-error`;
}

/** The three attributes an errored control needs, or nothing at all. */
export function invalidProps(
  id: string,
  error: string | undefined,
): { 'aria-invalid': 'true'; 'aria-describedby': string } | Record<string, never> {
  return error ? { 'aria-invalid': 'true', 'aria-describedby': errorId(id) } : {};
}
