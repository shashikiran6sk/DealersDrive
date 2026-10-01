import { SUPPORT_REQUESTS_PATH } from './support-requests.constants';

export function supportRequestsHref(cursor?: string): string {
  return cursor
    ? `${SUPPORT_REQUESTS_PATH}?${new URLSearchParams({ cursor }).toString()}`
    : SUPPORT_REQUESTS_PATH;
}

export function supportRequestHref(id: string): string {
  return `${SUPPORT_REQUESTS_PATH}/${id}`;
}
