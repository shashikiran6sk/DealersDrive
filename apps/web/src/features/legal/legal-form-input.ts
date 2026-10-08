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
    privacyAcknowledged: form?.get('privacyAcknowledged') === 'true',
  });
}
export function dealerAgreement(form: FormData | undefined) {
  return DealerAcceptanceInput.safeParse({
    version: form?.get('legalVersion'),
    accepted: form?.get('termsAccepted') === 'true',
    privacyAcknowledged: form?.get('privacyAcknowledged') === 'true',
    authorityConfirmed: form?.get('authorityConfirmed') === 'true',
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
