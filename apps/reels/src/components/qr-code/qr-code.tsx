import { useMemo } from 'react';

import { qrMatrix } from '../../lib/qr';

export type QrCodeProps = {
  value: string;
  size: number;
  color: string;
};

export function QrCode({ value, size, color }: QrCodeProps) {
  const { path, modules } = useMemo(() => {
    const rows = qrMatrix(value);
    const d = rows
      .flatMap((cells, row) => cells.map((on, col) => (on ? `M${col} ${row}h1v1h-1z` : '')))
      .join('');
    return { path: d, modules: rows.length };
  }, [value]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${modules} ${modules}`}
      shapeRendering="crispEdges"
      role="img"
    >
      <path d={path} fill={color} />
    </svg>
  );
}
