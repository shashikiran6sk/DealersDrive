import type { LegalScope } from '@dealers-drive/contracts';
export function acceptLegalAction(
  _scope: LegalScope,
  _returnTo: string,
  _previous: { message?: string },
  form: FormData,
): Promise<{ message?: string }> {
  return Promise.resolve({
    message:
      form.get('accepted') === 'true'
        ? 'Acceptance recorded (sandbox preview).'
        : 'Select the checkbox to continue.',
  });
}
