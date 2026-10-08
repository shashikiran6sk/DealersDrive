import { siteMetadata } from '@/lib/seo';
import { getSite } from '@/lib/tenant';

export async function generateMetadata() {
  const site = await getSite();
  return siteMetadata(site, '/terms', `Website information | ${site.name}`);
}
export default async function WebsiteInformationPage() {
  const site = await getSite();
  return (
    <section className="wl-wrap wl-section">
      <p className="wl-eyebrow">Website information</p>
      <h1>About this website</h1>
      <div className="wl-lead">
        <p>
          This website is branded for {site.legalName} and provided through Dealers-Drive. Its
          inventory is managed in the Dealers-Drive dealership dashboard.
        </p>
        <p>
          Contact the dealership to confirm availability, vehicle details, pricing and arrangements
          for a visit. A website enquiry is a request for contact; it does not reserve or purchase a
          vehicle.
        </p>
        <p>
          Dealership verification on Dealers-Drive identifies an approved dealership. It does not
          imply that Dealers-Drive inspected or certified a vehicle, or provides a warranty.
        </p>
        <a className="wl-text-link" href="/privacy">
          Privacy information
        </a>
      </div>
    </section>
  );
}
