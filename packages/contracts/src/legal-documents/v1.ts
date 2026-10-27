export interface LegalSection {
  id: string;
  heading: string;
  paragraphs: readonly string[];
}

export interface LegalDocument {
  title: string;
  version: string;
  route: string;
  description: string;
  sections: readonly LegalSection[];
}

export const LEGAL_V1_PUBLICATION: {
  operatorName: string | null;
  operatorForm: string | null;
  operatorAddress: string | null;
  grievanceName: string | null;
  grievanceDesignation: string | null;
  grievanceEmail: string | null;
  grievanceAddress: string | null;
  customerCarePhone: string | null;
  effectiveDate: string | null;
} = {
  operatorName: 'Shashikiran Lakshminarayanan, trading as Dealers-Drive',
  operatorForm: 'Sole proprietorship',
  operatorAddress: '19th Street, Lakshmipuram, Gandhinagar, Vellore 632006, Tamil Nadu, India',
  grievanceName: 'Shashikiran Lakshminarayanan',
  grievanceDesignation: 'Proprietor and Grievance Officer',
  grievanceEmail: 'support@dealers-drive.com',
  grievanceAddress: '19th Street, Lakshmipuram, Gandhinagar, Vellore 632006, Tamil Nadu, India',
  customerCarePhone: '+918015354298',
  effectiveDate: '2026-10-24',
};

export function legalV1Ready(publication = LEGAL_V1_PUBLICATION): boolean {
  return Object.values(publication).every((value) => Boolean(value?.trim()));
}

