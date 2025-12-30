import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm';
import * as dotenv from 'dotenv';

// Cargar variables de entorno desde .env
dotenv.config();

import { AppModule } from '@/app.module';
import { DirectoryNode, NodeType } from '@/directory/entities/directory-node.entity';

/**
 * Tests E2E para validar la Fase 1 de AUTH_TASKS.md:
 * - Validar Integridad del Path (actualización en cascada de mpath)
 * 
 * @description
 * Este test verifica que cuando se mueve un nodo padre, el mpath de todos
 * sus descendientes se actualiza correctamente en cascada.
 * 
 * Esto es CRÍTICO para la seguridad del sistema, ya que el HierarchyGuard
 * depende del mpath para validar el scope de acceso.
 */
describe('AUTH_TASKS - Fase 1: Path Integrity (e2e)', () => {
  let app: INestApplication;
  let repository: TreeRepository<DirectoryNode>;

  // Nodos de prueba
  let root: DirectoryNode;
  let salesOu: DirectoryNode;
  let marketingOu: DirectoryNode;
  let salesSubOu: DirectoryNode;
  let salesUser: DirectoryNode;
  let salesSubUser: DirectoryNode;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    repository = moduleFixture.get(getRepositoryToken(DirectoryNode));

    await setupTestTree();
  });

  afterAll(async () => {
    await repository.query('TRUNCATE TABLE directory_node RESTART IDENTITY CASCADE');
    await app.close();
  });

  /**
   * Estructura de árbol inicial:
   * Root (1.)
   * ├── Sales (1.2.)
   * │   ├── Sales Sub OU (1.2.3.)
   * │   │   └── sales.sub.user (1.2.3.4.)
   * │   └── sales.user (1.2.5.)
   * └── Marketing (1.6.)
   */
  async function setupTestTree() {
    await repository.query('TRUNCATE TABLE directory_node RESTART IDENTITY CASCADE');

    // Root OU
    root = await repository.save(
      repository.create({
        name: 'company',
        type: NodeType.OU,
        attributes: {},
      }),
    );

    // Sales OU
    salesOu = await repository.save(
      repository.create({
        name: 'sales',
        type: NodeType.OU,
        parent: root,
        attributes: {},
      }),
    );

    // Sales Sub OU
    salesSubOu = await repository.save(
      repository.create({
        name: 'sales.sub',
        type: NodeType.OU,
        parent: salesOu,
        attributes: {},
      }),
    );

    // Sales Sub User
    salesSubUser = await repository.save(
      repository.create({
        name: 'sales.sub.user',
        type: NodeType.USER,
        password: 'user123',
        parent: salesSubOu,
        attributes: {
          email: 'sales.sub.user@company.com',
        },
      }),
    );

    // Sales User
    salesUser = await repository.save(
      repository.create({
        name: 'sales.user',
        type: NodeType.USER,
        password: 'user123',
        parent: salesOu,
        attributes: {
          email: 'sales.user@company.com',
        },
      }),
    );

    // Marketing OU
    marketingOu = await repository.save(
      repository.create({
        name: 'marketing',
        type: NodeType.OU,
        parent: root,
        attributes: {},
      }),
    );
  }

  describe('🟢 Fase 1: Validar Integridad del Path', () => {
    it('should update mpath of parent node when moved', async () => {
      // Obtener el mpath inicial de Sales OU
      const salesBefore = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesOu.id })
        .getRawOne();

      console.log('Sales OU mpath BEFORE move:', salesBefore.node_mpath);

      // Mover Sales OU a Marketing (cambiar de padre)
      const salesNode = await repository.findOne({
        where: { id: salesOu.id },
        relations: ['parent'],
      });

      if (!salesNode) {
        throw new Error('Sales node not found');
      }

      salesNode.parent = marketingOu;
      await repository.save(salesNode);

      // Obtener el mpath actualizado de Sales OU
      const salesAfter = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesOu.id })
        .getRawOne();

      console.log('Sales OU mpath AFTER move:', salesAfter.node_mpath);

      // Verificar que el mpath del padre se actualizó
      expect(salesAfter.node_mpath).not.toBe(salesBefore.node_mpath);
      expect(salesAfter.node_mpath).toContain(marketingOu.id.toString());
    });

    it('should update mpath of ALL descendants in cascade when parent is moved', async () => {
      // Obtener los mpaths iniciales de todos los descendientes
      const salesSubOuBefore = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesSubOu.id })
        .getRawOne();

      const salesSubUserBefore = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesSubUser.id })
        .getRawOne();

      const salesUserBefore = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesUser.id })
        .getRawOne();

      console.log('BEFORE move:');
      console.log('  Sales Sub OU mpath:', salesSubOuBefore.node_mpath);
      console.log('  Sales Sub User mpath:', salesSubUserBefore.node_mpath);
      console.log('  Sales User mpath:', salesUserBefore.node_mpath);

      // Mover Sales OU de vuelta a Root
      const salesNode = await repository.findOne({
        where: { id: salesOu.id },
        relations: ['parent'],
      });

      if (!salesNode) {
        throw new Error('Sales node not found');
      }

      salesNode.parent = root;
      await repository.save(salesNode);

      // Obtener los mpaths actualizados de todos los descendientes
      const salesSubOuAfter = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesSubOu.id })
        .getRawOne();

      const salesSubUserAfter = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesSubUser.id })
        .getRawOne();

      const salesUserAfter = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesUser.id })
        .getRawOne();

      console.log('AFTER move:');
      console.log('  Sales Sub OU mpath:', salesSubOuAfter.node_mpath);
      console.log('  Sales Sub User mpath:', salesSubUserAfter.node_mpath);
      console.log('  Sales User mpath:', salesUserAfter.node_mpath);

      // Verificar que TODOS los mpaths se actualizaron en cascada
      expect(salesSubOuAfter.node_mpath).not.toBe(salesSubOuBefore.node_mpath);
      expect(salesSubUserAfter.node_mpath).not.toBe(salesSubUserBefore.node_mpath);
      expect(salesUserAfter.node_mpath).not.toBe(salesUserBefore.node_mpath);

      // Verificar que los nuevos mpaths son consistentes con la nueva jerarquía
      // Todos deberían empezar con el mpath de Sales (que ahora está bajo Root)
      const salesAfter = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesOu.id })
        .getRawOne();

      expect(salesSubOuAfter.node_mpath).toContain(salesAfter.node_mpath);
      expect(salesSubUserAfter.node_mpath).toContain(salesAfter.node_mpath);
      expect(salesUserAfter.node_mpath).toContain(salesAfter.node_mpath);
    });

    it('should maintain correct hierarchy after multiple moves', async () => {
      // Mover Sales Sub OU a Marketing
      const salesSubNode = await repository.findOne({
        where: { id: salesSubOu.id },
        relations: ['parent'],
      });

      if (!salesSubNode) {
        throw new Error('Sales Sub node not found');
      }

      salesSubNode.parent = marketingOu;
      await repository.save(salesSubNode);

      // Verificar que Sales Sub User (hijo de Sales Sub OU) también se actualizó
      const salesSubUserAfter = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesSubUser.id })
        .getRawOne();

      const marketingMpath = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: marketingOu.id })
        .getRawOne();

      console.log('Marketing mpath:', marketingMpath.node_mpath);
      console.log('Sales Sub User mpath after move:', salesSubUserAfter.node_mpath);

      // El mpath del usuario debe contener el mpath de Marketing
      expect(salesSubUserAfter.node_mpath).toContain(marketingMpath.node_mpath);
    });
  });

  describe('🔒 Security Implications of Path Integrity', () => {
    it('should ensure HierarchyGuard works correctly after path updates', async () => {
      // Este test verifica que después de mover nodos, el HierarchyGuard
      // sigue funcionando correctamente basándose en los mpaths actualizados

      // Obtener el mpath actualizado de Sales OU
      const salesAfter = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesOu.id })
        .getRawOne();

      // Obtener el mpath de Sales User
      const salesUserAfter = await repository
        .createQueryBuilder('node')
        .where('node.id = :id', { id: salesUser.id })
        .getRawOne();

      // Verificar que el mpath del usuario empieza con el mpath del padre
      // Esto es lo que usa el HierarchyGuard para validar scope
      expect(salesUserAfter.node_mpath.startsWith(salesAfter.node_mpath)).toBe(true);
    });
  });
});
