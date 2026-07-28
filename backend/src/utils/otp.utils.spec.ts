import * as OTPAuth from 'otpauth';
import { encryptSecret } from './crypto.utils';
import { verifyTOTP } from './otp.utils';

const TEST_KEY = 'a3f1c9d4b2e8f0c1d3a4b5c6e7f8091a2b3c4d5e6f7081920a1b2c3d4e5f6071';

const PERIOD_MS = 30_000;

// Mirrors the parameters createTOTP/verifyTOTP agree on.
function totpFor(secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret });
}

// verifyTOTP reads its own Date.now(), so a period boundary crossed mid-test
// shifts the accepted window. Tests compare this before and after to skip that run.
function currentStep(): number {
  return Math.floor(Date.now() / PERIOD_MS);
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

    expect(verifyTOTP(storedSecret, code)).toBe(currentStep());
  });

  it('rejects a wrong code', () => {
    const code = totpFor(plaintextSecret).generate();
    const wrong = code === '000000' ? '111111' : '000000';

    expect(verifyTOTP(storedSecret, wrong)).toBeNull();
  });

  it('rejects a code generated from a different secret', () => {
    const otherSecret = new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30 }).secret
      .base32;
    const code = totpFor(otherSecret).generate();

    expect(verifyTOTP(storedSecret, code)).toBeNull();
  });

  it('returns null rather than a falsy number for a non-match', () => {
    expect(verifyTOTP(storedSecret, '000000')).toBeNull();
  });

  it('accepts a code from the previous time step, for clock skew', () => {
    const before = currentStep();
    const previous = totpFor(plaintextSecret).generate({ timestamp: Date.now() - PERIOD_MS });
    const accepted = verifyTOTP(storedSecret, previous);

    if (currentStep() !== before) return; // rolled over, the code is two steps old now
    // The counter identifies the step the code belongs to, not the current one.
    expect(accepted).toBe(before - 1);
  });

  it('accepts a code from the next time step, for clock skew', () => {
    const next = totpFor(plaintextSecret).generate({ timestamp: Date.now() + PERIOD_MS });

    expect(verifyTOTP(storedSecret, next)).toBe(currentStep() + 1);
  });

  it('rejects a code from two time steps ago, outside the window', () => {
    const stale = totpFor(plaintextSecret).generate({ timestamp: Date.now() - 2 * PERIOD_MS });

    expect(verifyTOTP(storedSecret, stale)).toBeNull();
  });
});
