export interface RelatedSearchLink {
  href: string;
  label: string;
}

export interface RelatedSearchGroup {
  title: string;
  links: readonly RelatedSearchLink[];
}
