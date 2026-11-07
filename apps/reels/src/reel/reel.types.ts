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

export type StockFigure = {
  value: number;
  plus: boolean;
};

export type ReelSound = {
  music: string | null;
  whoosh: string | null;
};

export type ReelProps = {
  dealer: ReelDealer;
  featured: ReelCar[];
  gallery: string[];
  stock: StockFigure;
  priceRange: string | null;
  pageUrl: string;
  asOf: Bilingual;
  sound: ReelSound;
};
