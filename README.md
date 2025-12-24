# 📁 NestJS LDAP Directory Service

Sistema de directorio empresarial híbrido que combina la estructura jerárquica de LDAP con control de acceso basado en roles (RBAC) dinámico.

## 🎯 Características Principales

- **Jerarquía Organizacional:** Estructura tipo LDAP (DC → OU → GROUP → USER)
- **Materialized Path:** Búsquedas jerárquicas ultra-rápidas
- **RBAC Jerárquico:** Roles con validación por scope organizacional
- **Autenticación JWT:** Tokens seguros con información de roles
- **Swagger UI:** Documentación interactiva de API
- **TypeScript:** Type-safe en toda la aplicación

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 18+
- PostgreSQL 14+
- pnpm (recomendado) o npm

### Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd nestjs_ldap

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de BD

# Iniciar base de datos (Docker)
docker compose -f docker-compose.dev.yml up -d

# Ejecutar migraciones (opcional - synchronize: true en dev)
pnpm migration:run

# Iniciar aplicación
pnpm start:dev
```

La aplicación estará disponible en:
- **API:** http://localhost:3200
- **Swagger:** http://localhost:3200/docs

---

## 📖 Tutorial: Gestión de Usuarios y Permisos

### 1️⃣ Crear Estructura Organizacional

#### Paso 1: Crear Dominio Raíz (DC)

```bash
POST http://localhost:3200/directory
Content-Type: application/json

{
  "name": "com",
  "type": "DC",
  "attributes": {
    "description": "Root domain"
  }
}
```

**Respuesta:**
```json
{
  "id": 1,
  "name": "com",
  "type": "DC",
  "mpath": "1."
}
```

#### Paso 2: Crear Organización

```bash
POST http://localhost:3200/directory
Content-Type: application/json

{
  "name": "mycompany",
  "type": "OU",
  "parentId": 1,
  "attributes": {
    "fullName": "My Company Inc.",
    "location": "Argentina"
  }
}
```

**Respuesta:**
```json
{
  "id": 2,
  "name": "mycompany",
  "type": "OU",
  "mpath": "1.2.",
  "parent": { "id": 1 }
}
```

#### Paso 3: Crear Departamentos (OUs)

```bash
# Departamento de Ingeniería
POST http://localhost:3200/directory
Content-Type: application/json

{
  "name": "engineering",
  "type": "OU",
  "parentId": 2,
  "attributes": {
    "fullName": "Engineering Department",
    "manager": "tech-lead@company.com"
  }
}

# Departamento de Ventas
POST http://localhost:3200/directory
Content-Type: application/json

{
  "name": "sales",
  "type": "OU",
  "parentId": 2,
  "attributes": {
    "fullName": "Sales Department",
    "manager": "sales-director@company.com"
  }
}
```

---

### 2️⃣ Gestión de Usuarios

#### Crear Super Administrador

```bash
POST http://localhost:3200/directory
Content-Type: application/json

{
  "name": "superadmin",
  "type": "USER",
  "password": "SuperSecure123!",
  "parentId": 2,
  "attributes": {
    "email": "admin@company.com",
    "firstName": "Admin",
    "lastName": "System",
    "isSuperAdmin": true
  }
}
```

**Roles disponibles en `attributes`:**
- `isSuperAdmin: true` → SUPER_ADMIN (acceso total)
- `isAdmin: true, adminOf: "ID"` → OU_ADMIN (admin de una OU)
- Sin atributos especiales → USER (lectura básica)

#### Crear Administrador de Departamento (OU_ADMIN)

```bash
POST http://localhost:3200/directory
Content-Type: application/json

{
  "name": "eng.admin",
  "type": "USER",
  "password": "EngAdmin123!",
  "parentId": 3,
  "attributes": {
    "email": "eng.admin@company.com",
    "firstName": "Engineering",
    "lastName": "Admin",
    "isAdmin": true,
    "adminOf": "3",
    "department": "Engineering"
  }
}
```

**¿Qué puede hacer un OU_ADMIN?**
- ✅ Crear/editar/eliminar usuarios EN su departamento
- ✅ Ver toda la información de su departamento
- ❌ NO puede acceder a otros departamentos
- ❌ NO puede editar nodos superiores

#### Crear Usuarios Normales

```bash
# Usuario en Engineering
POST http://localhost:3200/directory
Content-Type: application/json

{
  "name": "juan.perez",
  "type": "USER",
  "password": "UserPass123!",
  "parentId": 3,
  "attributes": {
    "email": "juan.perez@company.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "position": "Backend Developer",
    "phone": "+54 11 1234-5678"
  }
}

# Usuario en Sales
POST http://localhost:3200/directory
Content-Type: application/json

{
  "name": "ana.garcia",
  "type": "USER",
  "password": "UserPass123!",
  "parentId": 4,
  "attributes": {
    "email": "ana.garcia@company.com",
    "firstName": "Ana",
    "lastName": "García",
    "position": "Sales Representative"
  }
}
```

---

### 3️⃣ Autenticación

#### Login

```bash
POST http://localhost:3200/auth/login
Content-Type: application/json

