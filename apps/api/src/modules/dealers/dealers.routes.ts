import { Router } from 'express';

import type { DealersService } from './dealers.service.js';
import { deleteDocument } from './routes/delete-document.js';
import { deletePortfolioPhoto } from './routes/delete-portfolio-photo.js';
import { deleteProfileChange } from './routes/delete-profile-change.js';
import { getCompleteness } from './routes/get-completeness.js';
import { getDashboard } from './routes/get-dashboard.js';
import { getDocuments } from './routes/get-documents.js';
import { getPortfolio } from './routes/get-portfolio.js';
import { getProfile } from './routes/get-profile.js';
import { patchOnboarding } from './routes/patch-onboarding.js';
import { patchProfile } from './routes/patch-profile.js';
import { postDocumentCommit } from './routes/post-document-commit.js';
import { postDocumentPresign } from './routes/post-document-presign.js';
import { postPortfolioCommit } from './routes/post-portfolio-commit.js';
import { postPortfolioPresign } from './routes/post-portfolio-presign.js';
import { postSubmit } from './routes/post-submit.js';
import type { DealersRoute } from './routes/route.js';

const ROUTES: DealersRoute[] = [
  getProfile,
  patchProfile,
  deleteProfileChange,
  patchOnboarding,
  getCompleteness,
  postSubmit,
  getDocuments,
  postDocumentPresign,
  postDocumentCommit,
  deleteDocument,
  getPortfolio,
  postPortfolioPresign,
  postPortfolioCommit,
  deletePortfolioPhoto,
  getDashboard,
];

export function createDealersRouter(service: DealersService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
