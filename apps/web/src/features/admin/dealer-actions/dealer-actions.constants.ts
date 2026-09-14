/** Below this a reason is not a reason, and the dealer has nothing to act on. */
export const MIN_REASON = 6;

export const DEALERS_LIST_PATH = '/admin/dealers';

export const DEALER_ACTIONS_TEXT = {
  heading: 'Actions',
  failed: 'That action did not go through.',
  nothingAvailable: 'No decisions are available from this state.',

  noteLabel: 'Note',
  approveNotePlaceholder: 'Internal — not shown to the dealer',
  approveConfirmLabel: 'Confirm approval',
  approve: 'Approve dealer',
  approved: 'Dealer approved.',
  approveBlocked:
    'Verify all three KYC documents above before approving — approval makes every one of this dealer’s listings eligible to appear publicly.',
  approveReady: 'Approving makes this dealer’s listings eligible to appear publicly.',
  approveConfirmHint: (phrase: string) => `type “${phrase}”`,

  changesLabel: 'What the dealer needs to change',
  changesPlaceholder: 'Shown to the dealer verbatim — say exactly what to fix',
  requestChanges: 'Request changes',
  changesSent: 'Sent back to the dealer for changes.',
  changesNote:
    'Reopens their application as a draft with everything they entered still in it. They correct what you named here and submit again. Nothing is deleted.',

  reinstateNotePlaceholder: 'Internal — why the suspension is being lifted',
  reinstate: 'Reinstate dealer',
  reinstated: 'Dealer reinstated.',
  reinstateNote:
    'Lifting the suspension clears the reason the dealer was shown and puts their listings back in front of buyers.',

  suspendLabel: 'Reason for suspension',
  verbatimPlaceholder: 'Shown to the dealer verbatim',
  suspend: 'Suspend',
  suspended: 'Dealer suspended and their listings withdrawn.',

  rejectOpen: 'Reject application…',
  reject: 'Reject and delete permanently',
  rejected: 'Application rejected and deleted.',
  cancel: 'Cancel',
  reasonLabel: 'Reason',
  rejectWarning: 'Rejecting deletes this application permanently.',
  rejectAlternative: 'If you only need something corrected, use',
  rejectAlternativeControl: 'Request changes',
  rejectAlternativeTail: 'above instead — it keeps everything.',
  rejectConfirmLabel: (brandName: string) => `Type "${brandName}" to confirm`,
  approvalPhrase: (brandName: string) => `approve ${brandName.trim().toLowerCase()}`,
} as const;
