import { siteMetadata } from '@/lib/seo';
import { getSite } from '@/lib/tenant';

export async function generateMetadata() {
  const site = await getSite();
  return siteMetadata(site, '/privacy', `Privacy information | ${site.name}`);
}
export default async function PrivacyPage() {
  const site = await getSite();
  return (
    <section className="wl-wrap wl-section">
      <p className="wl-eyebrow">Website information</p>
      <h1>Privacy information</h1>
      <div className="wl-lead">
        <p>
          This website presents inventory from {site.legalName}. Website services and customer
          enquiry processing are provided by Dealers-Drive.
        </p>
        <p>
          Browsing inventory does not require an account. Sending a vehicle enquiry uses the
          Dealers-Drive verified-customer flow. With your consent, your account name, verified
          mobile number and message are shared with this dealership to respond to your enquiry.
          Dealers-Drive also retains the enquiry and its status in the existing customer, dealership
          and administration systems.
        </p>
        <p>
          Call, WhatsApp, social media and Google Maps links open services operated by their
          respective providers. Their privacy information applies when you use them.
        </p>
        <p>
          For questions about an enquiry, contact the dealership or use customer support in your
          Dealers-Drive account.
        </p>
        <a className="wl-text-link" href="/contact">
          Contact {site.name}
        </a>
      </div>
    </section>
  );
}
