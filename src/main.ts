/**
 * Initializes and starts the NestJS application.
 *
 * @async
 * @function bootstrap
 * @returns {Promise<void>} A promise that resolves when the application is successfully started.
 * @description This function creates a NestJS application instance, starts the server to listen on the specified port (or 3000 by default), and logs the URL where the application is running.
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

import type { SwaggerCustomOptions } from '@nestjs/swagger/dist/interfaces';

dotenv.config();
const globalPrefix = '';
const port = Number(process.env.PORT);
const host = String(process.env.HOST);
const swaggerPort = Number(port + 10);

// Configuración de Swagger
const config = new DocumentBuilder()
  .setTitle('Nestjs LDAP API')
  .setDescription('API documentation for Nestjs LDAP application')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const myCustom: SwaggerCustomOptions = {
  customSiteTitle: 'Swagger dark mode',
  customCss: readFileSync(join(__dirname, 'SwaggerDark.css'), 'utf8'),
  swaggerOptions: {
    docExpansion: 'none',
    apisSorter: 'alpha',
  },
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: [String(process.env.API_URL), 'http://localhost:3000'],
    credentials: true,
  });
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }

  // Configurar Swagger antes de iniciar el servidor
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, myCustom);

  await app.listen(port, host);
  Logger.log(`🚀 Aplicación corriendo en: ${host}:${port}`);

  Logger.log(`📖 Documentación disponible en: http://${host}:${port}/docs`);

}

bootstrap();