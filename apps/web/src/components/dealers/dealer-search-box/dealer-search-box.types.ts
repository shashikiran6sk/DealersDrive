export interface DealerSearchBoxProps {
  /** The search currently applied to the grid — the box opens holding it. */
  q?: string;
  /** The page's own filters, passed through so suggestions match the grid. */
  district?: string;
  city?: string[];
  /** "Vellore", for the dropdown's heading. Absent on the unfiltered page. */
  districtName?: string;
  /** Apply a search term, or clear it. `DirectoryFilters` owns the URL. */
  onSearch: (term: string | null) => void;
  className?: string;
}
