import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from '@/auth/auth.service';
import { DirectoryService } from '@/directory/directory.service';
import { User } from '@/auth/interfaces/user.interface';
import { NodeType } from '@/directory/entities/directory-node.entity';
import { Role } from '@/auth/enums/role.enum';
import { AuditService } from '@/audit/audit.service';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let directoryService: DirectoryService;

  const mockDirectoryService = {
    findUserByEmailWithPassword: jest.fn(),
    findOne: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
    logRefresh: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockUser: Partial<User> = {
    id: 1,
    name: 'testuser',
    type: NodeType.USER,
    password: '$2b$10$hashedPassword',
    attributes: {
      email: 'test@example.com',
    },
    mpath: '1.2.3.',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DirectoryService,
          useValue: mockDirectoryService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
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
    }).compile();

    service = module.get<AuthService>(AuthService);
    directoryService = module.get<DirectoryService>(DirectoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      mockDirectoryService.findUserByEmailWithPassword.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password123');

      expect(result).toBeDefined();
      expect(result?.password).toBeUndefined();
      expect(result?.name).toBe('testuser');
      expect(directoryService.findUserByEmailWithPassword).toHaveBeenCalledWith('testuser');
    });

    it('should return null when user is not found', async () => {
      mockDirectoryService.findUserByEmailWithPassword.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password123');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      mockDirectoryService.findUserByEmailWithPassword.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    const loginDto = { username: 'testuser', password: 'password123' };

    beforeEach(() => {
      // Mock validateUser para simular validación exitosa por defecto
      jest.spyOn(service, 'validateUser').mockResolvedValue(mockUser);
      mockDirectoryService.findOne.mockResolvedValue({
        ...mockUser,
        mpath: '1.2.3.',
      });
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      mockCacheManager.set.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue({});
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');

      // Verificar que se registró el intento fallido
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
          status: 'FAILURE',
          actorName: 'testuser',
        })
      );
    });

    it('should return access token and user data when credentials are valid', async () => {
      const result = await service.login(loginDto);

      expect(result).toHaveProperty('access_token', 'mock-jwt-token');
      expect(result).toHaveProperty('refresh_token', 'mock-jwt-token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id', 1);
      expect(result.user).toHaveProperty('username', 'testuser');
      expect(result.user).toHaveProperty('mpath', '1.2.3.');

      // Verificar que se validaron las credenciales
      expect(service.validateUser).toHaveBeenCalledWith('testuser', 'password123');

      // Verificar que se registró el login exitoso
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
          status: 'SUCCESS',
          actorName: 'testuser',
        })
      );
    });

    it('should return SUPER_ADMIN role when user has isSuperAdmin attribute', async () => {
      const superAdminUser: Partial<User> = {
        ...mockUser,
        attributes: {
          ...mockUser.attributes,
          isSuperAdmin: true,
        },
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue(superAdminUser);
      mockDirectoryService.findOne.mockResolvedValue({
        ...superAdminUser,
        mpath: '1.2.',
      });

      const result = await service.login(loginDto);

      expect(result.user.role).toBe(Role.SUPER_ADMIN);
      expect(result.user.roles).toContain(Role.SUPER_ADMIN);
    });

    it('should return OU_ADMIN role when user has isAdmin attribute', async () => {
      const ouAdminUser: Partial<User> = {
        ...mockUser,
        attributes: {
          ...mockUser.attributes,
          isAdmin: true,
          adminOf: '2',
        },
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue(ouAdminUser);
      mockDirectoryService.findOne.mockResolvedValue({
        ...ouAdminUser,
        mpath: '1.2.',
        adminOfNodeId: 2,
      });

      const result = await service.login(loginDto);

      expect(result.user.role).toBe(Role.OU_ADMIN);
      expect(result.user.adminOfNodeId).toBe(2);
    });

    it('should return role from user attributes when explicitly set', async () => {
      const userWithExplicitRole: Partial<User> = {
        ...mockUser,
        attributes: {
          ...mockUser.attributes,
          role: Role.OU_ADMIN,
        },
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue(userWithExplicitRole);
      mockDirectoryService.findOne.mockResolvedValue({
        ...userWithExplicitRole,
        mpath: '1.2.',
      });

      const result = await service.login(loginDto);

      expect(result.user.role).toBe(Role.OU_ADMIN);
    });

    it('should throw UnauthorizedException when user is validated but not found in DB', async () => {
      mockDirectoryService.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('User not found');
    });

    it('should generate refresh token and store it in cache', async () => {
      await service.login(loginDto);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh_token:/),
        'testuser',
        7 * 24 * 60 * 60 * 1000,
      );
    });

    it('should generate ID token when clientId is provided', async () => {
      const result = await service.login(loginDto, 'test-client-id');

      expect(result).toHaveProperty('id_token');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          aud: 'test-client-id',
        })
      );
    });
  });

  describe('refresh', () => {
    it('should rotate access and refresh tokens when a valid refresh token is provided', async () => {
      const mockPayload = { sub: 'testuser', type: 'refresh', jti: 'old-jti' };
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockCacheManager.get.mockResolvedValue('testuser'); // Token is whitelisted
      mockDirectoryService.findUserByEmailWithPassword.mockResolvedValue(mockUser);
      mockDirectoryService.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new-token');

      const result = await service.refresh('old-refresh-token');

      expect(result).toBeDefined();
      expect(mockCacheManager.del).toHaveBeenCalledWith('refresh_token:old-jti');
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh_token:/),
        'testuser',
        expect.any(Number),
      );
    });

    it('should throw error if refresh token is not in Redis (already used or revoked)', async () => {
      const mockPayload = { sub: 'testuser', type: 'refresh', jti: 'used-jti' };
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockCacheManager.get.mockResolvedValue(null); // Not in whitelist

      await expect(service.refresh('used-refresh-token')).rejects.toThrow('Refresh token invalid or expired');
    });
  });

  describe('logout', () => {
    it('should blacklist the access token jti in Redis', async () => {
      mockConfigService.get.mockReturnValue(86400); // 24h
      await service.logout('test-jti');

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'revoked_token:test-jti',
        true,
        86400 * 1000,
      );
    });
  });
});
