import {
  IdParam,
  type DealerPermission,
  type IdParam as IdParamType,
} from '@dealers-drive/contracts';

import { requireDealerActive, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import type { DirectLifecycleAction } from '../vehicles.service.js';

import { actorOf } from './actor.js';
import { handle, type VehiclesRoute } from './route.js';

export function lifecycleRoute(
  path: string,
  action: Exclude<DirectLifecycleAction, 'withdraw'>,
  permission: DealerPermission,
): VehiclesRoute {
  return (router, service) => {
    router.post(
      `/vehicles/:id/${path}`,
      requirePermission(permission),
      requireDealerActive,
      validate({ params: IdParam }),
      handle((req) =>
        service.lifecycle(actorOf(req), validated<IdParamType>(req, 'params').id, action),
      ),
    );
  };
}
