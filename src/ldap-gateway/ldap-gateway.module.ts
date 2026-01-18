import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '@/auth/auth.module';
import { DirectoryModule } from '@/directory/directory.module';
import { LdapGatewayService } from './ldap-gateway.service';

@Module({
  imports: [ConfigModule, AuthModule, DirectoryModule],
  providers: [LdapGatewayService],
  exports: [LdapGatewayService],
})
export class LdapGatewayModule { }
