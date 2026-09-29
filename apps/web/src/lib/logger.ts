export type LogLevel = 'info' | 'warn' | 'error';

export type LogFields = Readonly<Record<string, unknown>>;

const ERROR_FIELDS = ['status', 'code', 'kind', 'digest', 'traceId'] as const;

function fieldOf(error: Error, key: (typeof ERROR_FIELDS)[number]): unknown {
  return key in error ? Reflect.get(error, key) : undefined;
}

export function describeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { value: String(error) };
  const described: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  for (const key of ERROR_FIELDS) {
    const value = fieldOf(error, key);
    if (value !== undefined) described[key] = value;
  }
  if (error.cause !== undefined) described.cause = describeError(error.cause);
  return described;
}

function serialise(fields: LogFields): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value instanceof Error ? describeError(value) : value,
    ]),
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
