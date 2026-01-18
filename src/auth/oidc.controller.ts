import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import { OidcKeyService } from '@/auth/services/oidc-key.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { User } from '@/auth/interfaces/user.interface';

@ApiTags('OIDC')
@Controller('.well-known')
export class OidcController {
  constructor(
    private readonly configService: ConfigService,
    private readonly oidcKeyService: OidcKeyService,
  ) { }

  @Get('openid-configuration')
  @ApiOperation({ summary: 'OIDC Discovery Endpoint' })
  getDiscovery() {
    const issuer = this.configService.get<string>('JWT_ISSUER', 'sigesta-auth-ldap');
    const baseUrl = this.configService.get<string>('APP_URL', 'http://localhost:3200');

    return {
      issuer,
      authorization_endpoint: `${baseUrl}/auth/authorize`,
      token_endpoint: `${baseUrl}/auth/token`,
      userinfo_endpoint: `${baseUrl}/auth/userinfo`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      registration_endpoint: `${baseUrl}/oauth2/clients`, // Opcional, pero útil si se expone
      scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
      response_types_supported: ['code', 'token', 'id_token', 'code id_token', 'token id_token'],
      grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      claims_supported: [
        'sub',
        'iss',
        'auth_time',
        'name',
        'given_name',
        'family_name',
        'preferred_username',
        'email',
        'email_verified',
        'groups',
        'role',
        'mpath',
      ],
      code_challenge_methods_supported: ['S256', 'plain'],
    };
  }

  @Get('jwks.json')
  @ApiOperation({ summary: 'JWKS Endpoint (Public Keys)' })
  getJwks() {
    return this.oidcKeyService.getJwks();
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
      given_name: req.user.attributes?.firstName,
      family_name: req.user.attributes?.lastName,
      preferred_username: req.user.name,
      role: req.user.attributes?.role,
      roles: req.user.roles,
      email: req.user.attributes?.email,
      email_verified: true, // Asumimos verificado si está en LDAP
      mpath: req.user.mpath,
    };
  }
}
