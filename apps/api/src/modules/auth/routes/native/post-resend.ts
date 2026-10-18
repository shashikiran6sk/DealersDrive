import { NativeOtpChallengeInput } from '@dealers-drive/contracts';
import { validate, validated } from '../../../../middleware/validate.js';
import { nativeHandle, type NativeAuthRoute } from './route.js';

export const postNativeResend: NativeAuthRoute = (router, { service }) => {
  router.post(
    '/otp/resend',
    validate({ body: NativeOtpChallengeInput }),
    nativeHandle(async (req, res) => {
      res.json(
        await service.resend(validated<NativeOtpChallengeInput>(req, 'body').challenge, req.ip),
      );
    }),
  );
};
