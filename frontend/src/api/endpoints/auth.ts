import type {
  LoginRequest,
  LoginResponse,
  MfaVerifyRequest,
  RegisterRequest,
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

  logout: () => backendClient('/auth/logout'),

  register: (payload: RegisterRequest) =>
    backendClient('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};
