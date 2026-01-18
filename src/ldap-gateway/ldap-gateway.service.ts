import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ldap from 'ldapjs';

import { AuthService } from '@/auth/auth.service';
import { DirectoryService } from '@/directory/directory.service';
import { AuditService } from '@/audit/audit.service';

@Injectable()
export class LdapGatewayService implements OnModuleInit, OnModuleDestroy {
  private server: any;
  private readonly logger = new Logger(LdapGatewayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly directoryService: DirectoryService,
    private readonly auditService: AuditService,
  ) { }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      this.logger.log('LDAP Gateway disabled in test mode');
      return;
    }
    const port = this.configService.get<number>('LDAP_PORT', 1389);
    this.server = ldap.createServer();

    // 1. Manejar BIND (Autenticación)
    this.server.bind('dc=organizacion,dc=com', (req, res, next) => this.handleBind(req, res, next));

    // 2. Manejar SEARCH
    this.server.search('dc=organizacion,dc=com', (req, res, next) => this.handleSearch(req, res, next));

    this.server.listen(port, () => {
      this.logger.log(`LDAP Gateway listening on port ${port}`);
    });
  }

  private async handleBind(req: any, res: any, next: any) {
    const dn = req.dn.toString();
    const password = req.credentials;

    this.logger.debug(`LDAP Bind attempt: ${dn}`);

    // Extraer username del DN (ej: uid=juan,ou=users,...)
    const uidRegex = /uid=([^,]+)/;
    const match = uidRegex.exec(dn);
    const username = match ? match[1] : dn;

    try {
      const user = await this.authService.validateUser(username, password);
      if (user) {
        // Log SUCCESS
        await this.auditService.logLdapAction({
          actorId: user.id || 0,
          actorName: user.name || username,
          actorRole: 'USER',
          action: 'LDAP_BIND',
          scope: user.mpath || '',
          status: 'SUCCESS',
          metadata: { dn, username },
        });
        res.end();
        return next();
      }
    } catch (error: any) {
      this.logger.error(`LDAP Auth failed for ${username}: ${error.message}`);
    }

    // Log FAILURE
    await this.auditService.logLdapAction({
      actorId: 0,
      actorName: username,
      actorRole: 'UNAUTHENTICATED',
      action: 'LDAP_BIND',
      scope: '',
      status: 'FAILED',
      metadata: { dn, username },
    });
    return next(new ldap.InvalidCredentialsError());
  }

  private async handleSearch(req: any, res: any, next: any) {
    const filterStr = req.filter.toString();
    const baseDn = req.dn?.toString() || 'dc=organizacion,dc=com';
    const scope = req.scope;

    this.logger.debug(`LDAP Search: dn=${baseDn}, scope=${scope}, filter=${filterStr}`);

    await this.auditService.logLdapAction({
      actorId: 0,
      actorName: 'LDAP_GATEWAY',
      actorRole: 'SYSTEM',
      action: 'LDAP_SEARCH',
      scope: baseDn,
      status: 'SUCCESS',
      metadata: { dn: baseDn, filter: filterStr, scope },
    });

    try {
      const rootId = await this.resolveRootIdFromDn(baseDn);
      const { searchTerm, searchType } = this.parseLdapFilter(req.filter, filterStr);
      const results = await this.executeSearch(scope, rootId, searchTerm, searchType);

      for (const item of results) {
        res.send(this.mapNodeToLdapEntry(item));
      }
    } catch (error: any) {
      this.logger.error(`LDAP Search error: ${error.message}`);
    }

    res.end();
    return next();
  }

  private async resolveRootIdFromDn(baseDn: string): Promise<number | undefined> {
    if (!baseDn.toLowerCase().includes('ou=')) return undefined;

    const ouRegex = /ou=([^,]+)/i;
    const ouMatch = ouRegex.exec(baseDn);
    if (!ouMatch) return undefined;

    const ouName = ouMatch[1];
    const ous = await this.directoryService.flatSearch(ouName, 'OU' as any);
    return ous.length > 0 ? ous[0].id : undefined;
  }

  private parseLdapFilter(filter: any, filterStr: string): { searchTerm: string; searchType?: any } {
    let searchTerm = '';
    let searchType: any = undefined;

    if (filter.json?.type === 'EqualityMatch') {
      const attr = filter.json.attribute.toLowerCase();
      const val = filter.json.value;
      if (['uid', 'cn', 'sn', 'mail'].includes(attr)) searchTerm = val;
      if (attr === 'objectclass') {
        if (val.toLowerCase() === 'inetorgperson') searchType = 'USER' as any;
        if (val.toLowerCase() === 'organizationalunit') searchType = 'OU' as any;
      }
    } else {
      searchTerm = filterStr.replaceAll(/[()]/g, '').split('=')[1] || '';
    }

    return { searchTerm, searchType };
  }

  private async executeSearch(scope: string, rootId: number | undefined, searchTerm: string, searchType: any): Promise<any[]> {
    if (scope === 'base' && rootId) {
      const node = await this.directoryService.findOne(rootId);
      return node ? [node] : [];
    }

    if (rootId) {
      return this.directoryService.searchInSubtree(rootId, searchTerm);
    }

    return this.directoryService.flatSearch(searchTerm, searchType);
  }

  private mapNodeToLdapEntry(item: any) {
    return {
      dn: `uid=${item.name},ou=users,dc=organizacion,dc=com`,
      attributes: {
        uid: item.name,
        cn: item.name,
        sn: item.attributes?.lastName || item.name,
        givenName: item.attributes?.firstName || '',
        displayName: `${item.attributes?.firstName || ''} ${item.attributes?.lastName || ''}`.trim(),
        mail: item.attributes?.email || '',
        objectClass: item.type === 'USER'
          ? ['top', 'person', 'organizationalPerson', 'inetOrgPerson']
          : ['top', 'organizationalUnit'],
        description: item.attributes?.description || '',
      },
    };
  }

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
      this.logger.log('LDAP Gateway server closed');
    }
  }
}
