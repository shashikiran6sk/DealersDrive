import { LEGAL_DOCUMENTS_V2 } from './v2.js';

export const LEGAL_PRIVACY_V3 = {
  ...LEGAL_DOCUMENTS_V2.privacy,
  version: '2.0-draft.2',
  sections: [
    ...LEGAL_DOCUMENTS_V2.privacy.sections,
    {
      id: 'web-analytics',
      heading: 'Vercel Web Analytics',
      paragraphs: [
        'The Platform includes Vercel Web Analytics to understand aggregate use of public marketplace pages where the hosting service enables collection. Our analytics payload excludes query strings and fragments and does not record account, authentication, administration, sales or private support routes. We do not send customer enquiry messages, verified phone numbers or identity document contents as analytics events.',
        'Vercel receives page-view and related request information for this service. Its documentation describes request-derived visitor hashes without third-party cookies and information such as public page path, referrer, approximate region, device and browser details. Provider processing, deployment settings and applicable lawful grounds require operational and Indian legal counsel review; this description is not a claim that all such information is outside personal-data law.',
        'Privacy Policy acknowledgment and dealership sharing permission do not authorize analytics or unrelated marketing. Any separately required analytics choice or notice must be implemented before the relevant processing is enabled. No unverified retention period or statutory compliance guarantee is promised here.',
      ],
    },
  ],
} as const;
