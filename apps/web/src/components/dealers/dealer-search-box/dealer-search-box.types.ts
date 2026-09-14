export interface DealerSearchBoxProps {
  q?: string;
  district?: string;
  city?: string[];
  districtName?: string;
  onSearch: (term: string | null) => void;
  className?: string;
}
