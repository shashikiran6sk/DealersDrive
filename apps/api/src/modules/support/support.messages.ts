export const TICKET_NOT_FOUND = 'There is no support request with that reference on your account.';

export const ENQUIRY_NOT_YOURS = 'Choose one of your own enquiries, or leave the enquiry out.';

export const TICKET_CLOSED =
  'This request is closed, so it cannot take a reply. Create a new support request and mention its reference.';

export const SUPPORT_RATE_LIMITED =
  'You have sent a lot of support messages. Try again in a little while.';

export const CUSTOMER_AUTHOR_LABEL = 'You';

export const SUPPORT_AUTHOR_LABEL = 'Dealers-Drive support';

export const ADMIN_TICKET_NOT_FOUND = 'There is no support ticket with that id.';

export const TICKET_CLOSED_FOR_SUPPORT =
  'This ticket is closed, so it cannot take a reply. Closed tickets are final.';

export const TRANSITION_REFUSED = (from: string, to: string) =>
  `A ticket that is ${from} cannot be moved to ${to}.`;

export const ASSIGNEE_INVALID = 'Assign the ticket to an active Dealers-Drive admin.';

export const SUPPORT_HISTORY_LABELS: Record<string, string> = {
  'support_ticket.created': 'Request created',
  'support_ticket.status_changed': 'Status changed',
  'support_ticket.resolved': 'Resolved',
  'support_ticket.closed': 'Closed',
  'support_ticket.reopened': 'Reopened',
  'support_ticket.priority_changed': 'Priority changed',
  'support_ticket.assigned': 'Assigned',
  'support_ticket.unassigned': 'Unassigned',
};

export const SUPPORT_ACTOR_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  ADMIN: 'Dealers-Drive',
  SYSTEM: 'System',
};

export const BY_CUSTOMER_REPLY = 'after the customer replied';

export const ASSIGNED_TO = (label: string) => `to ${label}`;

export const UNKNOWN_ADMIN = 'a former admin';

export const VEHICLE_IMAGE_ALT = (title: string) => `Photograph of the ${title}`;
