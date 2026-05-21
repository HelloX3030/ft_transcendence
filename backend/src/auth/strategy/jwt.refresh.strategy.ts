import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JwtRefreshPayload } from 'src/types';
import type { Request as ExpressRequest } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: ExpressRequest): string | null => {
          if (typeof req?.cookies?.refresh_token !== 'string') return null;
          else return req?.cookies?.refresh_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET as string,
    });
  }
  validate(payload: JwtRefreshPayload): JwtRefreshPayload {
    return { sub: payload.sub, sessionId: payload.sessionId, session: payload.session };
  }
}
