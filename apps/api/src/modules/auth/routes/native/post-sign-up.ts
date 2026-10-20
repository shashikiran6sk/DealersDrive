import { CustomerSignUpInput } from '@dealers-drive/contracts';
import { validate, validated } from '../../../../middleware/validate.js';
import { nativeHandle, type NativeAuthRoute } from './route.js';

export const postNativeSignUp: NativeAuthRoute = (router, { service }) => {
  router.post(
    '/sign-up',
    validate({ body: CustomerSignUpInput }),
    nativeHandle(async (req, res) => {
      res.status(201).json(
        await service.signUp(validated<CustomerSignUpInput>(req, 'body'), {
          ip: req.ip,
          userAgent: req.get('user-agent'),
        }),
      );
    }),
  );
};
