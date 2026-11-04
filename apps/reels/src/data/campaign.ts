export const REEL_CAMPAIGN = {
  utm_source: 'dealer-reel',
  utm_medium: 'social',
  utm_campaign: 'dealer-reels',
} as const;

export function withCampaign(url: string, source: string = REEL_CAMPAIGN.utm_source): string {
  const target = new URL(url);
  for (const [key, value] of Object.entries(REEL_CAMPAIGN)) target.searchParams.set(key, value);
  target.searchParams.set('utm_source', source);
  return target.toString();
}
