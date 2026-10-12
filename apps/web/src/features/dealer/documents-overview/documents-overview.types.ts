import type {
  DealerDocumentDto,
  DealerStatus,
  DocumentRequirementGap,
} from '@dealers-drive/contracts';

export interface DocumentsOverviewProps {
  documents: DealerDocumentDto[];
  gstin: string | null;
  dealerStatus: DealerStatus;
}

export interface DocumentsStatusProps {
  gaps: readonly DocumentRequirementGap[];
  active: boolean;
}

export interface DocumentsReminderProps {
  gaps: readonly DocumentRequirementGap[];
}
