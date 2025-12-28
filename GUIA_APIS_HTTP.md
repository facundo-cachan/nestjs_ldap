# 📖 Guía de Uso: apis.http

## 🎯 Objetivo

Este archivo contiene **todos los casos de uso** del sistema híbrido LDAP + RBAC, organizados por fases y validados con tests E2E.

---

## 🚀 Cómo Usar

### 1. **Instalar Extensión REST Client** (VS Code)

```
Nombre: REST Client
ID: humao.rest-client
```

### 2. **Iniciar el Servidor**

```bash
npm run start:dev
```

El servidor debe estar corriendo en `http://localhost:3000`

### 3. **Ejecutar Requests**

1. Abre `src/apis.http` en VS Code
2. Verás un botón "Send Request" sobre cada request
3. Click en "Send Request" para ejecutar
4. Los resultados aparecen en un panel lateral

---

## 📋 Flujo Recomendado

### Paso 1: Setup Inicial (SETUP 1-7)

Ejecuta los requests de SETUP en orden para crear la estructura:

1. ✅ SETUP 1: Root OU (company)
2. ✅ SETUP 2: Sales OU
3. ✅ SETUP 3: Marketing OU
4. ✅ SETUP 4: SUPER_ADMIN user
5. ✅ SETUP 5: Sales Admin (OU_ADMIN)
6. ✅ SETUP 6: Sales User
7. ✅ SETUP 7: Marketing User

### Paso 2: Autenticación (AUTH 1-3)

Ejecuta los logins y **copia los tokens**:

1. ✅ AUTH 1: Login SUPER_ADMIN
   - Copia el `access_token` de la respuesta
   - Pégalo en la variable `@superAdminToken` (línea 9)

2. ✅ AUTH 2: Login OU_ADMIN
   - Copia el `access_token`
   - Pégalo en `@ouAdminToken` (línea 10)

3. ✅ AUTH 3: Login USER
   - Copia el `access_token`
   - Pégalo en `@userToken` (línea 11)

### Paso 3: Probar Casos de Uso

Ahora puedes ejecutar cualquier request de las fases:

- **Fase 2:** RBAC Estándar (7 tests)
- **Fase 3:** Test Matrix (6 tests)
- **Fase 4:** Anti-Escalation (6 tests)
- **Fase 5:** Audit Trail (3 tests)

---

## 🎨 Estructura del Archivo

```
apis.http
├── 🏗️ SETUP INICIAL (7 requests)
│   └── Crear estructura de OUs y usuarios
│
├── 🔑 AUTENTICACIÓN (3 requests)
│   └── Obtener tokens JWT
│
├── ✅ FASE 2: RBAC ESTÁNDAR (7 requests)
│   ├── Public vs Private
│   └── Role Mismatch
│
├── ✅ FASE 3: TEST MATRIX (6 requests)
│   └── Hierarchical Access Control
│
├── ✅ FASE 4: ANTI-ESCALATION (6 requests)
│   ├── Auto-Promoción
│   ├── Creación Fantasma
│   └── Role Granting
│
├── ✅ FASE 5: AUDIT TRAIL (3 requests)
│   └── Logging de operaciones
│
├── 🔍 BÚSQUEDAS AVANZADAS (6 requests)
│   ├── Scoped Search
│   ├── Flat Search
│   ├── Ancestors
│   └── Tree
│
├── 🔄 OPERACIONES AVANZADAS (3 requests)
│   ├── Move nodes
│   └── Create sub-departments
│
├── ❌ VALIDACIONES (3 requests)
│   └── Casos que deben fallar
│
└── 🏥 HEALTH & MONITORING (3 requests)
    └── Health checks y Swagger
```

---

## 🔑 Variables de Entorno

El archivo usa estas variables:

```http
@host = http://localhost:3000
@superAdminToken = <PEGAR_AQUÍ_EL_TOKEN>
@ouAdminToken = <PEGAR_AQUÍ_EL_TOKEN>
@userToken = <PEGAR_AQUÍ_EL_TOKEN>
```

**Importante:** Debes actualizar los tokens después de cada login.

---

## 📊 Casos de Uso por Rol

### 🔴 SUPER_ADMIN

```http
# Puede hacer TODO sin restricciones
GET {{host}}/directory/7
Authorization: Bearer {{superAdminToken}}
```

**Permisos:**
- ✅ Acceso a CUALQUIER nodo
- ✅ Crear en CUALQUIER lugar
- ✅ Mover CUALQUIER nodo
- ✅ Otorgar CUALQUIER rol

### 🟡 OU_ADMIN (Sales)

```http
# Solo puede acceder dentro de su scope (Sales)
GET {{host}}/directory/6
Authorization: Bearer {{ouAdminToken}}
```

**Permisos:**
- ✅ Acceso a nodos en Sales (mpath: "1.2.*")
- ✅ Crear usuarios en Sales
- ✅ Mover nodos dentro de Sales
- ❌ NO puede acceder a Marketing
- ❌ NO puede acceder a ancestros (company)
- ❌ NO puede otorgar SUPER_ADMIN

### 🟢 USER

```http
# Solo lectura
GET {{host}}/directory/tree
Authorization: Bearer {{userToken}}
```

