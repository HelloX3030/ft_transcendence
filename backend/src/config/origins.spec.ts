import type { Request as ExpressRequest } from 'express';

const ORIGINS = 'https://localhost:8443,https://10.13.6.3:8443';

type OriginsModule = typeof import('./origins.ts');

/**
 * The module reads process.env at import time, so each case re-imports it.
 * `require` rather than a dynamic import: the unit jest config runs without
 * --experimental-vm-modules, where `import()` throws.
 */
function loadModule(value?: string): OriginsModule {
  if (value === undefined) delete process.env.APP_ORIGINS;
  else process.env.APP_ORIGINS = value;

  let loaded!: OriginsModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
    loaded = require('./origins') as OriginsModule;
  });
  return loaded;
}

function request(host: string | undefined, protocol = 'https'): ExpressRequest {
  return { protocol, get: () => host } as unknown as ExpressRequest;
}

describe('APP_ORIGINS', () => {
  const original = process.env.APP_ORIGINS;

  afterAll(() => {
    if (original === undefined) delete process.env.APP_ORIGINS;
    else process.env.APP_ORIGINS = original;
  });

  it('splits and trims the list, keeping the order', () => {
    const { APP_ORIGINS } = loadModule(' https://localhost:8443 , https://10.13.6.3:8443 ');

    expect(APP_ORIGINS).toEqual(['https://localhost:8443', 'https://10.13.6.3:8443']);
  });

  it('treats the first entry as canonical', () => {
    const { CANONICAL_ORIGIN } = loadModule(ORIGINS);

    expect(CANONICAL_ORIGIN).toBe('https://localhost:8443');
  });

  it('is empty rather than [""] when unset', () => {
    const { APP_ORIGINS, CANONICAL_ORIGIN } = loadModule(undefined);

    expect(APP_ORIGINS).toEqual([]);
    expect(CANONICAL_ORIGIN).toBe('');
  });
});

describe('requestOrigin', () => {
  const original = process.env.APP_ORIGINS;

  afterAll(() => {
    if (original === undefined) delete process.env.APP_ORIGINS;
    else process.env.APP_ORIGINS = original;
  });

  it('returns the origin the request arrived on when it is allowed', () => {
    const { requestOrigin } = loadModule(ORIGINS);

    expect(requestOrigin(request('10.13.6.3:8443'))).toBe('https://10.13.6.3:8443');
  });

  // The allowlist check is the whole point: a forged Host header must not be
  // able to steer the OAuth redirect at an attacker's origin.
  it('falls back to canonical for an origin not in the list', () => {
    const { requestOrigin } = loadModule(ORIGINS);

    expect(requestOrigin(request('evil.example.com'))).toBe('https://localhost:8443');
  });

  it('falls back to canonical when the protocol does not match', () => {
    const { requestOrigin } = loadModule(ORIGINS);

    expect(requestOrigin(request('10.13.6.3:8443', 'http'))).toBe('https://localhost:8443');
  });

  it('falls back to canonical when there is no Host header', () => {
    const { requestOrigin } = loadModule(ORIGINS);

    expect(requestOrigin(request(undefined))).toBe('https://localhost:8443');
  });
});
