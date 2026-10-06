import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import { deleteDealerDocument } from './routes/delete-dealer-document.js';
import { deleteDealerYardPhoto } from './routes/delete-dealer-yard-photo.js';
import { getDashboard } from './routes/get-dashboard.js';
import { getDealer } from './routes/get-dealer.js';
import { getDealers } from './routes/get-dealers.js';
import { getPhoneWidget } from './routes/get-phone-widget.js';
import { patchDealer } from './routes/patch-dealer.js';
import { postDealerDocumentCommit } from './routes/post-dealer-document-commit.js';
import { postDealerDocumentPresign } from './routes/post-dealer-document-presign.js';
import { postDealerEmailVerification } from './routes/post-dealer-email-verification.js';
import { postDealerSubmit } from './routes/post-dealer-submit.js';
import { postDealerYardPhotoCommit } from './routes/post-dealer-yard-photo-commit.js';
import { postDealerYardPhotoPresign } from './routes/post-dealer-yard-photo-presign.js';
import { postDealer } from './routes/post-dealer.js';
import { postPhoneVerify } from './routes/post-phone-verify.js';
import type { SalesRoute } from './routes/route.js';
import type { SalesService } from './sales.service.js';

const ROUTES: SalesRoute[] = [
  getDashboard,
  getPhoneWidget,
  postPhoneVerify,
  getDealers,
  postDealer,
  getDealer,
  patchDealer,
  postDealerEmailVerification,
  postDealerDocumentPresign,
  postDealerDocumentCommit,
  deleteDealerDocument,
  postDealerYardPhotoPresign,
  postDealerYardPhotoCommit,
  deleteDealerYardPhoto,
  postDealerSubmit,
];

export function createSalesRouter(service: SalesService, rateLimit: RateLimiter): Router {
  const router = Router();
  for (const route of ROUTES) route(router, { service, rateLimit });
  return router;
}
