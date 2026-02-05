import { Controller, Post, UseGuards, Body, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';

import { LoginDto } from '@/auth/dto/login.dto';
import { AuthService } from '@/auth/auth.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AuditService } from '@/audit/audit.service';
import { LogLogoutDto } from '@/audit/dto/log-logout.dto';
import { JwtBlacklistGuard } from '@/auth/guards/jwt-blacklist.guard';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { RequestResponse } from '@/common/interceptors/transform.interceptor';

/**
 * Controlador de autenticación.
 * Maneja los flujos de login, refresh y logout (SLO).
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) { }

  /**
   * Autenticación con username (email) y password.
   * 
   * @description
   * Valida las credenciales del usuario y genera tokens JWT (access, refresh, y opcionalmente ID token).
   * La respuesta es automáticamente envuelta por el TransformInterceptor en el formato RequestResponse.
   * 
   * @param loginDto - Credenciales del usuario (username/email y password)
   * @returns Tokens de autenticación y datos del usuario envueltos en RequestResponse
   * 
   * @example
   * ```json
   * // Request
   * POST /auth/login
   * {
   *   "username": "user@example.com",
   *   "password": "SecurePass123!"
   * }
   * 
   * // Response (200 OK)
   * {
   *   "statusCode": 200,
   *   "message": "success",
   *   "data": {
   *     "access_token": "eyJhbGc...",
   *     "refresh_token": "eyJhbGc...",
   *     "user": {
   *       "id": 1,
   *       "username": "user@example.com",
   *       "role": "USER",
   *       "roles": ["USER"],
   *       "mpath": "1.2.3."
   *     }
   *   }
   * }
   * ```
   */
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'User authentication' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            access_token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            refresh_token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            id_token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              description: 'Only present when clientId is provided (OIDC flow)',
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                username: { type: 'string', example: 'user@example.com' },
                role: { type: 'string', example: 'USER' },
                roles: { type: 'array', items: { type: 'string' }, example: ['USER'] },
                adminOfNodeId: { type: 'number', example: 2, nullable: true },
                mpath: { type: 'string', example: '1.2.3.' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'unauthorized' },
      },
    },
  })
  async login(@Body() loginDto: LoginDto) {
    // El TransformInterceptor global envuelve automáticamente la respuesta
    // en el formato RequestResponse { statusCode, message, data }
    return await this.authService.login(loginDto);
  }

  /**
   * Refresca el access_token usando un refresh_token válido.
   */
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refresh_token: { type: 'string' } },
    },
  })
  async refresh(@Body('refresh_token') token: string): Promise<any> {
    return this.authService.refresh(token);
  }

  /**
   * Logout (SLO) e invalidación de token.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard, JwtBlacklistGuard)
  @ApiOperation({ summary: 'User logout (SLO)' })
  async logout(@Req() req: Request): Promise<{ message: string }> {
    const user = req.user as JwtPayload;

    const logoutDto: LogLogoutDto = {
      actorId: user.id || 0,
      actorName: user.username || user.sub,
      actorRole: user.role || 'USER',
      action: 'LOGOUT',
      targetId: user.id,
      targetName: user.username || user.sub,
      targetType: 'USER',
      scope: user.mpath || '',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    };

    await this.auditService.logLogout(logoutDto);
    await this.authService.logout(user.jti);

    return { message: 'Logged out successfully' };
  }
}
