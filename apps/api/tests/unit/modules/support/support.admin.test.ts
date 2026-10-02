import { describe, expect, it } from 'vitest';

import {
  personLabel,
  supportHistoryOf,
  toAssignee,
  type Person,
} from '../../../../src/modules/support/support.admin.mapper.js';
import {
  statusAction,
  supportSearch,
  supportWindow,
} from '../../../../src/modules/support/support.admin.service.js';

/** R91 — the pure halves of the support workspace. */
const AT = new Date('2026-09-30T09:02:00.000Z');
const OPERATOR: Person = { id: 'a', fullName: '  ', email: 'ops@dealers-drive.test' };

describe('personLabel', () => {
  it('prefers a name, then the email, then says the person is gone', () => {
    expect(personLabel({ id: 'x', fullName: 'Priya', email: 'p@x.test' })).toBe('Priya');
    expect(personLabel(OPERATOR)).toBe('ops@dealers-drive.test');
    expect(personLabel({ id: 'x', fullName: null, email: null })).toBe('a former admin');
    expect(personLabel(null)).toBe('a former admin');
    expect(toAssignee({ id: 'x', fullName: 'Priya', email: null })).toEqual({
      id: 'x',
      label: 'Priya',
      email: '',
    });
  });
});

describe('supportHistoryOf', () => {
  const people = new Map([['a', OPERATOR]]);

  it('names the operator, and describes each kind of change', () => {
    const history = supportHistoryOf(
      [
        {
          action: 'support_ticket.priority_changed',
          actorType: 'ADMIN',
          actorId: 'a',
          before: { priority: 'LOW' },
          after: { priority: 'URGENT' },
          createdAt: AT,
        },
        {
          action: 'support_ticket.assigned',
          actorType: 'ADMIN',
          actorId: 'gone',
          before: {},
          after: { assignedAdminId: 'gone' },
          createdAt: AT,
        },
        {
          action: 'support_ticket.assigned',
          actorType: 'ADMIN',
          actorId: null,
          before: {},
          after: { assignedAdminId: null },
          createdAt: AT,
        },
        {
          action: 'support_ticket.status_changed',
          actorType: 'ROBOT',
          actorId: null,
          before: { status: 'NOPE' },
          after: ['x'],
          createdAt: AT,
        },
        {
          action: 'support_ticket.archived',
          actorType: 'SYSTEM',
          actorId: null,
          before: null,
          after: null,
          createdAt: AT,
        },
      ],
      people,
    );
    expect(history.map((entry) => [entry.label, entry.detail, entry.actor])).toEqual([
      ['Priority changed', 'Low → Urgent', 'Dealers-Drive · ops@dealers-drive.test'],
      ['Assigned', 'to a former admin', 'Dealers-Drive'],
      ['Assigned', 'to a former admin', 'Dealers-Drive'],
      ['Status changed', null, 'ROBOT'],
      ['support_ticket.archived', null, 'System'],
    ]);
    expect(history[0]?.atLabel).toBe('30 Sep 2026, 14:32');
  });

  it('describes a priority it does not recognise as no detail', () => {
    const [entry] = supportHistoryOf(
      [
        {
          action: 'support_ticket.priority_changed',
          actorType: 'ADMIN',
          actorId: 'a',
          before: { priority: 'X' },
          after: { priority: 'HIGH' },
          createdAt: AT,
        },
      ],
      people,
    );
    expect(entry?.detail).toBeNull();
  });
});

describe('statusAction', () => {
  it.each([
    ['OPEN', 'RESOLVED', 'support_ticket.resolved'],
    ['RESOLVED', 'CLOSED', 'support_ticket.closed'],
    ['RESOLVED', 'OPEN', 'support_ticket.reopened'],
    ['OPEN', 'IN_PROGRESS', 'support_ticket.status_changed'],
  ] as const)('%s → %s is %s', (from, to, action) => {
    expect(statusAction(from, to)).toBe(action);
  });
});

describe('supportSearch', () => {
  it('is nothing for a blank term', () => {
    expect(supportSearch(undefined)).toBeNull();
    expect(supportSearch('  ')).toBeNull();
  });

  it('reads a reference in any of its spellings', () => {
    for (const term of ['DD-1042', 'dd 1042', 'DD1042', '1042']) {
      expect(JSON.stringify(supportSearch(term))).toContain('"number":1042');
    }
    expect(JSON.stringify(supportSearch('Meera'))).not.toContain('"number"');
  });

  it('adds the phone from three digits and the plate only when there is one', () => {
    expect(JSON.stringify(supportSearch('98'))).not.toContain('"phone"');
    expect(JSON.stringify(supportSearch('98400'))).toContain('"phone"');
    expect(JSON.stringify(supportSearch('—'))).not.toContain('registrationNumber');
  });
});

describe('supportWindow', () => {
  it('is nothing without dates, and IST days otherwise', () => {
    expect(supportWindow(undefined, undefined)).toBeNull();
    expect(supportWindow('2026-09-30', undefined)).toEqual({
      createdAt: { gte: new Date('2026-09-29T18:30:00.000Z') },
    });
    expect(supportWindow(undefined, '2026-09-30')).toEqual({
      createdAt: { lt: new Date('2026-09-30T18:30:00.000Z') },
    });
  });
});
