import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ldap from 'ldapjs';

import { AuthService } from '@/auth/auth.service';
import { DirectoryService } from '@/directory/directory.service';

@Injectable()
export class LdapGatewayService implements OnModuleInit, OnModuleDestroy {
  private server: any;
  private readonly logger = new Logger(LdapGatewayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly directoryService: DirectoryService,
  ) { }

  onModuleInit() {
    const port = this.configService.get<number>('LDAP_PORT', 389);
    this.server = ldap.createServer();

    // 1. Manejar BIND (Autenticación)
    this.server.bind('dc=organizacion,dc=com', async (req, res, next) => {
      const dn = req.dn.toString();
      const password = req.credentials;

      this.logger.debug(`LDAP Bind attempt: ${dn}`);

      // Extraer username del DN (ej: uid=juan,ou=users,...)
      const match = dn.match(/uid=([^,]+)/);
      const username = match ? match[1] : dn;

      try {
        const user = await this.authService.validateUser(username, password);
        if (user) {
          res.end();
          return next();
        }
      } catch (error) {
        this.logger.error(`LDAP Auth failed for ${username}: ${error.message}`);
      }

      return next(new ldap.InvalidCredentialsError());
    });

    // 2. Manejar SEARCH
    this.server.search('dc=organizacion,dc=com', async (req, res, next) => {
      const filter = req.filter.toString();
      this.logger.debug(`LDAP Search filter: ${filter}`);

      // Mapear búsqueda a DirectoryService
      try {
        // Ejemplo simplificado de búsqueda plana
        const users = await this.directoryService.flatSearch(filter.replace(/[()]/g, '').split('=')[1] || '');

        for (const user of users) {
          res.send({
            dn: `uid=${user.name},ou=users,dc=organizacion,dc=com`,
            attributes: {
              uid: user.name,
              cn: user.name,
              sn: user.attributes?.lastName || user.name,
              mail: user.attributes?.email || '',
              objectClass: ['top', 'person', 'organizationalPerson', 'inetOrgPerson'],
            },
          });
        }
      } catch (error) {
        this.logger.error(`LDAP Search error: ${error.message}`);
      }

      res.end();
      return next();
    });

    this.server.listen(port, () => {
      this.logger.log(`LDAP Gateway listening on port ${port}`);
    });
  }

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
      this.logger.log('LDAP Gateway server closed');
    }
  }
}
