import { describe, expect, it } from 'vitest';
import { OptionalGstin, requiredDealerDocuments } from '../../src/dealer-gstin.js';
import { UpdateDealerInput } from '../../src/dealer.js';
import { CreateAssistedDealerInput, UpdateAssistedDealerInput } from '../../src/sales.js';
describe('optional GSTIN contracts', () => {
  it.each([null, '', ' ', '\t\n'])('normalizes absence %j to null', (value) => {
    expect(OptionalGstin.parse(value)).toBeNull();
    expect(UpdateDealerInput.parse({ gstin: value }).gstin).toBeNull();
    expect(UpdateAssistedDealerInput.parse({ gstin: value }).gstin).toBeNull();
  });
  it('preserves omitted patch values and normalizes supplied values', () => {
    expect(OptionalGstin.parse(undefined)).toBeUndefined();
    expect(UpdateDealerInput.parse({})).not.toHaveProperty('gstin');
    expect(OptionalGstin.parse(' 33aabcs1429p1z5 ')).toBe('33AABCS1429P1Z5');
    expect(CreateAssistedDealerInput.shape.gstin.parse(null)).toBeNull();
  });
  it.each(['invalid', '33AABCS1429P0Z5', '33AABCS1429P1X5', 123])(
    'refuses provided invalid GSTIN %j',
    (value) => {
      expect(OptionalGstin.safeParse(value).success).toBe(false);
    },
  );
  it('requires the certificate when GSTIN is supplied and preserves other business checks', () => {
    expect(requiredDealerDocuments(null)).toEqual(['PAN_CARD', 'ADDRESS_PROOF']);
    expect(requiredDealerDocuments('33AABCS1429P1Z5')).toEqual([
      'GST_CERTIFICATE',
      'PAN_CARD',
      'ADDRESS_PROOF',
    ]);
  });
});
