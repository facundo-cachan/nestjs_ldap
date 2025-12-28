import * as dotenv from 'dotenv';
dotenv.config();

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

import { AppModule } from '@/app.module';
import { DirectoryNode, NodeType } from '@/directory/entities/directory-node.entity';

describe('JWT Payload Debug', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let repository: TreeRepository<DirectoryNode>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    repository = moduleFixture.get(getRepositoryToken(DirectoryNode));

    // Limpiar y crear usuario de prueba
    await repository.query('TRUNCATE TABLE directory_node RESTART IDENTITY CASCADE');

    const rootOu = await repository.save(
      repository.create({
        name: 'company',
        type: NodeType.OU,
        attributes: {},
      }),
    );

    await repository.save(
      repository.create({
        name: 'superadmin',
        type: NodeType.USER,
        password: 'admin123',
        parent: rootOu,
        attributes: {
          isSuperAdmin: true,
          email: 'superadmin@company.com',
        },
      }),
    );
  });

  afterAll(async () => {
    await repository.query('TRUNCATE TABLE directory_node RESTART IDENTITY CASCADE');
    await app.close();
  });

  it('should decode SUPER_ADMIN JWT token and verify role', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'superadmin',
        password: 'admin123',
      });

    console.log('Login Response:', JSON.stringify(loginResponse.body, null, 2));

    if (loginResponse.body.access_token) {
      const decoded = jwtService.decode(loginResponse.body.access_token);
      console.log('Decoded JWT:', JSON.stringify(decoded, null, 2));

      // Verificar que el rol sea SUPER_ADMIN
      expect(decoded).toHaveProperty('role');
      expect(decoded['role']).toBe('SUPER_ADMIN');
      expect(decoded).toHaveProperty('mpath');
    } else {
      fail('No access token in response');
    }
  });
});
