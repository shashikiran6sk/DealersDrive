export interface OAuthClaims {
  subject: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface AuthorizationRequest {
  state: string;
  nonce: string;
  codeVerifier: string;
  prompt?: 'select_account' | 'consent';
}

export interface OAuthProvider {
  readonly id: 'GOOGLE';

  isConfigured(): boolean;

  authorizationUrl(request: AuthorizationRequest): string;

  exchange(input: { code: string; codeVerifier: string; nonce: string }): Promise<OAuthClaims>;
}
