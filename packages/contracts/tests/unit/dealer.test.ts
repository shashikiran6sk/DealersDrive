import { describe, expect, it } from 'vitest';

import {
  CreateOrderInput,
  CreateVehicleInput,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  DocTypeParam,
  DocumentCommitInput,
  DocumentPresignInput,
  EnquiryQuery,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
  InventoryQuery,
  MarkSoldInput,
  MediaCommitInput,
  MediaPresignInput,
  ReorderMediaInput,
  UpdateDealerInput,
  UpdateEnquiryInput,
  UpdateVehicleInput,
  VerifyOrderInput,
} from '../../src/dealer.js';

/**
 * Everything a signed-in dealer sends. The through-line is what these schemas
 * refuse:
 *
 *  · **money is paise, always** — a rupee float is a bug, not a style choice
 *    (CLAUDE.md rule 3), and the price bound is an integer count of paise;
 *  · **no `dealerId`** — the tenant comes from the session, checked across
 *    every schema in `index.test.ts`;
 *  · **no listing status** — publishing goes through `transition()`, so the
 *    only status a dealer sets here is a *lead's*.
 *
 * The upload schemas carry the other half of a security boundary: they declare
 * the type and the byte count that the server then signs, so a presigned PUT
 * that does not match what was declared is rejected before a byte is stored.
 */

const UUID = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('CreateVehicleInput', () => {
  const valid = {
    makeId: UUID,
    modelId: UUID,
    variantId: UUID,
    year: 2019,
    fuel: 'PETROL' as const,
    transmission: 'MANUAL' as const,
    bodyType: 'HATCHBACK' as const,
  };

  it('accepts the catalogue reference and the fixed facts', () => {
    expect(CreateVehicleInput.safeParse(valid).success).toBe(true);
  });

  /**
   * Variant used to be optional. It is not any more: a `Swift VXi` and a
   * `Swift ZXi+` are a lakh apart on the same model row, so a listing without
   * one is described rather than identified — and buyers filter on it.
   */
  it('refuses a null or absent variant', () => {
    const { variantId: _v, ...withoutVariant } = valid;

    expect(CreateVehicleInput.safeParse({ ...valid, variantId: null }).success).toBe(false);
    expect(CreateVehicleInput.safeParse(withoutVariant).success).toBe(false);
  });

  it('requires a make, a model and a variant — a car with a gap cannot be filed', () => {
    for (const field of ['makeId', 'modelId', 'variantId'] as const) {
      const { [field]: _dropped, ...without } = valid;
      expect(CreateVehicleInput.safeParse(without).success, field).toBe(false);
    }
  });

  /** §6.2: dealers pick from dropdowns, so a reference is a uuid or nothing. */
  it('refuses a free-text make', () => {
    expect(CreateVehicleInput.safeParse({ ...valid, makeId: 'Maruti Suzuki' }).success).toBe(false);
  });

  it('refuses a car from before 1950 or from the year after next', () => {
    expect(CreateVehicleInput.safeParse({ ...valid, year: 1949 }).success).toBe(false);
    expect(
      CreateVehicleInput.safeParse({ ...valid, year: new Date().getFullYear() + 2 }).success,
    ).toBe(false);
  });

  /** Next year's models are on forecourts this year. */
  it('accepts next year’s model', () => {
    expect(
      CreateVehicleInput.safeParse({ ...valid, year: new Date().getFullYear() + 1 }).success,
    ).toBe(true);
  });

  it('takes no price at create time — that is an edit, not a creation', () => {
    expect(CreateVehicleInput.safeParse({ ...valid, pricePaise: 55_000_000 }).success).toBe(false);
  });

  it('takes no status', () => {
    expect(CreateVehicleInput.safeParse({ ...valid, status: 'READY' }).success).toBe(false);
  });
});

