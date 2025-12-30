import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, TreeRepository } from 'typeorm';
import * as dotenv from 'dotenv';

// Cargar variables de entorno desde .env
dotenv.config();

import { AppModule } from '@/app.module';
import { DirectoryNode, NodeType } from '@/directory/entities/directory-node.entity';
import { AuditLog } from '@/audit/entities/audit-log.entity';

/**
 * Tests E2E para validar el Sistema de Auditoría (Fase 5 de AUTH_TASKS.md)
 * 
 * @description
 * Verifica que todas las acciones administrativas se registren correctamente
 * en el sistema de auditoría con toda la información requerida:
 * - Who: ID del Manager
 * - What: Action (CREATE, READ, UPDATE, DELETE, MOVE)
 * - Target: ID del empleado
 * - Scope: Path en el momento de la acción
 */
describe('Audit System (e2e)', () => {
  let app: INestApplication;
  let directoryRepository: TreeRepository<DirectoryNode>;
  let auditRepository: Repository<AuditLog>;
  let superAdminToken: string;
  let ouAdminToken: string;

  // Nodos de prueba
  let rootOu: DirectoryNode;
  let salesOu: DirectoryNode;
  let superAdminUser: DirectoryNode;
  let salesAdminUser: DirectoryNode;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    directoryRepository = moduleFixture.get(getRepositoryToken(DirectoryNode));
    auditRepository = moduleFixture.get(getRepositoryToken(AuditLog));

    await setupTestTree();
  });

  afterAll(async () => {
    await directoryRepository.query('TRUNCATE TABLE directory_node RESTART IDENTITY CASCADE');
    await auditRepository.query('TRUNCATE TABLE audit_log RESTART IDENTITY CASCADE');
    await app.close();
  });

  async function setupTestTree() {
    await directoryRepository.query('TRUNCATE TABLE directory_node RESTART IDENTITY CASCADE');
    await auditRepository.query('TRUNCATE TABLE audit_log RESTART IDENTITY CASCADE');

    // Root OU
    rootOu = await directoryRepository.save(
      directoryRepository.create({
        name: 'company',
        type: NodeType.OU,
        attributes: {},
      }),
    );

    // Sales OU
    salesOu = await directoryRepository.save(
      directoryRepository.create({
        name: 'sales',
        type: NodeType.OU,
        parent: rootOu,
        attributes: {},
      }),
    );

    // Super Admin
    superAdminUser = await directoryRepository.save(
      directoryRepository.create({
        name: 'superadmin',
        type: NodeType.USER,
        password: 'admin123',
        parent: rootOu,
        attributes: {
          isSuperAdmin: true,
          email: 'superadmin@company.com',
        },
      }),
    );

    // Sales Admin (OU_ADMIN)
    salesAdminUser = await directoryRepository.save(
      directoryRepository.create({
        name: 'sales.admin',
        type: NodeType.USER,
        password: 'salesadmin123',
        parent: salesOu,
        attributes: {
          isAdmin: true,
          adminOf: salesOu.id.toString(),
          email: 'sales.admin@company.com',
        },
      }),
    );

    // Obtener tokens
    superAdminToken = await getAuthToken('superadmin', 'admin123');
    ouAdminToken = await getAuthToken('sales.admin', 'salesadmin123');
  }

  async function getAuthToken(username: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password })
      .expect(201);

    return response.body.access_token;
  }

  describe('🟣 Fase 5: Audit Trail - CREATE Operations', () => {
    it('should log when OU_ADMIN creates a node', async () => {
      const initialCount = await auditRepository.count();

      // Crear un nuevo usuario
      const response = await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .send({
          name: 'new.sales.user',
          type: NodeType.USER,
          parentId: salesOu.id,
          password: 'password123',
          attributes: {
            email: 'new.sales@company.com',
          },
        })
        .expect(201);

      // Verificar que se creó un registro de auditoría
      const finalCount = await auditRepository.count();
      expect(finalCount).toBe(initialCount + 1);

      // Obtener el último registro de auditoría
      const auditLog = await auditRepository.findOne({
        where: { targetId: response.body.id },
        order: { createdAt: 'DESC' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('CREATE');
      expect(auditLog?.actorId).toBe(salesAdminUser.id);
      expect(auditLog?.actorName).toBe('sales.admin');
      expect(auditLog?.actorRole).toBe('OU_ADMIN');
      expect(auditLog?.targetId).toBe(response.body.id);
      expect(auditLog?.targetName).toBe('new.sales.user');
      expect(auditLog?.targetType).toBe('USER');
      expect(auditLog?.scope).toBeDefined();
      expect(auditLog?.metadata).toBeDefined();
      expect(auditLog?.metadata?.parentId).toBe(salesOu.id);
      expect(auditLog?.status).toBe('SUCCESS');
    });

    it('should log when SUPER_ADMIN creates a node', async () => {
      const initialCount = await auditRepository.count();

      // Crear un nuevo OU
      const response = await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'marketing',
          type: NodeType.OU,
          parentId: rootOu.id,
          attributes: {
            description: 'Marketing Department',
          },
        })
        .expect(201);

      // Verificar que se creó un registro de auditoría
      const finalCount = await auditRepository.count();
      expect(finalCount).toBe(initialCount + 1);

      // Obtener el último registro de auditoría
      const auditLog = await auditRepository.findOne({
        where: { targetId: response.body.id },
        order: { createdAt: 'DESC' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('CREATE');
      expect(auditLog?.actorId).toBe(superAdminUser.id);
      expect(auditLog?.actorName).toBe('superadmin');
      expect(auditLog?.actorRole).toBe('SUPER_ADMIN');
      expect(auditLog?.targetType).toBe('OU');
    });
  });

  describe('🟣 Fase 5: Audit Trail - READ Operations', () => {
    it('should log when OU_ADMIN reads a node', async () => {
      const initialCount = await auditRepository.count();

      // Leer un nodo
      await request(app.getHttpServer())
        .get(`/directory/${salesAdminUser.id}`)
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .expect(200);

      // Verificar que se creó un registro de auditoría
      const finalCount = await auditRepository.count();
      expect(finalCount).toBe(initialCount + 1);

      // Obtener el último registro de auditoría
      const auditLog = await auditRepository.findOne({
        where: { 
          action: 'READ',
          targetId: salesAdminUser.id 
        },
        order: { createdAt: 'DESC' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('READ');
      expect(auditLog?.actorId).toBe(salesAdminUser.id);
      expect(auditLog?.targetId).toBe(salesAdminUser.id);
    });

    it('should log when SUPER_ADMIN reads a node', async () => {
      const initialCount = await auditRepository.count();

      // Leer un nodo
      await request(app.getHttpServer())
        .get(`/directory/${salesOu.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      // Verificar que se creó un registro de auditoría
      const finalCount = await auditRepository.count();
      expect(finalCount).toBe(initialCount + 1);

      // Obtener el último registro de auditoría
      const auditLog = await auditRepository.findOne({
        where: { 
          action: 'READ',
          targetId: salesOu.id 
        },
        order: { createdAt: 'DESC' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('READ');
      expect(auditLog?.actorRole).toBe('SUPER_ADMIN');
    });
  });

  describe('🟣 Fase 5: Audit Trail - MOVE Operations', () => {
    it('should log when OU_ADMIN moves a node', async () => {
      // Crear un usuario para mover
      const userResponse = await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .send({
          name: 'movable.user',
          type: NodeType.USER,
          parentId: salesOu.id,
          password: 'password123',
          attributes: {
            email: 'movable@company.com',
          },
        })
        .expect(201);

      // Crear un sub-OU para mover el usuario
      const subOuResponse = await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .send({
          name: 'sales.sub',
          type: NodeType.OU,
          parentId: salesOu.id,
          attributes: {},
        })
        .expect(201);

      const initialCount = await auditRepository.count();

      // Mover el usuario al sub-OU
      await request(app.getHttpServer())
        .post('/directory/move')
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .send({
          nodeId: userResponse.body.id,
          newParentId: subOuResponse.body.id,
        })
        .expect(200);

      // Verificar que se creó un registro de auditoría
      const finalCount = await auditRepository.count();
      expect(finalCount).toBeGreaterThan(initialCount);

      // Obtener el registro de auditoría del MOVE
      const auditLog = await auditRepository.findOne({
        where: { 
          action: 'MOVE',
          targetId: userResponse.body.id 
        },
        order: { createdAt: 'DESC' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('MOVE');
      expect(auditLog?.actorId).toBe(salesAdminUser.id);
      expect(auditLog?.targetId).toBe(userResponse.body.id);
      expect(auditLog?.metadata).toBeDefined();
      expect(auditLog?.metadata?.newParentId).toBe(subOuResponse.body.id);
    });
  });

  describe('🟣 Fase 5: Audit Trail - DELETE Operations', () => {
    it('should log when OU_ADMIN attempts to delete a node', async () => {
      // Crear un usuario para eliminar
      const userResponse = await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .send({
          name: 'deletable.user',
          type: NodeType.USER,
          parentId: salesOu.id,
          password: 'password123',
          attributes: {
            email: 'deletable@company.com',
          },
        })
        .expect(201);

      const initialCount = await auditRepository.count();

      // Intentar eliminar el usuario
      await request(app.getHttpServer())
        .delete(`/directory/${userResponse.body.id}`)
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .expect(200);

      // Verificar que se creó un registro de auditoría
      const finalCount = await auditRepository.count();
      expect(finalCount).toBeGreaterThan(initialCount);

      // Obtener el registro de auditoría del DELETE
      const auditLog = await auditRepository.findOne({
        where: { 
          action: 'DELETE',
          targetId: userResponse.body.id 
        },
        order: { createdAt: 'DESC' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('DELETE');
      expect(auditLog?.actorId).toBe(salesAdminUser.id);
      expect(auditLog?.targetId).toBe(userResponse.body.id);
      expect(auditLog?.targetName).toBe('deletable.user');
    });
  });

  describe('🟣 Fase 5: Audit Trail - Metadata and Context', () => {
    it('should include IP address and User Agent in audit logs', async () => {
      // Crear un nodo con headers específicos
      const response = await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .set('User-Agent', 'Test-Agent/1.0')
        .send({
          name: 'test.user',
          type: NodeType.USER,
          parentId: salesOu.id,
          password: 'password123',
          attributes: {
            email: 'test@company.com',
          },
        })
        .expect(201);

      // Obtener el registro de auditoría
      const auditLog = await auditRepository.findOne({
        where: { targetId: response.body.id },
        order: { createdAt: 'DESC' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.ipAddress).toBeDefined();
      expect(auditLog?.userAgent).toBeDefined();
      expect(auditLog?.userAgent).toContain('Test-Agent');
    });

    it('should include scope (mpath) in audit logs', async () => {
      // Crear un nodo
      const response = await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${ouAdminToken}`)
        .send({
          name: 'scope.test.user',
          type: NodeType.USER,
          parentId: salesOu.id,
          password: 'password123',
          attributes: {
            email: 'scope.test@company.com',
          },
        })
        .expect(201);

      // Obtener el registro de auditoría
      const auditLog = await auditRepository.findOne({
        where: { targetId: response.body.id },
        order: { createdAt: 'DESC' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.scope).toBeDefined();
      expect(auditLog?.scope).toContain('.');
    });

    it('should track all required fields (Who, What, Target, Scope)', async () => {
      // Crear un nodo
      const response = await request(app.getHttpServer())
        .post('/directory')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'complete.test.user',
          type: NodeType.USER,
          parentId: rootOu.id,
          password: 'password123',
          attributes: {
            email: 'complete.test@company.com',
          },
        })
        .expect(201);

      // Obtener el registro de auditoría
      const auditLog = await auditRepository.findOne({
        where: { targetId: response.body.id },
        order: { createdAt: 'DESC' },
      });

      expect(auditLog).toBeDefined();

      // Verificar WHO
      expect(auditLog?.actorId).toBe(superAdminUser.id);
      expect(auditLog?.actorName).toBe('superadmin');
      expect(auditLog?.actorRole).toBe('SUPER_ADMIN');

      // Verificar WHAT
      expect(auditLog?.action).toBe('CREATE');

      // Verificar TARGET
      expect(auditLog?.targetId).toBe(response.body.id);
      expect(auditLog?.targetName).toBe('complete.test.user');
      expect(auditLog?.targetType).toBe('USER');

      // Verificar SCOPE
      expect(auditLog?.scope).toBeDefined();

      // Verificar campos adicionales
      expect(auditLog?.metadata).toBeDefined();
      expect(auditLog?.status).toBe('SUCCESS');
      expect(auditLog?.createdAt).toBeDefined();
    });
  });

  describe('🟣 Fase 5: Audit Trail - Query Capabilities', () => {
    it('should be able to query audit logs by actor', async () => {
      // Obtener todos los logs del OU_ADMIN
      const logs = await auditRepository.find({
        where: { actorId: salesAdminUser.id },
        order: { createdAt: 'DESC' },
      });

      expect(logs.length).toBeGreaterThan(0);
      logs.forEach(log => {
        expect(log.actorId).toBe(salesAdminUser.id);
      });
    });

    it('should be able to query audit logs by action type', async () => {
      // Obtener todos los logs de CREATE
      const logs = await auditRepository.find({
        where: { action: 'CREATE' },
        order: { createdAt: 'DESC' },
      });

      expect(logs.length).toBeGreaterThan(0);
      logs.forEach(log => {
        expect(log.action).toBe('CREATE');
      });
    });

    it('should be able to query audit logs by date range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Obtener logs de la última hora
      const logs = await auditRepository
        .createQueryBuilder('audit')
        .where('audit.createdAt >= :start', { start: oneHourAgo })
        .andWhere('audit.createdAt <= :end', { end: now })
        .orderBy('audit.createdAt', 'DESC')
        .getMany();

      expect(logs.length).toBeGreaterThan(0);
    });
  });
});
