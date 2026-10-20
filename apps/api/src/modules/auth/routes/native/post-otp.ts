import { NativeOtpRequestInput } from '@dealers-drive/contracts';
import { validate, validated } from '../../../../middleware/validate.js';
import { nativeHandle, type NativeAuthRoute } from './route.js';

export const postNativeOtp: NativeAuthRoute = (router, { service }) => {
  router.post(
    '/otp',
    validate({ body: NativeOtpRequestInput }),
    nativeHandle(async (req, res) => {
      const body = validated<NativeOtpRequestInput>(req, 'body');
      res.json(await service.request(body.phone, req.ip));
    }),
  );
};
