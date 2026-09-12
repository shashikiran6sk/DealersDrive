export interface MailDeliverabilityConfig {
  MAIL_DRIVER: 'console' | 'smtp' | 'resend';
  MAIL_FROM: string;
  WEB_BASE_URL: string;
}

export interface MailDeliverabilityIssue {
  code: 'resend_test_domain' | 'non_public_link_base';
  message: string;
  senderDomain: string | null;
  linkHost: string | null;
}

/**
 * Safe, configuration-only checks that can run at process startup.
 *
 * They deliberately do not make a network request or claim to measure inbox
 * placement. Their job is to catch the two concrete mistakes visible in the
 * incident email before another real message is sent with them.
 */
export function mailDeliverabilityIssues(
  config: MailDeliverabilityConfig,
): MailDeliverabilityIssue[] {
  if (config.MAIL_DRIVER !== 'resend') return [];

  const senderDomain = mailboxDomain(config.MAIL_FROM);
  const link = safeUrl(config.WEB_BASE_URL);
  const linkHost = link?.hostname ?? null;
  const issues: MailDeliverabilityIssue[] = [];

  if (senderDomain === 'resend.dev') {
    issues.push({
      code: 'resend_test_domain',
      message:
        'MAIL_FROM uses Resend’s shared test domain. Verify a domain and send from that domain before evaluating inbox placement.',
      senderDomain,
      linkHost,
    });
  }

  if (!link || link.protocol !== 'https:' || isLocalHost(link.hostname)) {
    issues.push({
      code: 'non_public_link_base',
      message:
        'WEB_BASE_URL is not a public HTTPS origin, so transactional email links can look unsafe or be unusable to recipients.',
      senderDomain,
      linkHost,
    });
  }

  return issues;
}

export function mailboxAddress(value: string): string | null {
  const bracketed = value.match(/<([^<>]+)>\s*$/)?.[1];
  const candidate = (bracketed ?? value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(candidate) ? candidate : null;
}

function mailboxDomain(value: string): string | null {
  return mailboxAddress(value)?.split('@')[1] ?? null;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}
