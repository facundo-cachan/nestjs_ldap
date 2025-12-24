import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm';

import { DirectoryNode } from '../../directory/entities/directory-node.entity';

@Injectable()
export class HierarchyGuard implements CanActivate {
  constructor(
    @InjectRepository(DirectoryNode)
    private readonly nodeRepository: TreeRepository<DirectoryNode>,
    private readonly reflector: Reflector,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Asumimos que AuthGuard ya pobló esto

    // 1. Si no hay usuario, denegar (Safety check)
    if (!user || !user.nodeId) {
      throw new ForbiddenException('Usuario no identificado en el árbol');
    }

    // 2. Bypass para Super Admin (Opcional: Si el Root siempre tiene acceso total)
    // if (user.roles.includes('SUPER_ADMIN')) return true;

    // 3. Obtener el Nodo del Solicitante (Requester)
    // Nota: Idealmente esto vendría en el JWT para ahorrar esta query.
    const requesterNode = await this.nodeRepository.findOne({
      where: { id: user.nodeId }
      // Importante: Necesitamos la columna 'mpath' oculta si TypeORM no la expone por defecto
      // O asegurarnos de que la entidad tenga una columna @Column({ select: false }) mpath: string;
    });

    if (!requesterNode) throw new ForbiddenException('Nodo del usuario solicitante no encontrado');

    // ---------------------------------------------------------
    // CASO A: Modificación/Lectura de un nodo existente (:id)
    // ---------------------------------------------------------
    const targetId = request.params.id;
    if (targetId) {
      // Regla: No puedes editarte a ti mismo si las reglas de negocio lo prohíben,
      // pero generalmente permitimos 'Self-Edit' básico.
      if (Number(targetId) === user.nodeId) return true;

      const targetNode = await this.nodeRepository.findOne({ where: { id: Number(targetId) } });
      if (!targetNode) throw new NotFoundException('Nodo objetivo no encontrado');

      // 🔥 LA MAGIA HÍBRIDA: Validación de Materialized Path
      // Verificamos si el path del objetivo EMPIEZA con el path del solicitante.
      // TypeORM suele llamar a esta columna 'mpath' internamente.
      // Suponiendo que hemos mapeado 'mpath' en la entidad o usamos query directa:

      const isDescendant = await this.checkIsDescendant(requesterNode, targetNode);

      if (!isDescendant) {
        throw new ForbiddenException(
          'Acceso Denegado: Este recurso está fuera de tu Unidad Organizativa (Scope).'
        );
      }
      return true;
    }

    // ---------------------------------------------------------
    // CASO B: Creación de un nodo nuevo (POST con parentId)
    // ---------------------------------------------------------
    const parentId = request.body.parentId;
    if (parentId) {
      // Regla: Solo puedes crear hijos debajo de tu propia rama.
      if (Number(parentId) === user.nodeId) return true; // Crear hijo directo

      const parentNode = await this.nodeRepository.findOne({ where: { id: Number(parentId) } });
      if (!parentNode) throw new BadRequestException('Parent ID no válido');

      const isDescendant = await this.checkIsDescendant(requesterNode, parentNode);

      if (!isDescendant) {
        throw new ForbiddenException(
          'No puedes crear nodos en una rama ajena a la tuya.'
        );
      }
      return true;
    }

    return true; // Si no hay ID ni parentID, dejamos pasar (quizás es un Listado general filtrado por otro lado)
  }

  /**
   * Helper para verificar descendencia usando Materialized Path.
   * Si tu entidad no expone 'mpath', usamos las funciones del TreeRepository.
   */
  private async checkIsDescendant(ancestor: DirectoryNode, descendant: DirectoryNode): Promise<boolean> {
    // OPCIÓN 1: Rápida (String Compare) - Requiere exponer columna 'mpath' en la entidad
    // return descendant.mpath.startsWith(ancestor.mpath);

    // OPCIÓN 2: Segura (TypeORM Nativo) - Un poco más lenta (Query count) pero a prueba de fallos
    // Busca si 'descendant' es realmente un descendiente de 'ancestor'
    const count = await this.nodeRepository
      .createDescendantsQueryBuilder('node', 'closure', ancestor)
      .where('node.id = :id', { id: descendant.id })
      .getCount();

    return count > 0;
  }
}