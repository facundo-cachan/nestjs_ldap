import { Test, TestingModule } from '@nestjs/testing';
import { JwtBlacklistGuard } from './jwt-blacklist.guard';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('JwtBlacklistGuard', () => {
  let guard: JwtBlacklistGuard;
  let cacheManager: any;

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtBlacklistGuard,
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    guard = module.get<JwtBlacklistGuard>(JwtBlacklistGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if token is not blacklisted', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { jti: 'valid-jti' },
        }),
      }),
    } as unknown as ExecutionContext;

    cacheManager.get.mockResolvedValue(null);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(cacheManager.get).toHaveBeenCalledWith('revoked_token:valid-jti');
  });

  it('should deny access if token is blacklisted', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { jti: 'revoked-jti' },
        }),
      }),
    } as unknown as ExecutionContext;

    cacheManager.get.mockResolvedValue(true);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(cacheManager.get).toHaveBeenCalledWith('revoked_token:revoked-jti');
  });

  it('should allow access if no user or jti is present (fail open to let other guards handle)', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {},
        }),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
