import type { JsonSchema } from './schemas.js';

/**
 * The vocabulary each module's `*.docs.ts` file writes in.
 *
 * Deliberately small. Everything that can be derived — parameter lists from the
 * params/query schema, the error bodies, the security requirement from the
 * mount point — is derived by the builder rather than repeated per operation,
 * because 73 hand-maintained copies of the same 401 block is how a reference
 * starts disagreeing with itself.
 */

export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

/**
 * Which guard chain the route is mounted behind (`src/routes.ts`).
 *
 *   public   `/v1/…`           no principal is resolved
 *   dealer   `/v1/dealer/…`    `requireDealer`
 *   admin    `/v1/admin/…`     `requireAdmin`
 *   internal `/health`, `/uploads`, `/media` — infrastructure, not API surface
 */
export type Audience = 'public' | 'dealer' | 'admin' | 'internal';

export interface ResponseSpec {
  status: number;
  description: string;
  /** A contracts export name. Omit for 204 and for non-JSON responses. */
  schema?: string;
  /** An inline schema, for the two handlers whose shape is not in contracts. */
  inlineSchema?: JsonSchema;
  example?: unknown;
  headers?: Record<string, { description: string; schema: JsonSchema }>;
  /** Overrides `application/json` — used by the media and PDF routes. */
  contentType?: string;
}

export interface OperationSpec {
  method: HttpMethod;
  /** The Express path, mount included: `/v1/dealer/vehicles/:id`. */
  path: string;
  operationId: string;
  tag: string;
  summary: string;
  description: string;
  audience: Audience;
  /**
   * The §8.3 permission `requirePermission` checks. Rendered into the
   * description, and the reason a 403 is documented on this operation.
   */
  permission?: string;
  /** True when `requireDealerActive` also runs (publishing paths). */
  requiresActiveDealer?: boolean;
  /** Contracts export name for the path parameters. */
  params?: string;
  /** Contracts export name for the query string. */
  query?: string;
  /** Inline query parameters, for the storage route whose schema is local. */
  inlineQuery?: { schema: JsonSchema; name: string };
  requestBody?: {
    schema: string;
    description?: string;
    /** Every documented body is required unless it says otherwise. */
    required?: boolean;
    example?: unknown;
  };
  responses: ResponseSpec[];
  /** Extra error statuses beyond the ones the builder infers. */
  errors?: number[];
  /** Rendered as a note; the limits live in the route's `rateLimit()` call. */
  rateLimit?: string;
  deprecated?: boolean;
}

/** A module's contribution to the document. */
export interface ModuleDocs {
  tag: string;
  description: string;
  operations: OperationSpec[];
}