describe('UpdateVehicleInput', () => {
  it('accepts an empty patch, which is a no-op rather than an error', () => {
    expect(UpdateVehicleInput.safeParse({}).success).toBe(true);
  });

  it('accepts a single field', () => {
    expect(UpdateVehicleInput.parse({ kmDriven: 42_000 })).toEqual({ kmDriven: 42_000 });
  });

  /**
   * Rule 3, in the type system: the field is named `pricePaise` and is an
   * integer, so `55000.50` — a rupee float that slipped through a form — is a
   * 400 rather than a rounding error in a ledger.
   */
  it('takes the price in whole paise', () => {
    expect(UpdateVehicleInput.safeParse({ pricePaise: 55_000_000 }).success).toBe(true);
    expect(UpdateVehicleInput.safeParse({ pricePaise: 55_000.5 }).success).toBe(false);
  });

  it('refuses a price below ₹10 or above ₹5 crore', () => {
    expect(UpdateVehicleInput.safeParse({ pricePaise: 999 }).success).toBe(false);
    expect(UpdateVehicleInput.safeParse({ pricePaise: 1000 }).success).toBe(true);
    expect(UpdateVehicleInput.safeParse({ pricePaise: 500_000_000_00 }).success).toBe(true);
    expect(UpdateVehicleInput.safeParse({ pricePaise: 500_000_000_01 }).success).toBe(false);
  });

  it('bounds the odometer to something a car could have driven', () => {
    expect(UpdateVehicleInput.safeParse({ kmDriven: -1 }).success).toBe(false);
    expect(UpdateVehicleInput.safeParse({ kmDriven: 1_000_001 }).success).toBe(false);
  });

  it('counts owners from one', () => {
    expect(UpdateVehicleInput.safeParse({ ownerNumber: 0 }).success).toBe(false);
    expect(UpdateVehicleInput.safeParse({ ownerNumber: 1 }).success).toBe(true);
    expect(UpdateVehicleInput.safeParse({ ownerNumber: 10 }).success).toBe(false);
  });

  /**
   * `null` clears a genuinely optional fact; `undefined` leaves it alone.
   *
   * The list is short on purpose. Every field the wizard requires is
   * `.optional()` rather than `.nullish()`, so a step may decline to *send* one
   * but no request may blank one — otherwise a PATCH could un-complete a step
   * the dealer had already passed, and the required-field rule would hold only
   * until someone sent a null.
   */
  it.each(['seats', 'airbags', 'description'])(
    'lets %s be cleared with an explicit null',
    (field) => {
      expect(UpdateVehicleInput.safeParse({ [field]: null }).success).toBe(true);
    },
  );

  it.each([
    'variantId',
    'colorId',
    'rtoCode',
    'cityId',
    'insuranceType',
    'insuranceValidTill',
    'regNumberMasked',
    'kmDriven',
    'ownerNumber',
  ])('refuses to blank %s, because the wizard requires it', (field) => {
    expect(UpdateVehicleInput.safeParse({ [field]: null }).success).toBe(false);
  });

  /**
   * The plate is validated because it is now mandatory, and a mandatory field
   * that accepts anything is a required field in name only — "asdf" would fill
   * it. Separators are optional because a dealer reading a windscreen should not
   * have to guess ours.
   */
  it.each([
    'TN 09 BX 1234',
    'TN09BX1234',
    'tn-09-bx-1234',
    'TN 23 A 4567',
    'KA01AB1234',
    '24 BH 1234 AB',
  ])('accepts %s as a registration number', (plate) => {
    expect(UpdateVehicleInput.safeParse({ regNumberMasked: plate }).success, plate).toBe(true);
  });

  it('normalises a registration number to unspaced upper case', () => {
    const parsed = UpdateVehicleInput.parse({ regNumberMasked: 'tn 09 bx 1234' });

    // One stored form, so two dealers typing the same plate differently do not
    // produce two different listings.
    expect(parsed.regNumberMasked).toBe('TN09BX1234');
  });

  it.each(['asdf', '1234', 'TN', 'TN09BX', 'ZZ 99 ZZ 99999', ''])(
    'refuses %s as a registration number',
    (plate) => {
      expect(UpdateVehicleInput.safeParse({ regNumberMasked: plate }).success, plate).toBe(false);
    },
  );

  it('requires an ISO datetime with an offset for the insurance expiry', () => {
    expect(UpdateVehicleInput.safeParse({ insuranceValidTill: '2027-03-01T00:00:00Z' }).success)
      .toBe(true);
    expect(UpdateVehicleInput.safeParse({ insuranceValidTill: '2027-03-01' }).success).toBe(false);
  });

  it('caps the feature list and each feature', () => {
    expect(UpdateVehicleInput.safeParse({ features: Array(40).fill('abs') }).success).toBe(true);
    expect(UpdateVehicleInput.safeParse({ features: Array(41).fill('abs') }).success).toBe(false);
    expect(UpdateVehicleInput.safeParse({ features: ['x'.repeat(61)] }).success).toBe(false);
  });

  it('caps the description, so a listing cannot carry a payload', () => {
    expect(UpdateVehicleInput.safeParse({ description: 'x'.repeat(4001) }).success).toBe(false);
  });

  it('takes no slug — the public URL is derived, not chosen', () => {
    expect(UpdateVehicleInput.safeParse({ slug: 'my-great-car' }).success).toBe(false);
  });
});

