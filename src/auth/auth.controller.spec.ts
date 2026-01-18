import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { User } from '@/auth/interfaces/user.interface';
import { NodeType } from '@/directory/entities/directory-node.entity';
import { Role } from '@/auth/enums/role.enum';
import { AuditService } from '@/audit/audit.service';
import { JwtBlacklistGuard } from '@/auth/guards/jwt-blacklist.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  const mockAuditService = {
    logLogout: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockUser: Partial<User> = {
    id: 1,
    name: 'testuser',
    type: NodeType.USER,
    attributes: {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    },
    mpath: '1.2.',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtBlacklistGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should return access token and user data', async () => {
      const expectedResult = {
        access_token: 'mock-jwt-token',
        user: {
          id: mockUser.id,
          username: mockUser.name,
          role: Role.USER,
          roles: [Role.USER],
          mpath: mockUser.mpath,
        },
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const request = { user: mockUser } as any;
      const result = await controller.login(request);

      expect(result).toEqual(expectedResult);
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(authService.login).toHaveBeenCalledTimes(1);
    });

    it('should call authService.login with the user from request', async () => {
      const request = { user: mockUser } as any;

      mockAuthService.login.mockResolvedValue({
        access_token: 'token',
        user: mockUser,
      });

      await controller.login(request);

      expect(authService.login).toHaveBeenCalledWith(mockUser);
    });
  });
});
