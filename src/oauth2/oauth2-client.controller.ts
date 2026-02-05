import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';
import { OAuth2ClientService, CreateOAuth2ClientDto } from '@/oauth2/services/oauth2-client.service';
import { OAuth2Client } from '@/oauth2/entities/oauth2-client.entity';

/**
 * Controller para gestión de clientes OAuth2.
 * 
 * @description Permite a los administradores registrar, actualizar y eliminar 
 * aplicaciones que usarán el SSO.
 */
@ApiTags('OAuth2/Clients')
@Controller('oauth2/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class OAuth2ClientController {
  constructor(private readonly clientService: OAuth2ClientService) { }

  @Post()
  @ApiOperation({ summary: 'Register a new OAuth2 client' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'clientId', 'redirectUris'],
      properties: {
        name: { type: 'string', example: 'My App' },
        clientId: { type: 'string', example: 'my-app' },
        clientSecret: { type: 'string', example: 'super-secret' },
        redirectUris: { type: 'array', items: { type: 'string' }, example: ['http://localhost:3000/callback'] },
        clientType: { type: 'string', enum: ['confidential', 'public'], default: 'confidential' },
      },
    }
  })
  @ApiResponse({ status: 201, type: OAuth2Client })
  async create(@Body() dto: CreateOAuth2ClientDto) {
    return this.clientService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all OAuth2 clients' })
  @ApiResponse({ status: 200, type: [OAuth2Client] })
  async findAll() {
    return this.clientService.findAll();
  }

  @Get(':clientId')
  @ApiOperation({ summary: 'Get an OAuth2 client by ID' })
  @ApiResponse({ status: 200, type: OAuth2Client })
  async findByClientId(@Param('clientId') clientId: string) {
    return this.clientService.findByClientId(clientId);
  }

  @Put(':clientId')
  @ApiOperation({ summary: 'Update an OAuth2 client' })
  @ApiResponse({ status: 200, type: OAuth2Client })
  async update(
    @Param('clientId') clientId: string,
    @Body() updates: Partial<CreateOAuth2ClientDto>,
  ) {
    return this.clientService.update(clientId, updates);
  }

  @Delete(':clientId')
  @ApiOperation({ summary: 'Delete an OAuth2 client' })
  @ApiResponse({ status: 204 })
  async delete(@Param('clientId') clientId: string) {
    await this.clientService.delete(clientId);
  }
}
