export interface MakeLink {
  label: string;
  href: string;
}

export interface MakesListProps {
  makes: readonly MakeLink[];
  copy?: boolean;
}

export interface MakesStripProps {
  makes: readonly MakeLink[];
}
