// src/directory/dto/create-node.dto.ts
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { NodeType } from '../entities/directory-node.entity';

export class CreateNodeDto {
  @ApiProperty({
    description: 'Name of the directory node',
    example: 'juan.perez',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Type of the directory node',
    enum: NodeType,
    example: NodeType.USER,
  })
  @IsEnum(NodeType)
  type: NodeType;

  @ApiProperty({
    description: 'ID of the parent node',
    example: 5,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  parentId?: number; // El ID del padre (ej: la OU donde crearás al usuario)

  @ApiProperty({
    description: 'Additional attributes in JSON format',
    example: { email: 'juan@empresa.com', firstName: 'Juan', lastName: 'Pérez' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, any>; // Ej: { "email": "juan@empresa.com" }

  @ApiProperty({
    description: 'Password for USER type nodes',
    example: 'SecurePassword123!',
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string; // Password para nodos de tipo USER
}

// src/directory/dto/search-node.dto.ts
export class SearchNodeDto {
  @ApiProperty({
    description: 'Search term for name or email',
    example: 'juan',
    required: false,
  })
  @IsString()
  @IsOptional()
  query?: string; // Texto a buscar (nombre o email)
}