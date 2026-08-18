/**
 * `server-only` exists to make a client bundle fail at build time if it
 * imports a module that reads a secret or a request header. There is no
 * bundler under test, so it resolves here to nothing — the guard is a
 * build-time concern, and the modules behind it still need testing.
 */
export {};
