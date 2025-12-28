import { SetMetadata } from '@nestjs/common';

import { Role } from '@/auth/enums/role.enum';

/**
 * Clave para almacenar los roles requeridos en los metadatos del endpoint
 */
export const ROLES_KEY = 'roles';

/**
 * Decorador para especificar qué roles tienen acceso a un endpoint
 * 
 * Uso:
 * @Roles(Role.ADMIN)
 * @Roles(Role.ADMIN, Role.OU_ADMIN)
 * 
 * Este decorador debe usarse junto con el RolesGuard
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
