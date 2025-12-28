import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';

import { DirectoryService } from '@/directory/directory.service';
import { NodeType } from '@/directory/entities/directory-node.entity';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { Role } from '@/auth/enums/role.enum';
import { User } from '@/auth/interfaces/user.interface';

import type { UserCredentials } from '@/auth/interfaces/user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly directoryService: DirectoryService,
    private readonly jwtService: JwtService,
  ) { }

  /**
   * Valida las credenciales del usuario.
   * Usado por LocalStrategy.
   */
  async validateUser(username: UserCredentials['username'], pass: UserCredentials['password']): Promise<Partial<User> | null> {
    // 1. Buscamos el nodo. Nota: necesitamos el password, así que usamos addSelect
    // Asumimos que el 'username' es el 'name' del nodo, pero podría ser un email en los attributes.
    const user = await this.directoryService.findUserByNameWithPassword(username);

    // 2. Verificaciones: Que exista, que sea tipo USER y que el pass coincida
    if (user && user.type === NodeType.USER && user.password) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (isMatch) {
        // Eliminamos el password del objeto antes de retornarlo
        const { password, ...result } = user;
        console.log({ result });
        return result;
      }
    }
    return null;
  }

  /**
   * Genera el JWT tras un login exitoso.
   * Incluye información de roles para RBAC jerárquico.
   */
  async login(user: User) {
    // NOTE: Necesitamos obtener el mpath del usuario desde la BD
    // El objeto 'user' que viene del validateUser no incluye mpath
    const fullUser = await this.directoryService.findOne(user.id);

    if (!fullUser) {
      throw new Error('User not found');
    }

    // Determinar rol del usuario desde la BD o attributes
    const role = this.getUserRole(fullUser);
    const roles = fullUser.roles || [role];
    const adminOfNodeId = fullUser.adminOfNodeId || this.getAdminNodeId(fullUser, role);

    const payload: JwtPayload = {
      sub: fullUser.name,
      id: fullUser.id,
      role,
      roles,
      adminOfNodeId,
      mpath: fullUser.mpath, // CRÍTICO: Incluir mpath para scope checking
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: fullUser.id,
        username: fullUser.name,
        role,
        roles,
        adminOfNodeId,
        mpath: fullUser.mpath,
      },
    };
  }

  /**
   * Determina el rol de un usuario basándose en sus atributos.
   * Lógica de ejemplo - puede ser más compleja según tus necesidades.
   */
  private getUserRole(user: User): Role {
    // Buscar el rol en los atributos del usuario
    if (user.attributes?.role) {
      return user.attributes.role as Role;
    }

    // Si el usuario tiene un atributo 'isSuperAdmin', es SUPER_ADMIN
    if (user.attributes?.isSuperAdmin === true) {
      return Role.SUPER_ADMIN;
    }

    // Si el usuario tiene un atributo 'isAdmin' y 'adminOf', es OU_ADMIN
    if (user.attributes?.isAdmin === true && user.attributes?.adminOf) {
      return Role.OU_ADMIN;
    }

    // Por defecto, usuario normal
    return Role.USER;
  }

  /**
   * Obtiene el ID del nodo del cual el usuario es administrador.
   * Solo relevante para OU_ADMIN.
   */
  private getAdminNodeId(user: any, role: Role): number | undefined {
    if (role === Role.OU_ADMIN && user.attributes?.adminOf) {
      return Number.parseInt(user.attributes.adminOf);
    }
    return undefined;
  }
}