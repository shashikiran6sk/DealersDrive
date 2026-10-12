import { ConflictError, errorCode, isRecord } from '../../platform/errors.js';
import { withDealerEmailConflict } from './dealer-email-identity.js';

export async function withDealerRegistrationConflict<T>(
  work: () => Promise<T>,
  field = 'body.email',
): Promise<T> {
  try {
    return await withDealerEmailConflict(work, field);
  } catch (error) {
    const meta = isRecord(error) ? error.meta : undefined;
    if (errorCode(error) !== 'P2002' || !JSON.stringify(meta)?.toLowerCase().includes('gstin'))
      throw error;
    throw new ConflictError(
      'GSTIN_ALREADY_REGISTERED',
      'That GSTIN is already registered to another dealership.',
      {
        errors: [
          {
            field: 'body.gstin',
            code: 'GSTIN_ALREADY_REGISTERED',
            message: 'That GSTIN is already registered to another dealership.',
          },
        ],
      },
    );
  }
}
