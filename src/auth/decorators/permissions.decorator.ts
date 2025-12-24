import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums/role.enum';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator para especificar qué permisos se requieren para un endpoint.
 * Uso: @RequirePermissions(Permission.READ, Permission.UPDATE)
 */
export const RequirePermissions = (...permissions: Permission[]) => 
  SetMetadata(PERMISSIONS_KEY, permissions);
