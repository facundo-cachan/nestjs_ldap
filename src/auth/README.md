# Módulo de Autenticación

Este módulo implementa autenticación JWT usando Passport para el sistema de directorio.

## Componentes

### 1. AuthService
Servicio principal que maneja la lógica de autenticación:
- `validateUser(username, password)`: Valida credenciales de usuario
- `login(user)`: Genera token JWT tras login exitoso

### 2. Strategies

#### LocalStrategy
- Valida username/password durante el login
- Se activa automáticamente con `@UseGuards(LocalAuthGuard)`
- Lanza `UnauthorizedException` si las credenciales son inválidas

#### JwtStrategy
- Valida tokens JWT en rutas protegidas
- Extrae el token del header `Authorization: Bearer <token>`
- Se activa con `@UseGuards(JwtAuthGuard)`

### 3. Guards

#### LocalAuthGuard
Protege el endpoint de login, invocando LocalStrategy para validar credenciales.

#### JwtAuthGuard
Protege rutas que requieren autenticación JWT.

## Uso

### 1. Login
```bash
POST /auth/login
Content-Type: application/json

{
  "username": "juan.perez",
  "password": "mi_password"
}
```

**Respuesta exitosa:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Proteger una ruta

```typescript
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Controller('protected')
export class ProtectedController {
  
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    // req.user contiene: { userId, username, type }
    return req.user;
  }
}
```

### 3. Hacer una request autenticada

```bash
GET /protected/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Variables de Entorno

Asegúrate de configurar en tu `.env`:

```bash
JWT_SECRET=tu_secreto_muy_seguro_aqui
```

## Seguridad

- Las contraseñas se hashean automáticamente con bcrypt en la entidad `DirectoryNode`
- El campo `password` tiene `select: false` para no exponerlo en queries normales
- Los tokens JWT expiran en 1 hora (configurable en `auth.module.ts`)

## Próximos pasos

- [ ] Implementar refresh tokens
- [ ] Agregar rate limiting al endpoint de login
- [ ] Implementar sistema RBAC jerárquico basado en materialized path
