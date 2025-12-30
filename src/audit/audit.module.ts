import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from '@/audit/entities/audit-log.entity';
import { AuditService } from '@/audit/audit.service';
import { AuditController } from '@/audit/audit.controller';

/**
 * Módulo de Auditoría.
 * 
 * @description
 * Proporciona funcionalidad de auditoría para el sistema, registrando todas
 * las acciones administrativas realizadas por usuarios con roles de SUPER_ADMIN
 * y OU_ADMIN.
 * 
 * Cumple con los requisitos de la Fase 5 de AUTH_TASKS.md:
 * - Who: ID del Manager
 * - What: Action (CREATE, UPDATE, DELETE, MOVE)
 * - Target: ID del empleado/nodo
 * - Scope: Path en el momento de la acción
 * 
 * Endpoints disponibles:
 * - GET /audit/actor/:actorId - Logs por usuario
 * - GET /audit/target/:targetId - Logs por objetivo
 * - GET /audit/action/:action - Logs por tipo de acción
 * - GET /audit/scope?path=... - Logs por scope (OU)
 * - GET /audit/date-range?startDate=...&endDate=... - Logs por rango de fechas
 * - GET /audit/stats/:actorId - Estadísticas de actividad
 * 
 * @example
 * ```typescript
 * // En otro módulo
 * @Module({
 *   imports: [AuditModule],
 *   // ...
 * })
 * export class DirectoryModule {}
 * ```
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule { }
