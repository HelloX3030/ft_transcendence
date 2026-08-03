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

/**
 * What GoogleStrategy.validate hands to the callback route. Google's access and
 * refresh tokens are deliberately not part of it: they are used once, during the
 * exchange, and never stored.
 */
export interface GoogleProfile {
  /** Google's `sub` claim — stable per account, unlike the email. */
  googleId: string;
  email: string;
  /** Gates account linking. Never assume Google only returns verified addresses. */
  emailVerified: boolean;
  locale?: string;
}

declare module 'express' {
  export interface Request {
    user?: JwtRefreshPayload | JwtAccessPayload | GoogleProfile;
  }
}

export interface JwtTokens {
  access_token: string;
  refresh_token: string;
}
