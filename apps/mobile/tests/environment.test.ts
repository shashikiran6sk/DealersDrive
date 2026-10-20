import { readPublicEnvironment } from '../src/services/environment';

describe('public mobile environment', () => {
  it('uses local emulator origins for development', () => {
    expect(readPublicEnvironment({})).toEqual({
      appEnv: 'development',
      apiBaseUrl: 'http://10.0.2.2:4000',
      webBaseUrl: 'http://10.0.2.2:3000',
    });
  });

  it.each(['preview', 'production'])('rejects cleartext %s traffic', (appEnv) => {
    expect(() =>
      readPublicEnvironment({
        appEnv,
        apiBaseUrl: 'http://example.com',
        webBaseUrl: 'https://example.com',
      }),
    ).toThrow();
  });

  it.each([
    'https://user:secret@example.com',
    'https://example.com?token=secret',
    'https://example.com#secret',
    'https://example.com/api',
  ])('rejects credentials or non-origin configuration', (apiBaseUrl) => {
    expect(() => readPublicEnvironment({ apiBaseUrl })).toThrow();
  });

  it('accepts explicit HTTPS production origins', () => {
    expect(
      readPublicEnvironment({
        appEnv: 'production',
        apiBaseUrl: 'https://api.dealers-drive.com',
        webBaseUrl: 'https://www.dealers-drive.com',
      }).appEnv,
    ).toBe('production');
  });

  it('rejects unexpected environment fields rather than copying server configuration', () => {
    expect(() => readPublicEnvironment({ DATABASE_URL: 'private' })).toThrow();
  });
});
