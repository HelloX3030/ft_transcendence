import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JwtAccessPayload } from 'src/types';
import type { Request as ExpressRequest } from 'express';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: ExpressRequest): string | null => {
          if (typeof req?.cookies?.refresh_token !== 'string') return null;
          else return req?.cookies?.refresh_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET as string,
    });
  }

  validate(payload: JwtAccessPayload): JwtAccessPayload {
    return { sub: payload.sub, email: payload.email };
  }
}
