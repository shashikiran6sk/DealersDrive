import type { ReelCar, ReelProps, StockFigure } from '../reel/reel.types';
import { withCampaign } from '../data/campaign';

import {
  CAPTION_COPY,
  MAX_BRAND_TAGS,
  SHORTS_TAG,
  YOUTUBE_SOURCE,
  YOUTUBE_TITLE_LIMIT,
} from './captions.constants';

export type CaptionInput = {
  props: ReelProps;
  city: string;
  state: string;
};

export type Captions = {
  instagram: string;
  youtube: { title: string; description: string };
};

export function hashtag(text: string): string {
  const words = text
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/);
  return words
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

export function stockText(stock: StockFigure): string {
  return `${stock.value}${stock.plus ? '+' : ''}`;
}

function carsWord(stock: StockFigure, capital: boolean): string {
  const word = stock.value === 1 && !stock.plus ? 'car' : 'cars';
  return capital ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

export function carLine(car: ReelCar): string {
  const name = car.year === null ? car.title : `${car.year} ${car.title}`;
  return `• ${name} · ${car.price ?? CAPTION_COPY.priceOnRequest}`;
}

export function brandTags(cars: readonly ReelCar[], max: number): string[] {
  const brands = cars.map((car) => hashtag(car.title.split(/\s+/)[0] ?? '')).filter(Boolean);
  return [...new Set(brands)].slice(0, max);
}

export function tagLine(tags: readonly string[]): string {
  return [...new Set(tags.filter((tag) => tag.length > 0))].map((tag) => `#${tag}`).join(' ');
}

export function lowestPrice(range: string | null): string | null {
  if (range === null) return null;
  return range.split(' – ')[0] ?? null;
}

export function youtubeTitle(input: CaptionInput): string {
  const { props, city } = input;
  const stock = stockText(props.stock);
  const cars = carsWord(props.stock, true);
  const low = lowestPrice(props.priceRange);
  const full = CAPTION_COPY.youtubeTitle(
    stock,
    cars,
    city,
    low === null ? '' : CAPTION_COPY.fromPrice(low),
    props.dealer.name,
  );
  if (full.length <= YOUTUBE_TITLE_LIMIT) return full;
  const short = CAPTION_COPY.youtubeShortTitle(props.dealer.name, stock, cars);
  if (short.length <= YOUTUBE_TITLE_LIMIT) return short;
  const keep = YOUTUBE_TITLE_LIMIT - SHORTS_TAG.length - 2;
  return `${props.dealer.name.slice(0, keep).trimEnd()}… ${SHORTS_TAG}`;
}

function sharedBlock(props: ReelProps): string[] {
  const lines: string[] = [];
  if (props.priceRange !== null) lines.push(CAPTION_COPY.priceRange(props.priceRange));
  if (props.dealer.services.length > 0) {
    lines.push(
      CAPTION_COPY.services(props.dealer.services.map((service) => service.en).join(' · ')),
    );
  }
  return lines;
}

function tamilLine(props: ReelProps): string {
  const place = props.dealer.location.ta ?? props.dealer.location.en;
  return CAPTION_COPY.tamil(props.dealer.name, place, stockText(props.stock));
}

export function buildCaptions(input: CaptionInput): Captions {
  const { props, city, state } = input;
  const stock = stockText(props.stock);
  const cars = carsWord(props.stock, false);
  const place = props.dealer.location.en;
  const carLines = props.featured.map(carLine);
  const brands = brandTags(props.featured, MAX_BRAND_TAGS);
  const shared = sharedBlock(props);
  const closing = CAPTION_COPY.pricesChange(props.asOf.en);

  const instagram = [
    CAPTION_COPY.instagramHeadline(props.dealer.name, place, stock, cars),
    '',
    CAPTION_COPY.featuredReel,
    ...carLines,
    '',
    ...shared,
    '',
    CAPTION_COPY.instagramFind(props.dealer.name),
    '',
    tamilLine(props),
    '',
    closing,
    '',
    tagLine([
      ...CAPTION_COPY.baseTags,
      `UsedCars${hashtag(city)}`,
      hashtag(city),
      hashtag(state),
      ...brands,
    ]),
  ].join('\n');

  const description = [
    CAPTION_COPY.youtubeHeadline(stock, cars, props.dealer.name, place),
    withCampaign(props.pageUrl, YOUTUBE_SOURCE),
    '',
    CAPTION_COPY.featuredShort,
    ...carLines,
    '',
    ...shared,
    '',
    tamilLine(props),
    '',
    closing,
    '',
    tagLine(['Shorts', ...CAPTION_COPY.youtubeTags, hashtag(city), ...brands]),
  ].join('\n');

  return { instagram, youtube: { title: youtubeTitle(input), description } };
}

export function youtubeFile(captions: Captions): string {
  return `${captions.youtube.title}\n\n${captions.youtube.description}\n`;
}
