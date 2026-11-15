import {
  IdParam,
  SubmittedPhotosDownloadInput,
  type IdParam as IdParamType,
  type SubmittedPhotosDownloadInput as SubmittedPhotosDownloadInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type DealerPhotosRoute } from './route.js';

export const postAdminSubmittedPhotosDownload: DealerPhotosRoute = (router, service) => {
  router.post(
    '/listings/:id/submitted-photos/download',
    requirePermission('admin:listing:moderate'),
    validate({ params: IdParam, body: SubmittedPhotosDownloadInput }),
    handle((req) =>
      service.adminDownload(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<SubmittedPhotosDownloadInputType>(req, 'body'),
      ),
    ),
  );
};
