import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number.parseInt(process.env.POSTGRES_PORT || '5432'),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'nestjs_ldap',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false, // NUNCA en producción con migraciones
  logging: process.env.ENABLE_AUDIT_LOGS === 'true',
});
