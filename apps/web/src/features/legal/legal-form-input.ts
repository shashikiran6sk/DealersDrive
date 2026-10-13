import 'server-only';
import {
  DealerAcceptanceInput,
  TermsAcceptanceInput,
  SubmitVehicleInput,
} from '@dealers-drive/contracts';
export function accountAgreement(form: FormData | undefined) {
  return TermsAcceptanceInput.safeParse({
    version: form?.get('legalVersion'),
    accepted: form?.get('termsAccepted') === 'true',
    privacyAcknowledged: form?.get('termsAccepted') === 'true',
  });
}
export function dealerAgreement(form: FormData | undefined) {
  return DealerAcceptanceInput.safeParse({
    version: form?.get('legalVersion'),
    accepted: form?.get('termsAccepted') === 'true',
    privacyAcknowledged: form?.get('termsAccepted') === 'true',
    authorityConfirmed: form?.get('termsAccepted') === 'true',
  });
}
export function listingDeclaration(form: FormData) {
  return SubmitVehicleInput.safeParse({
    certification: {
      version: form.get('legalVersion'),
      certified: form.get('certified') === 'true',
    },
  });
}
