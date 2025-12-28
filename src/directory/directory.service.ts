// src/directory/directory.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm'; // OJO: Usamos TreeRepository, no Repository normal

import { DirectoryNode, NodeType } from '@/directory/entities/directory-node.entity';
import { CreateNodeDto } from '@/directory/dto/create-node.dto';

@Injectable()
export class DirectoryService {
  constructor(
    @InjectRepository(DirectoryNode)
    private readonly nodeRepository: TreeRepository<DirectoryNode>,
  ) { }

  /**
   * Crea un nuevo nodo (OU, Usuario, etc.) en el árbol.
   * TypeORM calcula automáticamente el 'path' materializado.
   */
  async create(createNodeDto: CreateNodeDto): Promise<DirectoryNode> {
    const { name, type, parentId, attributes, password } = createNodeDto;

    const newNode = new DirectoryNode();
    newNode.name = name;
    newNode.type = type;
    newNode.attributes = attributes || {};

    // Solo asignamos password si es un USER
    if (password && type === 'USER') {
      newNode.password = password;
    }

    if (parentId) {
      const parent = await this.nodeRepository.findOneBy({ id: parentId });
      if (!parent) {
        throw new NotFoundException(`El nodo padre con ID ${parentId} no existe.`);
      }

      // Validación: Un USER no puede tener hijos
      if (parent.type === NodeType.USER) {
        throw new BadRequestException('Un nodo de tipo USER no puede tener hijos.');
      }

      newNode.parent = parent;

      // Validación Opcional: Verificar unicidad de nombre entre hermanos
      // (Evitar dos 'Juan' en la misma OU)
      const sibling = await this.nodeRepository.findOne({
        where: { parent: { id: parentId }, name: name }
      });
      if (sibling) {
        throw new BadRequestException(`Ya existe un nodo llamado '${name}' bajo este padre.`);
      }
    }

    // Al guardar, TypeORM genera el mpath (ej: "1.5.12.")
    return await this.nodeRepository.save(newNode);
  }

  /**
   * EL KILLER FEATURE: Búsqueda eficiente en sub-árbol.
   * Busca usuarios u OUs dentro de un nodo específico (y todos sus descendientes).
   * * @param rootId El ID del nodo desde donde empezar (ej: ID de la OU 'Ventas')
   * @param searchTerm Texto para filtrar por nombre
   */
  async searchInSubtree(rootId: number, searchTerm?: string): Promise<DirectoryNode[]> {
    // 1. Obtenemos el nodo raíz (el 'scope' de la búsqueda)
    const rootNode = await this.nodeRepository.findOneBy({ id: rootId });
    if (!rootNode) {
      throw new NotFoundException(`Nodo raíz con ID ${rootId} no encontrado.`);
    }

    // 2. Usamos el QueryBuilder especializado para Árboles
    // Esto genera automáticamente el SQL: WHERE mpath LIKE 'rootPath%'
    const qb = this.nodeRepository.createDescendantsQueryBuilder(
      'node',
      'closure',
      rootNode
    );

    // 3. Aplicamos filtros adicionales SI existen
    if (searchTerm) {
      qb.andWhere(
        '(node.name ILIKE :search OR node.attributes->>\'email\' ILIKE :search)',
        { search: `%${searchTerm}%` }
      );
    }

    // 4. Ejecutamos
    // Excluimos el nodo raíz de los resultados si solo queremos el contenido
    qb.andWhere('node.id != :rootId', { rootId });

    return await qb.getMany();
  }

  /**
   * Mueve una rama completa a otro padre.
   * Con Materialized Path, TypeORM actualizará los strings de path de todos los hijos.
   */
  async moveBranch(nodeId: number, newParentId: number): Promise<DirectoryNode> {
    const node = await this.nodeRepository.findOne({
      where: { id: nodeId },
      relations: ['parent']
    });
    const newParent = await this.nodeRepository.findOneBy({ id: newParentId });

    if (!node || !newParent) throw new NotFoundException("Nodo o nuevo padre no encontrados");

    // Evitar ciclos (Mover un padre dentro de su propio hijo)
    // TypeORM suele lanzar error, pero es bueno prevenirlo lógica de negocio si es necesario.

    node.parent = newParent;
    return await this.nodeRepository.save(node); // Esto dispara la actualización masiva de paths
  }

  /**
   * Obtiene la estructura completa en formato anidado (ideal para el Frontend)
   */
  async getFullTree(): Promise<DirectoryNode[]> {
    return await this.nodeRepository.findTrees();
  }

  /**
   * Busca un usuario por su nombre e incluye el password.
   * Usado exclusivamente para autenticación.
   * NOTA: Por defecto, TypeORM no devuelve campos con @Column({ select: false })
   */
  async findUserByNameWithPassword(username: string): Promise<DirectoryNode | null> {
    return await this.nodeRepository
      .createQueryBuilder('node')
      .addSelect('node.password') // Incluimos explícitamente el password
      .where('node.name = :username', { username })
      .getOne();
  }

  /**
   * Busca un nodo por su ID.
   * Incluye el mpath para scope checking.
   */
  async findOne(id: number): Promise<DirectoryNode | null> {
    // Usar getRawOne para obtener TODAS las columnas incluyendo mpath
    const raw = await this.nodeRepository
      .createQueryBuilder('node')
      .where('node.id = :id', { id })
      .getRawOne();

    if (!raw) return null;

    // Mapear el resultado raw a DirectoryNode
    const node = new DirectoryNode();
    node.id = raw.node_id;
    node.name = raw.node_name;
    node.type = raw.node_type;
    node.attributes = raw.node_attributes;
    node.roles = raw.node_roles;
    node.adminOfNodeId = raw.node_adminOfNodeId;
    node.mpath = raw.node_mpath;  // ¡Aquí está el mpath!
    node.createdAt = raw.node_createdAt;
    node.updatedAt = raw.node_updatedAt;

    return node;
  }

  /**
   * Obtiene todos los ancestros de un nodo (breadcrumbs).
   * Útil para mostrar la ruta completa: com > myco > devs > Juan
   * @param nodeId ID del nodo del cual obtener ancestros
   * @returns Array de nodos ancestros desde la raíz hasta el padre del nodo
   */
  async getAncestors(nodeId: number): Promise<DirectoryNode[]> {
    const node = await this.nodeRepository.findOneBy({ id: nodeId });
    if (!node) {
      throw new NotFoundException(`Nodo con ID ${nodeId} no encontrado.`);
    }

    // findAncestors incluye al nodo mismo, por lo que lo devuelve también
    return await this.nodeRepository.findAncestors(node);
  }

  /**
   * Búsqueda plana (flat) en todo el directorio.
   * Busca usuarios por nombre o email ignorando la estructura jerárquica.
   * @param searchTerm Término de búsqueda
   * @param type Tipo de nodo opcional para filtrar (ej: solo USER)
   */
  async flatSearch(searchTerm: string, type?: NodeType): Promise<DirectoryNode[]> {
    const qb = this.nodeRepository.createQueryBuilder('node');

    qb.where(
      '(node.name ILIKE :search OR node.attributes->>\'email\' ILIKE :search)',
      { search: `%${searchTerm}%` }
    );

    if (type) {
      qb.andWhere('node.type = :type', { type });
    }

    return await qb.getMany();
  }
}