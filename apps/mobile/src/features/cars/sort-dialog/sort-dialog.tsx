import { VehicleSort, VEHICLE_SORT_LABELS } from '@dealers-drive/contracts/public';
import { SelectionSheet } from '../../../components/selection-sheet';

export function SortDialog({
  value,
  onSelect,
  onClose,
}: {
  value?: string;
  onSelect: (sort: string) => void;
  onClose: () => void;
}) {
  return (
    <SelectionSheet
      title="Sort cars"
      value={value ?? 'newest'}
      options={VehicleSort.options.map((value) => ({ value, label: VEHICLE_SORT_LABELS[value] }))}
      onClose={onClose}
      onSelect={(value) => {
        if (VehicleSort.safeParse(value).success) {
          onSelect(value);
          onClose();
        }
      }}
    />
  );
}
