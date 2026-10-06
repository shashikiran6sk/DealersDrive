'use server';

import {
  ClaimDealerInput,
  ClaimTokenParam,
  type ClaimDealerResponse,
  type DealerClaimPreview,
} from '@dealers-drive/contracts';

import type { PhoneVerificationState } from '@/features/auth/phone-actions';
import { ApiError, apiSend } from '@/lib/api';
import { relaySessionCookie } from '@/lib/session-cookie';

import { CLAIM_ACTION_TEXT } from './claim-actions.constants';

export interface ClaimEmailResult {
  preview?: DealerClaimPreview;
  error?: string;
}

function tokenOf(token: string): string | null {
  const parsed = ClaimTokenParam.safeParse({ token });
  return parsed.success ? parsed.data.token : null;
}

export async function confirmClaimEmailAction(token: string): Promise<ClaimEmailResult> {
  const valid = tokenOf(token);
  if (!valid) return { error: CLAIM_ACTION_TEXT.verifyFailed };
  try {
    const preview = await apiSend<DealerClaimPreview>(
      'POST',
      `/v1/dealer-claims/${encodeURIComponent(valid)}/verify-email`,
    );
    return { preview };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.userMessage(CLAIM_ACTION_TEXT.verifyFailed) };
    }
    return { error: CLAIM_ACTION_TEXT.unavailable };
  }
}

export async function claimDealershipAction(
  token: string,
  phone: string,
  accessToken: string,
): Promise<PhoneVerificationState> {
  const valid = tokenOf(token);
  const parsed = ClaimDealerInput.safeParse({
    phone: phone.trim(),
    accessToken: accessToken.trim(),
  });
  if (!valid || !parsed.success) {
    return { error: parsed.error?.issues[0]?.message ?? CLAIM_ACTION_TEXT.claimFailed };
  }

  let setCookies: readonly string[] = [];
  try {
    const result = await apiSend<ClaimDealerResponse>(
      'POST',
      `/v1/dealer-claims/${encodeURIComponent(valid)}/claim`,
      parsed.data,
      {
        onSetCookie: (cookies) => {
          setCookies = cookies;
        },
      },
    );
    await relaySessionCookie(setCookies);
    return { verified: true, returnTo: result.returnTo };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.userMessage(CLAIM_ACTION_TEXT.claimFailed) };
    }
    return { error: CLAIM_ACTION_TEXT.unavailable };
  }
}
