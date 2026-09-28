import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';

const refreshSession = vi.fn();
const notifySessionEnded = vi.fn();

vi.mock('./http', async () => {
  const actual = await vi.importActual<typeof import('./http')>('./http');
  return { ...actual, API_BASE: '/api/v1', refreshSession: () => refreshSession() };
});
vi.mock('@/lib/session-signals', () => ({ notifySessionEnded: () => notifySessionEnded() }));

const { backendClient } = await import('./client');

function respond(status: number, body = '') {
  return { status, ok: status >= 200 && status < 300, text: () => Promise.resolve(body) };
}

describe('backendClient: 401 handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The routine 15-minute access-token expiry. Treating this as a logout would
  // be a far worse bug than the one the terminal case fixes.
  it('does not end the session when the refresh succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(401))
      .mockResolvedValueOnce(respond(200, '{"data":{"ok":true}}'));
    vi.stubGlobal('fetch', fetchMock);
    refreshSession.mockResolvedValue(undefined);

    await expect(backendClient('/me')).resolves.toEqual({ ok: true });
    expect(notifySessionEnded).not.toHaveBeenCalled();
  });

  it('ends the session when the refresh fails too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(401)));
    refreshSession.mockRejectedValue(new Error('no refresh token'));

    await expect(backendClient('/me')).rejects.toThrow(ApiError);
    expect(notifySessionEnded).toHaveBeenCalledTimes(1);
  });

  // The retry passes `retried`, so a second 401 falls through to the generic
  // error path rather than refreshing again.
  it('does not end the session on a 401 from the retried request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(401, '{"message":"nope"}')));
    refreshSession.mockResolvedValue(undefined);

    await expect(backendClient('/me')).rejects.toThrow(ApiError);
    expect(notifySessionEnded).not.toHaveBeenCalled();
  });
});

describe('backendClient: user errors answered with 200', () => {
  // The backend answers a wrong password with 200 so Chrome logs nothing; the
  // caller must still see the 403 it checks for.
  it('throws the ApiError the real status would have produced', async () => {
    const body = '{"success":false,"statusCode":403,"message":"Invalid credentials"}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, body)));

    const error = await backendClient('/auth/login').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, message: 'Invalid credentials' });
  });

  it('still returns data for a success body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, '{"success":true,"data":1}')));

    await expect(backendClient('/x')).resolves.toBe(1);
  });
});
