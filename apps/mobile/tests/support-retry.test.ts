import { RetryIdentity } from '../src/features/support/retry-identity';

it('retains a retry id only for an identical payload within the same screen instance', () => {
  const generate = jest
    .fn()
    .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
    .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
    .mockReturnValueOnce('33333333-3333-4333-8333-333333333333');
  const retry = new RetryIdentity(generate);
  const first = retry.forPayload({ message: 'Hello' });
  expect(retry.forPayload({ message: 'Hello' })).toBe(first);
  expect(generate).toHaveBeenCalledTimes(1);
  expect(retry.forPayload({ message: 'Changed' })).not.toBe(first);
  retry.clear();
  expect(retry.forPayload({ message: 'Hello' })).not.toBe(first);
});
it('refuses an invalid identifier rather than submitting without retry protection', () => {
  expect(() => new RetryIdentity(() => 'invalid').forPayload({ message: 'Hello' })).toThrow();
});
