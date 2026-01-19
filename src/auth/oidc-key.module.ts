import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OidcKeyService } from './services/oidc-key.service';

@Module({
  imports: [ConfigModule],
  providers: [OidcKeyService],
  exports: [OidcKeyService],
})
export class OidcKeyModule { }
