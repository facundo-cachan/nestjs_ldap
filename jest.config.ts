import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: String.raw`.*\.spec\.ts$`,
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/index.ts', // Ignorar archivos barell
    '!**/*.module.ts', // Ignorar archivos *.module.ts
    '!**/main.ts', // Ignorar main.ts (bootstrap)
    '!**/data-source.ts', // Ignorar configuración de TypeORM
    '!**/migrations/**', // Ignorar migraciones
    '!**/*.interface.ts', // Ignorar interfaces
    '!**/*.enum.ts', // Ignorar enums
    '!**/*.dto.ts', // Ignorar DTOs
    '!**/*.entity.ts', // Ignorar entidades
    '!**/*.strategy.ts', // Ignorar estrategias
    '!**/*.guard.ts', // Ignorar guardias
    '!**/*.decorator.ts', // Ignorar decoradores
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

export default config;
