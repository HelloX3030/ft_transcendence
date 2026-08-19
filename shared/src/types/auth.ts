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
   * token travels in an httpOnly cookie the browser sends automatically rather
   * than in a body the client never saw.
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
 * milliseconds. Reported by every endpoint that issues or renews one.
 *
 * Nothing secret: it is the `exp` claim of a token the client already holds. It
 * exists so the client can renew *before* the expiry instead of discovering it
 * through a 401 — a failed request the browser logs to the console from its own
 * network stack, where no application code can reach it.
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
   * Only set when mfaRequired. Short-lived, single-purpose, and useless on its
   * own — exchange it together with the OTP at POST /auth/mfa/verify.
   */
  mfaToken?: string;
}

export interface otp {
  otp: string;
}

/**
 * What GET /auth/me answers with: the access token's payload, not a user row.
 * The profile lives behind GET /users/me — this endpoint exists to say whether
 * there is a session at all.
 *
 * Both answers are 200, because both are true answers to the question asked.
 * Answering "nobody is signed in" with a 401 made every logged-out page load
 * print a red line the client could handle but not unprint.
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
