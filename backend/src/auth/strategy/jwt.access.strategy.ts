import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JwtAccessPayload } from 'src/types';
import type { Request as ExpressRequest } from 'express';

export function extractAccessToken(req: ExpressRequest): string | null {
  return typeof req?.cookies?.access_token === 'string' ? req.cookies.access_token : null;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractAccessToken]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET as string,
    });
  }

  // `exp` is carried through, not dropped: GET /auth/me reports it so the client
  // can renew the cookie before it lapses rather than after a 401.
  validate(payload: JwtAccessPayload): JwtAccessPayload {
    return { sub: payload.sub, email: payload.email, exp: payload.exp };
  }
}
