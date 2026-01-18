import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

import { LoginDto } from '@/auth/dto/login.dto';
import { AuthService } from '@/auth/auth.service';
import { LocalAuthGuard } from '@/auth/guards/local-auth.guard';

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
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refresh_token: { type: 'string' } },
    },
  })
  async refresh(@Body('refresh_token') token: string) {
    return this.authService.refresh(token);
  }
}
