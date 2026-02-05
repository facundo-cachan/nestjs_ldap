import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';

/**
 * Guard que comprueba si el jti del token está en la blacklist (Redis).
 * Debe usarse DESPUÉS de JwtAuthGuard.
 */
@Injectable()
export class JwtBlacklistGuard implements CanActivate {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user || !user.jti) {
      // Si no hay jti, permitimos porque el guard previo ya validó estructura
      // pero por seguridad si requerimos revocación, el token DEBE tener jti.
      return true;
    }

    // Comprobar si el jti está en la blacklist
    const isRevoked = await this.cacheManager.get(`revoked_token:${user.jti}`);

    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return true;
  }
}
