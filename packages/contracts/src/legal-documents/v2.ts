import { LEGAL_DOCUMENTS_V1 } from './v1.js';

function paragraphs(values: readonly string[]): string[] {
  return values.map((value) =>
    value
      .replaceAll('Dealer Agreement', 'dealer obligations in these Terms')
      .replaceAll(
        'Vehicle Listing and Photography Policy',
        'listing and photography sections of these Terms',
      )
      .replaceAll('Listing Policy', 'listing sections of these Terms')
      .replaceAll('Data Rights', 'Privacy Policy and privacy controls')
      .replaceAll('Grievance Redressal', 'grievance section of these Terms')
      .replace(
        'Dealers must additionally enter the dealer obligations in these Terms through an authorized representative.',
        'An authorized dealership owner must accept the dealership obligations in these Terms at final submission.',
      )
      .replace(
        'Your separate permission concerns that enquiry and enquiry-related contact;',
        'Your separate permission covers customer-initiated enquiries to the identified dealership and enquiry-related contact;',
      )
      .replace(
        'Map embeds load only after you choose to load them. Opening an external map or loading a map embed may disclose browser/network information to the map service.',
        'No embedded map is loaded. Selecting Get Directions opens Google Maps and may disclose browser/network information to that external provider.',
      )
      .replace(
        'a specified enquiry using the enquiry withdrawal control provided here',
        'a specified enquiry or dealership using the withdrawal controls provided here',
      ),
  );
}

function sections(
  document: (typeof LEGAL_DOCUMENTS_V1)[keyof typeof LEGAL_DOCUMENTS_V1],
  prefix: string,
) {
  return document.sections.map((section) => ({
    id: `${prefix}${section.id}`,
    heading: section.heading,
    paragraphs: paragraphs(section.paragraphs),
  }));
}

export const LEGAL_DOCUMENTS_V2 = {
  terms: {
    id: 'terms',
    title: 'Terms & Conditions',
    route: '/terms',
    version: '2.0-draft.1',
    effectiveDate: null,
    reviewed: false,
    sections: [
      ...sections(LEGAL_DOCUMENTS_V1.terms, ''),
      {
        id: 'dealer-agreement',
        heading: 'Dealer registration, authority and obligations',
        paragraphs: [
          'The following dealership obligations form part of these Terms. A sales representative may prepare a draft and collect approved information, but cannot accept these obligations for the owner. Verification of contact details alone is not contractual acceptance.',
        ],
      },
      ...sections(LEGAL_DOCUMENTS_V1.dealer, 'dealer-'),
      {
        id: 'listing-policy',
        heading: 'Vehicle listing standards and photography',
        paragraphs: [
          'The following listing and photography requirements form part of these Terms. A separate declaration about the particular vehicle is required at final listing submission.',
        ],
      },
      ...sections(LEGAL_DOCUMENTS_V1.listing, 'listing-'),
      {
        id: 'grievance',
        heading: 'Grievance mechanisms and disclosures',
        paragraphs: [
          'The grievance channels and applicable statutory disclosures below remain distinct from acceptance. Business identity, appointed officer and monitored contacts require factual confirmation and Indian legal counsel approval before publication.',
        ],
      },
      ...sections(LEGAL_DOCUMENTS_V1.grievance, 'grievance-'),
    ],
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    route: '/privacy',
    version: '2.0-draft.1',
    effectiveDate: null,
    reviewed: false,
    sections: [
      ...sections(LEGAL_DOCUMENTS_V1.privacy, ''),
      {
        id: 'contact-sharing',
        heading: 'Dealership-specific contact sharing permission',
        paragraphs: [
          'You choose whether to share your name, verified mobile number and submitted enquiry messages with the identified dealership so its authorized personnel can respond to your enquiries. A valid permission may cover later enquiries that you actively submit to that same dealership for the same purpose and data categories. It never creates an enquiry automatically or authorizes disclosure to another dealership or unrelated marketing.',
          'You may withdraw dealership permission through privacy controls. Withdrawal stops future disclosures under that grant, including access to its enquiries and pending notifications. Earlier lawful disclosures cannot be recalled. A later enquiry requires fresh permission. A materially changed recipient, purpose, data category or sharing notice requires a new choice; unrelated Terms updates do not by themselves expand or revoke this permission.',
          'The Platform records authenticated identity, dealership, purpose, permitted data categories, notice version and hash, grant and withdrawal events and server timestamps. Each enquiry retains its association with the applicable grant. Authentication, Terms acceptance and acknowledgment of this Privacy Policy do not provide blanket consent to all processing.',
        ],
      },
      {
        id: 'privacy-rights',
        heading: 'Privacy requests and consent withdrawal',
        paragraphs: [
          'Use the privacy controls and existing support channels for requests or withdrawal without accepting new Terms. Requests are assessed under the law that is applicable at the time; this draft does not promise unverified retention periods or statutory response timelines.',
        ],
      },
      ...sections(LEGAL_DOCUMENTS_V1.rights, 'rights-'),
    ],
  },
} as const;

export const LEGAL_NOTICES_V2 = {
  enquiry: {
    version: '2.0-draft.1',
    text: 'I permit sharing my name, verified mobile number and submitted enquiry messages with the identified dealership so it can respond to my enquiries. I can withdraw future sharing in privacy controls; information already received cannot be recalled. This does not permit unrelated marketing.',
  },
  certification: {
    version: '2.0-draft.1',
    text: 'I am authorized to advertise this vehicle, confirm its information and material disclosures after reasonable checks, and authorize the agreed photography and image uses under the Terms & Conditions.',
  },
} as const;
