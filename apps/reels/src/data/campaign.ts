export const REEL_CAMPAIGN = {
  utm_source: 'dealer-reel',
  utm_medium: 'social',
  utm_campaign: 'dealer-reels',
} as const;

export function withCampaign(url: string): string {
  const target = new URL(url);
  for (const [key, value] of Object.entries(REEL_CAMPAIGN)) target.searchParams.set(key, value);
  return target.toString();
}
