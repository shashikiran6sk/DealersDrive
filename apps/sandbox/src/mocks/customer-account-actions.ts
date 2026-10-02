export interface AccountWorkspace {
  membershipId: string;
  brandName: string;
  roleLabel: string;
  enterable: boolean;
  current: boolean;
}

export interface CustomerAccount {
  fullName: string;
  phoneMasked: string;
  workspaces?: AccountWorkspace[];
}

export const customerAccountStub: { delayMs: number; account: CustomerAccount | null } = {
  delayMs: 300,
  account: null,
};

export async function customerAccountAction(): Promise<CustomerAccount | null> {
  await new Promise((resolve) => setTimeout(resolve, customerAccountStub.delayMs));
  return customerAccountStub.account;
}

export async function enterWorkspaceAction(membershipId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, customerAccountStub.delayMs));
  const workspaces = customerAccountStub.account?.workspaces ?? [];
  for (const workspace of workspaces) workspace.current = workspace.membershipId === membershipId;
}

export async function customerLogoutAction(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, customerAccountStub.delayMs));
  customerAccountStub.account = null;
}
