import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, JwtAccessGuard } from './jwt.access.guard';

const mockContext = {
  getHandler: jest.fn(),
  getClass: jest.fn(),
} as unknown as ExecutionContext;

describe('JwtAccessGuard', () => {
  let guard: JwtAccessGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAccessGuard(reflector);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('returns true immediately when route is marked @Public(), bypassing passport', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const superSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAccessGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(superSpy).not.toHaveBeenCalled();
    });

    it('delegates to passport jwt-access when route is not @Public()', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const superSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAccessGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      void guard.canActivate(mockContext);

      expect(superSpy).toHaveBeenCalledWith(mockContext);
    });

    it('reads IS_PUBLIC_KEY from both handler and class metadata', () => {
      const getAllAndOverrideSpy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      jest
        .spyOn(Object.getPrototypeOf(JwtAccessGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      void guard.canActivate(mockContext);

      expect(getAllAndOverrideSpy).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });
  });
});
