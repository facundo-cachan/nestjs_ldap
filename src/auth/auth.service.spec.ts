import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AuthService } from '@/auth/auth.service';
import { DirectoryService } from '@/directory/directory.service';
import { User } from '@/auth/interfaces/user.interface';
import { NodeType } from '@/directory/entities/directory-node.entity';
import { Role } from '@/auth/enums/role.enum';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let directoryService: DirectoryService;

  const mockDirectoryService = {
    findUserByNameWithPassword: jest.fn(),
    findOne: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
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
      mockDirectoryService.findUserByNameWithPassword.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password123');

      expect(result).toBeDefined();
      expect(result?.password).toBeUndefined();
      expect(result?.name).toBe('testuser');
      expect(directoryService.findUserByNameWithPassword).toHaveBeenCalledWith('testuser');
    });

    it('should return null when user is not found', async () => {
      mockDirectoryService.findUserByNameWithPassword.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password123');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      mockDirectoryService.findUserByNameWithPassword.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token and user data for regular user', async () => {
      const userWithoutPassword = { ...mockUser };
      delete userWithoutPassword.password;

      mockDirectoryService.findOne.mockResolvedValue({
        ...userWithoutPassword,
        mpath: '1.2.3.',
      });
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.login(userWithoutPassword as User);

      expect(result).toHaveProperty('access_token', 'mock-jwt-token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id', 1);
      expect(result.user).toHaveProperty('username', 'testuser');
      expect(result.user).toHaveProperty('mpath', '1.2.3.');
    });

    it('should return SUPER_ADMIN role when user has isSuperAdmin attribute', async () => {
      const superAdminUser: Partial<User> = {
        ...mockUser,
        attributes: {
          ...mockUser.attributes,
          isSuperAdmin: true,
        },
      };
      delete superAdminUser.password;

      mockDirectoryService.findOne.mockResolvedValue({
        ...superAdminUser,
        mpath: '1.2.',
      });
      mockJwtService.sign.mockReturnValue('super-admin-token');

      const result = await service.login(superAdminUser as User);

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
      delete ouAdminUser.password;

      mockDirectoryService.findOne.mockResolvedValue({
        ...ouAdminUser,
        mpath: '1.2.',
        adminOfNodeId: 2,
      });
      mockJwtService.sign.mockReturnValue('ou-admin-token');

      const result = await service.login(ouAdminUser as User);

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
      delete userWithExplicitRole.password;

      mockDirectoryService.findOne.mockResolvedValue({
        ...userWithExplicitRole,
        mpath: '1.2.',
      });
      mockJwtService.sign.mockReturnValue('explicit-role-token');

      const result = await service.login(userWithExplicitRole as User);

      expect(result.user.role).toBe(Role.OU_ADMIN);
    });

    it('should throw error when user is not found', async () => {
      const userWithoutPassword = { ...mockUser };
      delete userWithoutPassword.password;

      mockDirectoryService.findOne.mockResolvedValue(null);

      await expect(service.login(userWithoutPassword as User)).rejects.toThrow('User not found');
    });
  });
});