describe('UpdateDealerInput', () => {
  it('accepts a partial profile edit', () => {
    expect(UpdateDealerInput.safeParse({ tagline: 'Trusted since 1998' }).success).toBe(true);
  });

  it('trims and bounds the brand name', () => {
    expect(UpdateDealerInput.parse({ brandName: '  Sri Lakshmi Motors  ' }).brandName).toBe(
      'Sri Lakshmi Motors',
    );
    expect(UpdateDealerInput.safeParse({ brandName: 'A' }).success).toBe(false);
  });

  it('validates a GSTIN rather than storing whatever arrives', () => {
    expect(UpdateDealerInput.safeParse({ gstin: 'not-a-gstin' }).success).toBe(false);
  });

  it('validates a PAN', () => {
    expect(UpdateDealerInput.safeParse({ pan: 'lowercase' }).success).toBe(false);
  });

  it('bounds the established year to a plausible one', () => {
    expect(UpdateDealerInput.safeParse({ establishedYear: 1899 }).success).toBe(false);
    expect(UpdateDealerInput.safeParse({ establishedYear: 1998 }).success).toBe(true);
  });

  it('caps the specialities list', () => {
    expect(UpdateDealerInput.safeParse({ specialities: Array(12).fill('SUVs') }).success).toBe(
      true,
    );
    expect(UpdateDealerInput.safeParse({ specialities: Array(13).fill('SUVs') }).success).toBe(
      false,
    );
  });

  it('lets a closed day be recorded as null in the working hours', () => {
    expect(UpdateDealerInput.safeParse({ workingHours: { sunday: null } }).success).toBe(true);
  });

  /**
   * The read schema marks `tagline` nullable, so the column allows a cleared
   * one — but this input is `.optional()` without `.nullable()`, so a dealer
   * who sets a tagline has no way to remove it. Pinned as the current
   * behaviour; widening the contract is a product decision, not a test fix.
   */
  it('has no way to clear a tagline once set', () => {
    expect(UpdateDealerInput.safeParse({ tagline: null }).success).toBe(false);
  });
});

