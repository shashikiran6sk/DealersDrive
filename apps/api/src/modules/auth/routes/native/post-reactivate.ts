import { CustomerReactivationInput } from '@dealers-drive/contracts';
import { validate, validated } from '../../../../middleware/validate.js';
import { nativeHandle, type NativeAuthRoute } from './route.js';

export const postNativeReactivate: NativeAuthRoute = (router, { service }) => {
  router.post(
    '/reactivate',
    validate({ body: CustomerReactivationInput }),
    nativeHandle(async (req, res) => {
      res.json(
        await service.reactivate(validated<CustomerReactivationInput>(req, 'body'), {
          ip: req.ip,
          userAgent: req.get('user-agent'),
        }),
      );
    }),
  );
};
