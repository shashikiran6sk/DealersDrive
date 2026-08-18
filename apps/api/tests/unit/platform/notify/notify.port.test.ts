import { describe, expect, it, vi } from 'vitest';

import {
  createConsoleMailer,
  createConsoleSms,
  type MailMessage,
  type SmsMessage,
} from '../../../../src/platform/notify/notify.port.js';
import { logger } from '../../../../src/platform/telemetry/logger.js';

/**
 * Unit tests for `src/platform/notify/notify.port.ts`.
 *
 * These adapters are mocked for this build (CLAUDE.md §8) — they print what would
 * have been sent, which is enough to prove the outbox actually fires. So the
 * thing worth pinning is the *port shape*: `ResendMailer` and `Msg91Sms` have to
 * slot in here without touching a caller, which means `send` must stay a single
 * async method that resolves rather than returning a provider response.
 */
describe('createConsoleMailer', () => {
  const message: MailMessage = {
    to: 'owner@sri-lakshmi-motors.in',
    subject: 'Your listing is live',
    body: 'The 2021 Alto 800 is now visible to buyers in Vellore.',
  };

  it('resolves, so a caller can await it like a real provider', async () => {
    await expect(createConsoleMailer().send(message)).resolves.toBeUndefined();
  });

  it('logs the recipient and subject as structured fields, and the body as the message', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await createConsoleMailer().send(message);

    expect(info).toHaveBeenCalledWith(
      { channel: 'email', to: message.to, subject: message.subject },
      message.body,
    );
    info.mockRestore();
  });

  it('tags the channel, so email and SMS are separable in a log search', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await createConsoleMailer().send(message);

    expect(info.mock.calls[0]?.[0]).toMatchObject({ channel: 'email' });
    info.mockRestore();
  });

  it('exposes exactly the port’s surface — one method', () => {
    // A console adapter that grew a `sendBatch` would make the port a lie: the
    // Resend adapter has to be a drop-in replacement.
    expect(Object.keys(createConsoleMailer())).toEqual(['send']);
  });

  it('returns an independent adapter per call', () => {
    expect(createConsoleMailer()).not.toBe(createConsoleMailer());
  });
});

describe('createConsoleSms', () => {
  const message: SmsMessage = {
    to: '+919840012345',
    body: 'Sri Lakshmi Motors: 98400 12345. Reply STOP to opt out.',
  };

  it('resolves', async () => {
    await expect(createConsoleSms().send(message)).resolves.toBeUndefined();
  });

  it('logs the recipient and the body, tagged as sms', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await createConsoleSms().send(message);

    expect(info).toHaveBeenCalledWith({ channel: 'sms', to: message.to }, message.body);
    info.mockRestore();
  });

  it('has no subject in its port, because SMS has no subject', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await createConsoleSms().send(message);

    expect(info.mock.calls[0]?.[0]).not.toHaveProperty('subject');
    info.mockRestore();
  });

  it('exposes exactly one method', () => {
    expect(Object.keys(createConsoleSms())).toEqual(['send']);
  });
});
