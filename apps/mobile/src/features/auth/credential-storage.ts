import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'dealersdrive.customer.session.v1';
export interface CredentialStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
}
export const credentialStorage: CredentialStorage = {
  read: () => SecureStore.getItemAsync(SESSION_KEY),
  write: (value) => SecureStore.setItemAsync(SESSION_KEY, value),
  remove: () => SecureStore.deleteItemAsync(SESSION_KEY),
};
