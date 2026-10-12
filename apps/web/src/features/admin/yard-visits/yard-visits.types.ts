import type { YardVisitDto } from '@dealers-drive/contracts';

export interface YardVisitsPanelProps {
  dealerId: string;
  visits: YardVisitDto[] | null;
}

export interface YardVisitRowProps {
  dealerId: string;
  visit: YardVisitDto;
}

export interface RecordVisitFormProps {
  dealerId: string;
}
