import type { JsonSchema } from './schemas.js';

export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

export type Audience = 'public' | 'dealer' | 'admin' | 'internal';

export interface ResponseSpec {
  status: number;
  description: string;
  schema?: string;
  inlineSchema?: JsonSchema;
  example?: unknown;
  headers?: Record<string, { description: string; schema: JsonSchema }>;
  contentType?: string;
}

export interface OperationSpec {
  method: HttpMethod;
  path: string;
  operationId: string;
  tag: string;
  summary: string;
  description: string;
  audience: Audience;
  permission?: string;
  requiresActiveDealer?: boolean;
  params?: string;
  query?: string;
  inlineQuery?: { schema: JsonSchema; name: string };
  requestBody?: {
    schema: string;
    description?: string;
    required?: boolean;
    example?: unknown;
  };
  responses: ResponseSpec[];
  errors?: number[];
  rateLimit?: string;
  deprecated?: boolean;
}

export interface ModuleDocs {
  tag: string;
  description: string;
  operations: OperationSpec[];
}
