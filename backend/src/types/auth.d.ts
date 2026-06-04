export interface JwtAccessPayload {
  sub: number;
  email: string;
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
