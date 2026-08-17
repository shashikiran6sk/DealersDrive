import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class joining, so a caller's override actually wins. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
