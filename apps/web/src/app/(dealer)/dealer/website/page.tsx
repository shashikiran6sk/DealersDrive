import {
  StorefrontManagementResponse,
  StorefrontPublicationQuery,
  StorefrontPublicationResponse,
  canDealer,
  type DealerProfile,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { StatusTag } from '@/components/ui/primitives';
import { WebsiteActionForm } from '@/features/website/action-form';
import { WebsiteMediaPicker } from '@/features/website/media-picker';
import { WebsiteLink } from '@/features/website/website-link';
import {
  addWebsiteDomainAction,
  createWebsiteAction,
  saveWebsiteBrandingAction,
  setWebsiteEnabledAction,
  setWebsitePublicationAction,
  websiteDomainAction,
} from '@/features/website/actions';
import { apiGet, apiGetParsed } from '@/lib/api';
import { currentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Website', robots: { index: false, follow: false } };

export default async function WebsitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await currentSession();
  if (!canDealer(session?.permissions, 'storefront:read')) notFound();
  const manage = canDealer(session?.permissions, 'storefront:manage');
  const [overview, dealer] = await Promise.all([
    apiGetParsed(StorefrontManagementResponse, '/v1/dealer/storefront', { revalidate: false }),
    apiGet<DealerProfile>('/v1/dealer', { revalidate: false }),
  ]);
  const site = overview.storefront;
  const canSave = manage && overview.enabled && overview.eligible;
  if (!site)
    return (
      <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-7 md:px-8">
        <p className="eyebrow">Your dealership, online</p>
        <h1 className="text-[32px] tracking-tight">My Website</h1>
        <div className="card gap-5 p-6 sm:p-8">
          <h2 className="text-[26px] tracking-tight">
            Give {dealer.brandName} its own home on the web
          </h2>
          <p className="text-[15px] leading-relaxed ink-muted">
            Choose Light or Dark, add your branding, and receive a unique Dealers-Drive subdomain.
            Your approved cars come from the inventory you already manage here. Changes to stock are
            reflected in your website; a custom domain is optional.
          </p>
          <ul className="grid gap-3 text-[14px] sm:grid-cols-2">
            <li>Only your dealership's approved inventory</li>
            <li>Responsive Light and Dark designs</li>
            <li>Verified customer enquiries in your existing inbox</li>
            <li>Optional ownership-verified custom domain</li>
          </ul>
          {!overview.enabled ? (
            <p role="status" className="text-[14px] text-(--color-warn)">
              Dealer websites are not enabled on this environment yet.
            </p>
          ) : !overview.eligible ? (
            <p role="status" className="text-[14px] text-(--color-warn)">
              Your dealership must be approved before you can create a website.
            </p>
          ) : !manage ? (
            <p className="text-[14px] ink-muted">
              Only the dealership owner can create and manage its website.
            </p>
          ) : null}
          <WebsiteActionForm
            action={createWebsiteAction}
            label="Create my website"
            disabled={!canSave}
          >
            <div className="field">
              <label htmlFor="website-subdomain">Website name</label>
              <input
                id="website-subdomain"
                name="subdomain"
                className="input"
                placeholder="abc-motors"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                minLength={3}
                maxLength={63}
                required
              />
              <p className="text-[12px] ink-muted">
                Your default address uses this name on the platform. It stays reserved for your
                dealership.
              </p>
            </div>
            <div className="field">
              <label htmlFor="website-theme">Design</label>
              <select id="website-theme" name="theme" className="input">
                <option value="LIGHT">Light — spacious and contemporary</option>
                <option value="DARK">Dark — premium photographic presentation</option>
              </select>
            </div>
          </WebsiteActionForm>
        </div>
      </div>
    );
  const query = StorefrontPublicationQuery.safeParse({ page: (await searchParams).page });
  const page = query.success ? query.data.page : 1;
  const publication = await apiGetParsed(
    StorefrontPublicationResponse,
    `/v1/dealer/storefront/publication?page=${page}`,
    { revalidate: false },
  );
  const live = Boolean(site.publicUrl && site.status === 'ACTIVE');
  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6 px-4 py-7 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[30px] tracking-tight">My Website</h1>
        <StatusTag tone={live ? 'ok' : site.status === 'DISABLED' ? 'neutral' : 'warn'}>
          {live
            ? 'Live'
            : site.status === 'ACTIVE'
              ? 'Infrastructure not ready'
              : site.status.replaceAll('_', ' ')}
        </StatusTag>
      </div>
      <nav
        className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]"
        aria-label="Website settings sections"
      >
        {['Overview', 'Branding', 'Design', 'Domains', 'Publication', 'Settings'].map((label) => (
          <a
            key={label}
            href={`#website-${label.toLowerCase()}`}
            className="inline-flex min-h-[44px] items-center underline underline-offset-4"
          >
            {label}
          </a>
        ))}
      </nav>
      <section id="website-overview" className="card gap-4 p-6">
        <h2 className="text-[23px]">Website overview</h2>
        {live && site.publicUrl ? (
          <WebsiteLink url={site.publicUrl} />
        ) : (
          <p className="text-[14px] ink-muted">
            {site.status === 'PENDING_ACTIVATION'
              ? 'Configuration is saved. Activation is pending a verified domain and ready hosting infrastructure.'
              : site.status === 'SUSPENDED'
                ? 'The website is suspended. An eligible owner must request reactivation after the underlying issue is resolved.'
                : 'Configuration is saved. Preview your website and activate it when you are ready.'}
          </p>
        )}
        <a
          href="/dealer/website/preview"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center text-[14px] font-semibold underline"
        >
          Open private preview ↗
        </a>
        <p className="text-[12px] ink-muted">
          Inventory stays managed in Dealers-Drive. Preview shows approved stock only and is not
          public or indexable.
        </p>
        {!canSave ? (
          <p role="status" className="text-[13px] text-(--color-warn)">
            {!manage
              ? 'Only the owner can save website settings.'
              : !overview.enabled
                ? 'Dealer websites are disabled on this environment.'
                : 'The dealership must be active to change website settings.'}
          </p>
        ) : null}
      </section>
      <section id="website-branding" className="card gap-5 p-6">
        <h2 className="text-[23px]">Branding & content</h2>
        <WebsiteActionForm
          action={saveWebsiteBrandingAction}
          label="Save branding and design"
          disabled={!canSave}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              Website display name
              <input
                name="displayName"
                className="input"
                defaultValue={site.displayName}
                maxLength={100}
                minLength={2}
                required
              />
            </label>
            <label className="field">
              Brand accent color
              <input
                name="accentColor"
                type="color"
                className="input h-[48px]"
                defaultValue={site.accentColor}
                required
              />
            </label>
          </div>
          <label className="field">
            Homepage headline
            <input name="headline" className="input" defaultValue={site.headline} maxLength={140} />
          </label>
          <label className="field">
            Homepage description
            <textarea
              name="description"
              className="input min-h-[90px] py-3"
              defaultValue={site.description}
              maxLength={500}
            />
          </label>
          <label className="field">
            About your dealership
            <textarea
              name="about"
              className="input min-h-[130px] py-3"
              defaultValue={site.about}
              maxLength={3000}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              Website contact number
              <input
                name="contactPhone"
                type="tel"
                className="input"
                defaultValue={site.contactPhone ?? ''}
                placeholder="Use your dealer profile number"
                maxLength={20}
              />
            </label>
            <label className="field">
              WhatsApp number
              <input
                name="whatsappPhone"
                type="tel"
                className="input"
                defaultValue={site.whatsappPhone ?? ''}
                maxLength={20}
              />
            </label>
          </div>
          <p className="text-[12px] ink-muted">
            The dealership address and legal identity come from your approved dealer profile. An
            empty contact or Maps field reuses the dealer profile.
          </p>
          <label className="field">
            Google Maps link
            <input
              name="mapsUrl"
              className="input"
              defaultValue={site.mapsUrl ?? ''}
              maxLength={500}
            />
          </label>
          <label className="field">
            Social links — one per line
            <textarea
              name="socialUrls"
              className="input min-h-[90px] py-3"
              defaultValue={site.socialUrls.join('\n')}
              maxLength={2504}
            />
            <span className="text-[12px] ink-muted">
              Up to five HTTPS links on Instagram, Facebook, YouTube, LinkedIn or X.
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              SEO title
              <input
                name="seoTitle"
                className="input"
                defaultValue={site.seoTitle}
                maxLength={70}
              />
            </label>
            <label className="field">
              SEO description
              <input
                name="seoDescription"
                className="input"
                defaultValue={site.seoDescription}
                maxLength={160}
              />
            </label>
          </div>
          <WebsiteMediaPicker
            name="logoMediaId"
            label="Dealer logo"
            initialIds={site.logoMediaId ? [site.logoMediaId] : []}
          />
          <WebsiteMediaPicker
            name="heroMediaId"
            label="Hero image"
            initialIds={site.heroMediaId ? [site.heroMediaId] : []}
          />
          <WebsiteMediaPicker
            name="yardMediaIds"
            label="Yard photographs"
            multiple
            initialIds={site.yardMediaIds}
          />
          <fieldset id="website-design" className="rounded-xl border border-(--color-divider) p-4">
            <legend className="px-2 text-[17px] font-semibold">Design</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer gap-3 rounded-lg border border-(--color-divider) bg-white p-4 text-[14px]">
                <input
                  type="radio"
                  name="theme"
                  value="LIGHT"
                  defaultChecked={site.theme === 'LIGHT'}
                />
                <span>
                  <strong>Light</strong>
                  <br />
                  Spacious, clean and contemporary.
                </span>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-lg bg-[#151a1c] p-4 text-[14px] text-white">
                <input
                  type="radio"
                  name="theme"
                  value="DARK"
                  defaultChecked={site.theme === 'DARK'}
                />
                <span>
                  <strong>Dark</strong>
                  <br />
                  Photographic, premium and high contrast.
                </span>
              </label>
            </div>
            <p className="mt-3 text-[12px] ink-muted">
              Save to apply the design. No code change or redeployment is required.
            </p>
          </fieldset>
        </WebsiteActionForm>
      </section>
      <section id="website-domains" className="card gap-5 p-6">
        <h2 className="text-[23px]">Domains</h2>
        <p className="text-[14px] ink-muted">
          Your default address remains reserved. For a custom domain, prove ownership with the
          displayed TXT record, then check verification to receive provider-specific routing
          records. Activation also requires a valid certificate.
        </p>
        {site.domains.map((domain) => (
          <article
            key={domain.id}
            className="flex min-w-0 flex-col gap-3 rounded-xl border border-(--color-divider) p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 break-all text-[17px]">{domain.hostname}</h3>
              <StatusTag tone={domain.status === 'ACTIVE' ? 'ok' : 'warn'}>
                {domain.status.replaceAll('_', ' ')}
              </StatusTag>
              {domain.isPrimary ? <span className="text-[12px] font-semibold">Primary</span> : null}
            </div>
            {domain.lastError ? (
              <p role="status" className="text-[13px] ink-muted">
                {domain.lastError}
              </p>
            ) : null}
            {domain.instructions.length ? (
              <dl className="grid min-w-0 gap-3 text-[12px]">
                {domain.instructions.map((record, index) => (
                  <div
                    key={`${record.type}-${index}`}
                    className="rounded-lg bg-(--color-sidebar) p-3"
                  >
                    <dt className="font-semibold">
                      {record.type} · {record.name}
                    </dt>
                    <dd className="mt-1 break-all font-mono">{record.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {domain.kind === 'DEFAULT' && domain.status !== 'ACTIVE' ? (
              <p className="text-[12px] ink-muted">
                Default-domain hosting is pending platform configuration. A saved record alone does
                not make the website live.
              </p>
            ) : null}
            {domain.checkedAt ? (
              <p className="text-[12px] ink-muted">
                Last checked:{' '}
                {new Date(domain.checkedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}{' '}
                IST · Certificate {domain.certificateReady ? 'ready' : 'pending'}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {domain.kind === 'CUSTOM' &&
              !['REMOVED', 'REMOVAL_PENDING'].includes(domain.status) ? (
                <WebsiteActionForm
                  action={websiteDomainAction.bind(null, domain.id, 'refresh')}
                  label="Check verification"
                  disabled={!canSave}
                />
              ) : null}
              {domain.status === 'ACTIVE' && !domain.isPrimary ? (
                <WebsiteActionForm
                  action={websiteDomainAction.bind(null, domain.id, 'primary')}
                  label="Set primary"
                  disabled={!canSave}
                />
              ) : null}
              {domain.kind === 'CUSTOM' && domain.status !== 'REMOVED' ? (
                <WebsiteActionForm
                  action={websiteDomainAction.bind(null, domain.id, 'remove')}
                  label={domain.status === 'REMOVAL_PENDING' ? 'Retry removal' : 'Remove domain'}
                  disabled={!canSave}
                />
              ) : null}
            </div>
          </article>
        ))}
        <WebsiteActionForm
          action={addWebsiteDomainAction}
          label="Add custom domain"
          disabled={!canSave}
        >
          <label className="field">
            Domain you own
            <input
              name="hostname"
              className="input"
              placeholder="www.abcmotors.com"
              maxLength={253}
              required
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
        </WebsiteActionForm>
      </section>
      <section id="website-publication" className="card gap-5 p-6">
        <h2 className="text-[23px]">Inventory publication</h2>
        <p className="text-[14px] ink-muted">
          Choose where each car may appear. Moderation, dealership approval and availability always
          apply. Selecting neither destination hides the car from both public channels.
        </p>
        {publication.data.length ? (
          publication.data.map((listing) => (
            <article key={listing.id} className="rounded-xl border border-(--color-divider) p-4">
              <h3 className="mb-3 text-[16px]">
                {listing.title}{' '}
                <span className="text-[12px] ink-muted">
                  · {listing.status.replaceAll('_', ' ')}
                </span>
              </h3>
              <WebsiteActionForm
                action={setWebsitePublicationAction.bind(null, listing.id)}
                label="Save destinations"
                disabled={!canSave}
              >
                <div className="flex flex-wrap gap-5 text-[14px]">
                  <label className="flex min-h-[44px] items-center gap-2">
                    <input
                      type="checkbox"
                      name="marketplacePublished"
                      defaultChecked={listing.marketplacePublished}
                    />
                    Dealers-Drive marketplace
                  </label>
                  <label className="flex min-h-[44px] items-center gap-2">
                    <input
                      type="checkbox"
                      name="storefrontPublished"
                      defaultChecked={listing.storefrontPublished}
                    />
                    My dealership website
                  </label>
                </div>
              </WebsiteActionForm>
            </article>
          ))
        ) : (
          <p className="text-[14px] ink-muted">Add vehicles through your inventory dashboard.</p>
        )}
        {publication.page.totalPages > 1 ? (
          <nav
            className="flex flex-wrap gap-4 text-[13px]"
            aria-label="Publication inventory pages"
          >
            {page > 1 ? (
              <a
                className="underline"
                href={`/dealer/website?page=${page - 1}#website-publication`}
              >
                Previous
              </a>
            ) : null}
            <span>
              Page {page} of {publication.page.totalPages}
            </span>
            {page < publication.page.totalPages ? (
              <a
                className="underline"
                href={`/dealer/website?page=${page + 1}#website-publication`}
              >
                Next
              </a>
            ) : null}
          </nav>
        ) : null}
      </section>
      <section id="website-settings" className="card gap-4 p-6">
        <h2 className="text-[23px]">Website settings</h2>
        <p className="text-[14px] ink-muted">
          Disabling retains your website configuration, domain reservations, inventory and enquiry
          history. Reactivation requires current dealership and domain eligibility.
        </p>
        <WebsiteActionForm
          action={setWebsiteEnabledAction.bind(null, !live)}
          label={
            live
              ? 'Disable website'
              : site.status === 'SUSPENDED'
                ? 'Request reactivation'
                : 'Activate website'
          }
          disabled={!canSave}
        />
      </section>
    </div>
  );
}
