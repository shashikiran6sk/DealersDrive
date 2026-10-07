import type { AdminNotificationRow, AdminNotificationsResponse } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NotificationLog, logHref } from '@/features/admin/notification-log';

function row(overrides: Partial<AdminNotificationRow> = {}): AdminNotificationRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    template: 'admin.application.received',
    recipient: 'priya@dealers-drive.in',
    subject: 'New dealer application — Kaveri Auto Hub',
    status: 'SENT',
    statusLabel: 'Sent',
    statusTone: 'ok',
    attempts: 1,
    lastError: null,
    dealer: { id: '22222222-2222-4222-8222-222222222222', name: 'Kaveri Auto Hub' },
    createdAt: '2026-10-07T03:00:00.000Z',
    createdLabel: '07 Oct 2026, 08:30',
    sentAt: '2026-10-07T03:00:01.000Z',
    ...overrides,
  };
}

function response(overrides: Partial<AdminNotificationsResponse> = {}): AdminNotificationsResponse {
  return {
    data: [row()],
    page: { nextCursor: null, hasMore: false },
    counts: { ALL: 3, PENDING: 1, SENT: 1, FAILED: 1 },
    ...overrides,
  };
}

/** R115 — the operator's read of the delivery table. */
describe('NotificationLog', () => {
  it('lists each delivery with its recipient, template and outcome', () => {
    render(<NotificationLog deliveries={response()} filters={{}} />);
    expect(screen.getByText('priya@dealers-drive.in')).toBeInTheDocument();
    expect(screen.getByText('admin.application.received')).toBeInTheDocument();
    expect(screen.getByText('1 attempt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Failed 1/ })).toHaveAttribute(
      'href',
      '/admin/notifications?status=FAILED',
    );
  });

  it('shows why a delivery failed, and links to older pages keeping the filter', () => {
    render(
      <NotificationLog
        deliveries={response({
          data: [
            row({
              status: 'FAILED',
              statusLabel: 'Failed',
              statusTone: 'err',
              attempts: 6,
              lastError: 'Resend answered 503',
            }),
          ],
          page: { nextCursor: 'abc', hasMore: true },
        })}
        filters={{ status: 'FAILED', q: 'priya' }}
      />,
    );
    expect(screen.getByText('Resend answered 503')).toBeInTheDocument();
    expect(screen.getByText('6 attempts')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Older deliveries/ })).toHaveAttribute(
      'href',
      '/admin/notifications?status=FAILED&q=priya&cursor=abc',
    );
  });

  it('says so when nothing matches', () => {
    render(<NotificationLog deliveries={response({ data: [] })} filters={{ q: 'nobody' }} />);
    expect(screen.getByText('No deliveries')).toBeInTheDocument();
  });

  it('builds plain links', () => {
    expect(logHref({})).toBe('/admin/notifications');
    expect(logHref({ q: 'a b' })).toBe('/admin/notifications?q=a+b');
  });
});
