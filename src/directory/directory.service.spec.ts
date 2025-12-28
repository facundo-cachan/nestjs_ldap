import { TreeRepository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { CreateNodeDto } from '@/directory/dto/create-node.dto';
import { DirectoryService } from '@/directory/directory.service';
import { DirectoryNode, NodeType } from '@/directory/entities/directory-node.entity';

describe('DirectoryService', () => {
  let service: DirectoryService;
  let repository: TreeRepository<DirectoryNode>;

  const mockNode: DirectoryNode = {
    id: 1,
    name: 'test-node',
    type: NodeType.OU,
    attributes: {},
    mpath: '1.',
    children: [],
    parent: {} as DirectoryNode,
    createdAt: new Date(),
    updatedAt: new Date(),
    hashPassword: jest.fn(),
  };

  const mockRepository = {
    save: jest.fn(),
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    findTrees: jest.fn(),
    findAncestors: jest.fn(),
    createQueryBuilder: jest.fn(),
    createDescendantsQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DirectoryService,
        {
          provide: getRepositoryToken(DirectoryNode),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DirectoryService>(DirectoryService);
    repository = module.get<TreeRepository<DirectoryNode>>(
      getRepositoryToken(DirectoryNode),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a node without parent', async () => {
      const createDto: CreateNodeDto = {
        name: 'root-node',
        type: NodeType.DC,
        attributes: {},
      };

      mockRepository.save.mockResolvedValue(mockNode);

      const result = await service.create(createDto);

      expect(result).toEqual(mockNode);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should create a USER node with password', async () => {
      const createDto: CreateNodeDto = {
        name: 'test-user',
        type: NodeType.USER,
        password: 'password123',
        attributes: {},
      };

      mockRepository.save.mockResolvedValue({ ...mockNode, type: NodeType.USER });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should create a node with parent', async () => {
      const parentNode = { ...mockNode, id: 1, type: NodeType.OU };
      const createDto: CreateNodeDto = {
        name: 'child-node',
        type: NodeType.OU,
        parentId: 1,
        attributes: {},
      };

      mockRepository.findOneBy.mockResolvedValue(parentNode);
      mockRepository.findOne.mockResolvedValue(null); // No sibling with same name
      mockRepository.save.mockResolvedValue({ ...mockNode, id: 2, name: 'child-node' });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('should throw NotFoundException when parent does not exist', async () => {
      const createDto: CreateNodeDto = {
        name: 'orphan-node',
        type: NodeType.OU,
        parentId: 999,
        attributes: {},
      };

      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when parent is a USER', async () => {
      const userParent = { ...mockNode, type: NodeType.USER };
      const createDto: CreateNodeDto = {
        name: 'invalid-child',
        type: NodeType.OU,
        parentId: 1,
        attributes: {},
      };

      mockRepository.findOneBy.mockResolvedValue(userParent);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when sibling with same name exists', async () => {
      const parentNode = { ...mockNode, id: 1 };
      const existingSibling = { ...mockNode, id: 2, name: 'duplicate' };
      const createDto: CreateNodeDto = {
        name: 'duplicate',
        type: NodeType.OU,
        parentId: 1,
        attributes: {},
      };

      mockRepository.findOneBy.mockResolvedValue(parentNode);
      mockRepository.findOne.mockResolvedValue(existingSibling);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFullTree', () => {
    it('should return the full directory tree', async () => {
      const mockTree = [mockNode];
      mockRepository.findTrees.mockResolvedValue(mockTree);

      const result = await service.getFullTree();

      expect(result).toEqual(mockTree);
      expect(repository.findTrees).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a node by id', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          node_id: 1,
          node_name: 'test-node',
          node_type: NodeType.OU,
          node_attributes: {},
          node_roles: null,
          node_adminOfNodeId: null,
          node_mpath: '1.',
          node_createdAt: new Date(),
          node_updatedAt: new Date(),
        }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findOne(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.mpath).toBe('1.');
    });

    it('should return null when node is not found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findOne(999);

      expect(result).toBeNull();
    });
  });

  describe('findUserByNameWithPassword', () => {
    it('should return user with password', async () => {
      const mockQueryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...mockNode, password: 'hashed' }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findUserByNameWithPassword('testuser');

      expect(result).toBeDefined();
      expect(result?.password).toBe('hashed');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('node.password');
    });
  });

  describe('getAncestors', () => {
    it('should return ancestors of a node', async () => {
      const mockAncestors = [mockNode];
      mockRepository.findOneBy.mockResolvedValue(mockNode);
      mockRepository.findAncestors.mockResolvedValue(mockAncestors);

      const result = await service.getAncestors(1);

      expect(result).toEqual(mockAncestors);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(repository.findAncestors).toHaveBeenCalledWith(mockNode);
    });

    it('should throw NotFoundException when node does not exist', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getAncestors(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('moveBranch', () => {
    it('should move a node to a new parent', async () => {
      const nodeToMove = { ...mockNode, id: 2 };
      const newParent = { ...mockNode, id: 3 };

      mockRepository.findOne.mockResolvedValue(nodeToMove);
      mockRepository.findOneBy.mockResolvedValue(newParent);
      mockRepository.save.mockResolvedValue({ ...nodeToMove, parent: newParent });

      const result = await service.moveBranch(2, 3);

      expect(result).toBeDefined();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when node or parent not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.moveBranch(2, 3)).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchInSubtree', () => {
    it('should search within a subtree', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockNode]),
      };

      mockRepository.findOneBy.mockResolvedValue(mockNode);
      mockRepository.createDescendantsQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchInSubtree(1, 'test');

      expect(result).toEqual([mockNode]);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('should throw NotFoundException when root node not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.searchInSubtree(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('flatSearch', () => {
    it('should perform flat search', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockNode]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.flatSearch('test');

      expect(result).toEqual([mockNode]);
    });

    it('should perform flat search with type filter', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockNode]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.flatSearch('test', NodeType.USER);

      expect(result).toEqual([mockNode]);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('node.type = :type', { type: NodeType.USER });
    });
  });
});
