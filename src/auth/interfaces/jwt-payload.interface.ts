import { Role } from '@/auth/enums/role.enum';

/**
 * Payload del JWT con información extendida para RBAC
 */
export interface JwtPayload {
  sub: string;           // Username (subject)
  id: number;            // ID del nodo usuario
  role?: Role;           // Rol del usuario
  roles?: Role[];        // Array de roles (para multi-rol)
  adminOfNodeId?: number; // ID del nodo del cual es admin (para OU_ADMIN)
  mpath?: string;        // Materialized Path del usuario (para scope checking rápido)
  iat?: number;          // Issued at
  exp?: number;          // Expiration
}

/**
 * Usuario autenticado con información completa
 */
export interface AuthenticatedUser {
  id: number;
  username: string;
  role?: Role;
  roles?: Role[];
  adminOfNodeId?: number;
  mpath?: string;
}