{
  "username": "superadmin",
  "password": "SuperSecure123!"
}
```

**Respuesta:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 5,
    "username": "superadmin",
    "type": "USER",
    "role": "SUPER_ADMIN"
  }
}
```

**Uso del Token:**
```bash
# Guardar el token
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Usar en requests
GET http://localhost:3200/directory/tree
Authorization: Bearer {TOKEN}
```

---

### 4️⃣ Operaciones con Permisos

#### Escenario 1: SUPER_ADMIN - Acceso Total

```bash
# Login como SUPER_ADMIN
POST http://localhost:3200/auth/login
{
  "username": "superadmin",
  "password": "SuperSecure123!"
}

# Puede acceder a CUALQUIER departamento
GET http://localhost:3200/directory/scope/4
Authorization: Bearer {TOKEN}
# ✅ Permitido - Puede ver Sales

# Puede crear usuarios EN CUALQUIER LUGAR
POST http://localhost:3200/directory
Authorization: Bearer {TOKEN}
{
  "name": "new.user",
  "type": "USER",
  "parentId": 4,
  "password": "pass123"
}
# ✅ Permitido
```

#### Escenario 2: OU_ADMIN - Limitado por Jerarquía

```bash
# Login como OU_ADMIN de Engineering
POST http://localhost:3200/auth/login
{
  "username": "eng.admin",
  "password": "EngAdmin123!"
}

# Puede acceder a SU departamento
GET http://localhost:3200/directory/scope/3
Authorization: Bearer {TOKEN}
# ✅ Permitido - Engineering es su scope

# Puede crear usuarios EN SU DEPARTAMENTO
POST http://localhost:3200/directory
Authorization: Bearer {TOKEN}
{
  "name": "new.developer",
  "type": "USER",
  "parentId": 3,
  "password": "pass123",
  "attributes": {
    "email": "new.dev@company.com"
  }
}
# ✅ Permitido

# NO puede acceder a otro departamento
GET http://localhost:3200/directory/scope/4
Authorization: Bearer {TOKEN}
# ❌ 403 Forbidden - Sales está fuera de su scope

# NO puede crear usuarios en otro departamento
POST http://localhost:3200/directory
Authorization: Bearer {TOKEN}
{
  "name": "new.sales",
  "parentId": 4,
  "password": "pass123"
}
# ❌ 403 Forbidden
```

#### Escenario 3: USER - Solo Lectura

```bash
# Login como usuario normal
POST http://localhost:3200/auth/login
{
  "username": "juan.perez",
  "password": "UserPass123!"
}

# Puede leer el árbol
GET http://localhost:3200/directory/tree
Authorization: Bearer {TOKEN}
# ✅ Permitido

# NO puede crear nodos
POST http://localhost:3200/directory
Authorization: Bearer {TOKEN}
{
  "name": "unauthorized",
  "type": "OU",
  "parentId": 3
}
# ❌ 403 Forbidden
```

---

### 5️⃣ Búsquedas Avanzadas

#### Búsqueda en Sub-árbol (Scoped)

```bash
# Buscar usuarios en Engineering y todos los sub-departamentos
GET http://localhost:3200/directory/scope/3?q=dev
Authorization: Bearer {TOKEN}
```

**Uso:** Buscar dentro de un departamento específico y todos sus descendientes.

#### Búsqueda Plana (Global)

```bash
# Buscar en TODO el directorio
GET http://localhost:3200/directory/search/flat?q=garcia
Authorization: Bearer {TOKEN}
```

**Uso:** Buscar ignorando la jerarquía.

#### Obtener Ancestros (Breadcrumbs)

```bash
# Obtener la ruta completa de un usuario
GET http://localhost:3200/directory/7/ancestors
Authorization: Bearer {TOKEN}
```

**Respuesta:**
```json
[
  { "id": 1, "name": "com", "type": "DC" },
  { "id": 2, "name": "mycompany", "type": "OU" },
  { "id": 3, "name": "engineering", "type": "OU" }
]
```

**Uso:** Mostrar "migas de pan" en la UI.

---

### 6️⃣ Operaciones Avanzadas

#### Mover Usuarios/Departamentos

```bash
POST http://localhost:3200/directory/move
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "nodeId": 7,
  "newParentId": 4
}
```

**Validaciones automáticas:**
- ✅ TypeORM actualiza `mpath` automáticamente
- ✅ Todos los descendientes se actualizan en cascada
- ❌ Un OU_ADMIN solo puede mover dentro de su scope

#### Ver Árbol Completo

```bash
GET http://localhost:3200/directory/tree
Authorization: Bearer {TOKEN}
```

**Respuesta:** Estructura completa con relaciones parent/children.

---

## 🔐 Gestión de Permisos

### Matriz de Permisos

