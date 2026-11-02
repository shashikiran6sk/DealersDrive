import type { RelatedSearchGroup } from '@/types';

export interface RelatedSearchesProps {
  heading: string;
  groups: readonly RelatedSearchGroup[];
  className?: string;
}
