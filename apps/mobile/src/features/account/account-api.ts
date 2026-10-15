import {
  CustomerAccountStatus,
  CustomerDeactivationReceipt,
} from '@dealers-drive/contracts/customer-account';
import { createApiClient } from '../../services/api';
import { publicEnvironment } from '../../services/environment';

export function createAccountApi(
  client = createApiClient({ baseUrl: publicEnvironment().apiBaseUrl }),
) {
  return {
    status: (token: string, signal?: AbortSignal) =>
      client.customer('/v1/auth/customer/account', CustomerAccountStatus, token, {}, signal),
    deactivate: (token: string) =>
      client.customer('/v1/auth/customer/account/deactivate', CustomerDeactivationReceipt, token, {
        method: 'POST',
        body: { confirmed: true },
      }),
  };
}
export const accountApi = createAccountApi();
