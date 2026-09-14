/** `9840012345` → `919840012345`, which is the identifier shape MSG91 uses. */
export function identifierOf(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('91') && digits.length > 10 ? digits : `91${digits}`;
}

export function countdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** A provider problem the dealer cannot solve by retyping, as opposed to a wrong code. */
export function isServiceFailure(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith('The verification service');
}
