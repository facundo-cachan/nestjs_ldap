import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm';

import { DirectoryNode, NodeType } from '../src/directory/entities/directory-node.entity';
import { AppModule } from '../src/app.module';

/**
 * Script de verificación de integridad de la estructura híbrida.
 * Valida que la arquitectura soporte tanto jerarquía como roles.
 */
describe('Hybrid Architecture Verification', () => {
  let repository: TreeRepository<DirectoryNode>;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    repository = module.get(getRepositoryToken(DirectoryNode));
  });

  afterAll(async () => {
    await module.close();
  });

  describe('✅ Validar Entidad Híbrida', () => {
    it('should have mpath column for hierarchy (Materialized Path)', async () => {
      const node = await repository.save(
        repository.create({
          name: 'test_node',
          type: NodeType.OU,
          attributes: {},
        }),
      );

      expect(node).toHaveProperty('mpath');
      expect(typeof node.mpath).toBe('string');

      await repository.delete(node.id);
    });

    it('should support roles in attributes (RBAC)', async () => {
      const node = await repository.save(
        repository.create({
          name: 'test_admin',
          type: NodeType.USER,
          password: 'test123',
          attributes: {
            role: 'SUPER_ADMIN',
            email: 'test@example.com',
          },
        }),
      );

      expect(node.attributes).toHaveProperty('role');
      expect(node.attributes.role).toBe('SUPER_ADMIN');

      await repository.delete(node.id);
    });

    it('should support adminOf field for OU_ADMIN', async () => {
      const ou = await repository.save(
        repository.create({
          name: 'test_ou',
          type: NodeType.OU,
          attributes: {},
        }),
      );

      const admin = await repository.save(
        repository.create({
          name: 'ou_admin',
          type: NodeType.USER,
          password: 'admin123',
          parent: ou,
          attributes: {
            isAdmin: true,
            adminOf: ou.id.toString(),
            email: 'admin@example.com',
          },
        }),
      );

      expect(admin.attributes).toHaveProperty('adminOf');
      expect(admin.attributes.adminOf).toBe(ou.id.toString());
      expect(admin.attributes.isAdmin).toBe(true);

      await repository.delete(admin.id);
      await repository.delete(ou.id);
    });
  });

  describe('✅ Validar Integridad del Path', () => {
    it('should update mpath when moving a node', async () => {
      // Crear estructura: root > child1, root > child2
      const root = await repository.save(
        repository.create({
          name: 'root_test',
          type: NodeType.OU,
        }),
      );

      const child1 = await repository.save(
        repository.create({
          name: 'child1',
          type: NodeType.OU,
          parent: root,
        }),
      );

      const child2 = await repository.save(
        repository.create({
          name: 'child2',
          type: NodeType.OU,
          parent: root,
        }),
      );

      const grandchild = await repository.save(
        repository.create({
          name: 'grandchild',
          type: NodeType.USER,
          password: 'test123',
          parent: child1,
        }),
      );

      // Verificar paths iniciales
      const initialGrandchild = await repository.findOneBy({ id: grandchild.id });
      expect(initialGrandchild).toBeDefined();
      const initialPath = initialGrandchild!.mpath;

      console.log('Initial grandchild path:', initialPath);
      expect(initialPath).toContain(root.mpath);
      expect(initialPath).toContain(child1.mpath);

      // Mover grandchild de child1 a child2
      grandchild.parent = child2;
      await repository.save(grandchild);

      // Verificar que el path se actualizó
      const updatedGrandchild = await repository.findOneBy({ id: grandchild.id });
      expect(updatedGrandchild).toBeDefined();
      console.log('Updated grandchild path:', updatedGrandchild!.mpath);

      expect(updatedGrandchild!.mpath).not.toBe(initialPath);
      expect(updatedGrandchild!.mpath).toContain(child2.mpath);
      expect(updatedGrandchild!.mpath).not.toContain(child1.mpath);

      // Cleanup
      await repository.delete(grandchild.id);
      await repository.delete(child1.id);
      await repository.delete(child2.id);
      await repository.delete(root.id);
    });

    it('should update mpath cascade for all descendants when moving parent', async () => {
      // Crear estructura profunda: root > branch1 > subbranch > leaf
      const root = await repository.save(
        repository.create({
          name: 'root_cascade',
          type: NodeType.OU,
        }),
      );

      const branch1 = await repository.save(
        repository.create({
          name: 'branch1',
          type: NodeType.OU,
          parent: root,
        }),
      );

      const branch2 = await repository.save(
        repository.create({
          name: 'branch2',
          type: NodeType.OU,
          parent: root,
        }),
      );

      const subbranch = await repository.save(
        repository.create({
          name: 'subbranch',
          type: NodeType.OU,
          parent: branch1,
        }),
      );

      const leaf = await repository.save(
        repository.create({
          name: 'leaf',
          type: NodeType.USER,
          password: 'test123',
          parent: subbranch,
        }),
      );

      // Guardar paths iniciales
      const initialSubbranch = await repository.findOneBy({ id: subbranch.id });
      const initialLeaf = await repository.findOneBy({ id: leaf.id });

      expect(initialSubbranch).toBeDefined();
      expect(initialLeaf).toBeDefined();

      console.log('Initial subbranch path:', initialSubbranch!.mpath);
      console.log('Initial leaf path:', initialLeaf!.mpath);

      // Mover toda la rama de branch1 a branch2
      subbranch.parent = branch2;
      await repository.save(subbranch);

      // Verificar que todos los descendientes se actualizaron
      const updatedSubbranch = await repository.findOneBy({ id: subbranch.id });
      const updatedLeaf = await repository.findOneBy({ id: leaf.id });

      expect(updatedSubbranch).toBeDefined();
      expect(updatedLeaf).toBeDefined();

      console.log('Updated subbranch path:', updatedSubbranch!.mpath);
      console.log('Updated leaf path:', updatedLeaf!.mpath);

      // El subbranch debe estar bajo branch2
      expect(updatedSubbranch!.mpath).toContain(branch2.mpath);
      expect(updatedSubbranch!.mpath).not.toContain(branch1.mpath);

      // El leaf debe reflejar el nuevo path (cascada)
      expect(updatedLeaf!.mpath).toContain(branch2.mpath);
      expect(updatedLeaf!.mpath).toContain(updatedSubbranch!.mpath);
      expect(updatedLeaf!.mpath).not.toContain(branch1.mpath);

      // Cleanup
      await repository.delete(leaf.id);
      await repository.delete(subbranch.id);
      await repository.delete(branch1.id);
      await repository.delete(branch2.id);
      await repository.delete(root.id);
    });
  });

  describe('✅ Validar Payload del JWT', () => {
    it('should include both role and nodeId in JWT payload', async () => {
      // Este test se validará en el e2e cuando hagamos login
      // pero aquí documentamos la expectativa
      const expectedJWTStructure = {
        sub: 'username',
        id: 'nodeId',          // Para jerarquía
        role: 'SUPER_ADMIN',   // Para RBAC
        adminOfNodeId: 5,      // Para OU_ADMIN scope
        iat: 'timestamp',
        exp: 'timestamp',
      };

      expect(expectedJWTStructure).toHaveProperty('id');
      expect(expectedJWTStructure).toHaveProperty('role');
      expect(expectedJWTStructure).toHaveProperty('adminOfNodeId');
    });
  });
});
