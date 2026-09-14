import {
  ConfigKeyParam,
  UpdateConfigInput,
  type ConfigKeyParam as ConfigKeyParamType,
  type UpdateConfigInput as UpdateConfigInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

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
