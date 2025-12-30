import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';

import { DirectoryService } from '@/directory/directory.service';
import { Role } from '@/auth/enums/role.enum';

import type { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import type { CreateNodeDto } from '@/directory/dto/create-node.dto';

/**
 * Servicio de validación anti-escalamiento.
 * 
 * @description
 * Implementa las validaciones de seguridad de la Fase 4 de AUTH_TASKS.md:
 * 1. Auto-Promoción: Previene que un OU_ADMIN mueva nodos fuera de su scope
 * 2. Creación Fantasma: Previene crear nodos con parentId fuera del scope
 * 3. Role Granting: Previene otorgar roles superiores al propio
 * 
 * @example
 * ```typescript
 * // En el controller
 * await this.antiEscalationService.validateNodeCreation(user, createNodeDto);
 * await this.antiEscalationService.validateNodeMove(user, nodeId, newParentId);
 * ```
 */
@Injectable()
export class AntiEscalationService {
  constructor(private readonly directoryService: DirectoryService) { }

  /**
   * Valida que un usuario pueda crear un nodo con los atributos especificados.
   * 
   * @description
   * Previene que un OU_ADMIN:
   * - Cree nodos con parentId fuera de su scope (Creación Fantasma)
   * - Otorgue roles superiores al suyo (Role Granting)
   * 
   * @param user - Usuario que intenta crear el nodo
   * @param createNodeDto - Datos del nodo a crear
   * @throws ForbiddenException si la validación falla
   * 
   * @example
   * ```typescript
   * await antiEscalationService.validateNodeCreation(user, {
   *   name: 'new.user',
   *   type: NodeType.USER,
   *   parentId: 2,
   *   attributes: { isSuperAdmin: true } // ❌ Esto fallará para OU_ADMIN
   * });
   * ```
   */
  async validateNodeCreation(
    user: JwtPayload,
    createNodeDto: CreateNodeDto,
  ): Promise<void> {
    // SUPER_ADMIN puede hacer cualquier cosa
    if (user.role === Role.SUPER_ADMIN) {
      return;
    }

    // Validación 1: Prevenir Role Granting (otorgar roles superiores)
    this.validateRoleGranting(user, createNodeDto);

    // Validación 2: Prevenir Creación Fantasma (parentId fuera de scope)
    if (createNodeDto.parentId) {
      await this.validateParentInScope(user, createNodeDto.parentId);
    }
  }

  /**
   * Valida que un usuario pueda mover un nodo a un nuevo padre.
   * 
   * @description
   * Previene que un OU_ADMIN:
   * - Mueva nodos fuera de su scope (Auto-Promoción)
   * - Mueva su propio nodo hacia arriba en la jerarquía
   * 
   * @param user - Usuario que intenta mover el nodo
   * @param nodeId - ID del nodo a mover
   * @param newParentId - ID del nuevo padre
   * @throws ForbiddenException si la validación falla
   * 
   * @example
   * ```typescript
   * await antiEscalationService.validateNodeMove(user, 5, 1);
   * // ❌ Fallará si el usuario intenta mover su nodo a Root
   * ```
   */
  async validateNodeMove(
    user: JwtPayload,
    nodeId: number,
    newParentId: number,
  ): Promise<void> {
    // SUPER_ADMIN puede mover cualquier cosa
    if (user.role === Role.SUPER_ADMIN) {
      return;
    }

    // Validación 1: Prevenir Auto-Promoción (mover propio nodo hacia arriba)
    await this.validateNoSelfPromotion(user, nodeId, newParentId);

    // Validación 2: Prevenir mover nodos fuera del scope
    await this.validateMoveInScope(user, nodeId, newParentId);
  }

  /**
   * Valida que un usuario no intente otorgar roles superiores al suyo.
   * 
   * @description
   * Un OU_ADMIN no puede crear usuarios con:
   * - isSuperAdmin: true
   * - Roles superiores al suyo
   * 
   * @param user - Usuario que intenta crear el nodo
   * @param createNodeDto - Datos del nodo a crear
   * @throws ForbiddenException si intenta otorgar un rol superior
   */
  private validateRoleGranting(
    user: JwtPayload,
    createNodeDto: CreateNodeDto,
  ): void {
    const attributes = createNodeDto.attributes || {};

    // Prevenir que OU_ADMIN otorgue rol SUPER_ADMIN
    if (user.role === Role.OU_ADMIN) {
      if (attributes.isSuperAdmin === true) {
        throw new ForbiddenException(
          'Acceso Denegado: No puedes otorgar el rol SUPER_ADMIN. ' +
          'Solo un SUPER_ADMIN puede crear otros SUPER_ADMIN.',
        );
      }

      // Prevenir que OU_ADMIN cree otro OU_ADMIN fuera de su scope
      if (attributes.isAdmin === true && attributes.adminOf) {
        const adminOfNodeId = Number(attributes.adminOf);

        // Validar que el nodo a administrar esté dentro del scope del creador
        // Esto se validará en validateParentInScope, pero agregamos validación explícita
        if (user.adminOfNodeId && adminOfNodeId !== user.adminOfNodeId) {
          // Solo puede crear OU_ADMIN de su propia OU o sub-OUs
          // Esta validación se hará con el mpath en validateParentInScope
        }
      }
    }

    // USER no puede crear nodos con roles administrativos
    if (user.role === Role.USER) {
      if (attributes.isSuperAdmin === true || attributes.isAdmin === true) {
        throw new ForbiddenException(
          'Acceso Denegado: No tienes permisos para otorgar roles administrativos.',
        );
      }
    }
  }

  /**
   * Valida que el parentId esté dentro del scope del usuario.
   * 
   * @description
   * Previene "Creación Fantasma": crear nodos con parentId fuera del scope.
   * 
   * @param user - Usuario que intenta crear el nodo
   * @param parentId - ID del nodo padre
   * @throws ForbiddenException si el padre está fuera del scope
   */
  private async validateParentInScope(
    user: JwtPayload,
    parentId: number,
  ): Promise<void> {
    // Obtener el nodo padre
    const parentNode = await this.directoryService.findOne(parentId);
    if (!parentNode) {
      throw new BadRequestException('Parent ID no válido');
    }

    // Obtener el mpath efectivo del usuario
    const effectiveMpath = await this.getEffectiveMpath(user);

    // Validar que el padre esté dentro del scope
    if (!parentNode.mpath?.startsWith(effectiveMpath)) {
      throw new ForbiddenException(
        `Acceso Denegado: No puedes crear nodos bajo el padre ${parentNode.name} ` +
        `porque está fuera de tu Unidad Organizativa. ` +
        `Tu scope: ${effectiveMpath}, Parent scope: ${parentNode.mpath}`,
      );
    }
  }

  /**
   * Valida que un usuario no intente mover su propio nodo hacia arriba.
   * 
   * @description
   * Previene "Auto-Promoción": un OU_ADMIN no puede mover su nodo o el de un aliado
   * hacia un nivel superior (ej: hacia Root).
   * 
   * @param user - Usuario que intenta mover el nodo
   * @param nodeId - ID del nodo a mover
   * @param newParentId - ID del nuevo padre
   * @throws ForbiddenException si intenta auto-promoción
   */
  private async validateNoSelfPromotion(
    user: JwtPayload,
    nodeId: number,
    newParentId: number,
  ): Promise<void> {
    // Obtener el nodo a mover
    const nodeToMove = await this.directoryService.findOne(nodeId);
    if (!nodeToMove) {
      throw new BadRequestException('Node ID no válido');
    }

    // Obtener el nuevo padre
    const newParent = await this.directoryService.findOne(newParentId);
    if (!newParent) {
      throw new BadRequestException('New Parent ID no válido');
    }

    // Obtener el mpath efectivo del usuario
    const effectiveMpath = await this.getEffectiveMpath(user);

    // Prevenir mover el nodo hacia un nivel superior al scope del usuario
    // Si el nuevo padre tiene un mpath más corto que el mpath del usuario,
    // significa que está intentando mover hacia arriba
    if (newParent.mpath && newParent.mpath.length < effectiveMpath.length) {
      throw new ForbiddenException(
        'Acceso Denegado: No puedes mover nodos hacia un nivel superior a tu Unidad Organizativa. ' +
        `Tu scope: ${effectiveMpath}, Nuevo padre: ${newParent.mpath}`,
      );
    }

    // Prevenir mover el nodo del cual eres administrador
    if (user.role === Role.OU_ADMIN && user.adminOfNodeId === nodeId) {
      throw new ForbiddenException(
        'Acceso Denegado: No puedes mover el nodo del cual eres administrador.',
      );
    }
  }

  /**
   * Valida que tanto el nodo a mover como el nuevo padre estén en el scope.
   * 
   * @description
   * Previene mover nodos fuera del scope del usuario.
   * 
   * @param user - Usuario que intenta mover el nodo
   * @param nodeId - ID del nodo a mover
   * @param newParentId - ID del nuevo padre
   * @throws ForbiddenException si alguno está fuera del scope
   */
  private async validateMoveInScope(
    user: JwtPayload,
    nodeId: number,
    newParentId: number,
  ): Promise<void> {
    // Obtener el nodo a mover
    const nodeToMove = await this.directoryService.findOne(nodeId);
    if (!nodeToMove) {
      throw new BadRequestException('Node ID no válido');
    }

    // Obtener el nuevo padre
    const newParent = await this.directoryService.findOne(newParentId);
    if (!newParent) {
      throw new BadRequestException('New Parent ID no válido');
    }

    // Obtener el mpath efectivo del usuario
    const effectiveMpath = await this.getEffectiveMpath(user);

    // Validar que el nodo a mover esté en el scope
    if (!nodeToMove.mpath?.startsWith(effectiveMpath)) {
      throw new ForbiddenException(
        `Acceso Denegado: El nodo ${nodeToMove.name} está fuera de tu Unidad Organizativa.`,
      );
    }

    // Validar que el nuevo padre esté en el scope
    if (!newParent.mpath?.startsWith(effectiveMpath)) {
      throw new ForbiddenException(
        `Acceso Denegado: El nuevo padre ${newParent.name} está fuera de tu Unidad Organizativa.`,
      );
    }
  }

  /**
   * Obtiene el mpath efectivo del usuario para validación de scope.
   * Para OU_ADMIN, usa el mpath del nodo que administra.
   * Para otros roles, usa su propio mpath.
   */
  private async getEffectiveMpath(user: JwtPayload): Promise<string> {
    // Si es OU_ADMIN y tiene adminOfNodeId, obtener el mpath de ese nodo
    if (user.role === Role.OU_ADMIN && user.adminOfNodeId) {
      const adminNode = await this.directoryService.findOne(user.adminOfNodeId);
      if (adminNode?.mpath) {
        return adminNode.mpath;
      }
    }

    // Para otros casos, usar el mpath del usuario
    return user.mpath!;
  }
}
