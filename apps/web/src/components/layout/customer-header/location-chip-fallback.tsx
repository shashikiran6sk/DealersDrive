import { HEADER_TEXT } from './customer-header.constants';

/**
 * The button's own footprint, so the header does not reflow when the real one
 * arrives. It reads "Select district" because that is what the button says for
 * every visitor who has not chosen one (**R23**).
 */
export function LocationChipFallback() {
  return (
    <span className="btn btn-secondary flex items-center gap-[7px]" aria-hidden="true">
      <span className="block h-[14px] w-[5px] bg-(--color-accent)" />
      {HEADER_TEXT.selectDistrict} <span>{HEADER_TEXT.caret}</span>
    </span>
  );
}