describe('the upload schemas', () => {
  /**
   * The client declares the type and the byte count; the server signs exactly
   * those and the storage adapter re-checks them before writing. A mismatch is
   * rejected at the PUT, which is what makes a presigned URL safe to hand out.
   */
  it('accepts only image types for a vehicle photo', () => {
    expect(IMAGE_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);

    for (const mimeType of IMAGE_MIME_TYPES) {
      expect(
        MediaPresignInput.safeParse({
          ownerType: 'VEHICLE',
          ownerId: UUID,
          fileName: 'front.jpg',
          mimeType,
          bytes: 1024,
        }).success,
        mimeType,
      ).toBe(true);
    }
  });

  it('refuses a non-image for a photo, including a PDF and an SVG', () => {
    for (const mimeType of ['application/pdf', 'image/svg+xml', 'text/html']) {
      expect(
        MediaPresignInput.safeParse({
          ownerType: 'VEHICLE',
          ownerId: UUID,
          fileName: 'x',
          mimeType,
          bytes: 1024,
        }).success,
        mimeType,
      ).toBe(false);
    }
  });

  it('bounds a photo at 10MB', () => {
    const base = { ownerType: 'VEHICLE' as const, ownerId: UUID, fileName: 'f.jpg', mimeType: 'image/jpeg' as const };

    expect(IMAGE_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(MediaPresignInput.safeParse({ ...base, bytes: IMAGE_MAX_BYTES }).success).toBe(true);
    expect(MediaPresignInput.safeParse({ ...base, bytes: IMAGE_MAX_BYTES + 1 }).success).toBe(
      false,
    );
    expect(MediaPresignInput.safeParse({ ...base, bytes: 0 }).success).toBe(false);
  });

  it('names the three owner types a photo can belong to', () => {
    for (const ownerType of ['VEHICLE', 'DEALER_LOGO', 'DEALER_COVER']) {
      expect(
        MediaPresignInput.safeParse({
          ownerType,
          ownerId: UUID,
          fileName: 'f.jpg',
          mimeType: 'image/jpeg',
          bytes: 1,
        }).success,
        ownerType,
      ).toBe(true);
    }
  });

  /** KYC documents are a separate flow with a separate type list and cap. */
  it('accepts a PDF for a KYC document, which a photo may not be', () => {
    expect(DOCUMENT_MIME_TYPES).toContain('application/pdf');
    expect(
      DocumentPresignInput.safeParse({
        type: 'GST_CERTIFICATE',
        fileName: 'gst.pdf',
        mimeType: 'application/pdf',
        bytes: 1024,
      }).success,
    ).toBe(true);
  });

  it('bounds a document at 5MB — smaller than a photo', () => {
    expect(DOCUMENT_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(DOCUMENT_MAX_BYTES).toBeLessThan(IMAGE_MAX_BYTES);
    expect(
      DocumentPresignInput.safeParse({
        type: 'PAN_CARD',
        fileName: 'pan.pdf',
        mimeType: 'application/pdf',
        bytes: DOCUMENT_MAX_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it('accepts only the three KYC document types', () => {
    expect(DocTypeParam.safeParse({ type: 'GST_CERTIFICATE' }).success).toBe(true);
    expect(DocTypeParam.safeParse({ type: 'PASSPORT' }).success).toBe(false);
  });

  it('commits a document by id, so a commit cannot claim a different upload', () => {
    expect(DocumentCommitInput.safeParse({ documentId: UUID }).success).toBe(true);
    expect(DocumentCommitInput.safeParse({ documentId: 'anything' }).success).toBe(false);
  });

  /**
   * A photo commit carries only its position: the media id is the path
   * parameter, so there is no body field a caller could point at somebody
   * else's upload. Accepting one here would be a second place to check
   * ownership.
   */
  it('takes no media id in the commit body — the path already names it', () => {
    expect(Object.keys(MediaCommitInput.shape)).toEqual(['position']);
    expect(MediaCommitInput.safeParse({ mediaId: UUID }).success).toBe(false);
  });

  it('accepts a position, and bounds it to the photo cap', () => {
    expect(MediaCommitInput.safeParse({}).success).toBe(true);
    expect(MediaCommitInput.safeParse({ position: 0 }).success).toBe(true);
    expect(MediaCommitInput.safeParse({ position: 41 }).success).toBe(false);
  });

  /**
   * §12.2: the full ordered array, always — never a partial swap. Two clients
   * reordering concurrently with partial updates would interleave into an
   * order neither of them asked for.
   */
  it('reorders by the complete list of media ids', () => {
    expect(ReorderMediaInput.safeParse({ mediaIds: [UUID] }).success).toBe(true);
    expect(ReorderMediaInput.safeParse({ mediaIds: ['x'] }).success).toBe(false);
    expect(ReorderMediaInput.safeParse({ mediaIds: [] }).success).toBe(false);
  });
});

describe('the console queries', () => {
  it('defaults the inventory page size', () => {
    expect(InventoryQuery.parse({})).toEqual({ limit: 20 });
  });

  it('coerces a limit off the query string and caps it', () => {
    expect(InventoryQuery.parse({ limit: '50' }).limit).toBe(50);
    expect(InventoryQuery.safeParse({ limit: 101 }).success).toBe(false);
  });

  /** A *filter*, not an assertion — the dealer is narrowing their own list. */
  it('filters the inventory by display status', () => {
    expect(InventoryQuery.safeParse({ status: 'ACTIVE' }).success).toBe(true);
    expect(InventoryQuery.safeParse({ status: 'NOT_A_STATUS' }).success).toBe(false);
  });

  it('filters enquiries by their own status', () => {
    expect(EnquiryQuery.safeParse({ status: 'NEW' }).success).toBe(true);
    expect(EnquiryQuery.safeParse({ status: 'ACTIVE' }).success).toBe(false);
  });

  it('bounds the cursor, so it cannot be used as a payload', () => {
    expect(InventoryQuery.safeParse({ cursor: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('UpdateEnquiryInput', () => {
  it('moves a lead to CONTACTED', () => {
    expect(UpdateEnquiryInput.safeParse({ status: 'CONTACTED' }).success).toBe(true);
  });

  it('records why a lead closed', () => {
    expect(UpdateEnquiryInput.safeParse({ status: 'CLOSED', closeReason: 'SOLD' }).success).toBe(
      true,
    );
  });

  it('refuses a close reason outside the enum', () => {
    expect(UpdateEnquiryInput.safeParse({ closeReason: 'CHANGED_THEIR_MIND' }).success).toBe(false);
  });

  it('caps the internal note', () => {
    expect(UpdateEnquiryInput.safeParse({ note: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('the billing inputs', () => {
  /** §26.4: a client-supplied amount is how a marketplace gives inventory away. */
  it('takes a packId and nothing else', () => {
    expect(CreateOrderInput.safeParse({ packId: UUID }).success).toBe(true);
    expect(CreateOrderInput.safeParse({ packId: UUID, amountPaise: 1 }).success).toBe(false);
    expect(CreateOrderInput.safeParse({ packId: UUID, credits: 50 }).success).toBe(false);
  });

  it('refuses an order with no pack', () => {
    expect(CreateOrderInput.safeParse({}).success).toBe(false);
  });

  it('verifies an order by what the gateway returned, not by an amount', () => {
    const keys = Object.keys(VerifyOrderInput.shape);

    expect(keys).not.toContain('credits');
    expect(keys).not.toContain('amountPaise');
  });
});

describe('MarkSoldInput', () => {
  it('accepts an empty body — the price is optional', () => {
    expect(MarkSoldInput.safeParse({}).success).toBe(true);
  });

  it('takes a sold price in paise when one is given', () => {
    expect(MarkSoldInput.safeParse({ soldPricePaise: 55_000_000 }).success).toBe(true);
    expect(MarkSoldInput.safeParse({ soldPricePaise: 55_000.5 }).success).toBe(false);
  });
});
