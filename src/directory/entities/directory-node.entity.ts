import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Tree,
  TreeChildren,
  TreeParent,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';

export enum NodeType {
  DC = 'DC',       // Domain Component (ej: com, google)
  OU = 'OU',       // Organizational Unit (ej: Ventas)
  GROUP = 'GROUP', // Grupos de seguridad
  USER = 'USER',   // Usuario final
}

@Entity()
@Tree("materialized-path") // <--- ESTO ACTIVA LA ESTRATEGIA
export class DirectoryNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index() // Indexamos nombre para búsquedas rápidas de hermanos
  name: string;

  @Column({
    type: 'enum',
    enum: NodeType,
    default: NodeType.OU
  })
  type: NodeType;

  @Column({ nullable: true, select: false }) // select: false es CRÍTICO por seguridad
  password?: string;

  // JSONB permite guardar atributos flexibles sin alterar esquema (ideal LDAP)
  @Column({ type: 'jsonb', default: {} })
  attributes: Record<string, any>;

  @TreeChildren()
  children: DirectoryNode[];

  @TreeParent()
  parent: DirectoryNode;

  // TypeORM crea implícitamente esta columna para Materialized Path
  // La agregamos aquí para tener acceso a ella en TypeScript
  mpath?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Hook para hashear contraseña antes de guardar
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      // Solo hasheamos si la contraseña ha sido modificada y no es ya un hash
      // (Bcrypt genera strings de 60 caracteres que empiezan con $)
      if (!this.password.startsWith('$2b$') && !this.password.startsWith('$2a$')) {
        const salt = await bcrypt.genSalt();
        this.password = await bcrypt.hash(this.password, salt);
      }
    }
  }

  // TypeORM crea implícitamente una columna 'mpath' (o similar) oculta
  // No necesitas declararla aquí, pero estará en la BD.
}
