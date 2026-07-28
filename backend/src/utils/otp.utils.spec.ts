import * as OTPAuth from 'otpauth';
import { encryptSecret } from './crypto.utils';
import { verifyTOTP } from './otp.utils';

const TEST_KEY = 'a3f1c9d4b2e8f0c1d3a4b5c6e7f8091a2b3c4d5e6f7081920a1b2c3d4e5f6071';

// Mirrors the parameters createTOTP/verifyTOTP agree on.
function totpFor(secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret });
}

describe('verifyTOTP', () => {
  const originalKey = process.env.MFA_KEY;
  let plaintextSecret: string;
  let storedSecret: string;

  beforeEach(() => {
    process.env.MFA_KEY = TEST_KEY;
    plaintextSecret = new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30 }).secret.base32;
    storedSecret = encryptSecret(plaintextSecret);
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.MFA_KEY;
    else process.env.MFA_KEY = originalKey;
  });

  it('accepts the code generated from the stored secret', () => {
    const code = totpFor(plaintextSecret).generate();

    expect(verifyTOTP(storedSecret, code)).toBe(true);
  });

  it('rejects a wrong code', () => {
    const code = totpFor(plaintextSecret).generate();
    const wrong = code === '000000' ? '111111' : '000000';

    expect(verifyTOTP(storedSecret, wrong)).toBe(false);
  });

  it('rejects a code generated from a different secret', () => {
    const otherSecret = new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30 }).secret
      .base32;
    const code = totpFor(otherSecret).generate();

    expect(verifyTOTP(storedSecret, code)).toBe(false);
  });

  it('returns a boolean rather than a truthy value', () => {
    expect(typeof verifyTOTP(storedSecret, '000000')).toBe('boolean');
  });

  // Documents current behaviour, not desired behaviour: there is no acceptance
  // window, so a code from the previous step is refused. See H5 in
  // _meta/reviews/CODE_REVIEW_FINDINGS.md — this expectation flips when that is fixed.
  it('rejects a code from the previous time step (no clock-skew window yet)', () => {
    const previous = totpFor(plaintextSecret).generate({ timestamp: Date.now() - 30_000 });
    const current = totpFor(plaintextSecret).generate();

    if (previous === current) return; // straddled a period boundary; nothing to assert
    expect(verifyTOTP(storedSecret, previous)).toBe(false);
  });
});
