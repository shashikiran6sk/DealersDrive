import type {
  DealerDocType,
  DealerDocumentDto,
  SelectableDocCategory,
} from '@dealers-drive/contracts';

export interface DocumentUploaderProps {
  category: SelectableDocCategory;
  document: DealerDocumentDto | null;
  basePath?: string;
  gstinOnFile?: boolean;
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
