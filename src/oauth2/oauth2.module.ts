import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OAuth2Client } from '@/oauth2/entities/oauth2-client.entity';
import { OAuth2ClientService } from '@/oauth2/services/oauth2-client.service';
import { AuthorizationCodeService } from '@/oauth2/services/authorization-code.service';
import { OAuth2Controller } from '@/oauth2/oauth2.controller';
import { OAuth2ClientController } from '@/oauth2/oauth2-client.controller';
import { AuthModule } from '@/auth/auth.module';
import { DirectoryModule } from '@/directory/directory.module';
import { CacheModule } from '@nestjs/cache-manager';

/**
 * Módulo OAuth2/OIDC.
 *
 * @description Implementa el flujo de Authorization Code y gestión de clientes OAuth2.
 * Permite que aplicaciones externas se autentiquen usando este servicio como IdP.
 *
 * @example
 * Import en app.module.ts:
 * imports: [OAuth2Module]
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OAuth2Client]),
    CacheModule.register({}), // We still need the module to be imported for injection to work if not using global, but since we made it global, we could even remove this.

    AuthModule,
    DirectoryModule,
  ],
  controllers: [OAuth2Controller, OAuth2ClientController],
  providers: [OAuth2ClientService, AuthorizationCodeService],
  exports: [OAuth2ClientService, AuthorizationCodeService],
})
export class OAuth2Module { }
