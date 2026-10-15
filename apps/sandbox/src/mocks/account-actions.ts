export const accountActionStub: {
  deactivate: { done: boolean; error?: string; reauth: boolean };
  deletion: { reference?: string; error?: string };
} = {
  deactivate: { done: true, reauth: false },
  deletion: { reference: 'DD-2001' },
};
export function deactivateCustomerAction() {
  return Promise.resolve(accountActionStub.deactivate);
}
export function requestCustomerDeletionAction() {
  return Promise.resolve(accountActionStub.deletion);
}
