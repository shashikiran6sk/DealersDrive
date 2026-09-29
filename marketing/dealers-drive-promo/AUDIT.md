# Product and seed audit

The existing application is the functional source of truth. The film uses the Next.js web app and Express API against a separate local PostgreSQL database. No promotional frontend implements application features.

| Area               | Implemented behavior used or inspected                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home               | Marketplace search, location entry points, featured inventory and configurable hero media                                                                      |
| `/cars`            | Make/model search, district selection, facet filters, sorting, vehicle cards, saving                                                                           |
| `/car/[slug]`      | Photography gallery/lightbox, price, mileage, specifications, dealer identity and enquiry                                                                      |
| `/dealers`         | Dealer discovery with cover media, identity and locality                                                                                                       |
| `/dealers/[slug]`  | Cover, dealership details, services, contact/location and live inventory                                                                                       |
| Customer account   | Real phone authentication; local fake OTP driver is used only for fixtures                                                                                     |
| `/saved`           | Authenticated customer saved vehicles                                                                                                                          |
| Enquiry            | Real submitted message with customer identity, vehicle and dealer relationships                                                                                |
| `/enquiries`       | Authenticated customer's enquiry history                                                                                                                       |
| Dealer login       | Real dealer phone sign-in endpoint and cookie session                                                                                                          |
| Onboarding         | Account → Business → Documents → Review. Requires linked Google identity, verified mobile, business information, registrations, three documents and yard image |
| Dealer dashboard   | Existing listing statistics, navigation and recent enquiries                                                                                                   |
| Profile            | Public identity; editable established year; reviewed fields retain their review semantics                                                                      |
| Inventory          | Existing inventory table on desktop and responsive cards; statuses and permitted actions                                                                       |
| Listing submission | Existing seeded draft submitted through the real review wizard                                                                                                 |
| Lifecycle          | Active → Reserved → Active recorded through existing controls; Sold and Withdrawn controls remain visible                                                      |
| Dealer enquiries   | The actual customer-created enquiry is marked Contacted in the dealer console                                                                                  |

## Seed relationships

The ordinary development seed contains 120 dealers and 320 deterministic vehicles. `seed.ts` imports its existing dealer/vehicle generators, selects 6 dealers and 12 distinct active cars, and preserves vehicle/listing IDs and slugs. A thirteenth existing seed vehicle supplies an editable draft. This promotional reset does not call or change the ordinary development seed.

Users have roles; dealer owners are related through dealer membership. Each vehicle belongs to its dealership and has a listing. Gallery ordering and primary images use VehicleMedia linked to READY Media records. VehiclePhotography is READY for photographed cars. Dealer cover media uses the existing coverMediaId field. Media derivatives are stored and served by the existing local storage adapter and normal `/media/by-media/…` route. No alternate public media API was introduced.

The selected 2021 City uses petrol rather than the original seed's implausible hybrid value. Innova and Tiago use manual transmission and Kushaq uses automatic to match their generated interiors. These overrides exist only in the promotional database. Image galleries are illustrative generated marketing assets, not evidence of any real vehicle's condition or exact trim equipment.

## Recording boundaries

- Arjun, Annamalai Auto Mart and the featured Honda Elevate connect the two sides of the story.
- Sample names, contact numbers and `example.invalid` emails belong to fixtures. No real account or external customer system is accessed.
- The new-dealer account starts with a seeded Google identity and verified phone. The film shows the actual subsequent account/business/document UI. It does not simulate an OAuth exchange or claim the new dealership is approved.
- Dealer vehicle photography is platform-managed in the implemented product. The film shows vehicle information submission, not a nonexistent dealer photography uploader.
- No guaranteed condition, cheapest price, certified vehicle or guaranteed trust claim is added.
- A capture-only stylesheet hides the development banner and Next.js indicator. The regular development app retains both. No application control, field, status, moderation rule or error is replaced with marketing HTML.
- The opening/closing brand frames and editorial labels are marketing graphics. All product screens come from the working application.
