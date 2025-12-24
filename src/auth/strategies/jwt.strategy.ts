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
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secreto_super_seguro',
    });
  }

  /**
   * Este método es invocado automáticamente por Passport tras validar el token.
   * El payload es el contenido decodificado del JWT.
   */
  async validate(payload: any) {
    // Retornamos el usuario que será adjuntado a req.user
    return { userId: payload.sub, username: payload.username, type: payload.type };
  }
}
