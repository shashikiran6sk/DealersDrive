import type { JsonLdNode } from '../json-ld';
import { directoryPath } from '../policy';
import { BREADCRUMB_TEXT } from '../seo.constants';
import { absoluteUrl } from '../site';

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbSchema(crumbs: readonly Crumb[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export interface DistrictCrumb {
  name: string;
  slug: string;
}

export function directoryTrail(directory: Crumb, district?: DistrictCrumb): readonly Crumb[] {
  return [
    { name: BREADCRUMB_TEXT.home, path: '/' },
    directory,
    ...(district
      ? [{ name: district.name, path: directoryPath(directory.path, district.slug) }]
      : []),
  ];
}
