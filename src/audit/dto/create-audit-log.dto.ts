import { IsNotEmpty, IsString, IsOptional, IsInt, IsObject } from 'class-validator';

/**
 * DTO para crear un registro de auditoría.
 * 
 * @description
 * Define los datos necesarios para registrar una acción en el sistema de auditoría.
 * 
 * @example
 * ```typescript
 * const dto: CreateAuditLogDto = {
 *   actorId: 5,
 *   actorName: 'admin.user',
 *   actorRole: 'OU_ADMIN',
 *   action: 'UPDATE',
 *   targetId: 10,
 *   targetName: 'sales.user',
 *   targetType: 'USER',
 *   scope: '1.2.',
 *   metadata: { field: 'email', newValue: 'new@example.com' },
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...'
 * };
 * ```
 */
export class CreateAuditLogDto {
  /**
   * ID del usuario que realiza la acción
   */
  @IsNotEmpty()
  @IsInt()
  actorId: number;

  /**
   * Nombre del usuario que realiza la acción
   */
  @IsNotEmpty()
  @IsString()
  actorName: string;

  /**
   * Rol del usuario al momento de la acción
   */
  @IsNotEmpty()
  @IsString()
  actorRole: string;

  /**
   * Tipo de acción (CREATE, READ, UPDATE, DELETE, MOVE)
   */
  @IsNotEmpty()
  @IsString()
  action: string;

  /**
   * ID del nodo objetivo (opcional para acciones globales)
   */
  @IsOptional()
  @IsInt()
  targetId?: number;

  /**
   * Nombre del nodo objetivo
   */
  @IsOptional()
  @IsString()
  targetName?: string;

  /**
   * Tipo del nodo objetivo (USER, OU, DC, GROUP)
   */
  @IsOptional()
  @IsString()
  targetType?: string;

  /**
   * Materialized Path del actor (scope de la acción)
   */
  @IsNotEmpty()
  @IsString()
  scope: string;

  /**
   * Metadata adicional de la acción
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  /**
   * IP del cliente
   */
  @IsOptional()
  @IsString()
  ipAddress?: string;

  /**
   * User Agent del cliente
   */
  @IsOptional()
  @IsString()
  userAgent?: string;

  /**
   * Estado de la acción (SUCCESS, FAILED, DENIED)
   */
  @IsOptional()
  @IsString()
  status?: string;

  /**
   * Mensaje de error si la acción falló
   */
  @IsOptional()
  @IsString()
  errorMessage?: string;
}
