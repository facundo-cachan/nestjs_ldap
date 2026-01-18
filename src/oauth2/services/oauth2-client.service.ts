import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { OAuth2Client } from '@/oauth2/entities/oauth2-client.entity';

/**
 * DTO para crear un nuevo cliente OAuth2.
 */
export interface CreateOAuth2ClientDto {
  name: string;
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  allowedScopes?: string;
  clientType?: 'confidential' | 'public';
  grantTypes?: string;
}

/**
 * Servicio para gestión de clientes OAuth2.
 *
 * @description Maneja el CRUD de aplicaciones cliente que pueden autenticarse
 * vía OAuth2/OIDC contra este IdP.
 */
@Injectable()
export class OAuth2ClientService {
  constructor(
    @InjectRepository(OAuth2Client)
    private readonly clientRepository: Repository<OAuth2Client>,
  ) { }

  /**
   * Crea un nuevo cliente OAuth2.
   *
   * @param dto Datos del cliente
   * @returns Cliente creado
   *
   * @description El clientSecret se hashea automáticamente con bcrypt.
   *
   * @example
   * const client = await service.create({
   *   name: 'Mi App',
   *   clientId: 'my-app',
   *   clientSecret: 'super-secret',
   *   redirectUris: ['http://localhost:3000/callback'],
   * });
   */
  async create(dto: CreateOAuth2ClientDto): Promise<OAuth2Client> {
    const existing = await this.clientRepository.findOne({
      where: { clientId: dto.clientId },
    });

    if (existing) {
      throw new BadRequestException(`Client with ID '${dto.clientId}' already exists`);
    }

    const client = new OAuth2Client();
    client.name = dto.name;
    client.clientId = dto.clientId;
    client.redirectUris = dto.redirectUris.join(',');
    client.clientType = dto.clientType || 'confidential';
    client.allowedScopes = dto.allowedScopes || 'openid profile email';
    client.grantTypes = dto.grantTypes || 'authorization_code,refresh_token';

    // Hashear el client_secret si es un cliente confidencial
    if (dto.clientSecret && client.clientType === 'confidential') {
      client.clientSecret = await bcrypt.hash(dto.clientSecret, 10);
    }

    return await this.clientRepository.save(client);
  }

  /**
   * Busca un cliente por su client_id.
   *
   * @param clientId Client ID
   * @returns Cliente encontrado
   * @throws NotFoundException si no existe
   *
   * @example
   * const client = await service.findByClientId('my-app');
   */
  async findByClientId(clientId: string): Promise<OAuth2Client> {
    const client = await this.clientRepository.findOne({
      where: { clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client '${clientId}' not found`);
    }

    return client;
  }

  /**
   * Valida las credenciales de un cliente confidencial.
   *
   * @param clientId Client ID
   * @param clientSecret Client Secret sin hashear
   * @returns Cliente si las credenciales son válidas
   * @throws BadRequestException si las credenciales son inválidas
   *
   * @example
   * const client = await service.validateClient('my-app', 'super-secret');
   */
  async validateClient(clientId: string, clientSecret: string): Promise<OAuth2Client> {
    const client = await this.findByClientId(clientId);

    if (!client.active) {
      throw new BadRequestException('Client is inactive');
    }

    if (client.clientType === 'public') {
      // Los clientes públicos no requieren secret
      return client;
    }

    if (!client.clientSecret) {
      throw new BadRequestException('Client secret is required');
    }

    const isValid = await bcrypt.compare(clientSecret, client.clientSecret);

    if (!isValid) {
      throw new BadRequestException('Invalid client credentials');
    }

    return client;
  }

  /**
   * Lista todos los clientes OAuth2.
   *
   * @returns Array de clientes
   *
   * @example
   * const clients = await service.findAll();
   */
  async findAll(): Promise<OAuth2Client[]> {
    return await this.clientRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Actualiza un cliente OAuth2.
   *
   * @param clientId Client ID
   * @param updates Campos a actualizar
   * @returns Cliente actualizado
   *
   * @example
   * const client = await service.update('my-app', { active: false });
   */
  async update(
    clientId: string,
    updates: Partial<CreateOAuth2ClientDto>,
  ): Promise<OAuth2Client> {
    const client = await this.findByClientId(clientId);

    if (updates.name) client.name = updates.name;
    if (updates.redirectUris) client.redirectUris = updates.redirectUris.join(',');
    if (updates.allowedScopes) client.allowedScopes = updates.allowedScopes;
    if (updates.grantTypes) client.grantTypes = updates.grantTypes;

    // Actualizar secret solo si se proporciona uno nuevo
    if (updates.clientSecret) {
      client.clientSecret = await bcrypt.hash(updates.clientSecret, 10);
    }

    return await this.clientRepository.save(client);
  }

  /**
   * Desactiva un cliente OAuth2.
   *
   * @param clientId Client ID
   * @returns Cliente desactivado
   *
   * @example
   * await service.deactivate('my-app');
   */
  async deactivate(clientId: string): Promise<OAuth2Client> {
    const client = await this.findByClientId(clientId);
    client.active = false;
    return await this.clientRepository.save(client);
  }

  /**
   * Elimina un cliente OAuth2.
   *
   * @param clientId Client ID
   *
   * @example
   * await service.delete('my-app');
   */
  async delete(clientId: string): Promise<void> {
    const client = await this.findByClientId(clientId);
    await this.clientRepository.remove(client);
  }
}
