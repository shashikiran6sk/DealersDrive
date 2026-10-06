import type { AdminMemberDto, AdminMembersResponse } from '@dealers-drive/contracts';

export interface AdminMembersProps {
  members: AdminMemberDto[];
  counts: AdminMembersResponse['counts'];
  status: 'ALL' | AdminMemberDto['status'];
}
