import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DirectoryService } from '@/directory/directory.service';
import { Role } from '@/auth/enums/role.enum';

import type { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';

/**
 * HierarchyGuard (Scope Guard)
 * 
 * Este guard implementa la lógica híbrida LDAP + RBAC.
 * Verifica que un usuario solo pueda acceder a recursos dentro de su scope jerárquico.
 * 
 * Lógica:
 * - SUPER_ADMIN: Acceso total, sin restricciones de scope
 * - OU_ADMIN: Solo puede acceder a nodos dentro de su rama (mpath)
 * - USER: Solo puede acceder a nodos dentro de su rama (mpath) con permisos limitados
 * 
 * El guard se ejecuta DESPUÉS del JwtAuthGuard y ANTES del RolesGuard.
 * 
 * OPTIMIZACIÓN: Usa el mpath del JWT en lugar de consultar la BD para cada request.
 */
@Injectable()
export class HierarchyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly directoryService: DirectoryService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    // 1. Si no hay usuario autenticado, dejamos que el AuthGuard lo maneje
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // 2. SUPER_ADMIN tiene acceso total sin restricciones de scope
    if (user.role === Role.SUPER_ADMIN || user.roles?.includes(Role.SUPER_ADMIN)) {
      return true;
    }

    // 3. Validar que el usuario tenga mpath en el token
    if (!user.mpath) {
      throw new ForbiddenException('User mpath not found in token - please re-login');
    }

    // ---------------------------------------------------------
    // CASO A: Modificación/Lectura de un nodo existente (:id)
    // ---------------------------------------------------------
    const targetId = request.params.id;
    if (targetId) {
      return this.validateTargetNodeAccess(user, targetId);
    }

    // ---------------------------------------------------------
    // CASO B: Creación de un nodo nuevo (POST con parentId)
    // ---------------------------------------------------------
    const parentId = request.body?.parentId;
    if (parentId) {
      return this.validateParentNodeAccess(user, parentId);
    }

    // ---------------------------------------------------------
    // CASO C: Movimiento de nodo (POST /directory/move)
    // Validar tanto el nodo a mover como el nuevo padre
    // ---------------------------------------------------------
    const moveNodeId = request.body?.nodeId;
    const newParentId = request.body?.newParentId;
    if (moveNodeId && newParentId) {
      // Validar que el nodo a mover esté en el scope
      const canAccessNode = await this.validateTargetNodeAccess(user, moveNodeId.toString());
      if (!canAccessNode) return false;

      // Validar que el nuevo padre esté en el scope
      return this.validateParentNodeAccess(user, newParentId);
    }

    // ---------------------------------------------------------
    // CASO D: Búsqueda en scope (GET /directory/scope/:rootId)
    // ---------------------------------------------------------
    const rootId = request.params.rootId || request.query?.rootId;
    if (rootId) {
      return this.validateRootNodeAccess(user, rootId);
    }

    // Si no hay ID, parentID ni rootID, dejamos pasar
    // (endpoints que no operan sobre nodos específicos)
    return true;
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

  /**
   * Valida acceso a un nodo objetivo existente
   */
  private async validateTargetNodeAccess(user: JwtPayload, targetId: string): Promise<boolean> {
    // Permitir self-edit (editar tu propio nodo)
    if (Number(targetId) === user.id) {
      return true;
    }

    const targetNode = await this.directoryService.findOne(Number(targetId));
    if (!targetNode) {
      throw new NotFoundException('Nodo objetivo no encontrado');
    }

    // Obtener el mpath efectivo (para OU_ADMIN, es el mpath de la OU que administra)
    const effectiveMpath = await this.getEffectiveMpath(user);

    // 🔥 LA MAGIA HÍBRIDA: Validación de Materialized Path
    // Verificamos si el path del objetivo EMPIEZA con el path del solicitante.
    return this.validateHierarchicalAccess(effectiveMpath, targetNode.mpath);
  }

  /**
   * Valida acceso al nodo padre para creación
   */
  private async validateParentNodeAccess(user: JwtPayload, parentId: number): Promise<boolean> {
    // Permitir crear hijo directo
    if (Number(parentId) === user.id) {
      return true;
    }

    const parentNode = await this.directoryService.findOne(Number(parentId));
    if (!parentNode) {
      throw new BadRequestException('Parent ID no válido');
    }

    // Obtener el mpath efectivo (para OU_ADMIN, es el mpath de la OU que administra)
    const effectiveMpath = await this.getEffectiveMpath(user);

    // Validar que el parent esté dentro del scope del usuario
    return this.validateHierarchicalAccess(effectiveMpath, parentNode.mpath);
  }

  /**
   * Valida acceso al nodo raíz para búsquedas en scope
   */
  private async validateRootNodeAccess(user: JwtPayload, rootId: string): Promise<boolean> {
    const rootNode = await this.directoryService.findOne(Number(rootId));
    if (!rootNode) {
      throw new NotFoundException('Root node not found');
    }

    // Obtener el mpath efectivo (para OU_ADMIN, es el mpath de la OU que administra)
    const effectiveMpath = await this.getEffectiveMpath(user);

    // Validar que el root esté dentro del scope del usuario
    return this.validateHierarchicalAccess(effectiveMpath, rootNode.mpath);
  }

  /**
   * Valida que el usuario tenga acceso jerárquico al nodo objetivo
   * 
   * Lógica:
   * - El mpath del objetivo debe empezar con el mpath del usuario
   * - Esto significa que el objetivo está dentro de la rama del usuario
   * 
   * Ejemplo:
   * - Usuario mpath: "1.2."
   * - Objetivo mpath: "1.2.5.10." ✅ PERMITIDO (está dentro de la rama)
   * - Objetivo mpath: "1.3.8." ❌ DENEGADO (está fuera de la rama)
   * - Objetivo mpath: "1." ❌ DENEGADO (es un ancestro, no un descendiente)
   */
  private validateHierarchicalAccess(userMpath: string, targetMpath?: string): boolean {
    // Si el objetivo no tiene mpath, denegamos acceso por seguridad
    if (!targetMpath) {
      throw new ForbiddenException('Target mpath not found');
    }

    // Validar que el objetivo esté dentro del scope del usuario
    // El mpath del objetivo debe empezar con el mpath del usuario
    const hasAccess = targetMpath.startsWith(userMpath);

    if (!hasAccess) {
      throw new ForbiddenException(
        `Acceso Denegado: Este recurso (${targetMpath}) está fuera de tu Unidad Organizativa (${userMpath})`
      );
    }

    // Validación adicional: No permitir editar ancestros (nodos padre)
    // Si el targetMpath es más corto que el userMpath, es un ancestro
    if (targetMpath.length < userMpath.length) {
      throw new ForbiddenException(
        'Acceso Denegado: No puedes modificar nodos ancestros'
      );
    }

    return true;
  }
}