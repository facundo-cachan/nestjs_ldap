import { JwtModule } from '@nestjs/jwt';
import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from '@/auth/auth.service';
import { AuthController } from '@/auth/auth.controller';
import { DirectoryModule } from '@/directory/directory.module'; // Para buscar usuarios
import { LocalStrategy } from '@/auth/strategies/local.strategy';
import { JwtStrategy } from '@/auth/strategies/jwt.strategy';
import { HierarchicalPermissionsGuard } from '@/auth/guards/hierarchical-permissions.guard';
import { AntiEscalationService } from '@/auth/services/anti-escalation.service';

@Module({
  imports: [
    forwardRef(() => DirectoryModule), // Importamos para poder usar DirectoryService
    PassportModule,
    JwtModule.register({
      secret: String(process.env.JWT_SECRET), // Mover a .env
      signOptions: {
        expiresIn: process.env.NODE_ENV === 'test' ? '24h' : '1h', // Más tiempo para tests
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    HierarchicalPermissionsGuard,
    AntiEscalationService,
  ],
  exports: [AuthService, HierarchicalPermissionsGuard, AntiEscalationService],
})
export class AuthModule { }