import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditLog } from '@/audit/entities/audit-log.entity';
import { CreateAuditLogDto } from '@/audit/dto/create-audit-log.dto';

/**
 * Servicio para gestionar el sistema de auditoría.
 * 
 * @description
 * Proporciona métodos para registrar y consultar eventos de auditoría en el sistema.
 * Cumple con los requisitos de la Fase 5 de AUTH_TASKS.md.
 * 
 * @example
 * ```typescript
 * // Registrar una acción de actualización
 * await auditService.log({
 *   actorId: user.id,
 *   actorName: user.name,
 *   actorRole: user.role,
 *   action: 'UPDATE',
 *   targetId: targetNode.id,
 *   targetName: targetNode.name,
 *   targetType: targetNode.type,
 *   scope: user.mpath,
 *   metadata: { field: 'email', oldValue: 'old@example.com', newValue: 'new@example.com' }
 * });
 * ```
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  /**
   * Registra una acción en el sistema de auditoría.
   * 
   * @description
   * Crea un registro de auditoría con toda la información de la acción realizada.
   * Este método debe ser llamado por todos los endpoints que realizan operaciones
   * administrativas (CREATE, UPDATE, DELETE, MOVE).
   * 
   * @param createAuditLogDto - Datos de la acción a registrar
   * @returns El registro de auditoría creado
   * 
   * @example
   * ```typescript
   * const log = await auditService.log({
   *   actorId: 5,
   *   actorName: 'admin.user',
   *   actorRole: 'OU_ADMIN',
   *   action: 'DELETE',
   *   targetId: 10,
   *   targetName: 'sales.user',
   *   targetType: 'USER',
   *   scope: '1.2.',
   *   ipAddress: req.ip,
   *   userAgent: req.headers['user-agent']
   * });
   * ```
   */
  async log(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditRepository.create({
      ...createAuditLogDto,
      status: createAuditLogDto.status || 'SUCCESS',
    });

    return await this.auditRepository.save(auditLog);
  }

  /**
   * Obtiene todos los registros de auditoría de un actor específico.
   * 
   * @description
   * Útil para ver el historial de acciones de un administrador.
   * 
   * @param actorId - ID del usuario actor
   * @param limit - Número máximo de registros a devolver (default: 100)
   * @returns Array de registros de auditoría ordenados por fecha descendente
   * 
   * @example
   * ```typescript
   * const logs = await auditService.findByActor(5, 50);
   * ```
   */
  async findByActor(actorId: number, limit: number = 100): Promise<AuditLog[]> {
    return await this.auditRepository.find({
      where: { actorId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Obtiene todos los registros de auditoría de un nodo objetivo específico.
   * 
   * @description
   * Útil para ver el historial de modificaciones de un usuario o OU.
   * 
   * @param targetId - ID del nodo objetivo
   * @param limit - Número máximo de registros a devolver (default: 100)
   * @returns Array de registros de auditoría ordenados por fecha descendente
   * 
   * @example
   * ```typescript
   * const logs = await auditService.findByTarget(10, 50);
   * ```
   */
  async findByTarget(targetId: number, limit: number = 100): Promise<AuditLog[]> {
    return await this.auditRepository.find({
      where: { targetId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Obtiene todos los registros de auditoría de un tipo de acción específico.
   * 
   * @description
   * Útil para filtrar por tipo de acción (CREATE, UPDATE, DELETE, etc.).
   * 
   * @param action - Tipo de acción (CREATE, READ, UPDATE, DELETE, MOVE)
   * @param limit - Número máximo de registros a devolver (default: 100)
   * @returns Array de registros de auditoría ordenados por fecha descendente
   * 
   * @example
   * ```typescript
   * const deleteLogs = await auditService.findByAction('DELETE', 50);
   * ```
   */
  async findByAction(action: string, limit: number = 100): Promise<AuditLog[]> {
    return await this.auditRepository.find({
      where: { action },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Obtiene registros de auditoría dentro de un rango de fechas.
   * 
   * @description
   * Útil para generar reportes de auditoría por período.
   * 
   * @param startDate - Fecha de inicio
   * @param endDate - Fecha de fin
   * @param limit - Número máximo de registros a devolver (default: 1000)
   * @returns Array de registros de auditoría ordenados por fecha descendente
   * 
   * @example
   * ```typescript
   * const logs = await auditService.findByDateRange(
   *   new Date('2025-01-01'),
   *   new Date('2025-01-31'),
   *   500
   * );
   * ```
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 1000,
  ): Promise<AuditLog[]> {
    return await this.auditRepository
      .createQueryBuilder('audit')
      .where('audit.createdAt >= :startDate', { startDate })
      .andWhere('audit.createdAt <= :endDate', { endDate })
      .orderBy('audit.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Obtiene registros de auditoría dentro de un scope específico.
   * 
   * @description
   * Útil para ver todas las acciones realizadas dentro de una OU específica.
   * 
   * @param scopePath - Materialized Path del scope (ej: '1.2.')
   * @param limit - Número máximo de registros a devolver (default: 100)
   * @returns Array de registros de auditoría ordenados por fecha descendente
   * 
   * @example
   * ```typescript
   * const logs = await auditService.findByScope('1.2.', 50);
   * ```
   */
  async findByScope(scopePath: string, limit: number = 100): Promise<AuditLog[]> {
    return await this.auditRepository
      .createQueryBuilder('audit')
      .where('audit.scope LIKE :scope', { scope: `${scopePath}%` })
      .orderBy('audit.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Obtiene estadísticas de auditoría por actor.
   * 
   * @description
   * Útil para generar reportes de actividad de administradores.
   * 
   * @param actorId - ID del usuario actor
   * @returns Objeto con estadísticas de acciones por tipo
   * 
   * @example
   * ```typescript
   * const stats = await auditService.getActorStats(5);
   * // { CREATE: 10, UPDATE: 5, DELETE: 2, MOVE: 3 }
   * ```
   */
  async getActorStats(actorId: number): Promise<Record<string, number>> {
    const logs = await this.auditRepository.find({
      where: { actorId },
      select: ['action'],
    });

    return logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
