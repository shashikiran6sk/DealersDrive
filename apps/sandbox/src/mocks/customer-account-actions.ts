export interface CustomerAccount {
  fullName: string;
  phoneMasked: string;
}

export const customerAccountStub: { delayMs: number; account: CustomerAccount | null } = {
  delayMs: 300,
  account: null,
};

export async function customerAccountAction(): Promise<CustomerAccount | null> {
  await new Promise((resolve) => setTimeout(resolve, customerAccountStub.delayMs));
  return customerAccountStub.account;
}

export async function customerLogoutAction(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, customerAccountStub.delayMs));
  customerAccountStub.account = null;
}
