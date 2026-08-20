export type MfaType = "none" | "totp";

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Second step of an MFA login. The challenge token stands in for the password,
 * which is never sent twice.
 */
export interface MfaVerifyRequest {
  /**
   * Omitted on the Google path: that login ends in a redirect, so the challenge
   * token travels in an httpOnly cookie rather than in a body.
   */
  mfaToken?: string;
  otp: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

/**
 * When the access cookie a response just issued stops being accepted, as epoch
 * milliseconds. Nothing secret: it is the `exp` claim of a token the client
 * already holds. It lets the client renew before the expiry rather than discover
 * it through a 401, which the browser logs from its own network stack.
 */
export interface AccessTokenExpiry {
  accessExpiresAt: number;
}

export interface LoginResponse {
  mfaRequired: boolean;
  mfaType: MfaType;
  /** Absent when `mfaRequired`: no session exists until the OTP is verified. */
  accessExpiresAt?: number;
  /**
   * Only set when mfaRequired. Short-lived and useless on its own: exchange it
   * together with the OTP at POST /auth/mfa/verify.
   */
  mfaToken?: string;
}

export interface otp {
  otp: string;
}

/**
 * What GET /auth/me answers with: the access token's payload, not a user row. The
 * profile lives behind GET /users/me; this only says whether there is a session.
 * Both answers are 200, because both are true answers to the question asked, and
 * a 401 would print a console error on every logged-out page load.
 */
export type SessionResponse =
  | { authenticated: false }
  | { authenticated: true; sub: number; email: string; accessExpiresAt: number };

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  /** Required only when the target account has TOTP enabled. */
  otp?: string;
}
