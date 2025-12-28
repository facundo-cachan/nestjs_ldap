import { DirectoryNode } from '@/directory/entities/directory-node.entity';

/**
 * User credentials for login
 */
export interface UserCredentials {
  username: string;
  password: string;
}

/**
 * User type - alias for DirectoryNode when used in auth context
 * This ensures type compatibility between DirectoryNode and User
 */
export type User = DirectoryNode;