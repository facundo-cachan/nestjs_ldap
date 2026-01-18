import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { User } from '@/auth/interfaces/user.interface';

@ApiTags('OIDC')
@Controller('.well-known')
export class OidcController {
  constructor(private readonly configService: ConfigService) { }

  @Get('openid-configuration')
  @ApiOperation({ summary: 'OIDC Discovery Endpoint' })
  getDiscovery() {
    const issuer = this.configService.get<string>('JWT_ISSUER', 'sigesta-auth-ldap');
    const baseUrl = this.configService.get<string>('APP_URL', 'http://localhost:3200');

    return {
      issuer,
      authorization_endpoint: `${baseUrl}/auth/authorize`,
      token_endpoint: `${baseUrl}/auth/login`,
      userinfo_endpoint: `${baseUrl}/auth/userinfo`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      response_types_supported: ['code', 'token', 'id_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['HS256'],
      scopes_supported: ['openid', 'profile', 'email'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      claims_supported: ['sub', 'iss', 'auth_time', 'name', 'given_name', 'family_name', 'email'],
    };
  }

  @Get('jwks.json')
  @ApiOperation({ summary: 'JWKS Endpoint (Public Keys)' })
  getJwks() {
    // Para simplificar con HS256 retornamos vacío o una estructura básica
    // En el futuro con RS256 aquí iría la clave pública
    return { keys: [] };
  }
}

@ApiTags('Auth')
@Controller('auth')
export class UserInfoController {
  @Get('userinfo')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'OIDC UserInfo Endpoint' })
  getUserInfo(@Request() req: { user: User }) {
    return {
      sub: req.user.name,
      name: req.user.name,
      preferred_username: req.user.name,
      role: req.user.attributes?.role,
      email: req.user.attributes?.email,
      mpath: req.user.mpath,
    };
  }
}
