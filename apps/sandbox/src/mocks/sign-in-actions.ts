export interface DealerSignInState {
  returnTo?: string;
  error?: string;
}

export interface CustomerSignInState {
  status?: 'SIGNED_IN' | 'NAME_REQUIRED';
  fullName?: string;
  phoneDisplay?: string;
  error?: string;
}

export interface CustomerSignUpState {
  done?: boolean;
  error?: string;
  fieldError?: string;
}

export const signInActionStub: {
  delayMs: number;
  customer: CustomerSignInState;
  signUp: CustomerSignUpState;
  dealer: DealerSignInState;
} = {
  delayMs: 600,
  customer: { status: 'NAME_REQUIRED', phoneDisplay: '+91 98400 12345' },
  signUp: { done: true },
  dealer: { returnTo: '/dealer' },
};

function settle<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), signInActionStub.delayMs));
}

export function dealerPhoneSignInAction(): Promise<DealerSignInState> {
  return settle(signInActionStub.dealer);
}

export function customerPhoneSignInAction(): Promise<CustomerSignInState> {
  return settle(signInActionStub.customer);
}

export function customerSignUpAction(): Promise<CustomerSignUpState> {
  return settle(signInActionStub.signUp);
}
