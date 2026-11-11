import {
  DealerDirectoryResponse,
  DealerPublicProfile,
  PublicVehiclesResponse,
  type DealerCard,
  type VehicleCardDto,
} from '@dealers-drive/contracts';

import type { ModelName } from './models';

export type Fetcher = (url: string) => Promise<Response>;

export type Parser<T> = { parse: (value: unknown) => T };

export type Inventory = {
  cards: VehicleCardDto[];
  available: number;
  models: ModelName[];
};

const PAGE_LIMIT = 48;
const MAX_PAGES = 40;

export class ApiRequestError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`GET ${url} answered ${status}`);
    this.name = 'ApiRequestError';
  }
}

export function apiUrl(base: string, path: string, query: Record<string, string> = {}): string {
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

export async function getJson<T>(fetcher: Fetcher, url: string, parser: Parser<T>): Promise<T> {
  const response = await fetcher(url);
  if (!response.ok) throw new ApiRequestError(url, response.status);
  const body: unknown = await response.json();
  return parser.parse(body);
}

export async function fetchDealersWithStock(base: string, fetcher: Fetcher): Promise<DealerCard[]> {
  const dealers: DealerCard[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = apiUrl(base, 'v1/dealers', { page: String(page), limit: String(PAGE_LIMIT) });
    const result = await getJson(fetcher, url, DealerDirectoryResponse);
    dealers.push(...result.data);
    if (page >= result.page.totalPages) break;
  }
  return dealers.filter((dealer) => dealer.carCount > 0);
}

export function fetchProfile(
  base: string,
  slug: string,
  fetcher: Fetcher,
): Promise<DealerPublicProfile> {
  return getJson(
    fetcher,
    apiUrl(base, `v1/dealers/${encodeURIComponent(slug)}`),
    DealerPublicProfile,
  );
}

export async function fetchInventory(
  base: string,
  slug: string,
  fetcher: Fetcher,
): Promise<Inventory> {
  const path = `v1/dealers/${encodeURIComponent(slug)}/vehicles`;
  const cards: VehicleCardDto[] = [];
  let available = 0;
  let brands: Array<{ value: string; label: string }> = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = apiUrl(base, path, {
      page: String(page),
      limit: String(PAGE_LIMIT),
      sort: 'newest',
    });
    const result = await getJson(fetcher, url, PublicVehiclesResponse);
    cards.push(...result.data);
    available = result.available;
    if (page === 1) brands = result.facets.brands;
    if (page >= result.page.totalPages) break;
  }

  const models: ModelName[] = [];
  for (const brand of brands) {
    const url = apiUrl(base, path, { limit: '1', brand: brand.value });
    const result = await getJson(fetcher, url, PublicVehiclesResponse);
    models.push(
      ...result.facets.models.map((model) => ({ brand: brand.label, model: model.label })),
    );
  }
  return { cards, available, models };
}
