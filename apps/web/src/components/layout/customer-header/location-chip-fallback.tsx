import { HEADER_TEXT } from './customer-header.constants';

export function LocationChipFallback() {
  return (
    <span className="btn btn-secondary flex items-center gap-[7px]" aria-hidden="true">
      {HEADER_TEXT.selectDistrict} <span>{HEADER_TEXT.caret}</span>
    </span>
  );
}
