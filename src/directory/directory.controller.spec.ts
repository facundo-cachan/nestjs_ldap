import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@/audit/audit.service';
import { AntiEscalationService } from '@/auth/services/anti-escalation.service';
import { Role } from '@/auth/enums/role.enum';

import { DirectoryController } from '@/directory/directory.controller';
import { DirectoryService } from '@/directory/directory.service';
import { DirectoryNode, NodeType } from '@/directory/entities/directory-node.entity';
import { CreateNodeDto } from '@/directory/dto/create-node.dto';

describe('DirectoryController', () => {
  let controller: DirectoryController;
  let service: DirectoryService;

  const mockDirectoryService = {
    create: jest.fn(),
    getFullTree: jest.fn(),
    searchInSubtree: jest.fn(),
    flatSearch: jest.fn(),
    moveBranch: jest.fn(),
    getAncestors: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockAntiEscalationService = {
    validateNodeCreation: jest.fn(),
    validateNodeMove: jest.fn(),
  };

  const mockUser = {
    sub: 1,
    username: 'admin',
    role: Role.SUPER_ADMIN,
    mpath: '1.',
  };

  const mockRequest = {
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'Jest',
    },
  } as any;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DirectoryController],
      providers: [
        {
          provide: DirectoryService,
          useValue: mockDirectoryService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: AntiEscalationService,
          useValue: mockAntiEscalationService,
        },
      ],
    }).compile();

    controller = module.get<DirectoryController>(DirectoryController);
    service = module.get<DirectoryService>(DirectoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new node', async () => {
      const createDto: CreateNodeDto = {
        name: 'new-node',
        type: NodeType.OU,
        attributes: {},
      };

      mockDirectoryService.create.mockResolvedValue(mockNode);

      const result = await controller.create(createDto, mockUser, mockRequest);

      expect(result).toEqual(mockNode);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('getTree', () => {
    it('should return the full directory tree', async () => {
      const mockTree = [mockNode];
      mockDirectoryService.getFullTree.mockResolvedValue(mockTree);

      const result = await controller.getTree();

      expect(result).toEqual(mockTree);
      expect(service.getFullTree).toHaveBeenCalled();
    });
  });

  describe('searchInScope', () => {
    it('should search within a scope', async () => {
      const mockResults = [mockNode];
      mockDirectoryService.searchInSubtree.mockResolvedValue(mockResults);

      const result = await controller.searchInScope(1, 'test');

      expect(result).toEqual(mockResults);
      expect(service.searchInSubtree).toHaveBeenCalledWith(1, 'test');
    });

    it('should search without query parameter', async () => {
      const mockResults = [mockNode];
      mockDirectoryService.searchInSubtree.mockResolvedValue(mockResults);

      const result = await controller.searchInScope(1);

      expect(result).toEqual(mockResults);
      expect(service.searchInSubtree).toHaveBeenCalledWith(1, undefined);
    });
  });

  describe('flatSearch', () => {
    it('should perform flat search with query', async () => {
      const mockResults = [mockNode];
      mockDirectoryService.flatSearch.mockResolvedValue(mockResults);

      const result = await controller.flatSearch('test');

      expect(result).toEqual(mockResults);
      expect(service.flatSearch).toHaveBeenCalledWith('test', undefined);
    });

    it('should perform flat search with type filter', async () => {
      const mockResults = [mockNode];
      mockDirectoryService.flatSearch.mockResolvedValue(mockResults);

      const result = await controller.flatSearch('test', NodeType.USER);

      expect(result).toEqual(mockResults);
      expect(service.flatSearch).toHaveBeenCalledWith('test', NodeType.USER);
    });
  });

  describe('moveNode', () => {
    it('should move a node to a new parent', async () => {
      mockDirectoryService.moveBranch.mockResolvedValue(mockNode);
      mockDirectoryService.findOne.mockResolvedValue(mockNode);

      const result = await controller.moveNode(1, 2, mockUser, mockRequest);

      expect(result).toEqual(mockNode);
      expect(service.moveBranch).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('getAncestors', () => {
    it('should return ancestors of a node', async () => {
      const mockAncestors = [mockNode];
      mockDirectoryService.getAncestors.mockResolvedValue(mockAncestors);

      const result = await controller.getAncestors(1);

      expect(result).toEqual(mockAncestors);
      expect(service.getAncestors).toHaveBeenCalledWith(1);
    });
  });

  describe('findOne', () => {
    it('should return a single node by id', async () => {
      mockDirectoryService.findOne.mockResolvedValue(mockNode);

      const result = await controller.findOne(1, mockUser, mockRequest);

      expect(result).toEqual(mockNode);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('remove', () => {
    it('should return delete message when node exists', async () => {
      mockDirectoryService.findOne.mockResolvedValue(mockNode);

      const result = await controller.remove(1, mockUser, mockRequest);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('nodeId', 1);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw error when node not found', async () => {
      mockDirectoryService.findOne.mockResolvedValue(null);

      await expect(controller.remove(999, mockUser, mockRequest)).rejects.toThrow('Node not found');
    });
  });
});
