# api / platform/audit

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/audit/audit.service.ts`

### `export interface AuditEntry`

Every admin write, and every cross-tenant read of private data, lands here
with the actor's identity (ARCHITECTURE §7 layer 4, §21).

### `record(tx: Tx, entry: AuditEntry): Promise<void>`

Inside a transaction, so the record cannot outlive a rolled-back write.

### `recordDetached(entry: AuditEntry): Promise<void>`

Outside one, for reads — an audit row for a read has nothing to roll back with.

### `logger.error({ err: error, action: entry.action }, 'audit write failed')`

Never fail a request because the audit write failed; alert instead.
