export type AdminSupportResult = { ok: true } | { ok: false; message: string };

export interface TicketChanges {
  status?: string;
  priority?: string;
  assignedAdminId?: string | null;
}

export const adminSupportActionStub: { result: AdminSupportResult; delayMs: number } = {
  result: { ok: true },
  delayMs: 500,
};

async function settle(): Promise<AdminSupportResult> {
  await new Promise((resolve) => setTimeout(resolve, adminSupportActionStub.delayMs));
  return adminSupportActionStub.result;
}

export function replyToTicketAction(_ticketId: string, _message: string) {
  return settle();
}

export function addTicketNoteAction(_ticketId: string, _note: string) {
  return settle();
}

export function updateTicketAction(_ticketId: string, _changes: TicketChanges) {
  return settle();
}
