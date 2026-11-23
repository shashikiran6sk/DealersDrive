export type GridShape = {
  columns: number;
  tile: number;
};

export function gridShape(count: number, width: number, gap: number): GridShape {
  const columns = count >= 5 ? 3 : count >= 2 ? 2 : 1;
  const tile = Math.floor((width - gap * (columns - 1)) / columns);
  return { columns, tile };
}
