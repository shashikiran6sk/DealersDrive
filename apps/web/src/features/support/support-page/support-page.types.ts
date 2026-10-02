import type { SupportContact, SupportContacts } from '@dealers-drive/contracts';
import type { ReactNode } from 'react';

export type SupportIconName = 'customer' | 'dealer' | 'chat' | 'request';

export interface SupportCardProps {
  icon: SupportIconName;
  title: string;
  body: string;
  headingId: string;
  children: ReactNode;
}

export interface ContactLinesProps {
  contact: SupportContact;
}

export interface SupportPageProps {
  support: SupportContacts;
}
