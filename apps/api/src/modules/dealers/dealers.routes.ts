import { Router } from 'express';

import type { DealersService } from './dealers.service.js';
import { deleteDocument } from './routes/delete-document.js';
import { deleteProfileChange } from './routes/delete-profile-change.js';
import { deleteYardPhoto } from './routes/delete-yard-photo.js';
import { getCompleteness } from './routes/get-completeness.js';
import { getDashboard } from './routes/get-dashboard.js';
import { getDocuments } from './routes/get-documents.js';
import { getProfile } from './routes/get-profile.js';
import { getYardPhoto } from './routes/get-yard-photo.js';
import { patchOnboarding } from './routes/patch-onboarding.js';
import { patchProfile } from './routes/patch-profile.js';
import { postDocumentCommit } from './routes/post-document-commit.js';
import { postDocumentPresign } from './routes/post-document-presign.js';
import { postSubmit } from './routes/post-submit.js';
import { postYardPhotoCommit } from './routes/post-yard-photo-commit.js';
import { postYardPhotoPresign } from './routes/post-yard-photo-presign.js';
import type { DealersRoute } from './routes/route.js';

/**
 * C1–C5 and C18. Mounted under `/v1/dealer`.
 *
 * The line this router draws is between *reading* your dealership and *changing*
 * it. Reads are open to any seat that got through `requireDealer` — a
 * salesperson can see the dashboard. Writes are OWNER-only, because the profile
 * and the KYC documents are the dealership's identity.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * F040 mounted the document checklist, F041 five more, F043 the completeness
 * read, **F042 the submit** and **F048 `GET /dashboard`**, which closes the
 * module. Every route the baseline declares here is now mounted.
 * ────────────────────────────────────────────────────────────────────────────
 */
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
  getYardPhoto,
  postYardPhotoPresign,
  postYardPhotoCommit,
  deleteYardPhoto,
  getDashboard,
];

export function createDealersRouter(service: DealersService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
