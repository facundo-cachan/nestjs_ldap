import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  Req,
  BadRequestException,
  UnauthorizedException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';

import { AuthService } from '@/auth/auth.service';
import { DirectoryService } from '@/directory/directory.service';
import { OAuth2ClientService } from '@/oauth2/services/oauth2-client.service';
import { AuthorizationCodeService } from '@/oauth2/services/authorization-code.service';

/**
 * Controlador OAuth2/OIDC.
 *
 * @description Implementa los endpoints del flujo Authorization Code:
 * - GET /auth/authorize: Inicia el flujo de autorización
 * - POST /auth/token: Intercambia código por tokens
 *
 * Compatible con OpenID Connect (OIDC).
 */
@ApiTags('OAuth2/OIDC')
@Controller('auth')
export class OAuth2Controller {
  private readonly logger = new Logger(OAuth2Controller.name);

  constructor(
    private readonly authService: AuthService,
    private readonly directoryService: DirectoryService,
    private readonly oauth2ClientService: OAuth2ClientService,
    private readonly authzCodeService: AuthorizationCodeService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * GET /auth/authorize - Endpoint de autorización OAuth2.
   *
   * @description Inicia el flujo de Authorization Code.
   * Si el usuario no está autenticado, redirige a la página de login.
   * Si está autenticado, genera un código de autorización y redirige al cliente.
   *
   * @param clientId Client ID de la aplicación solicitante
   * @param redirectUri URI de redirección
   * @param responseType Tipo de respuesta (debe ser 'code')
   * @param scope Scopes solicitados
   * @param state Estado opaco del cliente (se devuelve sin modificar)
   * @param res Response object de Express
   * @param req Request object de Express
   *
   * @example
   * GET /auth/authorize?client_id=my-app&redirect_uri=http://localhost:3000/callback&response_type=code&scope=openid profile&state=xyz
   */
  @Get('authorize')
  @ApiOperation({ summary: 'OAuth2 Authorization Endpoint' })
  @ApiQuery({ name: 'client_id', required: true })
  @ApiQuery({ name: 'redirect_uri', required: true })
  @ApiQuery({ name: 'response_type', required: true, enum: ['code'] })
  @ApiQuery({ name: 'scope', required: false, example: 'openid profile email' })
  @ApiQuery({ name: 'state', required: false })
  @ApiResponse({ status: 302, description: 'Redirect to login or client callback' })
  async authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('response_type') responseType: string,
    @Query('state') state: string,
    @Res() res: Response,
    @Req() req: Request,
    @Query('scope') scope: string = 'openid',
  ) {
    // 1. Validar parámetros básicos
    if (!clientId || !redirectUri || responseType !== 'code') {
      throw new BadRequestException('Invalid authorization request');
    }

    // 2. Validar que el cliente existe y está activo
    let client;
    try {
      client = await this.oauth2ClientService.findByClientId(clientId);
    } catch (error) {
      this.logger.error(`Failed to find client ${clientId}: ${error.message}`);
      throw new BadRequestException(`Invalid client_id: ${clientId}`);
    }

    if (!client.active) {
      throw new BadRequestException('Client is inactive');
    }

    // 3. Validar redirect_uri
    if (!client.isRedirectUriAllowed(redirectUri)) {
      throw new BadRequestException('Invalid redirect_uri');
    }

    // 4. Validar scopes
    if (!client.isScopeAllowed(scope)) {
      throw new BadRequestException('Invalid scope');
    }

    // 5. Verificar si el usuario está autenticado
    // NOTA: En una implementación real, aquí verificarías una sesión/cookie
    // Por ahora, simulamos redirección a login
    const userId = (req as any).userId; // Extraído de sesión/cookie

    if (!userId) {
      // Redirigir a página de login con parámetros para volver aquí
      const loginUrl = this.buildLoginRedirectUrl(req.originalUrl);
      return res.redirect(HttpStatus.FOUND, loginUrl);
    }

    // 6. Generar código de autorización
    const code = await this.authzCodeService.generateCode(
      userId,
      clientId,
      redirectUri,
      scope,
    );

    // 7. Redirigir al cliente con el código
    const callbackUrl = this.buildCallbackUrl(redirectUri, code, state);
    return res.redirect(HttpStatus.FOUND, callbackUrl);
  }

