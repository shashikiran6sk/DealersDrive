import { z } from 'zod';
import {
  LegalPublication,
  NativeCustomerSession,
  NativeCustomerSignIn,
  NativeCustomerSignUp,
  NativeOtpChallenge,
  type NativeCustomerSignUpInput,
} from '@dealers-drive/contracts/native-auth';

import { createApiClient } from '../../services/api';
import { publicEnvironment } from '../../services/environment';

export function createAuthApi(
  client = createApiClient({ baseUrl: publicEnvironment().apiBaseUrl }),
  authClient = createApiClient({ baseUrl: publicEnvironment().apiBaseUrl, timeoutMs: 12000 }),
) {
  return {
    publication: (signal?: AbortSignal) =>
      client.get('/v1/legal/publication', LegalPublication, signal),
    request: (phone: string, signal?: AbortSignal) =>
      authClient.postAuth('/v1/auth/native/customer/otp', { phone }, NativeOtpChallenge, signal),
    resend: (challenge: string, signal?: AbortSignal) =>
      authClient.postAuth(
        '/v1/auth/native/customer/otp/resend',
        { challenge },
        NativeOtpChallenge,
        signal,
      ),
    verify: (challenge: string, otp: string, signal?: AbortSignal) =>
      authClient.postAuth(
        '/v1/auth/native/customer/otp/verify',
        { challenge, otp },
        NativeCustomerSignIn,
        signal,
      ),
    signUp: (body: NativeCustomerSignUpInput, signal?: AbortSignal) =>
      authClient.postAuth('/v1/auth/native/customer/sign-up', body, NativeCustomerSignUp, signal),
    me: (token: string, signal?: AbortSignal) =>
      client.customer('/v1/auth/native/customer/me', NativeCustomerSession, token, {}, signal),
    logout: (token: string) =>
      client.customer('/v1/auth/native/customer/logout', z.undefined(), token, { method: 'POST' }),
  };
}
export type AuthApi = ReturnType<typeof createAuthApi>;
