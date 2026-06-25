export type LanguageCode = "de" | "en" | "es";
export type MfaTyp = "none" | "totp";

export interface LoginRequest {
  email: string;
  password: string;
  otp?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  language: LanguageCode;
}

export interface LoginResponse {
  mfaRequired: boolean;
  mfaTyp: MfaTyp;
}

export interface otp {
  otp: string;
}
