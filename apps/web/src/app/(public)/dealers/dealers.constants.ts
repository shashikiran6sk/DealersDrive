export const DEALERS_TEXT = {
  metaTitle: (place: string | undefined, page: number) =>
    `${place ? `Used Car Dealers in ${place}` : 'Used Car Dealers'}${page > 1 ? ` – Page ${page}` : ''}`,
  metaDescription: (place: string | undefined) =>
    `Browse verified independent used-car dealerships${place ? ` in ${place}` : ''} on Dealers-Drive and explore the cars each one has available. Identity, GSTIN and address are checked before a dealership goes live.`,
  listName: (place: string | undefined) =>
    place ? `Used car dealers in ${place}` : 'Used car dealers',
} as const;