  /**
   * POST /auth/token - Endpoint de intercambio de tokens OAuth2.
   *
   * @description Intercambia un authorization_code por access_token, id_token y refresh_token.
   * También soporta refresh_token grant type.
   *
   * @param grantType Tipo de grant (authorization_code o refresh_token)
   * @param code Código de autorización (para authorization_code)
   * @param redirectUri URI de redirección original (para authorization_code)
   * @param clientId Client ID
   * @param clientSecret Client Secret (para clientes confidenciales)
   * @param refreshToken Refresh token (para refresh_token grant)
   *
   * @returns Objeto con access_token, id_token, refresh_token y expires_in
   *
   * @example
   * POST /auth/token
   * {
   *   "grant_type": "authorization_code",
   *   "code": "abc123",
   *   "redirect_uri": "http://localhost:3000/callback",
   *   "client_id": "my-app",
   *   "client_secret": "secret"
   * }
   */
  @Post('token')
  @ApiOperation({ summary: 'OAuth2 Token Endpoint' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['grant_type', 'client_id'],
      properties: {
        grant_type: { type: 'string', enum: ['authorization_code', 'refresh_token'] },
        code: { type: 'string' },
        redirect_uri: { type: 'string' },
        client_id: { type: 'string' },
        client_secret: { type: 'string' },
        refresh_token: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens issued successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        id_token: { type: 'string' },
        refresh_token: { type: 'string' },
        token_type: { type: 'string', example: 'Bearer' },
        expires_in: { type: 'number', example: 3600 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Invalid client credentials' })
  async token(
    @Body('grant_type') grantType: string,
    @Body('code') code: string,
    @Body('redirect_uri') redirectUri: string,
    @Body('client_id') clientId: string,
    @Body('client_secret') clientSecret: string,
    @Body('refresh_token') refreshToken: string,
  ) {
    if (!grantType || !clientId) {
      throw new BadRequestException('Missing required parameters');
    }

    // Validar cliente
    let client;
    if (clientSecret) {
      client = await this.oauth2ClientService.validateClient(clientId, clientSecret);
    } else {
      client = await this.oauth2ClientService.findByClientId(clientId);
    }

    if (!client.isGrantTypeAllowed(grantType)) {
      throw new BadRequestException('Grant type not allowed for this client');
    }

    if (grantType === 'authorization_code') {
      return await this.handleAuthorizationCodeGrant(code, redirectUri, client);
    }

    if (grantType === 'refresh_token') {
      return await this.handleRefreshTokenGrant(refreshToken, client);
    }

    throw new BadRequestException('Unsupported grant_type');
  }

  /**
   * Maneja el flujo de authorization_code grant.
   *
   * @param code Código de autorización
   * @param redirectUri URI de redirección
   * @param client Cliente OAuth2
   * @returns Tokens
   */
  private async handleAuthorizationCodeGrant(code: string, redirectUri: string, client: any) {
    if (!code || !redirectUri) {
      throw new BadRequestException('Missing code or redirect_uri');
    }

    // Validar y consumir el código
    const authzData = await this.authzCodeService.validateAndConsume(
      code,
      client.clientId,
      redirectUri,
    );

    if (!authzData) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }

    // Obtener datos del usuario
    const user = await this.directoryService.findOne(String(authzData.userId));
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generar tokens
    const tokens = await this.authService.login(user as any, client.clientId);

    return {
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: authzData.scope,
    };
  }

  /**
   * Maneja el flujo de refresh_token grant.
   *
   * @param refreshToken Refresh token
   * @param client Cliente OAuth2
   * @returns Nuevos tokens
   */
  private async handleRefreshTokenGrant(refreshToken: string, client: any) {
    if (!refreshToken) {
      throw new BadRequestException('Missing refresh_token');
    }

    // Refrescar usando el servicio de auth existente
    const tokens = await this.authService.refresh(refreshToken);

    return {
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      token_type: 'Bearer',
      expires_in: 3600,
    };
  }

  /**
   * Construye la URL de redirección al login.
   *
   * @param returnUrl URL original de autorización
   * @returns URL de login con parámetro de retorno
   */
  private buildLoginRedirectUrl(returnUrl: string): string {
    const baseUrl = this.configService.get<string>('APP_URL', 'http://localhost:3200');
    const loginPath = '/login'; // Configurable según tu frontend
    return `${baseUrl}${loginPath}?return_to=${encodeURIComponent(returnUrl)}`;
  }

  /**
   * Construye la URL de callback al cliente.
   *
   * @param redirectUri URI base de redirección
   * @param code Código de autorización
   * @param state Estado del cliente
   * @returns URL completa con parámetros
   */
  private buildCallbackUrl(redirectUri: string, code: string, state?: string): string {
    const url = new URL(redirectUri);
    url.searchParams.append('code', code);
    if (state) {
      url.searchParams.append('state', state);
    }
    return url.toString();
  }
}