export const TERMS_V1: LegalDocument = {
  title: 'Terms & Conditions',
  version: 'terms-v1.0',
  route: '/terms',
  description:
    'Terms for using Dealers-Drive, a used-car discovery and enquiry marketplace connecting customers with independent dealerships in India.',
  sections: [
    {
      id: 'platform',
      heading: '1. The platform and its operator',
      paragraphs: [
        'These Terms govern use of Dealers-Drive at https://dealers-drive.com (the Platform). The business identified in the operator and contact details below operates the Platform (we, us). Dealers-Drive is a used-car discovery and enquiry marketplace connecting customers with independent dealerships. The dealership advertising a vehicle is identified on its listing.',
        'We currently photograph vehicles and moderate listings before publication. Dealer identity and business-document review, listing moderation and mechanical vehicle inspection are different activities. Neither a dealer verification badge nor an approved listing is a mechanical certification. A comprehensive vehicle inspection service is not currently offered.',
      ],
    },
    {
      id: 'eligibility',
      heading: '2. Acceptance and eligibility',
      paragraphs: [
        'Public browsing is available without an account. Account features require affirmative acceptance of these Terms and acknowledgment of the Privacy Policy. You must be at least 18 and legally capable of entering a contract under Indian law to create or use an account. A person acting for a dealership must have authority to do so.',
        'Acceptance does not authorize unrelated marketing or waive privacy or consumer rights. You may read these policies, contact support or make a privacy request without accepting them.',
      ],
    },
    {
      id: 'accounts',
      heading: '3. Customer accounts and account security',
      paragraphs: [
        'Provide your own accurate contact details and keep them current. Mobile sign-in uses a one-time password. Where Google sign-in or linking is offered, use an account you control. Keep your device, authentication codes and account access secure; do not share codes with anyone claiming to need them for support.',
        'Report suspected unauthorized access promptly through Contact & Support. You are responsible for actions you authorize and must not impersonate another person. We remain responsible for security obligations imposed on us by applicable law.',
      ],
    },
    {
      id: 'dealers',
      heading: '4. Dealer onboarding and verification',
      paragraphs: [
        'Dealerships provide business and contact details and the identity and business documents requested in onboarding. Documents and contact details are reviewed for onboarding and verification purposes. Verification describes the checks performed; it does not guarantee every dealer statement, regulatory authorization or vehicle.',
        'A sales representative may help prepare an application, but cannot accept these Terms for the dealership. The authenticated dealership owner must accept for the dealership. Saving a draft or proving a phone number or email does not constitute legal acceptance. Dealer approval and any verification badge remain subject to the Platform’s separate review processes. Some dealerships may be activated under a recorded administrative exception before document verification is complete.',
      ],
    },
    {
      id: 'dealer-responsibilities',
      heading: '5. Dealer responsibilities and listing accuracy',
      paragraphs: [
        'Dealers must have lawful authority to advertise each vehicle and supply genuine documents and accurate, current information after reasonable checks. Disclose known material defects, accident or flood history, mileage uncertainty, modifications, finance or title restrictions and other facts relevant to a purchaser. Do not describe unverified information as certified.',
        'Keep prices, charges and availability current; promptly correct errors and mark vehicles reserved, sold or withdrawn as appropriate. Dealers must comply with applicable vehicle, tax, advertising, consumer-protection and personal-data requirements and ensure their authorized personnel use the Platform lawfully.',
      ],
    },
    {
      id: 'vehicle-information',
      heading: '6. Vehicle information, specifications and prices',
      paragraphs: [
        'Listings contain dealer-supplied particulars and may include registration-derived specifications. These can contain errors or become out of date. Prices are asking prices unless expressly stated otherwise; confirm the final price, taxes, fees, accessories and all sale terms with the dealership before committing.',
        'We do not guarantee a vehicle’s condition, mileage, accident history, title or availability merely by displaying information. Check the actual vehicle, original documents and all material representations, and obtain an independent professional assessment suited to the purchase.',
      ],
    },
    {
      id: 'photography',
      heading: '7. Listing review and vehicle photography',
      paragraphs: [
        'We review listings and photographs for publication and may request corrections, reject or remove content. Photography records visible appearance at a point in time; it does not reveal every defect or establish roadworthiness. Moderation does not authenticate every dealer statement or replace an inspection.',
        'Dealers must arrange lawful access and necessary permissions for photography and supply images of the actual vehicle. Images may be resized, cropped, optimized or prepared for display, including background presentation. Images must fairly represent the vehicle and must not conceal material damage or mislead about its condition. Report inaccurate images or information through Contact & Support.',
      ],
    },
    {
      id: 'enquiries',
      heading: '8. Enquiries and dealer contact',
      paragraphs: [
        'Submitting an enquiry shares your name, verified mobile number and any message with the dealership offering the vehicle so its authorized personnel can respond. Review your message before submitting and avoid unnecessary sensitive information. The dealership may contact you about that enquiry. Do not use enquiry details for unrelated marketing or disclose them for unrelated purposes.',
        'An enquiry does not reserve a vehicle, conclude a sale or guarantee a response. Dealerships are responsible for their own communications. Contact support to report misuse or request help with a complaint.',
      ],
    },
    {
      id: 'transactions',
      heading: '9. Vehicle transactions',
      paragraphs: [
        'Vehicle purchases are agreed directly between the customer and independent dealership. Dealers-Drive currently facilitates discovery and enquiries; it does not sell the listed vehicles, guarantee a completed transaction, or provide vehicle warranties or insurance through these listings.',
        'The parties must agree payment, delivery, inspection, ownership transfer, registration, insurance, outstanding finance and any contractual warranty directly, and fulfill their respective legal responsibilities. Verify the recipient and documents before making a payment. Platform support does not replace the dealer’s obligations or your statutory remedies.',
      ],
    },
    {
      id: 'intellectual-property',
      heading: '10. Intellectual property and image permissions',
      paragraphs: [
        'The Platform’s branding, software, layout and original content belong to us or their respective rights holders. Do not copy, scrape, redistribute or commercially exploit content without permission or a lawful basis.',
        'Dealers retain rights they lawfully hold in submitted content and authorize us to host, reproduce, resize and display that content and permitted vehicle photographs to operate and promote the relevant listings and marketplace. Dealers must obtain necessary permissions from vehicle owners, premises controllers and other rights holders. This permission does not transfer ownership of a vehicle or authorize misleading image edits. Rights in commissioned photographs depend on the applicable commissioning arrangements. Contact us about infringements or removal requests.',
      ],
    },
    {
      id: 'prohibited-conduct',
      heading: '11. Fraud and prohibited conduct',
      paragraphs: [
        'Do not submit false documents, impersonate others, conceal material vehicle facts, post unlawful or misleading advertisements, advertise stolen vehicles, solicit fraudulent payments, harass users, misuse contact information, upload malicious material, bypass access controls or interfere with the Platform. Do not use automated collection that compromises privacy, security or service availability.',
      ],
    },
    {
      id: 'restrictions',
      heading: '12. Suspension, removal and termination',
      paragraphs: [
        'We may restrict accounts, suspend dealer privileges or remove listings for breaches, suspected fraud, security concerns, unlawful content or other reasonable grounds related to operating the Platform. Where practicable and lawful, we will explain the reason and allow correction or review. Immediate protective action may be necessary.',
        'You may stop using the Platform and request account closure through Contact & Support. Closure does not erase accrued legal obligations, unresolved transactions or records lawfully retained under the Privacy Policy. Necessary support and privacy requests remain available.',
      ],
    },
    {
      id: 'responsibility',
      heading: '13. Marketplace role and responsibility',
      paragraphs: [
        'Dealers remain responsible for their vehicle information, sale commitments and conduct. Our role as a marketplace does not make us the vehicle seller or guarantor. We take responsibility for our own services and representations as required by law.',
        'Nothing in these Terms excludes or limits liability for our own negligence, misrepresentation, fraud, unlawful conduct or any liability that cannot lawfully be excluded. Nothing waives non-excludable consumer rights, access to a competent consumer forum or remedies available under Indian law. No promise of uninterrupted service or a successful transaction is made.',
      ],
    },
    {
      id: 'grievance',
      heading: '14. Grievances, Indian law and disputes',
      paragraphs: [
        'Contact the grievance contact identified below, or use Contact & Support, for concerns about the Platform, dealers, listings, privacy or account access. Include the relevant listing or enquiry reference and a concise description; never send authentication codes. Signed-in customers can also raise and follow support requests. Email and telephone support remain available if you cannot sign in.',
        'Where applicable, the Consumer Protection (E-Commerce) Rules require acknowledgment of a consumer complaint within 48 hours and redress within one month. Any shorter or different mandatory period applicable to a particular complaint takes precedence.',
        'Indian law governs these Terms, subject to mandatory law. We encourage an attempt to resolve concerns through support without making it a prerequisite to legal remedies. Competent courts, consumer commissions and other authorities retain jurisdiction under applicable law. These Terms impose no compulsory private arbitration or exclusive venue.',
      ],
    },
    {
      id: 'changes',
      heading: '15. Changes, effective date and contact details',
      paragraphs: [
        'These interim V1 Terms are pending external legal review. Updated Terms will identify their version and effective date. Material changes requiring renewed agreement will be presented before affected account actions. These Terms apply when published and accepted; the displayed effective date does not create retrospective acceptance. Changes do not retrospectively rewrite previous acceptances. The published version is retained as a reference for acceptance records.',
        'The effective date and the operator and grievance details appear below. The Privacy Policy explains how personal information is handled. Contact & Support provides current service support channels.',
      ],
    },
  ],
};

