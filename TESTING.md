# Testing del Módulo de Autenticación

## Prerequisitos

1. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   # Edita .env con tus configuraciones
   ```

2. **Levantar PostgreSQL (con Docker):**
   ```bash
   docker run --name directory-postgres \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=directory_db \
     -p 5432:5432 \
     -d postgres:16-alpine
   ```

3. **Instalar dependencias:**
   ```bash
   pnpm install
   ```

4. **Iniciar la aplicación:**
   ```bash
   pnpm run start:dev
   ```

## Tests Manuales con cURL

### 1. Crear un usuario de prueba

Primero necesitamos crear un nodo de tipo USER en el directorio:

```bash
curl -X POST http://localhost:3000/directory \
  -H "Content-Type: application/json" \
  -d '{
    "name": "juan.perez",
    "type": "USER",
    "attributes": {
      "email": "juan@example.com",
      "firstName": "Juan",
      "lastName": "Pérez"
    },
    "password": "Password123!"
  }'
```

### 2. Login (Obtener JWT)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "juan.perez",
    "password": "Password123!"
  }'
```

**Respuesta esperada:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Imp1YW4ucGVyZXoiLCJzdWIiOjEsInR5cGUiOiJVU0VSIiwiaWF0IjoxNjk4ODg4ODg4LCJleHAiOjE2OTg4OTI0ODh9.xxxxx"
}
```

### 3. Acceder a una ruta protegida

Guarda el token y úsalo en requests posteriores:

```bash
TOKEN="tu_token_aqui"

curl -X GET http://localhost:3000/directory \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Probar credenciales inválidas

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "juan.perez",
    "password": "WrongPassword"
  }'
```

**Respuesta esperada:**
```json
{
  "statusCode": 401,
  "message": "Credenciales inválidas"
}
```

## Tests con Postman/Insomnia

1. **Importar colección** (crear archivo `auth-tests.json`):

```json
{
  "name": "Directory Auth Tests",
  "requests": [
    {
      "name": "Login",
      "method": "POST",
      "url": "{{baseUrl}}/auth/login",
      "body": {
        "username": "juan.perez",
        "password": "Password123!"
      }
    },
    {
      "name": "Get Tree (Protected)",
      "method": "GET",
      "url": "{{baseUrl}}/directory",
      "headers": {
        "Authorization": "Bearer {{token}}"
      }
    }
  ],
  "variables": {
    "baseUrl": "http://localhost:3000"
  }
}
```

## Verificación en Base de Datos

Conectarse a PostgreSQL y verificar:

```sql
-- Ver usuarios creados
SELECT id, name, type, attributes, created_at 
FROM directory_node 
WHERE type = 'USER';

-- Verificar que el password esté hasheado
SELECT name, LEFT(password, 20) as hashed_password 
FROM directory_node 
WHERE type = 'USER';
```

El password debe verse como: `$2b$10$abcdefghijk...` (hash de bcrypt)

## Troubleshooting

### Error: "Cannot connect to database"
- Verifica que PostgreSQL esté corriendo: `docker ps`
- Verifica las credenciales en `.env`

### Error: "JWT secret key not configured"
- Asegúrate de tener `JWT_SECRET` en tu `.env`

### Error: "Credenciales inválidas" con password correcto
- Verifica que el usuario tenga el campo `password` poblado
- Revisa que el tipo sea `USER` (no `OU` o `DC`)
