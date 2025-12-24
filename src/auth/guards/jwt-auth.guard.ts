import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que activa la JwtStrategy.
 * Úsalo en endpoints protegidos que requieren un JWT válido.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
