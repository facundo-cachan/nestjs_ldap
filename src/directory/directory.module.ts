import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DirectoryService } from './directory.service';
import { DirectoryController } from './directory.controller';
import { DirectoryNode } from './entities/directory-node.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DirectoryNode]),
  ],
  controllers: [DirectoryController],
  providers: [DirectoryService],
  exports: [
    DirectoryService,
    TypeOrmModule, // Exportar para que otros módulos puedan usar el repositorio
  ],
})
export class DirectoryModule { }
