export type LanguageCode = "de" | "en" | "es";
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
  language: LanguageCode;
}

export interface LoginResponse {
  mfaRequired: boolean;
  mfaType: MfaType;
  /**
   * Only set when mfaRequired. Short-lived, single-purpose, and useless on its
   * own — exchange it together with the OTP at POST /auth/mfa/verify.
   */
  mfaToken?: string;
}

export interface otp {
  otp: string;
}
