import { retainIntent } from '../config/with-retained-intent.cjs';
const template =
  'package com.example.preview\nimport android.os.Build\nclass MainActivity : ReactActivity() {\n  override fun getMainComponentName() = "main"\n}';
it('retains a startup-window intent before delegating and preserves other activity methods', () => {
  const source = retainIntent(template);
  expect(source).toContain('import android.content.Intent');
  expect(source.indexOf('setIntent(intent)')).toBeLessThan(
    source.indexOf('super.onNewIntent(intent)'),
  );
  expect(source).toContain('override fun getMainComponentName() = "main"');
  expect(retainIntent(source)).toBe(source);
});
it('refuses an unknown template or an existing foreign handler instead of silently rewriting it', () => {
  expect(() => retainIntent('class OtherActivity {}')).toThrow('Unsupported MainActivity');
  expect(() => retainIntent(template + '\noverride fun onNewIntent(intent: Intent) {}')).toThrow(
    'Review the existing',
  );
});