export const PRIVACY_V1: LegalDocument = {
  title: 'Privacy Policy',
  version: 'privacy-v1.0',
  route: '/privacy',
  description:
    'How Dealers-Drive handles account, dealer verification, vehicle, enquiry and support information, and how to make a privacy request.',
  sections: [
    {
      id: 'scope',
      heading: '1. Who handles your information',
      paragraphs: [
        'This Policy explains how the operator of Dealers-Drive, identified in the operator and contact details below, handles personal information through https://dealers-drive.com. It covers browsing, authentication, customer accounts, dealer onboarding and administration, vehicle listings, enquiries, saved cars, complaints and support. Independent dealerships separately handle information they receive for their own dealings with customers.',
      ],
    },
    {
      id: 'accounts',
      heading: '2. Account and authentication information',
      paragraphs: [
        'We collect your name, mobile number, verification status and account details. Customer sign-in currently uses mobile OTP through MSG91. Dealer sign-in supports Google and mobile OTP; dealer onboarding also links verified contact details. Google authentication can supply a Google account identifier, verified email, name and profile image. We do not receive your Google password.',
        'Authentication records include sign-in times, sessions, verification and account-linking records, IP address and browser information. OTP delivery and verification involve MSG91 and telecommunications providers. Email verification and service emails use Resend. Do not send passwords or OTPs in enquiries or support requests.',
      ],
    },
    {
      id: 'dealer-data',
      heading: '3. Dealer business and identity information',
      paragraphs: [
        'Dealer onboarding collects the contact person’s name, verified phone and email, business name, address, district, state, pin code, map location, contact channels and services. It also collects chosen personal and business identity documents and relevant tax identifiers. Aadhaar is voluntary; where selected, onboarding asks for a masked copy. The Platform does not automatically mask an uploaded document.',
        'We store document uploads and review decisions for onboarding, fraud prevention and dealer verification. Authorized staff may assist with information collection and record business visits and photographs. Dealer personnel information includes contact details, roles, invitations and membership history. Public dealer profiles display business information and approved portfolio photographs; identity-document copies are not public portfolio content.',
      ],
    },
    {
      id: 'customer-data',
      heading: '4. Enquiries, complaints, saved cars and preferences',
      paragraphs: [
        'We store enquiries, the vehicle and dealership they concern, your name, verified mobile number, any message, and enquiry status and handling records. Submitting an enquiry discloses these contact and message details to the relevant dealership’s authorized personnel and may generate a service email notification. A dealership may then contact you about the enquiry.',
        'Support requests and complaints contain the information you submit, replies, status and internal handling records. Saved cars are associated with your account. Interface preferences, such as a selected location, may be kept in your browser. Do not include another person’s information unless you have authority or another lawful reason.',
      ],
    },
    {
      id: 'vehicle-data',
      heading: '5. Vehicles and photographs',
      paragraphs: [
        'We collect vehicle registration and specification information, descriptions, prices, listing history and photographs for listing review and publication. Registration-derived information may be obtained through configured vehicle-information services. Photos may incidentally show people, registration marks or locations. Avoid unnecessary personal information and tell support about material that needs correction or removal.',
        'Vehicle photographs may be resized, cropped, optimized or prepared for presentation. Approved listing and business portfolio content is public. Private onboarding documents and internal business-visit evidence have restricted access.',
      ],
    },
    {
      id: 'purposes',
      heading: '6. Why we use information and applicable grounds',
      paragraphs: [
        'We use information to provide requested account and marketplace functions; verify contact details and dealer applications; review and publish listings; maintain saved cars; route enquiries; send service communications; handle complaints and privacy requests; prevent fraud; secure the service; and meet legal obligations or address disputes.',
        'Processing must have a basis permitted by the law applicable at the time, including consent where required, information voluntarily provided for the requested service where legally permitted, or an applicable legal duty. Accepting the Terms and acknowledging this Policy is not blanket consent to every use, unrelated marketing or unrestricted disclosure. If you decline information necessary for a feature, we may be unable to provide that feature. Public browsing remains available.',
        'As of 24 October 2026, the Digital Personal Data Protection Act, 2023 and Rules, 2025 have phased commencement. The principal processing, notice, consent and individual-rights provisions are scheduled for commencement eighteen months after the November 2025 Gazette publication. We assess requests under law currently in force, including applicable Information Technology Act and 2011 sensitive-personal-data rules; we do not represent future provisions as already operative. Statutory rights apply as they commence.',
      ],
    },
    {
      id: 'sharing',
      heading: '7. Who receives information',
      paragraphs: [
        'The dealership you enquire about receives your enquiry contact details and message for responding. Its authorized personnel must use them lawfully. Public listings and dealer profiles are visible to other visitors. Authorized platform personnel access information according to their work and permissions, including verification, moderation, customer support and security.',
        'Infrastructure and service providers process information needed to operate the service: hosting and content delivery, PostgreSQL database hosting, object storage for photos and documents, Google authentication and Maps, MSG91 OTP, Resend email, Vercel hosting and analytics, and configured operational logging and monitoring. Our documented infrastructure includes AWS hosting and database services and Cloudflare R2 object storage; monitoring may use Grafana Cloud. Service arrangements can change. We do not assert that all data is hosted by a single provider or exclusively within India.',
        'Providers may process information outside India, subject to applicable transfer requirements. Information may be disclosed where lawfully required by an authority, necessary to investigate fraud or protect legal rights, or as part of a lawful business transfer with appropriate safeguards. We do not authorize dealerships to use enquiry details for unrelated marketing.',
      ],
    },
    {
      id: 'cookies',
      heading: '8. Cookies, analytics and external services',
      paragraphs: [
        'The site uses session cookies for authentication and security, temporary authentication-flow cookies and an account-state hint in the browser. Browser storage may remember interface preferences. Signing out ends the current session; it does not erase records already stored on the server.',
        'Vercel Web Analytics is included in the application layout and can collect page views and related technical information where enabled by the hosting service, including page URL, referrer, browser, device and approximate location. Its service describes analytics without analytics cookies; authentication cookies remain separate. The current integration is not restricted to public pages and does not itself remove query strings from URLs. Do not place personal or sensitive information in URLs.',
        'Dealer location pages may load an embedded Google Map, which communicates browser and network information to Google and may use Google’s cookies or similar technologies. Opening Google sign-in, Maps or another external link also involves that provider’s own processing. Their privacy notices apply to their services. Policy acknowledgment does not itself authorize an optional tracking purpose where a separate choice is legally required.',
      ],
    },
    {
      id: 'security',
      heading: '9. Security',
      paragraphs: [
        'The Platform uses authenticated sessions, server-side access checks, restricted document access, short-lived document links, validation, rate limits and security logging. We limit access according to roles and operational need. These controls reduce risk but cannot guarantee absolute security. Report suspected misuse through Contact & Support.',
        'Storage, backup and transport protections also depend on deployed infrastructure and providers. We make no unverified promise here about encryption of every record, a compliance certification or exclusive Indian storage.',
      ],
    },
    {
      id: 'retention',
      heading: '10. Retention and deletion',
      paragraphs: [
        'Account, dealer document, enquiry, listing, support and agreement records are stored to operate the service and address security, complaints, disputes and legal obligations. Some operational records expire or are removed by specific maintenance processes, but a comprehensive automatic deletion schedule is not currently implemented. This Policy does not promise a fixed retention period or automatic anonymization.',
        'Account closure or a deletion request requires review through support. Certain information may need to remain for an applicable legal duty, unresolved dispute, fraud investigation or evidence of an agreement. Provider logs and backups may have separate handling. We assess the records concerned and explain applicable limitations; closing an account does not instantly erase all copies.',
      ],
    },
    {
      id: 'rights',
      heading: '11. Your choices, requests and complaints',
      paragraphs: [
        'Use Contact & Support or the privacy/grievance contact below to request access to information about your data, correction, withdrawal of a permission, account closure or deletion, or to complain about handling. State the account or information concerned and the outcome sought. We may reasonably verify identity or authority. Do not send an OTP, password or unnecessary identity document.',
        'There is currently no self-service account-erasure or enquiry-permission withdrawal control. Support can assess requests, including requests concerning future contact or disclosure. A withdrawal cannot recall information already received by a dealership; you may also need to contact it about its own copies. Necessary support and privacy requests do not require renewed Terms acceptance. Statutory remedies and timelines apply where the relevant provisions are in force.',
        'Account use is intended for adults aged 18 or above. Contact us if you believe a child has provided personal information so we can assess appropriate action under applicable law.',
      ],
    },
    {
      id: 'changes',
      heading: '12. Acceptance records, updates and contacts',
      paragraphs: [
        'We record the authenticated account, the dealership where acceptance is made for it, the Terms and Privacy versions and a server timestamp when you affirmatively accept. We do not record acceptance merely because sign-in succeeded. These records help establish the agreement and Privacy Policy acknowledged.',
        'This interim V1 Policy is pending external legal review. We will identify the effective date and version of updates and give further notice or seek a new choice where required. A policy update does not retrospectively expand the purposes of a previous permission. The effective date and operator and grievance/privacy contacts appear below.',
      ],
    },
  ],
};
