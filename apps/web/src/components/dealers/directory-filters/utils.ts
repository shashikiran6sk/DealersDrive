export interface DirectoryQuery {
  district?: string;
  city: string[];
  q?: string;
}

export function directoryHref({ district, city, q }: DirectoryQuery): string {
  const params = new URLSearchParams();
  if (district) params.set('district', district);
  if (city.length > 0) params.set('city', [...city].sort().join(','));
  if (q) params.set('q', q);
  const encoded = params.toString();
  return encoded ? `/dealers?${encoded}` : '/dealers';
}
