import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Entidad para registrar eventos de auditoría en el sistema.
 * 
 * Registra todas las acciones administrativas realizadas por usuarios con roles
 * de SUPER_ADMIN y OU_ADMIN para cumplir con estándares enterprise/LDAP.
 * 
 * @example
 * ```typescript
 * const log = new AuditLog();
 * log.actorId = 5;
 * log.actorName = 'admin.user';
 * log.action = 'UPDATE';
 * log.targetId = 10;
 * log.targetName = 'sales.user';
 * log.scope = '1.2.';
 * log.metadata = { field: 'email', oldValue: 'old@example.com', newValue: 'new@example.com' };
 * ```
 */
@Entity('audit_log')
@Index(['actorId', 'createdAt'])
@Index(['targetId', 'createdAt'])
@Index(['action', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * ID del usuario que realizó la acción (Who)
   */
  @Column({ type: 'int', nullable: false })
  @Index()
  actorId: number;

  /**
   * Nombre del usuario que realizó la acción
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  actorName: string;

  /**
   * Rol del usuario al momento de la acción
   */
  @Column({ type: 'varchar', length: 50, nullable: false })
  actorRole: string;

  /**
   * Tipo de acción realizada (What)
   * CREATE, READ, UPDATE, DELETE, MOVE
   */
  @Column({ type: 'varchar', length: 50, nullable: false })
  @Index()
  action: string;

  /**
   * ID del nodo objetivo de la acción (Target)
   */
  @Column({ type: 'int', nullable: true })
  @Index()
  targetId: number | null;

  /**
   * Nombre del nodo objetivo
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  targetName: string | null;

  /**
   * Tipo del nodo objetivo (USER, OU, DC, GROUP)
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  targetType: string | null;

  /**
   * Materialized Path del actor al momento de la acción (Scope)
   * Permite validar que la acción fue realizada dentro del scope permitido
   */
  @Column({ type: 'varchar', length: 500, nullable: false })
  scope: string;

  /**
   * Metadata adicional de la acción
   * Puede contener: valores anteriores, nuevos valores, razón, etc.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  /**
   * IP del cliente que realizó la acción
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /**
   * User Agent del cliente
   */
  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  /**
   * Resultado de la acción (SUCCESS, FAILED, DENIED)
   */
  @Column({ type: 'varchar', length: 20, default: 'SUCCESS' })
  status: string;

  /**
   * Mensaje de error si la acción falló
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  /**
   * Timestamp de creación del registro
   */
  @CreateDateColumn({ type: 'timestamp' })
  @Index()
  createdAt: Date;
}
