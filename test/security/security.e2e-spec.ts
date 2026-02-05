import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm';
import * as dotenv from 'dotenv';
import { AppModule } from '@/app.module';
import { DirectoryNode, NodeType } from '@/directory/entities/directory-node.entity';

dotenv.config();

describe('Security Hardening (e2e)', () => {
  let app: INestApplication;
  let repository: TreeRepository<DirectoryNode>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    repository = moduleFixture.get(getRepositoryToken(DirectoryNode));

    // Cleanup and setup
    await repository.query('TRUNCATE TABLE directory_node RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    if (repository) {
      await repository.query('TRUNCATE TABLE directory_node RESTART IDENTITY CASCADE');
    }
    if (app) {
      await app.close();
    }
  });

  describe('HTTP Security Headers (Helmet)', () => {
    it('should have security headers enabled', async () => {
      const response = await request(app.getHttpServer()).get('/');

      // Check for common Helmet headers
      // Note: Header names are lowercase in supertest/express
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Token Revocation & Logout', () => {
    let accessToken: string;

    beforeAll(async () => {
      // Create a test user
      await repository.save(
        repository.create({
          name: 'security.test',
          type: NodeType.USER,
          password: 'password123',
          attributes: { email: 'security@test.com' },
        }),
      );

      // Login
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'security.test', password: 'password123' })
        .expect(201);

      accessToken = loginRes.body.access_token;
    });

    it('should allow access with a fresh token', async () => {
      await request(app.getHttpServer())
        .get('/auth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should deny access after logout (Token Revocation)', async () => {
      // 1. Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // 2. Try to use the same token again
      // We expect 401 because JwtBlacklistGuard checks Redis
      await request(app.getHttpServer())
        .get('/auth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('Refresh Token Rotation', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'security.test', password: 'password123' })
        .expect(201);

      refreshToken = loginRes.body.refresh_token;
    });

    it('should rotate refresh tokens and deny old one', async () => {
      // 1. Use refresh token once
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(201);

      const newRefreshToken = refreshRes.body.refresh_token;
      expect(newRefreshToken).toBeDefined();
      expect(newRefreshToken).not.toBe(refreshToken);

      // 2. Try to use the OLD refresh token again (Reuse Attack)
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(401); // Should be denied as it was deleted from Redis
    });
  });
});
