import { NativeOtpVerifyInput } from '@dealers-drive/contracts';
import { validate, validated } from '../../../../middleware/validate.js';
import { nativeHandle, type NativeAuthRoute } from './route.js';

export const postNativeVerify: NativeAuthRoute = (router, { service }) => {
  router.post(
    '/otp/verify',
    validate({ body: NativeOtpVerifyInput }),
    nativeHandle(async (req, res) => {
      const body = validated<NativeOtpVerifyInput>(req, 'body');
      res.json(
        await service.verify(body.challenge, body.otp, {
          ip: req.ip,
          userAgent: req.get('user-agent'),
        }),
      );
    }),
  );
};
