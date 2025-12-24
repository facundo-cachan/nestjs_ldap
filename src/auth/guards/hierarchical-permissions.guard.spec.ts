import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';

import { HierarchicalPermissionsGuard } from './hierarchical-permissions.guard';
import { DirectoryNode, NodeType } from '../../directory/entities/directory-node.entity';
import { Role, Permission } from '../enums/role.enum';

describe('HierarchicalPermissionsGuard', () => {
  let guard: HierarchicalPermissionsGuard;
  let reflector: Reflector;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      findOneBy: jest.fn(),
      createDescendantsQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HierarchicalPermissionsGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DirectoryNode),
          useValue: mockRepository,
        },
      ],
    }).compile();

    guard = module.get<HierarchicalPermissionsGuard>(HierarchicalPermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (user: any, params = {}, body = {}): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params,
        body,
      }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext);

  describe('SUPER_ADMIN role', () => {
    it('should allow access for SUPER_ADMIN to any resource', async () => {
      const mockUser = {
        id: 1,
        name: 'superadmin',
        role: Role.SUPER_ADMIN,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.DELETE]);

      const context = createMockExecutionContext(mockUser, { id: '5' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('should allow SUPER_ADMIN to create nodes anywhere', async () => {
      const mockUser = {
        id: 1,
        name: 'superadmin',
        role: Role.SUPER_ADMIN,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.CREATE]);

      const context = createMockExecutionContext(mockUser, {}, { parentId: 99 });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('OU_ADMIN role', () => {
    it('should allow OU_ADMIN to access their own node', async () => {
      const mockUser = {
        id: 5,
        name: 'ou.admin',
        role: Role.OU_ADMIN,
        adminOfNodeId: 5,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.UPDATE]);

      const context = createMockExecutionContext(mockUser, { id: '5' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow OU_ADMIN to access descendant nodes', async () => {
      const adminNode: Partial<DirectoryNode> = {
        id: 5,
        name: 'Engineering',
        mpath: '1.2.5.',
        type: NodeType.OU,
      };

      const targetNode: Partial<DirectoryNode> = {
        id: 10,
        name: 'juan.perez',
        mpath: '1.2.5.10.',
        type: NodeType.USER,
      };

      const mockUser = {
        id: 5,
        name: 'eng.admin',
        role: Role.OU_ADMIN,
        adminOfNodeId: 5,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.READ]);
      mockRepository.findOneBy
        .mockResolvedValueOnce(adminNode)
        .mockResolvedValueOnce(targetNode);

      const context = createMockExecutionContext(mockUser, { id: '10' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 5 });
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 10 });
    });

    it('should deny OU_ADMIN access to non-descendant nodes', async () => {
      const adminNode: Partial<DirectoryNode> = {
        id: 5,
        name: 'Engineering',
        mpath: '1.2.5.',
        type: NodeType.OU,
      };

      const targetNode: Partial<DirectoryNode> = {
        id: 11,
        name: 'sales.user',
        mpath: '1.2.6.11.',  // Different branch
        type: NodeType.USER,
      };

      const mockUser = {
        id: 5,
        name: 'eng.admin',
        role: Role.OU_ADMIN,
        adminOfNodeId: 5,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.UPDATE]);
      mockRepository.findOneBy
        .mockResolvedValueOnce(adminNode)
        .mockResolvedValueOnce(targetNode);

      const context = createMockExecutionContext(mockUser, { id: '11' });
      
      await expect(guard.canActivate(context)).resolves.toBe(false);
    });

    it('should allow OU_ADMIN to create nodes under their OU', async () => {
      const adminNode: Partial<DirectoryNode> = {
        id: 5,
        name: 'Engineering',
        mpath: '1.2.5.',
        type: NodeType.OU,
      };

      const parentNode: Partial<DirectoryNode> = {
        id: 5,
        name: 'Engineering',
        mpath: '1.2.5.',
        type: NodeType.OU,
      };

      const mockUser = {
        id: 5,
        name: 'eng.admin',
        role: Role.OU_ADMIN,
        adminOfNodeId: 5,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.CREATE]);
      mockRepository.findOneBy
        .mockResolvedValueOnce(adminNode)
        .mockResolvedValueOnce(parentNode);

      const context = createMockExecutionContext(mockUser, {}, { parentId: 5 });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny OU_ADMIN creating nodes outside their OU', async () => {
      const adminNode: Partial<DirectoryNode> = {
        id: 5,
        name: 'Engineering',
        mpath: '1.2.5.',
        type: NodeType.OU,
      };

      const parentNode: Partial<DirectoryNode> = {
        id: 6,
        name: 'Sales',
        mpath: '1.2.6.',  // Different branch
        type: NodeType.OU,
      };

      const mockUser = {
        id: 5,
        name: 'eng.admin',
        role: Role.OU_ADMIN,
        adminOfNodeId: 5,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.CREATE]);
      mockRepository.findOneBy
        .mockResolvedValueOnce(adminNode)
        .mockResolvedValueOnce(parentNode);

      const context = createMockExecutionContext(mockUser, {}, { parentId: 6 });
      
      await expect(guard.canActivate(context)).resolves.toBe(false);
    });
  });

  describe('USER role', () => {
    it('should allow USER to read resources', async () => {
      const mockUser = {
        id: 10,
        name: 'juan.perez',
        role: Role.USER,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.READ]);

      const context = createMockExecutionContext(mockUser);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny USER from creating resources', async () => {
      const mockUser = {
        id: 10,
        name: 'juan.perez',
        role: Role.USER,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.CREATE]);

      const context = createMockExecutionContext(mockUser, {}, { parentId: 5 });
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should deny USER from updating resources', async () => {
      const mockUser = {
        id: 10,
        name: 'juan.perez',
        role: Role.USER,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.UPDATE]);

      const context = createMockExecutionContext(mockUser, { id: '5' });
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });
  });

  describe('READONLY role', () => {
    it('should allow READONLY to read resources', async () => {
      const mockUser = {
        id: 11,
        name: 'readonly.user',
        role: Role.READONLY,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.READ]);

      const context = createMockExecutionContext(mockUser);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny READONLY from performing write operations', async () => {
      const mockUser = {
        id: 11,
        name: 'readonly.user',
        role: Role.READONLY,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.CREATE, Permission.UPDATE]);

      const context = createMockExecutionContext(mockUser, {}, { parentId: 5 });
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });
  });

  describe('No permissions specified', () => {
    it('should allow access when no permissions are required', async () => {
      const mockUser = {
        id: 10,
        name: 'any.user',
        role: Role.USER,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const context = createMockExecutionContext(mockUser);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should throw ForbiddenException when user is not authenticated', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.READ]);

      const context = createMockExecutionContext(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should return false when admin node does not exist', async () => {
      const mockUser = {
        id: 5,
        name: 'eng.admin',
        role: Role.OU_ADMIN,
        adminOfNodeId: 999,  // Non-existent
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.READ]);
      mockRepository.findOneBy.mockResolvedValue(null);

      const context = createMockExecutionContext(mockUser, { id: '10' });
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return false when target node does not exist', async () => {
      const adminNode: Partial<DirectoryNode> = {
        id: 5,
        name: 'Engineering',
        mpath: '1.2.5.',
        type: NodeType.OU,
      };

      const mockUser = {
        id: 5,
        name: 'eng.admin',
        role: Role.OU_ADMIN,
        adminOfNodeId: 5,
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.READ]);
      mockRepository.findOneBy
        .mockResolvedValueOnce(adminNode)
        .mockResolvedValueOnce(null);  // Target not found

      const context = createMockExecutionContext(mockUser, { id: '999' });
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });
  });
});
