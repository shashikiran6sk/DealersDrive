import type { Metadata } from 'next';

import { indexPolicy, robotsFor, type SeoRoute } from './policy';
import {
  DEFAULT_SOCIAL_IMAGE,
  HOME_TITLE,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  TITLE_SEPARATOR,
  TITLE_TEMPLATE,
} from './seo.constants';
import { absoluteUrl, indexingEnabled, siteUrl } from './site';

export interface SeoImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export type SeoTitle = string | { absolute: string };

export interface PageSeo {
  title: SeoTitle;
  description: string;
  route: SeoRoute;
  images?: readonly SeoImage[];
}

export function defaultSocialImage(): SeoImage {
  return {
    url: absoluteUrl(DEFAULT_SOCIAL_IMAGE.path),
    alt: DEFAULT_SOCIAL_IMAGE.alt,
    width: DEFAULT_SOCIAL_IMAGE.width,
    height: DEFAULT_SOCIAL_IMAGE.height,
  };
}

export function fullTitle(title: SeoTitle): string {
  return typeof title === 'string' ? `${title}${TITLE_SEPARATOR}${SITE_NAME}` : title.absolute;
}

export function rootMetadata(): Metadata {
  const images = [defaultSocialImage()];
  return {
    metadataBase: new URL(siteUrl()),
    applicationName: SITE_NAME,
    title: { default: HOME_TITLE, template: TITLE_TEMPLATE },
    description: SITE_DESCRIPTION,
    creator: SITE_NAME,
    publisher: SITE_NAME,
    ...(indexingEnabled() ? {} : { robots: robotsFor({ index: false, follow: false }) }),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title: HOME_TITLE,
      description: SITE_DESCRIPTION,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: HOME_TITLE,
      description: SITE_DESCRIPTION,
      images,
    },
  };
}

export function pageMetadata({ title, description, route, images }: PageSeo): Metadata {
  const policy = indexPolicy(route);
  const canonical = policy.canonical === null ? null : absoluteUrl(policy.canonical);
  const social = images && images.length > 0 ? [...images] : [defaultSocialImage()];
  const shared = fullTitle(title);

  return {
    title,
    description,
    robots: robotsFor(policy.robots),
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title: shared,
      description,
      images: social,
      ...(canonical ? { url: canonical } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: shared,
      description,
      images: social,
    },
  };
}
