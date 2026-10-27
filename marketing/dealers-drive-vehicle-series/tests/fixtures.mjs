import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
export function vehicle(slug = 'fixture-car', changes = {}) {
  return {
    slug,
    availability: 'AVAILABLE',
    title: 'Fixture Motors Demonstrator',
    year: 2018,
    priceLabel: '₹7,50,000',
    specs: [
      { label: 'Manufacturing year', value: '2018' },
      { label: 'Registration year', value: '2020' },
      { label: 'Owners', value: 'Second owner' },
    ],
    facts: {
      make: 'Fixture Motors',
      model: 'Demonstrator',
      variant: 'Test trim',
      fuelType: 'Diesel',
      transmission: 'Automatic',
      kilometersDriven: 123456,
      ownerCount: 2,
      pricePaise: 75000000,
    },
    images: [1, 2, 3, 4].map((n) => ({
      url: `https://api.dealers-drive.com/media/fixture/${slug}-${n}.png`,
      alt: 'Test illustration ' + n,
    })),
    primaryIndex: 0,
    dealer: { location: 'Test City' },
    ...changes,
  };
}
export const url = (slug) => 'https://www.dealers-drive.com/car/' + slug;
export async function fixture(dir, count = 2) {
  await fs.mkdir(dir, { recursive: true });
  const listings = {};
  for (let i = 0; i < count; i++) {
    const slug = 'fixture-car-' + (i + 1),
      raw = vehicle(slug);
    if (i === 1) {
      raw.facts.model = 'A Longer Model Name';
      raw.facts.fuelType = null;
      raw.facts.ownerCount = null;
      raw.specs = raw.specs.filter((s) => s.label !== 'Owners');
      raw.facts.transmission = null;
      raw.facts.kilometersDriven = null;
      raw.priceLabel = null;
      raw.facts.pricePaise = null;
    }
    const images = {};
    for (let n = 1; n <= 4; n++) {
      const label = ['FRONT', 'REAR', 'DASHBOARD', 'SEATING'][n - 1],
        color = i ? '#576f86' : '#644354';
      const body =
        n < 3
          ? `<path d="M180 550V420L340 280H780L960 420V550Z" fill="${color}"/><circle cx="350" cy="540" r="78" fill="#171717"/><circle cx="800" cy="540" r="78" fill="#171717"/>`
          : `<rect x="180" y="280" width="780" height="350" rx="40" fill="${color}"/><rect x="360" y="340" width="400" height="180" rx="20" fill="#222"/>`;
      const file = `${slug}-${n}.png`;
      await sharp(
        Buffer.from(
          `<svg width="1200" height="900"><rect width="100%" height="100%" fill="#fff"/>${body}<text x="90" y="790" font-family="Arial" font-size="48">TEST FIXTURE ${i + 1}: ${label}</text></svg>`,
        ),
      )
        .png()
        .toFile(path.join(dir, file));
      images[raw.images[n - 1].url] = file;
    }
    listings[url(slug)] = { vehicle: raw, images };
  }
  const data = { listings };
  await fs.writeFile(path.join(dir, 'fixture.json'), JSON.stringify(data, null, 2));
  return data;
}