**Permisos:**
- ✅ Leer árbol completo
- ✅ Buscar en directorio
- ❌ NO puede crear
- ❌ NO puede mover
- ❌ NO puede eliminar

---

## ✅ Validación de Resultados

### Respuestas Esperadas

#### ✅ Éxito (200/201)
```json
{
  "id": 6,
  "name": "sales.user",
  "type": "USER",
  "mpath": "1.2.6.",
  ...
}
```

#### ❌ No Autorizado (401)
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### ❌ Prohibido (403)
```json
{
  "statusCode": 403,
  "message": "Acceso Denegado: Este recurso está fuera de tu Unidad Organizativa"
}
```

#### ❌ No Encontrado (404)
```json
{
  "statusCode": 404,
  "message": "Nodo objetivo no encontrado"
}
```

---

## 🧪 Tests Automatizados

Para ejecutar los tests E2E completos:

```bash
npm run test:e2e -- auth-tasks-validation.e2e-spec.ts
```

**Resultado esperado:**
```
Tests:       22 passed, 22 total
```

---

## 🔍 Debugging

### Ver el mpath de un nodo

```http
GET {{host}}/directory/6
Authorization: Bearer {{superAdminToken}}
```

Respuesta:
```json
{
  "id": 6,
  "name": "sales.user",
  "mpath": "1.2.6.",  // ← Aquí está el mpath
  ...
}
```

### Ver el árbol completo

```http
GET {{host}}/directory/tree
Authorization: Bearer {{superAdminToken}}
```

### Ver ancestros (breadcrumbs)

```http
GET {{host}}/directory/6/ancestors
Authorization: Bearer {{superAdminToken}}
```

---

## 📝 Notas Importantes

### 1. **Tokens JWT**
- Expiran en **1 hora** en producción
- Expiran en **24 horas** en tests (NODE_ENV=test)
- Contienen: `id`, `role`, `roles`, `mpath`, `adminOfNodeId`

### 2. **Materialized Path (mpath)**
- Formato: `"1.2.3."` (cada número es un ID de nodo)
- Se genera automáticamente por TypeORM
- Permite validación jerárquica en O(1)

### 3. **Orden de Ejecución**
1. Primero ejecuta SETUP (crear estructura)
2. Luego AUTH (obtener tokens)
3. Finalmente prueba los casos de uso

### 4. **Limpiar Base de Datos**
Si necesitas empezar de cero:

```bash
npm run migration:revert
npm run migration:run
```

---

## 🎯 Casos de Uso Comunes

### Crear un nuevo usuario en Sales

```http
POST {{host}}/directory
Authorization: Bearer {{ouAdminToken}}
Content-Type: application/json

{
  "name": "new.sales.user",
  "type": "USER",
  "parentId": 2,  // Sales OU
  "password": "password123",
  "attributes": {
    "email": "new.sales@company.com"
  }
}
```

### Buscar usuarios en Sales

```http
GET {{host}}/directory/scope/2?q=user
Authorization: Bearer {{ouAdminToken}}
```

### Mover usuario entre departamentos

```http
POST {{host}}/directory/move
Authorization: Bearer {{superAdminToken}}
Content-Type: application/json

{
  "nodeId": 6,
  "newParentId": 3
}
```

---

## 🚨 Errores Comunes

### Error: "User mpath not found in token"
**Solución:** El token es antiguo. Haz login nuevamente.

### Error: "Acceso Denegado: fuera de tu Unidad Organizativa"
**Solución:** Estás intentando acceder a un nodo fuera de tu scope. Usa SUPER_ADMIN o accede a nodos dentro de tu OU.

### Error: "Forbidden"
**Solución:** Tu rol no tiene permisos para esta operación. Verifica que estés usando el token correcto.

### Error: "Unauthorized"
**Solución:** No estás enviando el token o el token expiró. Verifica la cabecera `Authorization: Bearer {{token}}`.

---

## 📚 Recursos Adicionales

- 📄 **Reporte Completo:** `TODAS_LAS_FASES_COMPLETADAS.md`
- 📄 **Tasks:** `AUTH_TASKS.md`
- 🧪 **Tests E2E:** `test/auth-tasks-validation.e2e-spec.ts`
- 📖 **README:** `README.md`

---

## ✅ Checklist de Validación

Usa esta checklist para verificar que todo funciona:

- [ ] SETUP: Crear estructura completa (7 requests)
- [ ] AUTH: Obtener 3 tokens (SUPER_ADMIN, OU_ADMIN, USER)
- [ ] FASE 2: Validar RBAC (7 requests)
  - [ ] 4 requests sin token → 401
  - [ ] 3 requests USER sin permisos → 403
- [ ] FASE 3: Validar Hierarchy (6 requests)
  - [ ] SUPER_ADMIN accede a todo ✅
  - [ ] OU_ADMIN limitado a su scope ✅
  - [ ] USER solo lectura ✅
- [ ] FASE 4: Validar Anti-Escalation (6 requests)
  - [ ] OU_ADMIN no puede escalar ✅
  - [ ] OU_ADMIN no puede crear fuera ✅
- [ ] FASE 5: Validar Audit (3 requests)
  - [ ] Operaciones se ejecutan correctamente ✅

---

**🎉 ¡Listo! Ahora puedes probar todos los casos de uso del sistema.**
