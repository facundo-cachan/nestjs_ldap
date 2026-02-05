import { CreateAuditLogDto } from './create-audit-log.dto';

/**
 * DTO para registrar una acción LDAP (bind o search) en el audit log.
 *
 * @description Extiende `CreateAuditLogDto` y permite especificar el tipo de acción LDAP.
 * @example
 * ```typescript
 * const dto: LogLdapActionDto = {
 *   actorId: 5,
 *   actorName: 'admin.user',
 *   actorRole: 'SUPER_ADMIN',
 *   action: 'LDAP_BIND', // o 'LDAP_SEARCH'
 *   scope: '1.2.',
 *   metadata: { dn: 'uid=john,ou=users,dc=example,dc=com', filter: '(uid=john)' },
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...'
 * };
 * ```
 */
export class LogLdapActionDto extends CreateAuditLogDto {
  // El campo 'action' se hereda de CreateAuditLogDto.
  // Se usa para LDAP_BIND o LDAP_SEARCH.
}
