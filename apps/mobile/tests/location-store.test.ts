import {
  createLocationStore,
  DISTRICT_PREFERENCE_KEY,
} from '../src/features/location/location-store';

it('persists only a public district slug and hydrates it', async () => {
  const storage = {
    getItem: jest.fn(() => Promise.resolve('vellore')),
    setItem: jest.fn(() => Promise.resolve(undefined)),
  };
  const store = createLocationStore(storage);
  await store.hydrate();
  expect(store.getState()).toMatchObject({ district: 'vellore', hydrated: true });
  store.choose('ranipet');
  await Promise.resolve();
  await Promise.resolve();
  expect(storage.setItem).toHaveBeenCalledWith(DISTRICT_PREFERENCE_KEY, 'ranipet');
  expect(Object.keys(store.getState()).sort()).toEqual(['district', 'hydrated', 'revision']);
});
it('does not let slow preference hydration overwrite an explicit route or user choice', async () => {
  let finish!: (value: string | null) => void;
  const store = createLocationStore({
    getItem: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    setItem: () => Promise.resolve(undefined),
  });
  const loading = store.hydrate();
  store.choose('ranipet');
  finish('vellore');
  await loading;
  expect(store.getState().district).toBe('ranipet');
});
it('supports all districts and rejects corrupt preference values without blocking browsing', async () => {
  const store = createLocationStore({
    getItem: () => Promise.resolve('{"customer":"private"}'),
    setItem: () => Promise.reject(new Error('unavailable')),
  });
  await store.hydrate();
  expect(store.getState().district).toBeUndefined();
  store.choose('vellore');
  store.choose(undefined);
  expect(store.getState()).toMatchObject({ district: undefined, hydrated: true });
});
