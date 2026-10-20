import {
  NO_VEHICLE_FACETS,
  type PublicVehiclesResponse,
  type VehicleCardDto,
} from '@dealers-drive/contracts/public';

export const discoveryCar: VehicleCardDto = {
  slug: 'test-creta',
  availability: 'AVAILABLE',
  title: '2023 Hyundai Creta',
  year: 2023,
  priceLabel: '₹10,00,000',
  metaLabel: 'Petrol · Automatic · 20,000 km',
  image: null,
  imageCount: 0,
  dealer: { slug: 'test-dealer', name: 'Test dealership', initials: 'TD', isVerified: true },
};
export const emptyDiscovery: PublicVehiclesResponse = {
  data: [],
  available: 0,
  facets: NO_VEHICLE_FACETS,
  page: { page: 1, limit: 4, total: 0, totalPages: 1 },
};
