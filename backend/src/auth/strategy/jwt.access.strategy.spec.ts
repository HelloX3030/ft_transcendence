import { extractAccessToken, JwtAccessStrategy } from './jwt.access.strategy';

describe('JwtAccessStrategy', () => {
  let strategy: JwtAccessStrategy;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    strategy = new JwtAccessStrategy();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('returns only sub and email, stripping other JWT fields', () => {
      const payload = { sub: 1, email: 'test@example.com', iat: 1000, exp: 9999 };

      const result = strategy.validate(payload);

      expect(result).toEqual({ sub: 1, email: 'test@example.com' });
    });

    it('reads from the access_token cookie, not the refresh_token cookie', () => {
      // Regression test: the extractor previously read refresh_token by mistake,
      // causing all guarded routes to reject authenticated users.
      const withAccess = { cookies: { access_token: 'tok' } } as never;
      const withRefresh = { cookies: { refresh_token: 'tok' } } as never;
      const withNeither = { cookies: {} } as never;

      expect(extractAccessToken(withAccess)).toBe('tok');
      expect(extractAccessToken(withRefresh)).toBeNull();
      expect(extractAccessToken(withNeither)).toBeNull();
    });
  });
});
