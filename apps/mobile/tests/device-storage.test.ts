import {
  createLocationStore,
  type PreferenceStorage,
} from '../src/features/location/location-store';

const MODULE = '@react-native-async-storage/async-storage';
function loadDeviceStorage(): PreferenceStorage {
  let storage: PreferenceStorage | undefined;
  jest.isolateModules(() => {
    storage = jest.requireActual<{ deviceStorage: PreferenceStorage }>(
      '../src/features/location/device-storage',
    ).deviceStorage;
  });
  if (!storage) throw new Error('device storage did not load');
  return storage;
}
afterEach(() => {
  jest.dontMock(MODULE);
  jest.resetModules();
});

it('degrades to an in-memory district when the installed binary lacks the native module', async () => {
  jest.doMock(MODULE, () => {
    throw new Error('[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null.');
  });
  const deviceStorage = loadDeviceStorage();
  await expect(deviceStorage.getItem('any')).rejects.toThrow(
    'Device preference storage is unavailable',
  );
  const store = createLocationStore(deviceStorage);
  await store.hydrate();
  expect(store.getState()).toMatchObject({ district: undefined, hydrated: true });
  store.choose('vellore');
  expect(store.getState().district).toBe('vellore');
  await expect(deviceStorage.setItem('any', 'value')).rejects.toThrow(
    'Device preference storage is unavailable',
  );
});
it('reads and writes through the native module when the binary links it', async () => {
  const getItem = jest.fn(() => Promise.resolve('vellore'));
  const setItem = jest.fn(() => Promise.resolve(undefined));
  jest.doMock(MODULE, () => ({ __esModule: true, default: { getItem, setItem } }));
  const deviceStorage = loadDeviceStorage();
  await expect(deviceStorage.getItem('key')).resolves.toBe('vellore');
  await deviceStorage.setItem('key', 'ranipet');
  expect(getItem).toHaveBeenCalledWith('key');
  expect(setItem).toHaveBeenCalledWith('key', 'ranipet');
});
it('loads the district store without throwing when the native module is missing', () => {
  jest.doMock(MODULE, () => {
    throw new Error('[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null.');
  });
  jest.isolateModules(() => {
    expect(() => jest.requireActual<object>('../src/features/location/location')).not.toThrow();
  });
});
