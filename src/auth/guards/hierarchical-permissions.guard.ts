import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm';

import { DirectoryNode } from '../../directory/entities/directory-node.entity';
import { Permission, Role } from '../enums/role.enum';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * Guard que valida permisos jerárquicos basados en el árbol de directorio.
 * 
 * Lógica:
 * - SUPER_ADMIN: Acceso total a todo
 * - OU_ADMIN: Acceso solo a su OU y todos los descendientes
 * - USER/READONLY: Sin permisos especiales
 * 
 * El guard verifica si el usuario tiene permisos sobre el nodo objetivo
 * consultando la jerarquía usando el mpath.
 */
@Injectable()
export class HierarchicalPermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(DirectoryNode)
    private directoryRepository: TreeRepository<DirectoryNode>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Obtener permisos requeridos del metadata del endpoint
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay permisos específicos requeridos, permitir acceso
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as DirectoryNode & { role?: Role; adminOfNodeId?: number };
    
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // SUPER_ADMIN tiene acceso total
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // Obtener el ID del nodo objetivo desde los parámetros de la request
    const targetNodeId = this.extractTargetNodeId(request);
    
    if (!targetNodeId) {
      // Si no hay nodo objetivo específico, solo validar el rol
      return this.hasBasicPermission(user.role, requiredPermissions);
    }

    // Para OU_ADMIN, validar permisos jerárquicos
    if (user.role === Role.OU_ADMIN && user.adminOfNodeId) {
      return await this.hasHierarchicalPermission(
        user.adminOfNodeId,
        targetNodeId,
        requiredPermissions,
      );
    }

    // Para otros roles, denegar acceso a operaciones que requieren permisos
    return false;
  }

  /**
   * Extrae el ID del nodo objetivo de los parámetros de la request.
   * Busca en params, body y query.
   */
  private extractTargetNodeId(request: any): number | null {
    // Intentar obtener de params (ej: /directory/:id)
    if (request.params?.id) {
      return Number.parseInt(request.params.id);
    }

    // Intentar obtener del body (ej: para operaciones de creación/actualización)
    if (request.body?.parentId) {
      return Number.parseInt(request.body.parentId);
    }

    if (request.body?.nodeId) {
      return Number.parseInt(request.body.nodeId);
    }

    // Intentar obtener de query params (ej: /directory/scope/:rootId)
    if (request.params?.rootId) {
      return Number.parseInt(request.params.rootId);
    }

    return null;
  }

  /**
   * Valida si un rol tiene permisos básicos para realizar una acción.
   */
  private hasBasicPermission(role: Role | undefined, requiredPermissions: Permission[]): boolean {
    if (!role) return false;

    // READONLY solo puede READ
    if (role === Role.READONLY) {
      return requiredPermissions.every(p => p === Permission.READ);
    }

    // USER puede READ
    if (role === Role.USER) {
      return requiredPermissions.every(p => p === Permission.READ);
    }

    return false;
  }

  /**
   * Valida permisos jerárquicos: si el usuario es admin de un nodo,
   * puede operar sobre ese nodo y todos sus descendientes.
   */
  private async hasHierarchicalPermission(
    adminNodeId: number,
    targetNodeId: number,
    requiredPermissions: Permission[],
  ): Promise<boolean> {
    try {
      // Si el usuario es admin del nodo objetivo, tiene todos los permisos
      if (adminNodeId === targetNodeId) {
        return true;
      }

      // Obtener el nodo del cual el usuario es admin
      const adminNode = await this.directoryRepository.findOneBy({ id: adminNodeId });
      if (!adminNode) {
        return false;
      }

      // Obtener el nodo objetivo
      const targetNode = await this.directoryRepository.findOneBy({ id: targetNodeId });
      if (!targetNode) {
        return false;
      }

      // Verificar si el nodo objetivo es descendiente del nodo admin
      // usando el mpath: el targetNode.mpath debe empezar con adminNode.mpath
      const isDescendant = targetNode.mpath?.startsWith(adminNode.mpath || '');

      return isDescendant || false;
    } catch (error) {
      console.error('Error validando permisos jerárquicos:', error);
      return false;
    }
  }
}
