import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para validar los datos del login.
 */
export class LoginDto {
  @ApiProperty({
    description: 'Username for authentication',
    example: 'juan.perez',
  })
  @IsNotEmpty({ message: 'El username es obligatorio' })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
  })
  @IsNotEmpty({ message: 'El password es obligatorio' })
  @IsString()
  password: string;
}
