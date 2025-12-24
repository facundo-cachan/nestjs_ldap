import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';

import { AuthService } from '../auth.service';

/**
 * LocalStrategy: Valida username y password.
 * Se activa cuando usamos @UseGuards(LocalAuthGuard) en un endpoint.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  /**
   * Este método es invocado automáticamente por Passport.
   * Recibe username y password del body de la request.
   */
  async validate(username: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }
}
