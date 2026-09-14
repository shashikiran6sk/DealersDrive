import {
  ConfigKeyParam,
  UpdateConfigInput,
  type ConfigKeyParam as ConfigKeyParamType,
  type UpdateConfigInput as UpdateConfigInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

/**
 * D14 — the settings screen (**F072**).
 *
 * One key per write rather than a blob PATCH over the table. These values govern
 * money and moderation — the GST percentage, the listing duration, the reveal
 * caps — so "what did this admin change" should be a row in the audit log, not a
 * diff somebody has to compute.
 */
export const putConfigKey: AdminRoute = (router, service) => {
  router.put(
    '/config/:key',
    validate({ params: ConfigKeyParam, body: UpdateConfigInput }),
    handle((req) =>
      service.setConfig(
        adminPrincipal(req),
        validated<ConfigKeyParamType>(req, 'params').key,
        validated<UpdateConfigInputType>(req, 'body').value,
      ),
    ),
  );
};
