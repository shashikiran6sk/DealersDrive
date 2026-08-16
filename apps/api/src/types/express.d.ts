import type { ValidatedData } from '../middleware/validate.js';

declare global {
  namespace Express {
    interface Request {
      /**
       * Values parsed by `validate()`. Populated per-source, so a route that
       * only declares a body schema leaves `query` and `params` undefined.
       * Read it through `validated<T>(req, 'body')`.
       */
      valid?: ValidatedData;
    }
  }
}

export {};
