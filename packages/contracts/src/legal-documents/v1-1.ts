import { TERMS_V1, type LegalDocument, type LegalSection } from './v1.js';

/**
 * Terms version 1.1: the same Terms as 1.0 with the description of vehicle
 * photography corrected. Version 1.0 said "We currently photograph vehicles";
 * since some listings now carry the dealership's own photographs, checked
 * against the Dealers-Drive photo standard, that sentence is no longer true.
 *
 * Version 1.0 stays in `v1.ts`, unchanged and hash-locked, as the record of
 * what earlier acceptances agreed to. This version is built from it so the
 * only differences are the paragraphs replaced below; its rendered text is
 * locked separately by `docs/legal/v1-1-manifest.json`.
 *
 * An acceptance of 1.0 continues to count (`LEGAL_ACCEPTED_TERMS_VERSIONS`):
 * the change corrects a factual description of the service and adds no
 * obligation for customers or dealers.
 */
export interface DatedLegalDocument extends LegalDocument {
  effectiveDate: string;
  changeSummary: string;
}

const PLATFORM_PHOTOGRAPHY =
  'We moderate listings before publication. A listing’s photographs are taken either by us or by the dealership advertising the vehicle; we check a dealership’s own photographs against our photo standard before publishing them, and the vehicle page states who took the photographs where that has been recorded. Dealer identity and business-document review, listing moderation, photograph review and mechanical vehicle inspection are different activities. Neither a dealer verification badge, an approved listing nor a reviewed photograph is a mechanical certification. A comprehensive vehicle inspection service is not currently offered.';

const REVIEW_AND_PHOTOGRAPHY =
  'We review listings and photographs for publication and may request corrections, reject or remove content. Vehicle photographs are taken by us or supplied by the dealership. We publish a dealership’s own photographs only after checking them against our photo standard, which concerns the angles shown, image quality and that the images show the listed vehicle without misleading edits; that check does not verify the vehicle’s condition. Photography records visible appearance at a point in time; it does not reveal every defect or establish roadworthiness. Moderation does not authenticate every dealer statement or replace an inspection.';

const VERSION_NOTE =
  'Version 1.1 corrects the description of vehicle photography in sections 1 and 7: a listing’s photographs may be taken by us or supplied by the dealership and checked against our photo standard. It adds no obligation, and an acceptance of version 1.0 continues to apply.';

const REVISED: Record<string, (original: LegalSection['paragraphs']) => readonly string[]> = {
  platform: ([about = '']) => [about, PLATFORM_PHOTOGRAPHY],
  photography: ([, dealerDuties = '']) => [REVIEW_AND_PHOTOGRAPHY, dealerDuties],
  changes: ([interim = '', ...rest]) => [interim, VERSION_NOTE, ...rest],
};

export const TERMS_V1_1: DatedLegalDocument = {
  ...TERMS_V1,
  version: 'terms-v1.1',
  effectiveDate: '2026-11-06',
  changeSummary:
    'Version 1.1 corrects the description of vehicle photography (sections 1 and 7). Acceptance of version 1.0 continues to apply.',
  sections: TERMS_V1.sections.map((section) => {
    const revise = REVISED[section.id];
    return revise ? { ...section, paragraphs: revise(section.paragraphs) } : section;
  }),
};
