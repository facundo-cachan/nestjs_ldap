import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { Role } from '@/auth/enums/role.enum';
import { NodeType } from '@/directory/entities/directory-node.entity';

export interface UserCredentials {
  username: string;
  password: string;
}

export class TimeStamps {
  createdAt: Date;
  updatedAt: Date;
}

@Entity()
export class User extends TimeStamps {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  password: string;

  @Column()
  type: NodeType;

  @Column()
  role: Role;

  @Column()
  adminOfNodeId: number;

  @Column()
  attributes: {
    isSuperAdmin?: boolean;
    role?: Role;
    adminOf?: boolean;
    isAdmin?: boolean;
  };
}