import { hydrateSavedSlugs } from '../src/features/saved/saved-api';

it('hydrates all server pages beyond the legacy 500 cap and deduplicates state', async () => {
  const first = Array.from({ length: 500 }, (_value, index) => `car-${index}`);
  const slugs = jest
    .fn()
    .mockResolvedValueOnce({ slugs: first, page: { hasMore: true, nextCursor: 'next' } })
    .mockResolvedValueOnce({
      slugs: ['car-500', 'car-0'],
      page: { hasMore: false, nextCursor: null },
    });
  const result = await hydrateSavedSlugs('token', new AbortController().signal, { slugs });
  expect(result).toHaveLength(501);
  expect(result).toContain('car-500');
  expect(slugs).toHaveBeenCalledTimes(2);
});
it('refuses pagination loops and ignores cancelled hydration rather than inventing unsaved state', async () => {
  const slugs = jest
    .fn()
    .mockResolvedValue({ slugs: [], page: { hasMore: true, nextCursor: 'same' } });
  await expect(
    hydrateSavedSlugs('token', new AbortController().signal, { slugs }),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  const controller = new AbortController();
  controller.abort();
  await expect(hydrateSavedSlugs('token', controller.signal, { slugs })).rejects.toMatchObject({
    code: 'REQUEST_CANCELLED',
  });
});
