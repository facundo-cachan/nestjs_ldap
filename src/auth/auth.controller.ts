import { Controller, Post, UseGuards, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';

import { LoginDto } from '@/auth/dto/login.dto';
import { AuthService } from '@/auth/auth.service';
import { LocalAuthGuard } from '@/auth/guards/local-auth.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AuditService } from '@/audit/audit.service';
import { LogLogoutDto } from '@/audit/dto/log-logout.dto';
import { JwtBlacklistGuard } from '@/auth/guards/jwt-blacklist.guard';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { User } from '@/auth/interfaces/user.interface';

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
   * Autenticación con username y password.
   * LocalAuthGuard invoca la LocalStrategy automáticamente.
   */
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'User authentication' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    description: 'Successfully authenticated',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        user: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Req() req: Request): Promise<any> {
    const user = req.user as User;
    return this.authService.login(user);
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
