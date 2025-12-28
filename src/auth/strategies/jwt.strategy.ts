import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

/**
 * JwtStrategy: Valida y extrae información del JWT.
 * Se activa cuando usamos @UseGuards(JwtAuthGuard) en un endpoint.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: String(process.env.JWT_SECRET || 'secreto_super_seguro'),
      ignoreExpiration: false,
    });
  }

  /**
   * Este método es invocado automáticamente por Passport tras validar el token.
   * El payload es el contenido decodificado del JWT.
   */
  async validate(payload: any) {
    // Retornamos el usuario completo que será adjuntado a req.user
    // Incluimos TODOS los datos del JWT para que estén disponibles en los guards
    return {
      userId: payload.sub,
      username: payload.sub,
      id: payload.id,
      role: payload.role,
      roles: payload.roles,
      mpath: payload.mpath,
      adminOfNodeId: payload.adminOfNodeId,
    };
  }
}
