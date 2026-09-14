export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}
