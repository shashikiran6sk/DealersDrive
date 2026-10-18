# Shared district

## `apps/mobile/src/features/location/device-storage.ts`

### `export const deviceStorage: PreferenceStorage`

`@react-native-async-storage/async-storage` throws while it is being loaded when the installed binary does not link its native module. A binary built before F109 added the package is one example; a development client that was not rebuilt is another. A static import made that throw a crash of every screen that reads the district. The module is therefore loaded on first use inside a guard. When it is missing, reads and writes reject, the store hydrates to "all districts" and a choice still holds for the session, so browsing never depends on the preference surviving. The fix for the device is still a native rebuild. Only a public district slug is stored here; session credentials stay in SecureStore.

`require` rather than `import()`: Jest in this workspace cannot evaluate a dynamic import without VM modules, and the guard is the behaviour under test.

## `apps/mobile/src/features/location/location-store.ts`

### `choose(district)`

Choosing the district that is already current is no change. A revision bump tells mounted directories that the district moved, and they clear the town, dealer and page that depended on it. Re-asserting the same district, from a deep link for instance, must not wipe those.

## `apps/mobile/app/+native-intent.tsx`

### `redirectSystemPath`

Only a link that names a district changes the shared district. A plain `/cars` link keeps the saved one, as a plain visit does.

## `apps/mobile/src/features/location/use-directory-location.ts`

### `useDirectoryLocation(requested)`

A district parameter that is not a valid slug is treated as no district, and it is removed from the route. Without that, the store refused it, the requested and shared districts never agreed, and the screen stayed on its loading state.
