import { describe, expect, it } from 'vitest';

import { REEL_CAMPAIGN, withCampaign } from '../src/data/campaign';
import { atWidth, mediaFileName, planMedia } from '../src/data/media';

const PHOTO =
  'https://api.dealers-drive.com/media/by-media/2D12BEBC-9e9f-430a-bd24-df53f47de07e/640.webp';

describe('atWidth', () => {
  it('asks the media route for a larger derivative', () => {
    expect(atWidth(PHOTO, 1600)).toMatch(/\/1600\.webp$/);
  });

  it('leaves other URLs alone', () => {
    expect(atWidth('https://cdn.example.com/logo.png', 1600)).toBe(
      'https://cdn.example.com/logo.png',
    );
  });
});

describe('mediaFileName', () => {
  it('names a media URL by its id', () => {
    expect(mediaFileName(PHOTO)).toBe('2d12bebc-9e9f-430a-bd24-df53f47de07e.webp');
  });

  it('hashes any other URL and keeps its extension', () => {
    expect(mediaFileName('https://cdn.example.com/logo.PNG')).toMatch(/^[0-9a-f]{24}\.png$/);
    expect(mediaFileName('https://cdn.example.com/logo')).toMatch(/^[0-9a-f]{24}\.img$/);
  });
});

describe('planMedia', () => {
  it('maps each URL to a public path and remembers what to download', () => {
    const plan = planMedia(1600);
    expect(plan.src(PHOTO)).toBe('media/2d12bebc-9e9f-430a-bd24-df53f47de07e.webp');
    expect([...plan.files().values()]).toEqual([atWidth(PHOTO, 1600)]);
  });
});

describe('withCampaign', () => {
  it('tags the dealer page so reel visits can be counted', () => {
    const url = new URL(withCampaign('https://www.dealers-drive.com/dealers/x?utm_source=old'));
    for (const [key, value] of Object.entries(REEL_CAMPAIGN)) {
      expect(url.searchParams.get(key)).toBe(value);
    }
  });
});
