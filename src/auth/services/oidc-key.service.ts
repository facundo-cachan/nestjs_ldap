import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

@Injectable()
export class OidcKeyService {
  private readonly logger = new Logger(OidcKeyService.name);
  private privateKey: string;
  private publicKey: string;
  private publicKeyJwks: any;

  constructor(private readonly configService: ConfigService) {
    this.initializeKeys();
  }

  /**
   * Inicializa las claves RSA para OIDC.
   * Intenta cargar desde variables de entorno o genera una nueva.
   */
  private initializeKeys() {
    let privateKeyPem = this.configService.get<string>('OIDC_PRIVATE_KEY');

    if (privateKeyPem) {
      privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');
      this.logger.log('OIDC Private Key loaded from config');
      // Si tenemos la privada, derivamos la pública correctamente
      const keyObject = crypto.createPrivateKey(privateKeyPem);
      const publicKeyObject = crypto.createPublicKey(keyObject);
      this.publicKey = publicKeyObject.export({ type: 'spki', format: 'pem' }) as string;
    } else {
      this.logger.warn('No OIDC_PRIVATE_KEY found. Generating a new one (ephemeral)...');
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      privateKeyPem = privateKey;
      this.publicKey = publicKey;
    }

    this.privateKey = privateKeyPem;

    // Generar JWKS a partir de la clave pública usando crypto nativo (CJS safe)
    try {
      const publicKeyObj = crypto.createPublicKey(this.publicKey);
      const publicJwk = publicKeyObj.export({ format: 'jwk' });

      this.publicKeyJwks = {
        keys: [
          {
            ...publicJwk,
            kid: this.configService.get<string>('OIDC_KID', 'main-key'),
            use: 'sig',
            alg: 'RS256',
          },
        ],
      };
    } catch (error: any) {
      this.logger.error(`Failed to generate JWKS: ${error.message}`);
    }
  }

  /**
   * Retorna la clave privada en formato PEM para firmar JWTs.
   */
  getPrivateKey(): string {
    return this.privateKey;
  }

  /**
   * Retorna la clave pública en formato PEM.
   */
  getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Retorna el Public Key Set (JWKS).
   */
  getJwks() {
    return this.publicKeyJwks;
  }
}
