import type { VehicleSearchParams } from '@dealers-drive/contracts/vehicle-search';
import { dealersApi } from '../dealers/dealers-api';

export async function loadHomeSection(params: VehicleSearchParams, signal?: AbortSignal) {
  const first = await dealersApi.home(params, signal);
  const cars = first.data.filter((car) => car.availability === 'AVAILABLE');
  for (
    let page = 2;
    cars.length === 0 && first.available > 0 && page <= Math.min(first.page.totalPages, 3);
    page++
  ) {
    const next = await dealersApi.home({ ...params, page: String(page) }, signal);
    cars.push(...next.data.filter((car) => car.availability === 'AVAILABLE'));
  }
  return { ...first, data: [...new Map(cars.map((car) => [car.slug, car])).values()].slice(0, 4) };
}
