import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DirectoryModule } from '../directory/directory.module'; // Para buscar usuarios
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { HierarchicalPermissionsGuard } from './guards/hierarchical-permissions.guard';

@Module({
  imports: [
    DirectoryModule, // Importamos para poder usar DirectoryService
    PassportModule,
    JwtModule.register({
      secret: String(process.env.JWT_SECRET), // Mover a .env
      signOptions: { expiresIn: '1h' }, // El token expira en 1 hora
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, HierarchicalPermissionsGuard],
  exports: [AuthService, HierarchicalPermissionsGuard],
})
export class AuthModule { }