import { Controller, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

import { LoginDto } from '@/auth/dto/login.dto';
import { AuthService } from '@/auth/auth.service';
import { User } from '@/auth/interfaces/user.interface';
import { LocalAuthGuard } from '@/auth/guards/local-auth.guard';

import type { Request as ExpressRequest } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * POST /auth/login
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
        user: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            name: { type: 'string', example: 'user' },
            type: { type: 'string', example: 'USER' },
            attributes: {
              type: 'object',
              properties: {
                email: { type: 'string', example: 'user@example.com' },
                lastName: { type: 'string', example: 'User' },
                firstName: { type: 'string', example: 'User' },
                isSuperAdmin: { type: 'boolean', example: false },
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
  })
  async login(@Request() req: ExpressRequest & { user: User }): Promise<{ access_token: string; user: Partial<User> }> {
    // NOTE: Si llegamos aquí, el LocalAuthGuard ya validó las credenciales y adjuntó el usuario al objeto req.user
    return this.authService.login(req.user);
  }
}
