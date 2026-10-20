import { incomingLink } from '../src/features/navigation/incoming-link';
const web = 'https://www.dealers-drive.com';

test.each([
  ['dealersdrive://car/maruti-swift-123', '/car/maruti-swift-123'],
  ['dealersdrive:///dealers/sri-motors', '/dealers/sri-motors'],
  [web + '/car/maruti-swift-123', '/car/maruti-swift-123'],
  [web + '/dealers/sri-motors', '/dealers/sri-motors'],
  [web + '/cars?q=Swift&fuel=petrol', '/cars?q=Swift&fuel=petrol'],
  ['/dealers?district=vellore', '/dealers?district=vellore'],
  ['dealersdrive://saved', '/(tabs)/saved'],
  ['/terms', '/policy/terms'],
  ['/account-deletion', '/account-deletion'],
])('maps the permitted customer destination %s', (url, route) => {
  expect(incomingLink(url, web)).toBe(route);
});

test.each([
  'https://evil.example/car/swift',
  'https://www.dealers-drive.com.evil.test/car/swift',
  'https://person:private@www.dealers-drive.com/car/swift',
  '//evil.example/car/swift',
  'javascript:alert(1)',
  'dealersdrive://admin',
  '/console',
  '/sales',
  '/invitations',
  '/auth/callback?token=secret',
  '/car/swift?token=secret',
  '/cars?code=123456',
  '/cars?__proto__=secret',
  '/cars?q=one&q=two',
  '/cars?minPrice=invalid',
  '/car/%2e%2e/admin',
  '/car/../account',
  '/car/a%2fb',
  '/car/a\\b',
  '/car/a\n',
  '/car/swift#token=secret',
  'dealersdrive://car:999/swift',
  '/car/' + 'a'.repeat(161),
  '/car/' + 'a'.repeat(4096),
  'not a link',
])('refuses malformed, credential-bearing or privileged intent %s', (url) => {
  expect(incomingLink(url, web)).toBe('/');
});

test('canonicalises malformed query encoding before handing it to the router', () => {
  const route = incomingLink('/cars?q=%E0%A4%A', web);
  expect(route).toBe('/cars?q=%EF%BF%BD%25A');
  expect(() => decodeURIComponent(route.split('q=')[1] ?? '')).not.toThrow();
});
