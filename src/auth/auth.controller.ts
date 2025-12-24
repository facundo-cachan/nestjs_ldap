import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { LoginDto } from './dto/login.dto';

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
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Request() req, @Body() loginDto: LoginDto) {
    // Si llegamos aquí, el LocalAuthGuard ya validó las credenciales
    // y adjuntó el usuario al objeto req.user
    return this.authService.login(req.user);
  }
}
