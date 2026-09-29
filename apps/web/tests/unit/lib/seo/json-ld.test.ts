import { describe, expect, it } from 'vitest';

import { serializeJsonLd } from '@/lib/seo';

/**
 * JSON-LD sits inside a `<script>`, and a dealer's tagline and a vehicle's
 * description are typed by people. `JSON.stringify` alone does not stop a
 * `</script>` in one of them from ending the element early.
 */
describe('serializeJsonLd', () => {
  const hostile = {
    '@context': 'https://schema.org',
    description: '</script><script>alert("x")</script> & \u2028\u2029',
  };

  it('never writes a character that could close the script or start markup', () => {
    const text = serializeJsonLd(hostile);

    expect(text).not.toMatch(/[<>&\u2028\u2029]/);
    expect(text).toContain('\\u003c/script\\u003e');
  });

  it('round-trips to exactly the same data', () => {
    expect(JSON.parse(serializeJsonLd(hostile))).toEqual(hostile);
  });

  it('drops fields that are undefined rather than writing them as null', () => {
    expect(serializeJsonLd({ '@context': 'https://schema.org', color: undefined })).toBe(
      '{"@context":"https://schema.org"}',
    );
  });
});
