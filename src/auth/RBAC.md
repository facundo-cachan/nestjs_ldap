# RBAC Jerárquico - Guía de Uso

## Descripción

Sistema de control de acceso basado en roles (RBAC) que aprovecha la estructura jerárquica del árbol de directorio para permisos en cascada.

## Roles Disponibles

### `SUPER_ADMIN`
- Acceso total a todo el sistema
- Puede operar sobre cualquier nodo

### `OU_ADMIN`
- Administrador de una OU específica
- Tiene acceso a la OU asignada y **todos sus descendientes**
- Los permisos se heredan en cascada por la jerarquía

### `USER`
- Usuario normal
- Solo puede leer información (Permission.READ)

### `READONLY`
- Usuario de solo lectura
- Solo puede leer información

## Permisos

- `READ` - Leer información
- `CREATE` - Crear nuevos nodos
- `UPDATE` - Actualizar nodos existentes
- `DELETE` - Eliminar nodos
- `MANAGE` - Todos los permisos anteriores

## Configuración de Roles

Los roles se asignan a los usuarios mediante atributos en el nodo USER:

### Ejemplo 1: SUPER_ADMIN
```json
{
  "name": "admin.system",
  "type": "USER",
  "password": "secure_password",
  "attributes": {
    "email": "admin@company.com",
    "isSuperAdmin": true
  }
}
```

### Ejemplo 2: OU_ADMIN
```json
{
  "name": "admin.engineering",
  "type": "USER",
  "password": "secure_password",
  "attributes": {
    "email": "eng-admin@company.com",
    "isAdmin": true,
    "adminOf": 5  // ID de la OU Engineering
  }
}
```

### Ejemplo 3: Usuario Normal
```json
{
  "name": "juan.perez",
  "type": "USER", 
  "password": "secure_password",
  "attributes": {
    "email": "juan@company.com"
    // No tiene atributos especiales de rol
  }
}
```

## Uso en Controladores

### 1. Importar decorators y guards
```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { HierarchicalPermissionsGuard } from './auth/guards/hierarchical-permissions.guard';
import { RequirePermissions } from './auth/decorators/permissions.decorator';
import { Permission } from './auth/enums/role.enum';
```

### 2. Proteger endpoints con permisos

#### Endpoint de solo lectura
```typescript
@Get(':id')
@UseGuards(JwtAuthGuard, HierarchicalPermissionsGuard)
@RequirePermissions(Permission.READ)
async getNode(@Param('id') id: number) {
  return this.service.findOne(id);
}
```

#### Endpoint de creación (requiere permisos jerárquicos)
```typescript
@Post()
@UseGuards(JwtAuthGuard, HierarchicalPermissionsGuard)
@RequirePermissions(Permission.CREATE)
async createNode(@Body() dto: CreateNodeDto) {
  // El guard verificará que el usuario tiene permisos sobre el parentId
  return this.service.create(dto);
}
```

#### Endpoint de actualización
```typescript
@Put(':id')
@UseGuards(JwtAuthGuard, HierarchicalPermissionsGuard)
@RequirePermissions(Permission.UPDATE)
async updateNode(@Param('id') id: number, @Body() dto: UpdateNodeDto) {
  // El guard verificará que el usuario tiene permisos sobre este nodo
  return this.service.update(id, dto);
}
```

#### Endpoint de eliminación
```typescript
@Delete(':id')
@UseGuards(JwtAuthGuard, HierarchicalPermissionsGuard)
@RequirePermissions(Permission.DELETE)
async deleteNode(@Param('id') id: number) {
  return this.service.delete(id);
}
```

### 3. Acceder al usuario actual
```typescript
import { CurrentUser } from './auth/decorators/current-user.decorator';
import { DirectoryNode } from './directory/entities/directory-node.entity';

@Get('me')
@UseGuards(JwtAuthGuard)
async getCurrentUser(@CurrentUser() user: DirectoryNode) {
  return {
    id: user.id,
    username: user.name,
    email: user.attributes?.email,
  };
}
```

## Lógica de Validación Jerárquica

El `HierarchicalPermissionsGuard` valida permisos de la siguiente manera:

1. **SUPER_ADMIN**: ✅ Siempre permitido
2. **OU_ADMIN**: 
   - Extrae el `targetNodeId` de la request (params, body, query)
   - Obtiene el nodo admin usando `adminOfNodeId`
   - Verifica si `targetNode.mpath.startsWith(adminNode.mpath)`
   - Si es descendiente ✅ permitido, sino ❌ denegado
3. **USER/READONLY**: Solo operaciones de lectura

## Ejemplo de Jerarquía

```
Estructura:
com (ID: 1, mpath: "1.")
└── mycompany (ID: 2, mpath: "1.2.")
    ├── engineering (ID: 3, mpath: "1.2.3.")
    │   └── juan.perez (ID: 10, mpath: "1.2.3.10.")
    └── sales (ID: 4, mpath: "1.2.4.")
        └── ana.garcia (ID: 11, mpath: "1.2.4.11.")
```

**Escenario:**
- Usuario `admin.engineering` es OU_ADMIN de "engineering" (ID: 3)
- `adminOfNodeId = 3`
- `adminNode.mpath = "1.2.3."`

**Permisos:**
- ✅ Puede operar sobre "engineering" (ID: 3)
- ✅ Puede operar sobre "juan.perez" (ID: 10) - es descendiente
- ❌ NO puede operar sobre "sales" (ID: 4) - no es descendiente
- ❌ NO puede operar sobre "ana.garcia" (ID: 11) - no es descendiente

## Testing

### Crear usuarios de prueba
```bash
# SUPER_ADMIN
POST /directory
{
  "name": "superadmin",
  "type": "USER",
  "password": "admin123",
  "attributes": {
    "isSuperAdmin": true,
    "email": "superadmin@company.com"
  }
}

# OU_ADMIN de Engineering
POST /directory
{
  "name": "eng.admin",
  "type": "USER",
  "password": "engadmin123",
  "parentId": 3,  // ID de engineering OU
  "attributes": {
    "isAdmin": true,
    "adminOf": 3,
    "email": "eng-admin@company.com"
  }
}
```

### Probar permisos
```bash
# Login como OU_ADMIN
POST /auth/login
{
  "username": "eng.admin",
  "password": "engadmin123"
}

# Usar el token para crear un usuario en la OU administrada
POST /directory
Authorization: Bearer <token>
{
  "name": "new.engineer",
  "type": "USER",
  "parentId": 3,  // ✅ Permitido - es su OU
  "password": "pass123"
}

# Intentar crear en otra OU
POST /directory
Authorization: Bearer <token>
{
  "name": "new.sales",
  "type": "USER",
  "parentId": 4,  // ❌ Denegado - no es su OU
  "password": "pass123"
}
```

## Notas Importantes

1. **El mpath es crítico**: Sin el índice en mpath, las validaciones serían lentas
2. **Roles flexibles**: Los roles se determinan dinámicamente desde `attributes`
3. **Extensible**: Puedes agregar más roles modificando el enum `Role`
4. **Seguro por defecto**: Si no hay permisos explícitos, se deniega el acceso
5. **Compatible con JWT**: Los roles se incluyen en el token para evitar consultas extras

## Mejoras Futuras

- [ ] Cache de permisos para reducir consultas a BD
- [ ] Auditoría de accesos (logging de quién accedió a qué)
- [ ] Permisos más granulares por tipo de operación
- [ ] UI para gestión de roles y permisos
