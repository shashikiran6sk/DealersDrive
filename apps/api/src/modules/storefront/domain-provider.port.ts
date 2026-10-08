import type { StorefrontDnsRecord } from '@dealers-drive/contracts';
import type { z } from 'zod';

export interface DomainInspection {
  verified: boolean;
  configured: boolean;
  certificateReady: boolean;
  verification: z.infer<typeof StorefrontDnsRecord>[];
  routing: z.infer<typeof StorefrontDnsRecord> | null;
}
export interface DomainProvider {
  readonly configured: boolean;
  attach(hostname: string): Promise<void>;
  inspect(hostname: string): Promise<DomainInspection>;
  remove(hostname: string): Promise<void>;
  ownership(hostname: string, token: string): Promise<boolean>;
}
