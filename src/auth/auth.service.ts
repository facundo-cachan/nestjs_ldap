import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';

import { Role } from '@/auth/enums/role.enum';
import { User } from '@/auth/interfaces/user.interface';
import { DirectoryService } from '@/directory/directory.service';
import { NodeType } from '@/directory/entities/directory-node.entity';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { AuditService } from '@/audit/audit.service';

import type { UserCredentials } from '@/auth/interfaces/user.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly directoryService: DirectoryService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  /**
   * Valida las credenciales del usuario.
   * Usado por LocalStrategy.
   */
  async validateUser(
    username: UserCredentials['username'],
    pass: UserCredentials['password'],
  ): Promise<Partial<User> | null> {
    // 1. Buscamos el nodo. Nota: necesitamos el password, así que usamos addSelect
    // Asumimos que el 'username' es el 'name' del nodo, pero podría ser un email en los attributes.
    const user =
      await this.directoryService.findUserByNameWithPassword(username);

    // 2. Verificaciones: Que exista, que sea tipo USER y que el pass coincida
    if (user && user.type === NodeType.USER && user.password) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (isMatch) {
        // Eliminamos el password del objeto antes de retornarlo
        const result = { ...user };
        delete (result as { password?: string }).password;

        return result;
      }
    }
    return null;
  }

  /**
   * Genera el JWT tras un login exitoso.
   * Incluye información de roles para RBAC jerárquico.
   *
   * @param user Usuario autenticado
   * @param clientId Client ID de la app (opcional, para flujo OIDC)
   * @returns Tokens de acceso, refresh y opcionalmente ID token
   */
  async login(user: User, clientId?: string) {
    // NOTE: Necesitamos obtener el mpath del usuario desde la BD
    // El objeto 'user' que viene del validateUser no incluye mpath
    const fullUser = await this.directoryService.findOne(user.id);
    if (!fullUser) {
      throw new Error('User not found');
    }

    // Determinar rol del usuario desde la BD o attributes
    const role = this.getUserRole(fullUser);
    const roles = fullUser.roles || [role];
    const adminOfNodeId =
      fullUser.adminOfNodeId || this.getAdminNodeId(fullUser, role);

    const payload: JwtPayload = {
      sub: fullUser.name,
      id: fullUser.id,
      iss: this.configService.get<string>('JWT_ISSUER', 'sigesta-auth-ldap'),
      aud: this.configService.get<string>('JWT_AUDIENCE', 'sigesta-apps'),
      role,
      roles,
      adminOfNodeId,
      mpath: fullUser.mpath, // CRÍTICO: Incluir mpath para scope checking
      username: fullUser.name,
      jti: crypto.randomUUID(), // Generar ID único para el token
    };

    const access_token = this.jwtService.sign(payload);
    const refreshTokenJti = crypto.randomUUID();
    const refresh_token = this.jwtService.sign(
      { sub: fullUser.name, type: 'refresh', jti: refreshTokenJti },
      { expiresIn: '7d' },
    );

    // Persistir Refresh Token en Redis para rotación y revocación
    // Expira en 7 días (igual que el token)
    await this.cacheManager.set(
      `refresh_token:${refreshTokenJti}`,
      fullUser.name,
      7 * 24 * 60 * 60 * 1000,
    );

    // Generar ID Token si es flujo OIDC (cuando hay clientId)
    let id_token: string | undefined;
    if (clientId) {
      const idTokenPayload = {
        iss: this.configService.get<string>('JWT_ISSUER', 'sigesta-auth-ldap'),
        sub: fullUser.id.toString(),
        aud: clientId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        // OIDC Standard Claims
        name: `${(fullUser.attributes?.firstName as string) || ''} ${(fullUser.attributes?.lastName as string) || ''}`.trim(),
        given_name: fullUser.attributes?.firstName as string,
        family_name: fullUser.attributes?.lastName as string,
        email: fullUser.attributes?.email as string,
        // Custom Claims (RBAC)
        role,
        roles,
        mpath: fullUser.mpath,
        adminOfNodeId,
      };
      id_token = this.jwtService.sign(idTokenPayload);
    }

    return {
      access_token,
      refresh_token,
      id_token,
      user: {
        id: fullUser.id,
        username: fullUser.name,
        role,
        roles,
        adminOfNodeId,
        mpath: fullUser.mpath,
      },
    };
  }

  /**
   * Refresca el access_token usando un refresh_token válido.
   */
  async refresh(token: string) {
    try {
      const payload = this.jwtService.verify(token) as unknown as JwtPayload & {
        type?: string;
      };
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const jti = payload.jti;
      if (!jti) {
        throw new Error('Missing token ID');
      }

      // 1. Verificar si el Refresh Token existe en Redis (Whitelisting + Rotation)
      const storedUser = await this.cacheManager.get(`refresh_token:${jti}`);
      if (!storedUser) {
        this.logger.warn(`Potential reuse attack or expired token: ${jti}`);
        throw new Error('Refresh token revoked or already used');
      }

      // 2. Rotación: Eliminar el token usado
      await this.cacheManager.del(`refresh_token:${jti}`);

      const sub = payload.sub;
      if (!sub) {
        throw new Error('Invalid token sub');
      }

      const user = await this.directoryService.findUserByNameWithPassword(sub);
      if (!user) throw new Error('User not found');

      // Log REFRESH
      await this.auditService.logRefresh({
        actorId: user.id || 0,
        actorName: user.name || sub,
        actorRole: user.attributes?.role || 'USER',
        action: 'REFRESH',
        scope: user.mpath || '',
        status: 'SUCCESS',
        metadata: { sub },
      });

      return this.login(user);
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Refresh token failed: ${errorMsg}`);
      throw new Error('Refresh token invalid or expired');
    }
  }

  /**
   * Determina el rol de un usuario basándose en sus atributos.
   * Lógica de ejemplo - puede ser más compleja según tus necesidades.
   */
  private getUserRole(user: User): Role {
    // Buscar el rol en los atributos del usuario
    if (user.attributes?.role) {
      return user.attributes.role as Role;
    }

    // Si el usuario tiene un atributo 'isSuperAdmin', es SUPER_ADMIN
    if (user.attributes?.isSuperAdmin === true) {
      return Role.SUPER_ADMIN;
    }

    // Si el usuario tiene un atributo 'isAdmin' y 'adminOf', es OU_ADMIN
    if (user.attributes?.isAdmin === true && user.attributes?.adminOf) {
      return Role.OU_ADMIN;
    }

    // Por defecto, usuario normal
    return Role.USER;
  }

  /**
   * Obtiene el ID del nodo del cual el usuario es administrador.
   * Solo relevante para OU_ADMIN.
   */
  private getAdminNodeId(user: User, role: Role): number | undefined {
    if (role === Role.OU_ADMIN && user.attributes?.adminOf) {
      return Number.parseInt(user.attributes.adminOf as string);
    }
    return undefined;
  }

  /**
   * Revoca un token (SLO).
   * En una implementación real, se guardaría el jti en Redis con su exp.
   *
   * @param jti JWT ID a revocar
   */
  async logout(jti?: string): Promise<void> {
    if (jti) {
      this.logger.log(`Token ${jti} revoked (SLO)`);
      // Guardar en Redis con un TTL (ej: 24h o lo que dure el token)
      const ttl = this.configService.get<number>('JWT_BLACKLIST_TTL', 86400); // 24h
      await this.cacheManager.set(`revoked_token:${jti}`, true, ttl * 1000);
    }
  }
}
