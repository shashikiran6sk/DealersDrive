import type { ValidatedData } from '../middleware/validate.js';
import type { Principal } from '../modules/auth/session.port.js';

declare global {
  namespace Express {
    interface Request {
      /**
       * Values parsed by `validate()`. Populated per-source, so a route that
       * only declares a body schema leaves `query` and `params` undefined.
       * Read it through `validated<T>(req, 'body')`.
       */
      valid?: ValidatedData;

      /**
       * Who is making this request, resolved from the session by
       * `requireDealer` / `requireAdmin`. It is the only source of `dealerId`
       * in the entire API — a controller that reads one from the body, the
       * query or the path is a bug (CLAUDE.md rule 1).
       */
      principal?: Principal;
    }
  }
}

export {};
