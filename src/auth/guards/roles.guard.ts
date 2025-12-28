import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';

import type { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';

/**
 * RolesGuard
 * 
 * Guard que verifica si el usuario tiene los roles necesarios para acceder a un endpoint.
 * Este guard implementa la parte RBAC (Role-Based Access Control) del sistema híbrido.
 * 
 * Se ejecuta DESPUÉS del JwtAuthGuard (que valida el token) y puede ejecutarse
 * ANTES o DESPUÉS del HierarchyGuard dependiendo de la configuración.
 * 
 * Uso:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(Role.ADMIN)
 * async deleteUser() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    // Obtener los roles requeridos desde los metadatos del endpoint
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay roles requeridos, permitir acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Obtener el usuario del request (ya validado por JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    // Si no hay usuario, denegar acceso
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // SUPER_ADMIN tiene acceso a todo
    if (user.role === Role.SUPER_ADMIN || user.roles?.includes(Role.SUPER_ADMIN)) {
      return true;
    }

    // Verificar si el usuario tiene alguno de los roles requeridos
    const hasRole = this.checkUserHasRequiredRole(user, requiredRoles);

    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }

  /**
   * Verifica si el usuario tiene alguno de los roles requeridos
   */
  private checkUserHasRequiredRole(user: JwtPayload, requiredRoles: Role[]): boolean {
    // Verificar el rol principal
    if (user.role && requiredRoles.includes(user.role)) {
      return true;
    }

    // Verificar el array de roles (si existe)
    if (user.roles && user.roles.length > 0) {
      return user.roles.some(role => requiredRoles.includes(role));
    }

    return false;
  }
}
