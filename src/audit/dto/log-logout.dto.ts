import { IsNotEmpty, IsString } from 'class-validator';

import { CreateAuditLogDto } from './create-audit-log.dto';

/**
 * DTO para registrar un logout (SLO) y la inserción del token en la lista de revocación.
 *
 * @description Extiende `CreateAuditLogDto` y fija la acción a `LOGOUT`.
 * @example
 * ```typescript
 * const dto: LogLogoutDto = {
 *   actorId: 5,
 *   actorName: 'admin.user',
 *   actorRole: 'SUPER_ADMIN',
 *   action: 'LOGOUT',
 *   scope: '1.2.',
 *   metadata: { tokenId: 'jti-12345' },
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...'
 * };
 * ```
 */
export class LogLogoutDto extends CreateAuditLogDto {
  /**
   * Acción de logout.
   */
  @IsNotEmpty()
  @IsString()
  action: string = 'LOGOUT';
}
