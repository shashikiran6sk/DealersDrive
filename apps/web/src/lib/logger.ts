export type LogLevel = 'info' | 'warn' | 'error';

export type LogFields = Readonly<Record<string, unknown>>;

const ERROR_FIELDS = ['status', 'code', 'kind', 'digest', 'traceId'] as const;
const LOG_FIELDS = new Set([
  'method',
  'path',
  'route',
  'slug',
  'status',
  'code',
  'kind',
  'digest',
  'traceId',
  'error',
]);

function fieldOf(error: Error, key: (typeof ERROR_FIELDS)[number]): unknown {
  return key in error ? Reflect.get(error, key) : undefined;
}

export function describeError(
  error: unknown,
  seen = new WeakSet<Error>(),
): Record<string, unknown> {
  if (!(error instanceof Error)) return { name: 'NonError', type: typeof error };
  if (seen.has(error)) return { name: error.name, circular: true };
  seen.add(error);
  const described: Record<string, unknown> = {
    name: error.name,
  };
  for (const key of ERROR_FIELDS) {
    const value = fieldOf(error, key);
    if (typeof value === 'string' || typeof value === 'number') described[key] = value;
  }
  if (error.cause !== undefined) described.cause = describeError(error.cause, seen);
  return described;
}

function serialise(fields: LogFields): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key]) => LOG_FIELDS.has(key))
      .map(([key, value]) => {
        if (key === 'error') return [key, describeError(value)];
        if ((key === 'path' || key === 'route') && typeof value === 'string') {
          return [key, value.startsWith('/') ? value.split(/[?#]/, 1)[0] : '[redacted-path]'];
        }
        return [key, value];
      }),
  );
}

function write(level: LogLevel, event: string, fields: LogFields): void {
  if (typeof process === 'undefined' || typeof process.stderr?.write !== 'function') return;
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    event,
    ...serialise(fields),
  });
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

export const logger = {
  info: (event: string, fields: LogFields = {}): void => {
    write('info', event, fields);
  },
  warn: (event: string, fields: LogFields = {}): void => {
    write('warn', event, fields);
  },
  error: (event: string, fields: LogFields = {}): void => {
    write('error', event, fields);
  },
};
