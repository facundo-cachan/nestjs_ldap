import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { randomBytes } from 'node:crypto';

/**
 * Datos almacenados para cada código de autorización.
 *
 * @interface AuthorizationCodeData
 */
interface AuthorizationCodeData {
  /** ID del usuario que autorizó */
  userId: number;
  /** ID del cliente OAuth2 que solicitó la autorización */
  clientId: string;
  /** URI de redirección registrada */
  redirectUri: string;
  /** Scopes autorizados */
  scope: string;
  /** Timestamp de creación */
  createdAt: number;
}

/**
 * Servicio para gestión de códigos de autorización OAuth2.
 *
 * @description Implementa el flujo de Authorization Code de OAuth2/OIDC.
 * Los códigos son de un solo uso y tienen validez de 5 minutos (configurable).
 *
 * @example
 * const code = await authzCodeService.generateCode(userId, clientId, redirectUri, scope);
 * const userId = await authzCodeService.validateAndConsume(code, clientId);
 */
@Injectable()
export class AuthorizationCodeService {
  /** TTL por defecto para códigos de autorización (5 minutos) */
  private readonly CODE_TTL = 300; // segundos

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) { }

  /**
   * Genera un nuevo código de autorización.
   *
   * @param userId ID del usuario que autorizó
   * @param clientId ID del cliente OAuth2
   * @param redirectUri URI de redirección
   * @param scope Scopes solicitados y autorizados
   * @returns Código de autorización (string aleatorio)
   *
   * @description El código se almacena en Redis con TTL de 5 minutos.
   * Es criptográficamente seguro (32 bytes aleatorios).
   *
   * @example
   * const code = await this.generateCode(7, 'app-client-id', 'http://app.com/callback', 'openid profile');
   * // Returns: "a1b2c3d4e5f6..."
   */
  async generateCode(
    userId: number,
    clientId: string,
    redirectUri: string,
    scope: string,
  ): Promise<string> {
    const code = randomBytes(32).toString('hex');
    const key = this.getRedisKey(code);

    const data: AuthorizationCodeData = {
      userId,
      clientId,
      redirectUri,
      scope,
      createdAt: Date.now(),
    };

    await this.cache.set(key, JSON.stringify(data), this.CODE_TTL * 1000);

    return code;
  }

  /**
   * Valida y consume un código de autorización.
   *
   * @param code Código de autorización a validar
   * @param clientId ID del cliente que intenta usar el código
   * @param redirectUri URI de redirección (debe coincidir con la original)
   * @returns Datos del código si es válido, null si no existe o no coincide
   *
   * @description Valida que:
   * 1. El código existe y no ha expirado
   * 2. El client_id coincide
   * 3. El redirect_uri coincide
   * Tras validar, el código se consume (elimina de cache).
   *
   * @example
   * const data = await this.validateAndConsume('abc123', 'app-client-id', 'http://app.com/callback');
   * if (data) {
   *   console.log('User ID:', data.userId);
   * }
   */
  async validateAndConsume(
    code: string,
    clientId: string,
    redirectUri: string,
  ): Promise<AuthorizationCodeData | null> {
    const key = this.getRedisKey(code);
    const rawData = await this.cache.get<string>(key);

    if (!rawData) {
      return null;
    }

    const data: AuthorizationCodeData = JSON.parse(rawData);

    // Validar que el cliente y redirect_uri coincidan
    if (data.clientId !== clientId || data.redirectUri !== redirectUri) {
      return null;
    }

    // Consumir el código (un solo uso)
    await this.cache.del(key);

    return data;
  }

  /**
   * Revoca un código de autorización específico.
   *
   * @param code Código a revocar
   * @returns true si se revocó, false si no existía
   *
   * @example
   * await this.revokeCode('abc123');
   */
  async revokeCode(code: string): Promise<boolean> {
    const key = this.getRedisKey(code);
    const deleted = await this.cache.del(key);
    return !!deleted;
  }

  /**
   * Genera la clave de Redis para un código de autorización.
   *
   * @param code Código de autorización
   * @returns Clave de Redis formateada
   */
  private getRedisKey(code: string): string {
    return `oauth2:authz_code:${code}`;
  }
}
