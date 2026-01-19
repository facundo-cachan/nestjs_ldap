import { JwtModule } from '@nestjs/jwt';
import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from '@/auth/auth.service';
import { AuthController } from '@/auth/auth.controller';
import { OidcController, UserInfoController } from '@/auth/oidc.controller';
import { DirectoryModule } from '@/directory/directory.module'; // Para buscar usuarios
import { LocalStrategy } from '@/auth/strategies/local.strategy';
import { JwtStrategy } from '@/auth/strategies/jwt.strategy';
import { HierarchicalPermissionsGuard } from '@/auth/guards/hierarchical-permissions.guard';
import { JwtBlacklistGuard } from '@/auth/guards/jwt-blacklist.guard';
import { AntiEscalationService } from '@/auth/services/anti-escalation.service';
import { AuditModule } from '@/audit/audit.module';
import { OidcKeyModule } from '@/auth/oidc-key.module';
import { OidcKeyService } from '@/auth/services/oidc-key.service';

@Module({
  imports: [
    forwardRef(() => DirectoryModule), // Importamos para poder usar DirectoryService
    PassportModule,
    OidcKeyModule,
    JwtModule.registerAsync({
      imports: [ConfigModule, OidcKeyModule],
      inject: [ConfigService, OidcKeyService],
      useFactory: (configService: ConfigService, oidcKeyService: OidcKeyService) => ({
        privateKey: oidcKeyService.getPrivateKey(),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: process.env.NODE_ENV === 'test' ? '24h' : '1h',
        },
      }),
    }),
    AuditModule,
  ],
  controllers: [AuthController, OidcController, UserInfoController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    HierarchicalPermissionsGuard,
    JwtBlacklistGuard,
    AntiEscalationService,
  ],
  exports: [AuthService, HierarchicalPermissionsGuard, AntiEscalationService, OidcKeyModule],
})
export class AuthModule { }