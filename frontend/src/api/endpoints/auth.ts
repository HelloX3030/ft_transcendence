import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  MfaVerifyRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from '@trailertinder/shared';
import { backendClient } from '../client';

export const authApi = {
  session: () => backendClient('/auth/me'),

  login: (payload: LoginRequest) =>
    backendClient<LoginResponse>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  verifyMfa: (payload: MfaVerifyRequest) =>
    backendClient<LoginResponse>('/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  logout: () => backendClient('/auth/logout', { method: 'POST' }),

  register: (payload: RegisterRequest) =>
    backendClient('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // Always resolves for a well-formed address, whether or not the account
  // exists — the caller must not branch on it, or the UI leaks what the API
  // deliberately withholds.
  forgotPassword: (payload: ForgotPasswordRequest) =>
    backendClient('/auth/password/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  resetPassword: (payload: ResetPasswordRequest) =>
    backendClient('/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};
