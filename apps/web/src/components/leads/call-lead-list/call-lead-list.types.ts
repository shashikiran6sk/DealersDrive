import type { AdminCallLead, CallLead } from '@dealers-drive/contracts';

export type CallLeadItem = CallLead & { dealer?: AdminCallLead['dealer'] };

export interface CallLeadListProps {
  leads: CallLeadItem[];
  audience: 'dealer' | 'admin';
  nextHref: string | null;
}

export interface CallLeadCardProps {
  lead: CallLeadItem;
}
