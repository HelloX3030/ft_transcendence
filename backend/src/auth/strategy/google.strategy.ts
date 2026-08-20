import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import { GoogleProfile } from 'src/types';

/**
 * True when all three Google variables are set. The module registers the
 * strategy only in that case, so a checkout without credentials still boots:
 * passport would otherwise throw at construction time for a missing clientID.
 */
export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CALLBACK_URL,
  );
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
      scope: ['email', 'profile'],
      // We generate and check `state` ourselves against a cookie: passport's
      // own handling stores it in a server-side session, and this app has none.
      // See AuthService.googleState*.
      state: false,
    });
  }

  /**
   * Normalises Google's profile into the few fields the callback needs. The
   * access token is used once, here, and deliberately not stored.
   */
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;

    // `verified` is per-email and arrives as a boolean or the string "true"
    // depending on the response shape, so normalise rather than trust the type.
    const rawVerified: unknown = profile.emails?.[0]?.verified;
    const emailVerified = rawVerified === true || rawVerified === 'true';

    if (email === undefined) {
      // No email means nothing to match or create an account on.
      done(null, false);
      return;
    }

    const user: GoogleProfile = {
      googleId: profile.id,
      email,
      emailVerified,
    };

    done(null, user);
  }
}
