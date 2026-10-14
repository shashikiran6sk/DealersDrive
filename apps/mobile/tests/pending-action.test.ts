import { PendingActions } from '../src/features/auth/pending-action';
it('claims a protected save at most once for its authenticated owner', () => {
  const pending = new PendingActions();
  const action = pending.request({ kind: 'save', slug: 'car-one' });
  pending.bind('customer-one');
  expect(pending.consume(action.id, 'customer-two')).toBeNull();
  expect(pending.consume(action.id, 'customer-one')).toEqual({ kind: 'save', slug: 'car-one' });
  expect(pending.consume(action.id, 'customer-one')).toBeNull();
});
it('replaces cancelled/obsolete actions and clears actions when identities change', () => {
  const pending = new PendingActions();
  const first = pending.request({ kind: 'save', slug: 'removed-car' });
  const second = pending.request({ kind: 'enquiry', slug: 'current-car' });
  pending.bind('customer-one');
  expect(pending.consume(first.id, 'customer-one')).toBeNull();
  pending.bind('customer-two');
  expect(pending.consume(second.id, 'customer-two')).toBeNull();
  pending.request({ kind: 'saved' });
  pending.clear();
  expect(pending.peek()).toBeNull();
});
it('starts empty after process restart so mutations are never replayed', () => {
  const before = new PendingActions();
  before.request({ kind: 'save', slug: 'car-one' });
  expect(new PendingActions().peek()).toBeNull();
});
