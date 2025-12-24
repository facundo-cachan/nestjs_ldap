/**
 * Roles disponibles en el sistema
 */
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',  // Acceso total al sistema
  OU_ADMIN = 'OU_ADMIN',          // Admin de una OU específica (permisos jerárquicos)
  USER = 'USER',                   // Usuario normal
  READONLY = 'READONLY',           // Solo lectura
}

/**
 * Acciones que se pueden realizar sobre los nodos
 */
export enum Permission {
  READ = 'READ',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  MANAGE = 'MANAGE',  // Todas las anteriores
}
