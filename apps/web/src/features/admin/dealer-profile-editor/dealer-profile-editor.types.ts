import type { FIELDS } from './dealer-profile-editor.constants';

export type DealerField = (typeof FIELDS)[number];
export type FieldKey = DealerField['key'];
export type Values = Record<FieldKey, string>;
