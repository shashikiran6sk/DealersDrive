import { revalidateTag } from 'next/cache';

export const DEALERS_TAG = 'dealers';

export const CONFIG_TAG = 'public-config';

export const VEHICLES_TAG = 'vehicles';

export function dealerTag(slug: string): string {
  return `dealer:${slug}`;
}

export function revalidatePublicDealer(slug?: string | null): void {
  revalidateTag(DEALERS_TAG);
  if (slug) revalidateTag(dealerTag(slug));
}

export function revalidatePublicConfig(): void {
  revalidateTag(CONFIG_TAG);
}

export function revalidatePublicVehicles(): void {
  revalidateTag(VEHICLES_TAG);
}
