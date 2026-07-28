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
  mfaToken: string;
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
