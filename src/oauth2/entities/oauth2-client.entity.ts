import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entidad OAuth2Client - Representa una aplicación cliente autorizada.
 *
 * @description Almacena la configuración de aplicaciones que pueden usar el SSO.
 * Cada cliente tiene credenciales únicas y configuración de redirecciones permitidas.
 *
 * @example
 * const client = new OAuth2Client();
 * client.name = 'Mi Aplicación';
 * client.clientId = 'app-client-id';
 * client.clientSecret = hashedSecret;
 * client.redirectUris = ['http://localhost:3000/callback'];
 */
@Entity('oauth2_clients')
export class OAuth2Client {
  /**
   * ID único del cliente en la base de datos.
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Nombre descriptivo de la aplicación cliente.
   *
   * @example 'Portal de Empleados', 'App Móvil Ventas'
   */
  @Column({ length: 255 })
  name: string;

  /**
   * Client ID público usado en el flujo OAuth2.
   *
   * @description Identificador único que se incluye en las peticiones OAuth2.
   * Es público pero debe ser único en el sistema.
   *
   * @example 'portal-empleados', 'mobile-app-v2'
   */
  @Column({ unique: true, length: 255 })
  clientId: string;

  /**
   * Client Secret (hasheado) para autenticación del cliente.
   *
   * @description Debe hashearse antes de almacenar (usando bcrypt).
   * Solo las aplicaciones confidenciales (backend) usan este campo.
   *
   * @example '$2b$10$...' (bcrypt hash)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  clientSecret: string | null;

  /**
   * URIs de redirección permitidas (separadas por coma).
   *
   * @description Lista de URLs a las que se puede redirigir tras autorización.
   * Crítico para seguridad - previene ataques de redirección abierta.
   *
   * @example 'http://localhost:3000/callback,https://app.company.com/oauth/callback'
   */
  @Column({ type: 'text' })
  redirectUris: string;

  /**
   * Scopes permitidos para este cliente (separados por espacio).
   *
   * @description Define qué información puede solicitar este cliente.
   *
   * @example 'openid profile email', 'openid profile'
   */
  @Column({ type: 'text', default: 'openid profile email' })
  allowedScopes: string;

  /**
   * Tipo de cliente OAuth2.
   *
   * @description
   * - 'confidential': Puede mantener secretos (backend apps)
   * - 'public': No puede mantener secretos (SPAs, mobile apps)
   */
  @Column({ type: 'enum', enum: ['confidential', 'public'], default: 'confidential' })
  clientType: 'confidential' | 'public';

  /**
   * Grant types permitidos.
   *
   * @description Separados por coma.
   *
   * @example 'authorization_code,refresh_token'
   */
  @Column({ type: 'text', default: 'authorization_code,refresh_token' })
  grantTypes: string;

  /**
   * Indica si el cliente está activo.
   *
   * @description Los clientes inactivos no pueden autenticarse.
   */
  @Column({ default: true })
  active: boolean;

  /**
   * Fecha de creación del cliente.
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Fecha de última actualización.
   */
  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Verifica si una URI de redirección está permitida.
   *
   * @param uri URI a validar
   * @returns true si está permitida
   *
   * @example
   * client.isRedirectUriAllowed('http://localhost:3000/callback') // true
   */
  isRedirectUriAllowed(uri: string): boolean {
    const allowed = this.redirectUris.split(',').map((u) => u.trim());
    return allowed.includes(uri);
  }

  /**
   * Verifica si un scope está permitido.
   *
   * @param scope Scope a validar
   * @returns true si está permitido
   *
   * @example
   * client.isScopeAllowed('openid') // true
   */
  isScopeAllowed(scope: string): boolean {
    const allowed = this.allowedScopes.split(' ');
    const requested = scope.split(' ');
    return requested.every((s) => allowed.includes(s));
  }

  /**
   * Verifica si un grant type está permitido.
   *
   * @param grantType Grant type a validar
   * @returns true si está permitido
   *
   * @example
   * client.isGrantTypeAllowed('authorization_code') // true
   */
  isGrantTypeAllowed(grantType: string): boolean {
    const allowed = this.grantTypes.split(',').map((g) => g.trim());
    return allowed.includes(grantType);
  }
}
