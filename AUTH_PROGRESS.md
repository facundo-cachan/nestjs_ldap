# Progreso de Implementación AUTH_TASKS

**Fecha:** 2025-12-27
**Estado:** En Progreso

## ✅ Completado

### 🟢 Fase 1: Verificación de Arquitectura de Datos

#### ✅ Validar Entidad Híbrida
- **DirectoryNode Entity** actualizada con:
  - ✅ Columna `mpath` (Materialized Path) via `@Tree("materialized-path")`
  - ✅ Columna `roles` (Array de roles) tipo `simple-array`
  - ✅ Columna `adminOfNodeId` para OU_ADMIN
  
**Archivo:** `src/directory/entities/directory-node.entity.ts`

```typescript
@Column({
  type: 'simple-array',
  nullable: true,
  default: null,
})
roles?: Role[];

@Column({ nullable: true })
adminOfNodeId?: number;
```

#### ✅ Validar Payload del JWT
- **JwtPayload Interface** actualizada con:
  - ✅ `roles`: Array de roles para check RBAC rápido
  - ✅ `mpath`: Materialized Path para check de jerarquía rápido
  - ✅ `role`: Rol principal del usuario
  - ✅ `adminOfNodeId`: ID del nodo administrado

**Archivo:** `src/auth/interfaces/jwt-payload.interface.ts`

```typescript
export interface JwtPayload {
  sub: string;
  id: number;
  role?: Role;
  roles?: Role[];
  adminOfNodeId?: number;
  mpath?: string; // CRÍTICO para scope checking
  iat?: number;
  exp?: number;
}
```

#### ✅ AuthService Actualizado
- **login()** method ahora:
  - Obtiene el `mpath` del usuario desde la BD
  - Incluye `mpath` y `roles` en el JWT payload
  - Usa roles de la BD en lugar de solo attributes

**Archivo:** `src/auth/auth.service.ts`

---

### 🟠 Fase 2: Verificación de RBAC Estándar

#### ✅ Endpoint Protection
- **Creado decorador `@Roles()`**
  - Archivo: `src/auth/decorators/roles.decorator.ts`
  - Permite especificar roles requeridos por endpoint

- **Creado `RolesGuard`**
  - Archivo: `src/auth/guards/roles.guard.ts`
  - Valida que el usuario tenga los roles necesarios
  - SUPER_ADMIN tiene acceso total

- **Aplicado a endpoints críticos:**
  - ✅ `POST /directory` - `@Roles(Role.OU_ADMIN, Role.SUPER_ADMIN)`
  - ✅ `POST /directory/move` - `@Roles(Role.OU_ADMIN, Role.SUPER_ADMIN)`
  - ✅ `DELETE /directory/:id` - `@Roles(Role.OU_ADMIN, Role.SUPER_ADMIN)`

**Archivo:** `src/directory/directory.controller.ts`

---

### 🔴 Fase 3: Verificación de Lógica Híbrida

#### ✅ Implementación del Guard
- **HierarchyGuard (Scope Guard)** implementado
  - Archivo: `src/auth/guards/hierarchy.guard.ts`
  - ✅ Se ejecuta después del JwtAuthGuard
  - ✅ Compara `mpath` del solicitante vs objetivo
  - ✅ Lógica: `Target.mpath.startsWith(Requester.mpath)`
  - ✅ **OPTIMIZACIÓN:** Usa `mpath` del JWT en lugar de consultar BD

**Casos manejados:**
1. **Modificación de nodo existente** (`/:id`)
   - Valida que el nodo objetivo esté dentro del scope del usuario
   - Permite self-edit
   
2. **Creación de nodo nuevo** (`POST` con `parentId`)
   - Valida que el parent esté dentro del scope del usuario
   
3. **Búsqueda en scope** (`/scope/:rootId`)
   - Valida que el root esté dentro del scope del usuario

**Validaciones de seguridad:**
- ✅ Bloquea edición de ancestros (nodos padre)
- ✅ Bloquea acceso a nodos fuera del scope
- ✅ SUPER_ADMIN bypass (acceso total)

#### ✅ Aplicación de Guards
- **DirectoryController** configurado con guards en orden correcto:
  ```typescript
  @UseGuards(JwtAuthGuard, RolesGuard, HierarchyGuard)
  ```
  
**Orden crítico:**
1. `JwtAuthGuard` - Valida token y extrae usuario
2. `RolesGuard` - Valida roles (QUÉ puede hacer)
3. `HierarchyGuard` - Valida scope (DÓNDE puede hacerlo)

---

## ⏳ Pendiente

### 🟢 Fase 1: Verificación de Arquitectura de Datos

#### ⏳ Validar Integridad del Path
- [ ] Crear script de prueba para mover nodo padre
- [ ] Verificar actualización en cascada de `mpath` de descendientes
- **Nota:** TypeORM maneja esto automáticamente con Materialized Path, pero debe ser testeado

---

### 🟠 Fase 2: Verificación de RBAC Estándar

#### ⏳ Tests de Autenticación
- [ ] **Public vs Private:** Test de acceso sin token (esperar 401)
- [ ] **Role Mismatch:** Test con rol insuficiente (esperar 403)

