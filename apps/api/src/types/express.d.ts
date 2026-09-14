import type { ValidatedData } from '../middleware/validate.js';
import type { Principal } from '../modules/auth/session.port.js';

declare global {
  namespace Express {
    interface Request {
      valid?: ValidatedData;

      principal?: Principal;
    }
  }
}

export {};
