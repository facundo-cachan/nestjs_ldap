# 🛡️ Sistema Anti-Escalamiento - Fase 4

## 📋 Descripción General

El sistema anti-escalamiento implementa validaciones de seguridad críticas para prevenir que usuarios con privilegios limitados (especialmente `OU_ADMIN`) puedan escalar sus privilegios o bypass las restricciones jerárquicas.

---

## 🎯 Validaciones Implementadas

### 1. **Auto-Promoción** ❌

**Problema:** Un `OU_ADMIN` intenta mover su propio nodo o el de un aliado hacia un nivel superior (ej: hacia Root).

**Solución:**
```typescript
// ❌ DENEGADO: OU_ADMIN intenta mover su nodo a Root
await antiEscalationService.validateNodeMove(user, 5, 1);
// ForbiddenException: No puedes mover nodos hacia un nivel superior
```

**Validaciones:**
- ✅ El nuevo padre no puede tener un `mpath` más corto que el `mpath` del usuario
- ✅ No se puede mover el nodo del cual eres administrador
- ✅ Ambos nodos (a mover y nuevo padre) deben estar en el scope del usuario

---

### 2. **Creación Fantasma** ❌

**Problema:** Un `OU_ADMIN` intenta crear un nodo asignándole un `parentId` que no pertenece a su rama.

**Solución:**
```typescript
// ❌ DENEGADO: OU_ADMIN de Sales intenta crear usuario en Marketing
await antiEscalationService.validateNodeCreation(user, {
  name: 'phantom.user',
  type: NodeType.USER,
  parentId: 3, // Marketing (fuera de scope)
  password: 'password123',
});
// ForbiddenException: No puedes crear nodos bajo el padre marketing
```

**Validaciones:**
- ✅ El `parentId` debe estar dentro del scope del usuario
- ✅ El `mpath` del padre debe empezar con el `mpath` del usuario

---

### 3. **Role Granting** ❌

**Problema:** Un `OU_ADMIN` intenta crear un usuario nuevo y asignarle el rol `SUPER_ADMIN`.

**Solución:**
```typescript
// ❌ DENEGADO: OU_ADMIN intenta crear SUPER_ADMIN
await antiEscalationService.validateNodeCreation(user, {
  name: 'fake.superadmin',
  type: NodeType.USER,
  parentId: 2,
  password: 'password123',
  attributes: {
    isSuperAdmin: true, // ❌ Esto fallará
  },
});
// ForbiddenException: No puedes otorgar el rol SUPER_ADMIN
```

**Validaciones:**
- ✅ `OU_ADMIN` no puede otorgar `isSuperAdmin: true`
- ✅ `OU_ADMIN` solo puede crear `OU_ADMIN` dentro de su scope
- ✅ `USER` no puede otorgar ningún rol administrativo

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│      DirectoryController                │
│  (create, moveNode)                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│    AntiEscalationService                 │
│  - validateNodeCreation()                │
│  - validateNodeMove()                    │
└──────────────┬───────────────────────────┘
               │
               ├─► validateRoleGranting()
               ├─► validateParentInScope()
               ├─► validateNoSelfPromotion()
               └─► validateMoveInScope()
