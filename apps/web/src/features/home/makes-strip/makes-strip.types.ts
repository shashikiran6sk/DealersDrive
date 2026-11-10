export interface MakeLink {
  label: string;
  href: string;
}

export interface MakesStripProps {
  makes: readonly MakeLink[];
}
