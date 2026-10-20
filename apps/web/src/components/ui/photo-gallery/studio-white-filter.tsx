import { studioWhiteTable } from './utils';

const TABLE = studioWhiteTable();

export interface StudioWhiteFilterProps {
  id: string;
}

export function StudioWhiteFilter({ id }: StudioWhiteFilterProps) {
  return (
    <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0 overflow-hidden">
      <filter id={id} colorInterpolationFilters="sRGB">
        <feComponentTransfer>
          <feFuncR type="table" tableValues={TABLE} />
          <feFuncG type="table" tableValues={TABLE} />
          <feFuncB type="table" tableValues={TABLE} />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}
