import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DirectoryService } from '@/directory/directory.service';
import { DirectoryController } from '@/directory/directory.controller';
import { DirectoryNode } from '@/directory/entities/directory-node.entity';
import { AuditModule } from '@/audit/audit.module';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DirectoryNode]),
    AuditModule, // Importar módulo de auditoría
    forwardRef(() => AuthModule),
  ],
  controllers: [DirectoryController],
  providers: [DirectoryService],
  exports: [
    DirectoryService,
    TypeOrmModule, // Exportar para que otros módulos puedan usar el repositorio
  ],
})
export class DirectoryModule { }
