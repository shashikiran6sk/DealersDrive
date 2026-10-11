import type {
  AdminPhoneSecurity,
  AuthProvidersResponse,
  PhoneOtpWidget,
} from '@dealers-drive/contracts';
import { Banner } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { GoogleSignInButton } from '@/components/auth/google-button';
import { AdminPhone } from '@/features/auth/admin-phone/admin-phone';
import { revokeAdminPhone } from '@/features/auth/admin-phone/actions';
import { apiGet } from '@/lib/api';

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [security, widget, providers, query] = await Promise.all([
    apiGet<AdminPhoneSecurity>('/v1/admin/profile/security', { revalidate: false }),
    apiGet<PhoneOtpWidget>('/v1/auth/admin/phone/widget', { revalidate: false }),
    apiGet<AuthProvidersResponse>('/v1/auth/providers', { revalidate: false }),
    searchParams,
  ]);
  const googleUrl = new URL(providers.google.adminStartUrl);
  googleUrl.searchParams.set('returnTo', '/admin/profile/security');
  return (
    <section className="mx-auto max-w-[680px] p-4 md:p-8">
      <h1 className="mb-3 text-[24px] font-bold">Profile · Security</h1>
      <p className="mb-5 ink-muted">
        Google remains available. Only a verified mobile linked here can sign in to your existing
        admin account.
      </p>
      {query.error ? (
        <Banner tone="err" className="mb-4">
          {query.error === 'reauthenticate'
            ? 'Continue with Google again before changing mobile security.'
            : 'The mobile credential could not be revoked. Please try again.'}
        </Banner>
      ) : null}
      {security.requiresGoogleReauthentication ? (
        <div className="mb-5 flex flex-col gap-3">
          <Banner tone="warn">
            Continue with Google again to link or revoke a mobile number. This step is required even
            after mobile sign-in.
          </Banner>
          <GoogleSignInButton
            href={googleUrl.toString()}
            label="Reauthenticate with Google"
            disabled={!providers.google.enabled}
          />
        </div>
      ) : null}
      {security.linked ? (
        <div className="flex flex-col gap-4 rounded-xl border border-(--color-divider) bg-white p-4">
          <h2 className="font-semibold">Linked mobile number</h2>
          <p>{security.phoneMasked}</p>
          <p className="text-sm ink-muted">
            To replace a number or recover from a lost phone, revoke this credential, sign in again
            with Google, then verify the new number. Revocation ends every admin session and pending
            mobile request. Customer and dealer sessions remain available.
          </p>
          <form action={revokeAdminPhone} className="flex flex-col gap-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                name="confirm"
                type="checkbox"
                required
                disabled={security.requiresGoogleReauthentication}
                className="mt-1"
              />
              I understand this revokes mobile access and signs out all admin sessions.
            </label>
            <Button
              type="submit"
              variant="secondary"
              disabled={security.requiresGoogleReauthentication}
            >
              Revoke mobile access
            </Button>
          </form>
        </div>
      ) : security.requiresGoogleReauthentication ? null : (
        <div className="rounded-xl border border-(--color-divider) bg-white p-4">
          <h2 className="mb-4 font-semibold">Link Mobile Number</h2>
          <AdminPhone mode="ENROLL" widget={widget} />
        </div>
      )}
    </section>
  );
}
