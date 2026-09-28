import {
  IdParam,
  type IdParam as IdParamType,
  type ListingLifecycleAction,
} from '@dealers-drive/contracts';

import { requireDealerActive, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { actorOf } from './actor.js';
import { handle, type VehiclesRoute } from './route.js';

export function lifecycleRoute(
  path: string,
  action: Exclude<ListingLifecycleAction, 'withdraw'>,
): VehiclesRoute {
  return (router, service) => {
    router.post(
      `/vehicles/:id/${path}`,
      requirePermission('listing:submit'),
      requireDealerActive,
      validate({ params: IdParam }),
      handle((req) =>
        service.lifecycle(actorOf(req), validated<IdParamType>(req, 'params').id, action),
      ),
    );
  };
}
