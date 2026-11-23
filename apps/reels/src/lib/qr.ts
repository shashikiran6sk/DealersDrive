import QRCode from 'qrcode';

export function qrMatrix(text: string): boolean[][] {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const rows: boolean[][] = [];
  for (let row = 0; row < modules.size; row += 1) {
    const cells: boolean[] = [];
    for (let col = 0; col < modules.size; col += 1) cells.push(modules.get(row, col) === 1);
    rows.push(cells);
  }
  return rows;
}
