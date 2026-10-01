import type { DealerEnquiry } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EnquiryHandledBy } from '@/features/dealer/enquiries/enquiry-handled-by';
import { EnquiryStatusActions } from '@/features/dealer/enquiries/enquiry-status-actions';

/**
 * R95 — the inbox offers each member only the moves their role allows. STAFF
 * work leads: a new enquiry can be marked contacted, and nothing else. The API
 * refuses the rest anyway; this is the console not showing buttons that would
 * only ever answer 403.
 */
vi.mock('@/features/dealer/enquiry-actions', () => ({ setEnquiryStatusAction: vi.fn() }));

const STAFF = ['enquiry:read', 'enquiry:contact'];
const MANAGER = ['enquiry:read', 'enquiry:contact', 'enquiry:close'];

function buttons(): string[] {
  const group = screen.queryByRole('group');
  return group
    ? within(group)
        .getAllByRole('button')
        .map((b) => b.textContent ?? '')
    : [];
}

describe('EnquiryStatusActions by role', () => {
  it('gives STAFF only Mark contacted on a new enquiry', () => {
    render(
      <EnquiryStatusActions enquiryId="e" status="NEW" customerName="Ravi" permissions={STAFF} />,
    );
    expect(buttons()).toEqual(['Mark contacted']);
  });

  it.each(['CONTACTED', 'CLOSED', 'SPAM'] as const)(
    'gives STAFF nothing on a %s enquiry',
    (status) => {
      const { container } = render(
        <EnquiryStatusActions
          enquiryId="e"
          status={status}
          customerName="Ravi"
          permissions={STAFF}
        />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('gives a MANAGER every move', () => {
    render(
      <EnquiryStatusActions enquiryId="e" status="NEW" customerName="Ravi" permissions={MANAGER} />,
    );
    expect(buttons()).toEqual(['Mark contacted', 'Close', 'Spam']);
  });
});

describe('EnquiryHandledBy', () => {
  const base = {
    status: 'CLOSED',
    contactedBy: { name: 'Priya Devi', atLabel: '01 Oct 2026, 16:42' },
    closedBy: { name: 'Arun Kumar', atLabel: '02 Oct 2026, 10:05' },
  } as DealerEnquiry;

  it('names who contacted and who closed, and when', () => {
    render(<EnquiryHandledBy enquiry={base} />);
    expect(screen.getByText('Contacted by Priya Devi · 01 Oct 2026, 16:42')).toBeInTheDocument();
    expect(screen.getByText('Closed by Arun Kumar · 02 Oct 2026, 10:05')).toBeInTheDocument();
  });

  it('says nothing about a close once the enquiry is reopened, or when nobody has acted', () => {
    render(<EnquiryHandledBy enquiry={{ ...base, status: 'CONTACTED' }} />);
    expect(screen.queryByText(/Closed by/)).toBeNull();

    const { container } = render(
      <EnquiryHandledBy enquiry={{ ...base, contactedBy: null, closedBy: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
