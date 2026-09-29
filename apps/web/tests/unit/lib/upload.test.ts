import { describe, expect, it } from 'vitest';

import { failureMessage, UploadFailure } from '@/lib/upload';

/**
 * An uploader shows `failureMessage` to the dealer. Only a sentence the upload
 * flow wrote itself gets through; a browser's `TypeError: Failed to fetch`, a
 * JSON parse error or anything else becomes the uploader's own fallback.
 */
describe('failureMessage', () => {
  it('shows a message the upload flow wrote', () => {
    expect(failureMessage(new UploadFailure('The upload was rejected by storage.'), 'x')).toBe(
      'The upload was rejected by storage.',
    );
  });

  it('never shows a raw error', () => {
    expect(failureMessage(new TypeError('Failed to fetch'), 'That upload failed.')).toBe(
      'That upload failed.',
    );
    expect(failureMessage(new SyntaxError('Unexpected token <'), 'That upload failed.')).toBe(
      'That upload failed.',
    );
    expect(failureMessage('nope', 'That upload failed.')).toBe('That upload failed.');
  });
});
