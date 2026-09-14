export function errorId(id: string): string {
  return `${id}-error`;
}

export function invalidProps(
  id: string,
  error: string | undefined,
): { 'aria-invalid': 'true'; 'aria-describedby': string } | Record<string, never> {
  return error ? { 'aria-invalid': 'true', 'aria-describedby': errorId(id) } : {};
}
