export interface JwtAccessPayload {
  sub: number;
  email: string;
}

/**
 * Issued once a password checks out but before the second factor. Carries no
 * authority of its own: it is only ever accepted by the MFA verify endpoint,
 * and is signed with a key derived separately from the access-token secret so
 * it can never be presented as an access token.
 */
export interface JwtMfaPayload {
  sub: number;
  purpose: 'mfa';
}

export interface JwtRefreshPayload {
  sub: number;
  sessionId: number;
  session: string;
}

declare module 'express' {
  export interface Request {
    user?: JwtRefreshPayload | JwtAccessPayload;
  }
}

export interface JwtTokens {
  access_token: string;
  refresh_token: string;
}
