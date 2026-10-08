import 'server-only';
import { LegalStatus, LegalHistory } from '@dealers-drive/contracts';
import { ApiError, apiGetParsed } from '@/lib/api';
export async function legalAccount() {
  for (const audience of ['dealer', 'account', 'customer'] as const) {
    const base = `/v1/legal/${audience}`;
    try {
      const status = await apiGetParsed(LegalStatus, `${base}/status`, { revalidate: false });
      const history = status.enabled
        ? await apiGetParsed(LegalHistory, `${base}/history`, { revalidate: false })
        : { data: [] };
      return { base, status, history };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) continue;
      throw error;
    }
  }
  return null;
}
