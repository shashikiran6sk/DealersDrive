import { z } from 'zod';

import type { Env } from '../../config/env.js';
import {
  ConfigurationError,
  ConflictError,
  UpstreamUnavailableError,
  DomainError,
  errorCode,
} from '../../platform/errors.js';
import { certificateReady, domainOwnership } from './domain-network.js';
import type { DomainProvider } from './domain-provider.port.js';

const ProjectDomain = z.object({
  apexName: z.string().optional(),
  name: z.string(),
  projectId: z.string(),
  verified: z.boolean(),
  verification: z
    .array(z.object({ type: z.string(), domain: z.string(), value: z.string() }))
    .optional(),
});
const DomainConfig = z.object({
  misconfigured: z.boolean(),
  recommendedCNAME: z.array(z.object({ rank: z.number(), value: z.string() })),
  recommendedIPv4: z.array(z.object({ rank: z.number(), value: z.array(z.string()) })),
});

export function createVercelDomainProvider(
  config: Pick<
    Env,
    | 'STOREFRONT_DOMAIN_PROVIDER'
    | 'STOREFRONT_VERCEL_TOKEN'
    | 'STOREFRONT_VERCEL_PROJECT_ID'
    | 'STOREFRONT_VERCEL_TEAM_ID'
  >,
  transport: typeof fetch = fetch,
  tlsReady: (hostname: string) => Promise<boolean> = certificateReady,
  ownership = domainOwnership,
): DomainProvider {
  const configured =
    config.STOREFRONT_DOMAIN_PROVIDER === 'vercel' &&
    Boolean(
      config.STOREFRONT_VERCEL_TOKEN &&
      config.STOREFRONT_VERCEL_PROJECT_ID &&
      config.STOREFRONT_VERCEL_TEAM_ID,
    );
  const project = encodeURIComponent(config.STOREFRONT_VERCEL_PROJECT_ID ?? '');
  async function request(
    method: string,
    path: string,
    body?: unknown,
    missing = false,
  ): Promise<unknown> {
    if (!configured) throw new ConfigurationError('Custom-domain provider is not configured.');
    const url = new URL(path, 'https://api.vercel.com');
    url.searchParams.set('teamId', config.STOREFRONT_VERCEL_TEAM_ID!);
    let response: Response;
    try {
      response = await transport(url, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(2000),
        headers: {
          Authorization: `Bearer ${config.STOREFRONT_VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new UpstreamUnavailableError('The domain provider is unavailable. Retry shortly.');
    }
    if (response.status === 404 && missing) return null;
    if (response.status === 400 && path.endsWith('/verify'))
      throw new DomainError(
        'DOMAIN_VERIFICATION_PENDING',
        'Provider ownership verification is pending.',
      );
    if (response.status === 409 || response.status === 400)
      throw new ConflictError(
        'DOMAIN_PROVIDER_CONFLICT',
        'The provider could not accept this domain. It may already be assigned to a deployment.',
      );
    if (!response.ok)
      throw new UpstreamUnavailableError(
        'The domain provider could not complete this request. Retry shortly.',
      );
    if (response.status === 204) return null;
    try {
      return await response.json();
    } catch {
      throw new UpstreamUnavailableError('The domain provider returned an invalid response.');
    }
  }
  const path = (hostname: string) =>
    `/v9/projects/${project}/domains/${encodeURIComponent(hostname)}`;
  return {
    configured,
    ownership,
    async attach(hostname) {
      const existing = await request('GET', path(hostname), undefined, true);
      if (existing)
        throw new ConflictError(
          'DOMAIN_EXISTING_DEPLOYMENT',
          'This domain is already attached to a deployment. Contact support; it will not be transferred automatically.',
        );
      const added = ProjectDomain.parse(
        await request('POST', `/v10/projects/${project}/domains`, { name: hostname }),
      );
      if (added.name !== hostname || added.projectId !== config.STOREFRONT_VERCEL_PROJECT_ID)
        throw new UpstreamUnavailableError(
          'The domain provider returned a different project or hostname.',
        );
    },
    async inspect(hostname) {
      let domain = ProjectDomain.parse(await request('GET', path(hostname)));
      if (domain.name !== hostname || domain.projectId !== config.STOREFRONT_VERCEL_PROJECT_ID)
        throw new ConflictError(
          'DOMAIN_PROVIDER_CONFLICT',
          'This domain is not attached to the configured storefront project.',
        );
      if (!domain.verified) {
        try {
          domain = ProjectDomain.parse(await request('POST', `${path(hostname)}/verify`));
        } catch (error) {
          if (errorCode(error) !== 'DOMAIN_VERIFICATION_PENDING') throw error;
        }
      }
      if (domain.name !== hostname || domain.projectId !== config.STOREFRONT_VERCEL_PROJECT_ID)
        throw new ConflictError(
          'DOMAIN_PROVIDER_CONFLICT',
          'The provider verification returned a different project or hostname.',
        );
      const settings = DomainConfig.parse(
        await request(
          'GET',
          `/v6/domains/${encodeURIComponent(hostname)}/config?projectIdOrName=${project}`,
        ),
      );
      const cname = [...settings.recommendedCNAME].sort((a, b) => a.rank - b.rank)[0]?.value;
      const address = [...settings.recommendedIPv4].sort((a, b) => a.rank - b.rank)[0]?.value[0];
      const routing =
        domain.apexName === hostname && address
          ? { type: 'A' as const, name: hostname, value: address }
          : cname
            ? { type: 'CNAME' as const, name: hostname, value: cname }
            : address
              ? { type: 'A' as const, name: hostname, value: address }
              : null;
      return {
        verified: domain.verified,
        configured: !settings.misconfigured,
        certificateReady: domain.verified && !settings.misconfigured && (await tlsReady(hostname)),
        verification: (domain.verification ?? [])
          .filter((record) => record.type === 'TXT')
          .map((record) => ({ type: 'TXT' as const, name: record.domain, value: record.value })),
        routing,
      };
    },
    async remove(hostname) {
      await request('DELETE', path(hostname), undefined, true);
    },
  };
}
