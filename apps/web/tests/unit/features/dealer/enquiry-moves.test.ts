import { ENQUIRY_TRANSITIONS, EnquiryStatus } from '@dealers-drive/contracts';
import { describe, expect, it } from 'vitest';

import { ENQUIRY_MOVES } from '@/features/dealer/enquiries/enquiries.constants';

describe('ENQUIRY_MOVES', () => {
  it.each(EnquiryStatus.options)(
    'offers from %s exactly the moves the API allows (UPD-2)',
    (status) => {
      expect(ENQUIRY_MOVES[status].map((move) => move.to)).toEqual([
        ...ENQUIRY_TRANSITIONS[status],
      ]);
    },
  );
});
