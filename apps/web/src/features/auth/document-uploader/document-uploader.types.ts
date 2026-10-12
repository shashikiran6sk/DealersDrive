import type {
  DealerDocType,
  DealerDocumentDto,
  SelectableDocCategory,
} from '@dealers-drive/contracts';

export interface DocumentUploaderProps {
  category: SelectableDocCategory;
  document: DealerDocumentDto | null;
  basePath?: string;
  gstin?: string | null;
}

export interface DocumentTypeFieldProps {
  id: string;
  category: SelectableDocCategory;
  type: DealerDocType | '';
  onTypeChange: (type: DealerDocType | '') => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  gstinOnFile: boolean;
  disabled: boolean;
}

export interface GstinFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  disabled: boolean;
}

export interface CommitRefusal {
  message: string | null;
  gstin: string | null;
}