**Recomendación:** Crear tests E2E para estos casos

---

### 🔴 Fase 3: Verificación de Lógica Híbrida

#### ⏳ Casos de Prueba (Test Matrix)
Todos los casos de la tabla deben ser testeados:

| Test Case | Estado |
|-----------|--------|
| Admin Global → User Marketing (PERMITIDO) | ⏳ Pendiente |
| Gerente Ventas → User Ventas (PERMITIDO) | ⏳ Pendiente |
| Gerente Ventas → User IT (DENEGADO) | ⏳ Pendiente |
| Gerente Ventas → User Root (DENEGADO) | ⏳ Pendiente |
| Usuario Ventas → User Ventas 2 Read (PERMITIDO) | ⏳ Pendiente |
| Usuario Ventas → User Ventas 2 Delete (DENEGADO) | ⏳ Pendiente |

**Recomendación:** Convertir estos en tests E2E automatizados

---

### 🔵 Fase 4: Verificación de Seguridad Anti-Escalamiento

#### ⏳ Pruebas de Seguridad
- [ ] **Auto-Promoción:** OU_ADMIN intenta mover su nodo a Root
- [ ] **Creación Fantasma:** Crear usuario con parentId fuera de scope
- [ ] **Role Granting:** OU_ADMIN intenta crear SUPER_ADMIN

**Estado:** No implementado aún
**Prioridad:** Alta - Crítico para seguridad

---

### 🟣 Fase 5: Auditoría y Logs

#### ⏳ Audit Trail
- [ ] Sistema de logs para acciones de administradores
- [ ] Registrar: Who, What, Target, Scope

**Estado:** No implementado
**Prioridad:** Media - Requerido para compliance

---

## 📋 Próximos Pasos Recomendados

### 1. Migración de Base de Datos (URGENTE)
Crear migración para agregar las nuevas columnas:
```bash
pnpm migration:generate -- AddRolesAndAdminToDirectoryNode
pnpm migration:run
```

### 2. Tests E2E (ALTA PRIORIDAD)
Crear suite de tests para validar:
- Fase 2: RBAC básico
- Fase 3: Lógica híbrida (Test Matrix)
- Fase 4: Anti-escalamiento

### 3. Actualizar Datos Existentes
Script para migrar usuarios existentes:
- Asignar roles basados en `attributes`
- Calcular `adminOfNodeId` para OU_ADMIN

### 4. Documentación
- Actualizar README con arquitectura híbrida
- Documentar flujo de autenticación/autorización
- Ejemplos de uso de guards

---

## 🎯 Resumen de Archivos Modificados/Creados

### Creados
1. `src/auth/guards/hierarchy.guard.ts` ✨ (actualizado)
2. `src/auth/guards/roles.guard.ts` ✨
3. `src/auth/decorators/roles.decorator.ts` ✨
4. `src/auth/decorators/index.ts` ✨
5. `src/auth/guards/index.ts` ✨

### Modificados
1. `src/directory/entities/directory-node.entity.ts` ✏️
2. `src/auth/interfaces/jwt-payload.interface.ts` ✏️
3. `src/auth/interfaces/user.interface.ts` ✏️
4. `src/auth/auth.service.ts` ✏️
5. `src/directory/directory.service.ts` ✏️
6. `src/directory/directory.controller.ts` ✏️
7. `AUTH_TASKS.md` ✏️

---

## 🔒 Seguridad Implementada

### ✅ Implementado
- ✅ JWT con mpath para scope checking sin consultas extra
- ✅ Validación de roles (RBAC)
- ✅ Validación de jerarquía (LDAP-style)
- ✅ Bloqueo de edición de ancestros
- ✅ Bloqueo de acceso fuera de scope
- ✅ SUPER_ADMIN bypass controlado

### ⚠️ Pendiente
- ⏳ Validación de role granting (no otorgar roles superiores)
- ⏳ Validación de auto-promoción
- ⏳ Audit logging
- ⏳ Rate limiting en endpoints críticos

---

## 📊 Progreso General

**Fase 1:** 66% completado (2/3 tareas)
**Fase 2:** 50% completado (implementación completa, faltan tests)
**Fase 3:** 50% completado (guard implementado, faltan tests)
**Fase 4:** 0% completado
**Fase 5:** 0% completado

**TOTAL:** ~35% completado

---

## 💡 Notas Técnicas

### Optimizaciones Implementadas
1. **mpath en JWT:** Evita consultas a BD en cada request
2. **roles en JWT:** Check de roles sin consultar BD
3. **String comparison:** `startsWith()` es O(n) muy eficiente

### Consideraciones de Performance
- El HierarchyGuard hace 1 consulta a BD por request (para obtener target node)
- Esto es inevitable si queremos validar el mpath del objetivo
- Alternativa: Cachear nodos frecuentemente accedidos (Redis)

### Seguridad
- **NUNCA** confiar solo en el JWT para decisiones críticas
- El mpath en JWT es para optimización, pero siempre validamos contra BD
- Los guards están en el orden correcto para máxima seguridad
