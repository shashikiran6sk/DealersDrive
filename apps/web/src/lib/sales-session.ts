import 'server-only';

import type { SalesDashboard } from '@dealers-drive/contracts';
import { redirect } from 'next/navigation';

import { ApiError, apiGet } from './api';

export const SALES_WORKSPACE_FORBIDDEN = 'SALES_WORKSPACE_FORBIDDEN';

export async function requireSalesMember(): Promise<SalesDashboard> {
  try {
    return await apiGet<SalesDashboard>('/v1/sales/dashboard', { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect('/admin/login?error=session_expired');
    }
    if (error instanceof ApiError && error.code === SALES_WORKSPACE_FORBIDDEN) redirect('/admin');
    throw error;
  }
}
