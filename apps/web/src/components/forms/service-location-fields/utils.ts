import {
  canonicalDistrictFilterSlug,
  slugify,
  type ServiceDistrictDto,
} from '@dealers-drive/contracts';

export function matchDistricts(
  districts: readonly ServiceDistrictDto[],
  search: string,
): ServiceDistrictDto[] {
  const query = search.trim().toLowerCase();
  const typed = slugify(search);
  const canonical = canonicalDistrictFilterSlug(typed);
  const viaAlias = canonical !== typed;
  return districts.filter(
    (item) =>
      item.name.toLowerCase().includes(query) || (viaAlias && slugify(item.name) === canonical),
  );
}
