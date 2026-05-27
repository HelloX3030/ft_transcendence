import { extractRefreshToken, JwtRefreshStrategy } from './jwt.refresh.strategy';

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;

  beforeEach(() => {
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    strategy = new JwtRefreshStrategy();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('returns only sub, sessionId, and session, stripping other JWT fields', () => {
      const payload = { sub: 1, sessionId: 42, session: 'abc123', iat: 1000, exp: 9999 };

      const result = strategy.validate(payload);

      expect(result).toEqual({ sub: 1, sessionId: 42, session: 'abc123' });
    });

    it('reads from the refresh_token cookie', () => {
      const withRefresh = { cookies: { refresh_token: 'tok' } } as never;
      const withNeither = { cookies: {} } as never;

      expect(extractRefreshToken(withRefresh)).toBe('tok');
      expect(extractRefreshToken(withNeither)).toBeNull();
    });
  });
});
