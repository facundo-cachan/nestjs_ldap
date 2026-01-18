import { IsNotEmpty, IsString } from 'class-validator';

import { CreateAuditLogDto } from './create-audit-log.dto';

/**
 * DTO para registrar el uso de un refresh token.
 *
 * @description Extiende `CreateAuditLogDto` y fija la acción a `REFRESH`.
 * @example
 * ```typescript
 * const dto: LogRefreshDto = {
 *   actorId: 5,
 *   actorName: 'admin.user',
 *   actorRole: 'SUPER_ADMIN',
 *   action: 'REFRESH',
 *   scope: '1.2.',
 *   metadata: { clientId: 'client-123' },
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...'
 * };
 * ```
 */
export class LogRefreshDto extends CreateAuditLogDto {
  /**
   * Acción de refresh token.
   */
  @IsNotEmpty()
  @IsString()
  action: string = 'REFRESH';
}
