export type Bilingual = {
  en: string;
  ta: string | null;
};

export type ReelCar = {
  slug: string;
  title: string;
  year: number | null;
  price: string | null;
  specs: Bilingual[];
  imageSrc: string | null;
};

export type ReelDealer = {
  name: string;
  initials: string;
  isVerified: boolean;
  logoSrc: string | null;
  location: Bilingual;
  services: Bilingual[];
};

export type ReelProps = {
  dealer: ReelDealer;
  featured: ReelCar[];
  gallery: string[];
  availableCount: number;
  priceRange: string | null;
  pageUrl: string;
  asOf: Bilingual;
  musicSrc: string | null;
};
