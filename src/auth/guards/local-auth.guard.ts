import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que activa la LocalStrategy.
 * Úsalo en endpoints de login para validar username/password.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
