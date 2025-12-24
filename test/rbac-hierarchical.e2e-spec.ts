import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm';

import { AppModule } from '../src/app.module';
import { DirectoryNode, NodeType } from '../src/directory/entities/directory-node.entity';
import { Role } from '../src/auth/enums/role.enum';

describe('RBAC Hierarchical System (e2e)', () => {
  let app: INestApplication;
  let repository: TreeRepository<DirectoryNode>;
  let superAdminToken: string;
  let ouAdminToken: string;
  let userToken: string;

  // IDs de nodos de prueba
  let rootOu: DirectoryNode;
  let engineeringOu: DirectoryNode;
  let salesOu: DirectoryNode;
  let superAdminUser: DirectoryNode;
  let engAdminUser: DirectoryNode;
  let normalUser: DirectoryNode;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    repository = moduleFixture.get(getRepositoryToken(DirectoryNode));

    // Crear estructura de árbol de prueba
    await setupTestTree();
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await repository.delete({});
    await app.close();
  });

  /**
   * Crea una estructura de árbol para testing:
   * Root (OU)
   * ├── Engineering (OU)
   * │   ├── eng.admin (USER - OU_ADMIN)
   * │   └── juan.perez (USER)
   * └── Sales (OU)
   *     └── ana.garcia (USER)
   * SuperAdmin (USER - SUPER_ADMIN)
   */
  async function setupTestTree() {
    // Limpiar tabla
    await repository.query('TRUNCATE TABLE directory_node RESTART IDENTITY CASCADE');

    // Root OU
    rootOu = repository.create({
      name: 'company',
      type: NodeType.OU,
      attributes: {},
    });
    rootOu = await repository.save(rootOu);

    // Engineering OU
    engineeringOu = repository.create({
      name: 'engineering',
      type: NodeType.OU,
      parent: rootOu,
      attributes: {},
    });
    engineeringOu = await repository.save(engineeringOu);

    // Sales OU
    salesOu = repository.create({
      name: 'sales',
      type: NodeType.OU,
      parent: rootOu,
      attributes: {},
    });
    salesOu = await repository.save(salesOu);

    // Super Admin User
    superAdminUser = repository.create({
      name: 'superadmin',
      type: NodeType.USER,
      password: 'admin123',
      parent: rootOu,
      attributes: {
        isSuperAdmin: true,
        email: 'superadmin@company.com',
      },
    });
    superAdminUser = await repository.save(superAdminUser);

    // Engineering Admin
    engAdminUser = repository.create({
      name: 'eng.admin',
      type: NodeType.USER,
      password: 'engadmin123',
      parent: engineeringOu,
      attributes: {
        isAdmin: true,
        adminOf: engineeringOu.id.toString(),
        email: 'eng.admin@company.com',
      },
    });
    engAdminUser = await repository.save(engAdminUser);

    // Normal User in Engineering
    normalUser = repository.create({
      name: 'juan.perez',
      type: NodeType.USER,
      password: 'user123',
      parent: engineeringOu,
      attributes: {
        email: 'juan@company.com',
      },
    });
    normalUser = await repository.save(normalUser);

    // User in Sales
    const salesUser = repository.create({
      name: 'ana.garcia',
      type: NodeType.USER,
      password: 'user123',
      parent: salesOu,
      attributes: {
        email: 'ana@company.com',
      },
    });
    await repository.save(salesUser);

    // Obtener tokens de autenticación
    superAdminToken = await getAuthToken('superadmin', 'admin123');
    ouAdminToken = await getAuthToken('eng.admin', 'engadmin123');
    userToken = await getAuthToken('juan.perez', 'user123');
  }

  async function getAuthToken(username: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password })
      .expect(201);

    return response.body.access_token;
  }

  describe('Authentication Flow', () => {
    it('should authenticate SUPER_ADMIN and return role information', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'superadmin',
          password: 'admin123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.role).toBe(Role.SUPER_ADMIN);
    });

    it('should authenticate OU_ADMIN and return admin node info', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'eng.admin',
          password: 'engadmin123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user.role).toBe(Role.OU_ADMIN);
      expect(response.body.user.adminOfNodeId).toBe(engineeringOu.id);
    });

    it('should authenticate normal USER', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'juan.perez',
          password: 'user123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user.role).toBe(Role.USER);
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'superadmin',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('SUPER_ADMIN Permissions', () => {
    it('should allow SUPER_ADMIN to access any node', async () => {
      await request(app.getHttpServer())
        .get(`/directory/${salesOu.id}/ancestors`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
    });

    it('should allow SUPER_ADMIN to create nodes anywhere', async () => {
      const response = await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'new.ou',
          type: NodeType.OU,
          parentId: salesOu.id,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('new.ou');
    });

    it('should allow SUPER_ADMIN to search anywhere', async () => {
      await request(app.getHttpServer())
        .get(`/directory/scope/${rootOu.id}?q=juan`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
    });
  });

  describe('OU_ADMIN Permissions', () => {
    it('should allow OU_ADMIN to access nodes in their OU', async () => {
      await request(app.getHttpServer())
        .get(`/directory/${normalUser.id}/ancestors`)
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .expect(200);
    });

    it('should allow OU_ADMIN to create nodes in their OU', async () => {
      const response = await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .send({
          name: 'new.engineer',
          type: NodeType.USER,
          parentId: engineeringOu.id,
          password: 'password123',
          attributes: {
            email: 'new.engineer@company.com',
          },
        })
        .expect(201);

      expect(response.body.name).toBe('new.engineer');
    });

    it('should deny OU_ADMIN from accessing nodes outside their OU', async () => {
      await request(app.getHttpServer())
        .get(`/directory/${salesOu.id}/ancestors`)
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .expect(403);
    });

    it('should deny OU_ADMIN from creating nodes outside their OU', async () => {
      await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .send({
          name: 'new.sales',
          type: NodeType.USER,
          parentId: salesOu.id,
          password: 'password123',
        })
        .expect(403);
    });

    it('should allow OU_ADMIN to search within their scope', async () => {
      const response = await request(app.getHttpServer())
        .get(`/directory/scope/${engineeringOu.id}?q=juan`)
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('USER Permissions', () => {
    it('should allow USER to read the directory tree', async () => {
      await request(app.getHttpServer())
        .get('/directory/tree')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('should deny USER from creating nodes', async () => {
      await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'unauthorized.node',
          type: NodeType.OU,
          parentId: engineeringOu.id,
        })
        .expect(403);
    });

    it('should deny USER from performing updates', async () => {
      await request(app.getHttpServer())
        .post('/directory/move')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          nodeId: normalUser.id,
          newParentId: salesOu.id,
        })
        .expect(403);
    });
  });

  describe('Unauthenticated Access', () => {
    it('should deny access without token', async () => {
      await request(app.getHttpServer())
        .get('/directory/tree')
        .expect(401);
    });

    it('should deny access with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/directory/tree')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });
  });

  describe('Data Validation', () => {
    it('should validate that USER nodes cannot have children', async () => {
      await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'child.of.user',
          type: NodeType.OU,
          parentId: normalUser.id,  // USER cannot have children
        })
        .expect(400);
    });

    it('should validate sibling name uniqueness', async () => {
      // Try to create a node with the same name as an existing sibling
      await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'juan.perez',  // Already exists under engineering
          type: NodeType.USER,
          parentId: engineeringOu.id,
          password: 'password123',
        })
        .expect(400);
    });
  });

  describe('Complex Hierarchical Scenarios', () => {
    it('should correctly validate nested descendants', async () => {
      // Create nested structure: Engineering > DevTeam > Backend > junior.dev
      const devTeam = await repository.save(
        repository.create({
          name: 'devteam',
          type: NodeType.OU,
          parent: engineeringOu,
        }),
      );

      const backend = await repository.save(
        repository.create({
          name: 'backend',
          type: NodeType.OU,
          parent: devTeam,
        }),
      );

      const juniorDev = await repository.save(
        repository.create({
          name: 'junior.dev',
          type: NodeType.USER,
          password: 'pass123',
          parent: backend,
          attributes: { email: 'junior@company.com' },
        }),
      );

      // OU_ADMIN of Engineering should have access to deeply nested junior.dev
      await request(app.getHttpServer())
        .get(`/directory/${juniorDev.id}/ancestors`)
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .expect(200);
    });
  });
});
