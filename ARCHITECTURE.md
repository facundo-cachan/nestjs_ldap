# Arquitectura del Módulo de Autenticación

## Estructura del Módulo

```
src/auth/
├── auth.controller.ts      # Controlador con endpoint POST /auth/login
├── auth.service.ts          # Lógica de validación y generación de JWT
├── auth.module.ts           # Módulo principal que conecta todo
├── dto/
│   └── login.dto.ts         # DTO para validar request de login
├── guards/
│   ├── local-auth.guard.ts  # Guard para login (username/password)
│   └── jwt-auth.guard.ts    # Guard para rutas protegidas (JWT)
├── strategies/
│   ├── local.strategy.ts    # Estrategia Passport para username/password
│   └── jwt.strategy.ts      # Estrategia Passport para JWT
└── README.md                # Documentación del módulo
```

## Flujo de Autenticación

### 1. Login Flow

```
Cliente                    Controller              Guard                Strategy              Service
  |                           |                      |                      |                      |
  |  POST /auth/login         |                      |                      |                      |
  |-------------------------->|                      |                      |                      |
  |  { username, password }   |                      |                      |                      |
  |                           |                      |                      |                      |
  |                           | @UseGuards(Local)    |                      |                      |
  |                           |--------------------> |                      |                      |
  |                           |                      |                      |                      |
  |                           |                      | validate()           |                      |
  |                           |                      |--------------------> |                      |
  |                           |                      |                      |                      |
  |                           |                      |                      | validateUser()       |
  |                           |                      |                      |--------------------> |
  |                           |                      |                      |                      |
  |                           |                      |                      |  1. findUserByName   |
  |                           |                      |                      |  2. bcrypt.compare() |
  |                           |                      |                      |                      |
  |                           |                      |                      | <--------------------| 
  |                           |                      |                      | user (sin password)  |
  |                           |                      |                      |                      |
  |                           |                      | <--------------------| 
  |                           |                      | user                 |
  |                           |                      |                      |                      |
  |                           | <--------------------| 
  |                           | req.user = user      |
  |                           |                      |                      |                      |
  |                           | login(req.user)      |                      |                      |
  |                           |----------------------------------------------------> |
  |                           |                      |                      |                      |
  |                           |                      |                      |  jwtService.sign()   |
  |                           |                      |                      |                      |
  |                           | <----------------------------------------------------| 
  | <-------------------------|                      |                      |                      |
  | { access_token: "..." }   |                      |                      |                      |
```

### 2. Protected Route Flow

```
Cliente                    Controller              Guard                Strategy
  |                           |                      |                      |
  |  GET /protected/resource  |                      |                      |
  |  Authorization: Bearer .. |                      |                      |
  |-------------------------->|                      |                      |
  |                           |                      |                      |
  |                           | @UseGuards(JWT)      |                      |
  |                           |--------------------> |                      |
  |                           |                      |                      |
  |                           |                      | validate(payload)    |
  |                           |                      |--------------------> |
  |                           |                      |                      |
  |                           |                      |                      | 1. Extract token
  |                           |                      |                      | 2. Verify signature
  |                           |                      |                      | 3. Decode payload
  |                           |                      |                      |
  |                           |                      | <--------------------| 
  |                           |                      | { userId, username } |
  |                           |                      |                      |
  |                           | <--------------------| 
  |                           | req.user = user      |
  |                           |                      |
  | <-------------------------|
  | Resource data             |
```

## Componentes Clave

### AuthService
- **validateUser()**: Busca el usuario en la BD y compara el password hasheado
- **login()**: Genera el JWT con el payload: `{ username, sub: userId, type }`

### LocalStrategy (Passport)
- Activa automáticamente cuando se usa `@UseGuards(LocalAuthGuard)`
- Extrae `username` y `password` del body
- Llama a `authService.validateUser()`
- Si es válido, adjunta `user` a `req.user`
- Si falla, lanza `UnauthorizedException`

### JwtStrategy (Passport)
- Activa automáticamente cuando se usa `@UseGuards(JwtAuthGuard)`
- Extrae el token del header `Authorization: Bearer <token>`
- Verifica firma y expiración
- Decodifica el payload y lo adjunta a `req.user`

### Guards
- **LocalAuthGuard**: Wrapper de `AuthGuard('local')` de Passport
- **JwtAuthGuard**: Wrapper de `AuthGuard('jwt')` de Passport

## Seguridad Implementada

1. **Password Hashing**: 
   - Bcrypt con salt automático en la entidad `DirectoryNode`
   - Hook `@BeforeInsert()` y `@BeforeUpdate()` para hashear antes de guardar

2. **Password Exclusion**:
   - Campo `password` con `select: false` en la entidad
   - Solo se incluye explícitamente con `addSelect('node.password')`

3. **JWT Expiration**:
   - Tokens expiran en 1 hora (configurable)
   - Secret key desde variable de entorno

4. **Input Validation**:
   - DTOs con class-validator para requests
   - Validación automática con NestJS ValidationPipe

## Variables de Entorno

```bash
JWT_SECRET=your_super_secret_key_here
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=directory_db
```

## Dependencias

```json
{
  "dependencies": {
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/passport": "^11.0.5",
    "bcrypt": "^6.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^6.0.0",
    "@types/passport-jwt": "^4.0.1",
    "@types/passport-local": "^1.0.38"
  }
}
```

## Próximos Pasos (RBAC Jerárquico)

Para implementar el sistema de permisos en cascada basado en `mpath`:

1. **Crear entidad de Roles/Permisos**
2. **Guardar en attributes**: `{ role: 'admin', scope: nodeId }`
3. **Custom Decorator**: `@RequirePermission('read', 'subtree')`
4. **Permission Guard**: 
   - Extrae el usuario de `req.user`
   - Lee su `scope` (ID del nodo donde tiene permisos)
   - Obtiene el `mpath` de ese nodo
   - Valida que el recurso solicitado esté bajo ese path: `resource.mpath LIKE userScope.mpath || '%'`

Ejemplo:
```typescript
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('write')
@Post('directory/:id/move')
moveNode(@Param('id') id: number, @Body() dto: MoveNodeDto) {
  // Solo accesible si el usuario tiene permisos en el subtree del nodo
}
```