| Rol | Lectura | Crear | Editar | Eliminar | Scope |
|-----|---------|-------|--------|----------|-------|
| **SUPER_ADMIN** | ✅ Todo | ✅ Todo | ✅ Todo | ✅ Todo | 🌍 Global |
| **OU_ADMIN** | ✅ Su OU | ✅ Su OU | ✅ Su OU | ✅ Su OU | 🏢 Su departamento + descendientes |
| **USER** | ✅ Público | ❌ | ❌ | ❌ | 👁️ Solo lectura |
| **READONLY** | ✅ Público | ❌ | ❌ | ❌ | 👁️ Solo lectura |

### Cómo Asignar Roles

Los roles se asignan mediante el campo `attributes` al crear el usuario:

```json
{
  "attributes": {
    // SUPER_ADMIN
    "isSuperAdmin": true,
    
    // OU_ADMIN
    "isAdmin": true,
    "adminOf": "3",
    
    // USER (por defecto, sin atributos especiales)
  }
}
```

### Cambiar Rol de un Usuario

**Opción 1: Actualizar attributes (Recomendado)**
```bash
# Implementar endpoint PATCH /directory/:id
# Actualizar solo el campo attributes
```

**Opción 2: Recrear usuario**
```bash
# Eliminar usuario existente
# Crear nuevo con los attributes correctos
```

---

## 📊 Estructura de Ejemplo Completa

```
com (DC)
└── mycompany (OU)
    ├── engineering (OU)
    │   ├── eng.admin (USER - OU_ADMIN de engineering)
    │   ├── backend (OU)
    │   │   ├── juan.perez (USER)
    │   │   └── maria.lopez (USER)
    │   └── frontend (OU)
    │       └── carlos.ruiz (USER)
    ├── sales (OU)
    │   ├── sales.admin (USER - OU_ADMIN de sales)
    │   └── ana.garcia (USER)
    └── superadmin (USER - SUPER_ADMIN)
```

**Permisos en esta estructura:**
- `superadmin`: Acceso total a todo
- `eng.admin`: Acceso a engineering + backend + frontend
- `sales.admin`: Acceso solo a sales
- `juan.perez`: Solo lectura

---

## 🧪 Testing con archivo .http

El proyecto incluye `src/apis.http` para testing manual:

```http
### 1. Crear usuario
POST {{API_URL}}/directory
Content-Type: application/json

{
  "name": "test.user",
  "type": "USER",
  "password": "test123"
}

### 2. Login
POST {{API_URL}}/auth/login
Content-Type: application/json

{
  "username": "test.user",
  "password": "test123"
}

### 3. Usar token
GET {{API_URL}}/directory/tree
Authorization: Bearer {{USER_SESSION_JWT_TOKEN}}
```

**Variables de entorno** (`.env`):
```
API_URL=http://localhost:3200
USER_SESSION_JWT_TOKEN=<tu-token-aqui>
```

---

## 🛠️ Scripts Útiles

```bash
# Desarrollo
pnpm start:dev          # Modo desarrollo con hot-reload
pnpm build              # Compilar para producción
pnpm start:prod         # Ejecutar en producción

# Tests
pnpm test               # Tests unitarios
pnpm test:e2e           # Tests end-to-end
pnpm test:cov           # Cobertura de tests

# Base de datos
pnpm migration:generate src/migrations/MiMigración    # Generar migración
pnpm migration:run      # Ejecutar migraciones
pnpm migration:revert   # Revertir última migración

# Linting
pnpm lint               # Verificar código
pnpm format             # Formatear código
```

---

## 📚 Documentación Adicional

- **Swagger UI:** http://localhost:3200/docs
- **RBAC Detallado:** `src/auth/RBAC.md`
- **Migraciones:** `src/migrations/README.md`
- **Autenticación:** `AUTH_TASKS.md`
- **Reporte Completo:** `REPORT.md`

---

## 🚨 Troubleshooting

### Error: "Usuario no tiene permisos"

**Causa:** El usuario no tiene el rol adecuado o está intentando acceder fuera de su scope.

**Solución:**
1. Verificar rol del usuario en `attributes`
2. Si es OU_ADMIN, verificar que `adminOf` apunte al ID correcto
3. Confirmar que el nodo objetivo esté dentro de su jerarquía

### Error: "Ya existe un nodo con ese nombre"

**Causa:** Validación de unicidad entre hermanos.

**Solución:**
- Usar un nombre diferente
- O mover el nodo a otro padre

### Error: "Un nodo USER no puede tener hijos"

**Causa:** Intentando crear un nodo con parentId de tipo USER.

**Solución:**
- Cambiar el parentId a un nodo de tipo OU o GROUP

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│          Swagger UI / REST API          │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          NestJS Controllers             │
│    (JWT Guard + Hierarchical Guard)     │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│           Services Layer                │
│  (Lógica de negocio + Validaciones)     │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│     TypeORM TreeRepository               │
│    (Materialized Path Strategy)          │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          PostgreSQL Database            │
│  (Tabla directory_node con índice mpath)│
└─────────────────────────────────────────┘
```

---

## 📄 Licencia

MIT

---

## 👥 Contribuir

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

---

## 📞 Soporte

Para reportar bugs o solicitar features, abrir un issue en GitHub.

**Desarrollado con ❤️ usando NestJS + TypeORM + PostgreSQL**