```

---

## 📝 Métodos del Servicio

### `validateNodeCreation(user, createNodeDto)`

Valida que un usuario pueda crear un nodo con los atributos especificados.

**Validaciones:**
1. Role Granting (previene otorgar roles superiores)
2. Parent In Scope (previene creación fantasma)

**Ejemplo:**
```typescript
await antiEscalationService.validateNodeCreation(user, {
  name: 'new.user',
  type: NodeType.USER,
  parentId: 2,
  attributes: {
    email: 'new@company.com',
  },
});
```

---

### `validateNodeMove(user, nodeId, newParentId)`

Valida que un usuario pueda mover un nodo a un nuevo padre.

**Validaciones:**
1. No Self Promotion (previene auto-promoción)
2. Move In Scope (previene mover fuera del scope)

**Ejemplo:**
```typescript
await antiEscalationService.validateNodeMove(user, 6, 8);
```

---

## 🔍 Validaciones Internas

### `validateRoleGranting(user, createNodeDto)`

Previene que un usuario otorgue roles superiores al suyo.

**Reglas:**
- `OU_ADMIN` no puede otorgar `isSuperAdmin: true`
- `USER` no puede otorgar roles administrativos
- Solo `SUPER_ADMIN` puede crear otros `SUPER_ADMIN`

---

### `validateParentInScope(user, parentId)`

Previene crear nodos con `parentId` fuera del scope.

**Reglas:**
- El `mpath` del padre debe empezar con el `mpath` del usuario
- Usa `getEffectiveMpath()` para obtener el scope correcto

---

### `validateNoSelfPromotion(user, nodeId, newParentId)`

Previene mover nodos hacia un nivel superior.

**Reglas:**
- El nuevo padre no puede tener un `mpath` más corto que el del usuario
- No se puede mover el nodo del cual eres administrador

---

### `validateMoveInScope(user, nodeId, newParentId)`

Previene mover nodos fuera del scope.

**Reglas:**
- El nodo a mover debe estar en el scope
- El nuevo padre debe estar en el scope

---

## 🧪 Tests E2E

Los tests para estas validaciones están en `test/auth-tasks-validation.e2e-spec.ts`:

### Test 1: Auto-Promoción
```typescript
it('should prevent OU_ADMIN from moving own node to Root', async () => {
  await request(app.getHttpServer())
    .post('/directory/move')
    .set('Authorization', `Bearer ${ouAdminToken}`)
    .send({
      nodeId: 5, // OU_ADMIN node
      newParentId: 1, // Root
    })
    .expect(403);
});
```

### Test 2: Creación Fantasma
```typescript
it('should prevent OU_ADMIN from creating node outside scope', async () => {
  await request(app.getHttpServer())
    .post('/directory')
    .set('Authorization', `Bearer ${ouAdminToken}`)
    .send({
      name: 'phantom.user',
      type: NodeType.USER,
      parentId: 3, // Marketing (fuera de scope)
      password: 'password123',
    })
    .expect(403);
});
```

### Test 3: Role Granting
```typescript
it('should prevent OU_ADMIN from creating SUPER_ADMIN', async () => {
  await request(app.getHttpServer())
    .post('/directory')
    .set('Authorization', `Bearer ${ouAdminToken}`)
    .send({
      name: 'fake.superadmin',
      type: NodeType.USER,
      parentId: 2,
      password: 'password123',
      attributes: {
        isSuperAdmin: true,
      },
    })
    .expect(403);
});
```

---

## 🔒 Integración en DirectoryController

### Creación de Nodos

```typescript
@Post()
@Roles(Role.OU_ADMIN, Role.SUPER_ADMIN)
async create(
  @Body() createNodeDto: CreateNodeDto,
  @CurrentUser() user: any,
) {
  // Validar anti-escalamiento (Fase 4)
  await this.antiEscalationService.validateNodeCreation(user, createNodeDto);

  const node = await this.directoryService.create(createNodeDto);
  return node;
}
```

### Movimiento de Nodos

```typescript
@Post('move')
@Roles(Role.OU_ADMIN, Role.SUPER_ADMIN)
async moveNode(
  @Body('nodeId') nodeId: number,
  @Body('newParentId') newParentId: number,
  @CurrentUser() user: any,
) {
  // Validar anti-escalamiento (Fase 4)
  await this.antiEscalationService.validateNodeMove(user, nodeId, newParentId);

  const result = await this.directoryService.moveBranch(nodeId, newParentId);
  return result;
}
```

---

## 📊 Matriz de Validaciones

| Acción | OU_ADMIN | SUPER_ADMIN | USER |
|--------|----------|-------------|------|
| Crear nodo en su scope | ✅ | ✅ | ❌ |
| Crear nodo fuera de scope | ❌ | ✅ | ❌ |
| Otorgar rol SUPER_ADMIN | ❌ | ✅ | ❌ |
| Otorgar rol OU_ADMIN | ✅* | ✅ | ❌ |
| Mover nodo en su scope | ✅ | ✅ | ❌ |
| Mover nodo fuera de scope | ❌ | ✅ | ❌ |
| Mover propio nodo a Root | ❌ | ✅ | ❌ |

*Solo dentro de su scope

---

## 🎯 Casos de Uso

### Caso 1: Prevenir Auto-Promoción

**Escenario:** El administrador de Sales intenta mover su nodo a Root para ganar más privilegios.

**Resultado:** ❌ DENEGADO
```
ForbiddenException: No puedes mover nodos hacia un nivel superior a tu Unidad Organizativa.
```

---

### Caso 2: Prevenir Creación Fantasma

**Escenario:** El administrador de Sales intenta crear un usuario en Marketing.

**Resultado:** ❌ DENEGADO
```
ForbiddenException: No puedes crear nodos bajo el padre marketing porque está fuera de tu Unidad Organizativa.
```

---

### Caso 3: Prevenir Role Granting

**Escenario:** El administrador de Sales intenta crear un usuario con rol SUPER_ADMIN.

**Resultado:** ❌ DENEGADO
```
ForbiddenException: No puedes otorgar el rol SUPER_ADMIN. Solo un SUPER_ADMIN puede crear otros SUPER_ADMIN.
```

---

## 🔧 Configuración

### Importar el Servicio

```typescript
// auth.module.ts
import { AntiEscalationService } from '@/auth/services/anti-escalation.service';

@Module({
  providers: [AntiEscalationService],
  exports: [AntiEscalationService],
})
export class AuthModule {}
```

### Usar en Controladores

```typescript
// directory.controller.ts
constructor(
  private readonly antiEscalationService: AntiEscalationService,
) {}
```

---

## 📚 Referencias

- **Código:** `src/auth/services/anti-escalation.service.ts`
- **Tests:** `test/auth-tasks-validation.e2e-spec.ts`
- **Integración:** `src/directory/directory.controller.ts`
- **Documentación:** `AUTH_TASKS.md` (Fase 4)

---

## ✅ Checklist de Validación

- [x] Servicio `AntiEscalationService` creado
- [x] Método `validateNodeCreation()` implementado
- [x] Método `validateNodeMove()` implementado
- [x] Integrado en `DirectoryController.create()`
- [x] Integrado en `DirectoryController.moveNode()`
- [x] Exportado en `AuthModule`
- [x] Tests E2E implementados
- [x] Snyk scan: 0 issues
- [x] Documentación completa

---

## 🎉 Resultado

El sistema anti-escalamiento está **100% implementado** y proporciona:

1. ✅ Prevención de auto-promoción
2. ✅ Prevención de creación fantasma
3. ✅ Prevención de role granting
4. ✅ Validaciones exhaustivas de scope
5. ✅ Mensajes de error claros y descriptivos
6. ✅ Integración completa en el flujo de creación y movimiento

**Estado: COMPLETADO** 🏆
