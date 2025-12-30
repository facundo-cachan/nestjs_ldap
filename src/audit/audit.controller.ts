import { Controller, Get, Query, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';

import { AuditService } from '@/audit/audit.service';
import { AuditLog } from '@/audit/entities/audit-log.entity';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';

/**
 * Controlador para consultar logs de auditoría.
 * 
 * @description
 * Proporciona endpoints para que los administradores puedan consultar
 * el historial de acciones realizadas en el sistema.
 * 
 * Solo accesible para usuarios con rol SUPER_ADMIN o OU_ADMIN.
 * 
 * @example
 * ```typescript
 * // Obtener logs por actor
 * GET /audit/actor/5?limit=50
 * 
 * // Obtener logs por objetivo
 * GET /audit/target/10?limit=50
 * 
 * // Obtener logs por acción
 * GET /audit/action/DELETE?limit=100
 * 
 * // Obtener logs por scope
 * GET /audit/scope?path=1.2.&limit=50
 * 
 * // Obtener estadísticas de un actor
 * GET /audit/stats/5
 * ```
 */
@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Obtiene logs de auditoría por actor (usuario que realizó la acción).
   * 
   * @param actorId - ID del usuario actor
   * @param limit - Número máximo de registros a devolver (default: 100)
   * @returns Array de registros de auditoría ordenados por fecha descendente
   * 
   * @example
   * GET /audit/actor/5?limit=50
   */
  @Get('actor/:actorId')
  @Roles(Role.OU_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get audit logs by actor' })
  @ApiParam({ name: 'actorId', description: 'Actor user ID', type: 'number' })
  @ApiQuery({ name: 'limit', description: 'Maximum number of records', required: false, type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Audit logs for the specified actor',
    type: [AuditLog],
  })
  async findByActor(
    @Param('actorId', ParseIntPipe) actorId: number,
    @Query('limit') limit?: number,
  ): Promise<AuditLog[]> {
    return this.auditService.findByActor(actorId, limit || 100);
  }

  /**
   * Obtiene logs de auditoría por objetivo (nodo afectado).
   * 
   * @param targetId - ID del nodo objetivo
   * @param limit - Número máximo de registros a devolver (default: 100)
   * @returns Array de registros de auditoría ordenados por fecha descendente
   * 
   * @example
   * GET /audit/target/10?limit=50
   */
  @Get('target/:targetId')
  @Roles(Role.OU_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get audit logs by target node' })
  @ApiParam({ name: 'targetId', description: 'Target node ID', type: 'number' })
  @ApiQuery({ name: 'limit', description: 'Maximum number of records', required: false, type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Audit logs for the specified target',
    type: [AuditLog],
  })
  async findByTarget(
    @Param('targetId', ParseIntPipe) targetId: number,
    @Query('limit') limit?: number,
  ): Promise<AuditLog[]> {
    return this.auditService.findByTarget(targetId, limit || 100);
  }

  /**
   * Obtiene logs de auditoría por tipo de acción.
   * 
   * @param action - Tipo de acción (CREATE, READ, UPDATE, DELETE, MOVE)
   * @param limit - Número máximo de registros a devolver (default: 100)
   * @returns Array de registros de auditoría ordenados por fecha descendente
   * 
   * @example
   * GET /audit/action/DELETE?limit=100
   */
  @Get('action/:action')
  @Roles(Role.OU_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get audit logs by action type' })
  @ApiParam({ 
    name: 'action', 
    description: 'Action type', 
    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MOVE'],
  })
  @ApiQuery({ name: 'limit', description: 'Maximum number of records', required: false, type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Audit logs for the specified action',
    type: [AuditLog],
  })
  async findByAction(
    @Param('action') action: string,
    @Query('limit') limit?: number,
  ): Promise<AuditLog[]> {
    return this.auditService.findByAction(action, limit || 100);
  }

  /**
   * Obtiene logs de auditoría por scope (materialized path).
   * 
   * @description
   * Útil para ver todas las acciones realizadas dentro de una OU específica.
   * 
   * @param path - Materialized Path del scope (ej: '1.2.')
   * @param limit - Número máximo de registros a devolver (default: 100)
   * @returns Array de registros de auditoría ordenados por fecha descendente
   * 
   * @example
   * GET /audit/scope?path=1.2.&limit=50
   */
  @Get('scope')
  @Roles(Role.OU_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get audit logs by scope (organizational unit)' })
  @ApiQuery({ name: 'path', description: 'Materialized path (e.g., "1.2.")', required: true })
  @ApiQuery({ name: 'limit', description: 'Maximum number of records', required: false, type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Audit logs for the specified scope',
    type: [AuditLog],
  })
  async findByScope(
    @Query('path') path: string,
    @Query('limit') limit?: number,
  ): Promise<AuditLog[]> {
    return this.auditService.findByScope(path, limit || 100);
  }

  /**
   * Obtiene logs de auditoría por rango de fechas.
   * 
   * @param startDate - Fecha de inicio (ISO 8601)
   * @param endDate - Fecha de fin (ISO 8601)
   * @param limit - Número máximo de registros a devolver (default: 1000)
   * @returns Array de registros de auditoría ordenados por fecha descendente
   * 
   * @example
   * GET /audit/date-range?startDate=2025-01-01&endDate=2025-01-31&limit=500
   */
  @Get('date-range')
  @Roles(Role.OU_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get audit logs by date range' })
  @ApiQuery({ name: 'startDate', description: 'Start date (ISO 8601)', required: true })
  @ApiQuery({ name: 'endDate', description: 'End date (ISO 8601)', required: true })
  @ApiQuery({ name: 'limit', description: 'Maximum number of records', required: false, type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Audit logs for the specified date range',
    type: [AuditLog],
  })
  async findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: number,
  ): Promise<AuditLog[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.auditService.findByDateRange(start, end, limit || 1000);
  }

  /**
   * Obtiene estadísticas de actividad de un actor.
   * 
   * @description
   * Retorna un objeto con el conteo de acciones por tipo.
   * 
   * @param actorId - ID del usuario actor
   * @returns Objeto con estadísticas de acciones por tipo
   * 
   * @example
   * GET /audit/stats/5
   * // Response: { CREATE: 10, UPDATE: 5, DELETE: 2, MOVE: 3 }
   */
  @Get('stats/:actorId')
  @Roles(Role.OU_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get activity statistics for an actor' })
  @ApiParam({ name: 'actorId', description: 'Actor user ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Activity statistics by action type',
    schema: {
      type: 'object',
      example: { CREATE: 10, UPDATE: 5, DELETE: 2, MOVE: 3 },
    },
  })
  async getActorStats(
    @Param('actorId', ParseIntPipe) actorId: number,
  ): Promise<Record<string, number>> {
    return this.auditService.getActorStats(actorId);
  }
}
