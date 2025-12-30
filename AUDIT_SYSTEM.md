# 📊 Sistema de Auditoría - Guía Completa

## 🎯 Descripción General

El sistema de auditoría proporciona trazabilidad completa de todas las acciones administrativas realizadas en el sistema. Cumple con estándares enterprise/LDAP y registra:

- **Who** (Quién): ID y nombre del usuario que realizó la acción
- **What** (Qué): Tipo de acción (CREATE, READ, UPDATE, DELETE, MOVE)
- **Target** (Objetivo): ID, nombre y tipo del nodo afectado
- **Scope** (Alcance): Materialized Path del usuario al momento de la acción
- **When** (Cuándo): Timestamp de la acción
- **Context** (Contexto): IP, User Agent, metadata adicional

---

## 📋 Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Entidad AuditLog](#entidad-auditlog)
3. [Servicio de Auditoría](#servicio-de-auditoría)
4. [API Endpoints](#api-endpoints)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Consultas Avanzadas](#consultas-avanzadas)
7. [Casos de Uso](#casos-de-uso)
8. [Performance](#performance)

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│      DirectoryController                │
│  (CREATE, READ, UPDATE, DELETE, MOVE)   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│         AuditService.log()               │
│  (Registra acción con toda la info)      │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│       AuditLog Entity (PostgreSQL)       │
│  (Almacenamiento con índices optimizados)│
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│         AuditController                  │
│  (API para consultar logs)               │
└──────────────────────────────────────────┘
```

---

## 📦 Entidad AuditLog

### Campos

| Campo | Tipo | Descripción | Índice |
|-------|------|-------------|--------|
| `id` | number | ID único del registro | PK |
| `actorId` | number | ID del usuario que realizó la acción | ✅ |
| `actorName` | string | Nombre del usuario | - |
| `actorRole` | string | Rol del usuario (SUPER_ADMIN, OU_ADMIN, USER) | - |
| `action` | string | Tipo de acción (CREATE, READ, UPDATE, DELETE, MOVE) | ✅ |
| `targetId` | number | ID del nodo afectado | ✅ |
| `targetName` | string | Nombre del nodo afectado | - |
| `targetType` | string | Tipo del nodo (USER, OU, DC, GROUP) | - |
| `scope` | string | Materialized Path del actor | - |
| `metadata` | jsonb | Metadata adicional (parentId, oldValue, newValue, etc.) | - |
| `ipAddress` | string | IP del cliente | - |
| `userAgent` | string | User Agent del cliente | - |
| `status` | string | Estado (SUCCESS, FAILED, DENIED) | - |
| `errorMessage` | string | Mensaje de error si falló | - |
| `createdAt` | timestamp | Fecha y hora de la acción | ✅ |

### Índices Compuestos

- `actorId` + `createdAt` - Para consultas por usuario
- `targetId` + `createdAt` - Para consultas por objetivo
- `action` + `createdAt` - Para consultas por tipo de acción

---

## 🔧 Servicio de Auditoría

### Métodos Disponibles

#### `log(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog>`

Registra una acción en el sistema de auditoría.

```typescript
await auditService.log({
  actorId: user.sub,
  actorName: user.username,
  actorRole: user.role,
  action: 'CREATE',
  targetId: node.id,
  targetName: node.name,
  targetType: node.type,
  scope: user.mpath,
  metadata: {
    parentId: createNodeDto.parentId,
    nodeType: createNodeDto.type,
  },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});
```

#### `findByActor(actorId: number, limit?: number): Promise<AuditLog[]>`

Obtiene todos los logs de un usuario específico.

```typescript
const logs = await auditService.findByActor(5, 50);
```

#### `findByTarget(targetId: number, limit?: number): Promise<AuditLog[]>`

Obtiene todos los logs de un nodo específico.

```typescript
const logs = await auditService.findByTarget(10, 50);
```

#### `findByAction(action: string, limit?: number): Promise<AuditLog[]>`

Obtiene todos los logs de un tipo de acción.

```typescript
const logs = await auditService.findByAction('DELETE', 100);
```

#### `findByScope(scopePath: string, limit?: number): Promise<AuditLog[]>`

Obtiene todos los logs dentro de un scope (OU).

```typescript
const logs = await auditService.findByScope('1.2.', 50);
```

#### `findByDateRange(startDate: Date, endDate: Date, limit?: number): Promise<AuditLog[]>`

Obtiene logs dentro de un rango de fechas.

```typescript
const logs = await auditService.findByDateRange(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
  500
);
```

#### `getActorStats(actorId: number): Promise<Record<string, number>>`

Obtiene estadísticas de actividad de un usuario.

```typescript
const stats = await auditService.getActorStats(5);
// { CREATE: 10, UPDATE: 5, DELETE: 2, MOVE: 3 }
```

---

## 🌐 API Endpoints

Todos los endpoints requieren autenticación JWT y rol de SUPER_ADMIN o OU_ADMIN.

### GET /audit/actor/:actorId

Obtiene logs por usuario.

**Query Parameters:**
- `limit` (opcional): Número máximo de registros (default: 100)

**Ejemplo:**
```bash
GET /audit/actor/5?limit=50
Authorization: Bearer {token}
```

**Respuesta:**
```json
[
  {
    "id": 1,
    "actorId": 5,
    "actorName": "sales.admin",
    "actorRole": "OU_ADMIN",
    "action": "CREATE",
    "targetId": 10,
    "targetName": "new.user",
    "targetType": "USER",
    "scope": "1.2.",
    "metadata": {
      "parentId": 2,
      "nodeType": "USER"
    },
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "status": "SUCCESS",
    "createdAt": "2025-12-29T22:00:00.000Z"
  }
]
```

### GET /audit/target/:targetId

Obtiene logs por nodo objetivo.

**Query Parameters:**
- `limit` (opcional): Número máximo de registros (default: 100)

**Ejemplo:**
```bash
GET /audit/target/10?limit=50
Authorization: Bearer {token}
```

### GET /audit/action/:action

Obtiene logs por tipo de acción.

**Valores válidos para action:**
- `CREATE`
- `READ`
- `UPDATE`
- `DELETE`
- `MOVE`

**Query Parameters:**
- `limit` (opcional): Número máximo de registros (default: 100)

**Ejemplo:**
```bash
GET /audit/action/DELETE?limit=100
Authorization: Bearer {token}
```

### GET /audit/scope

Obtiene logs por scope (OU).

**Query Parameters:**
- `path` (requerido): Materialized Path (ej: "1.2.")
- `limit` (opcional): Número máximo de registros (default: 100)

**Ejemplo:**
```bash
GET /audit/scope?path=1.2.&limit=50
Authorization: Bearer {token}
```

### GET /audit/date-range

Obtiene logs por rango de fechas.

**Query Parameters:**
- `startDate` (requerido): Fecha de inicio (ISO 8601)
- `endDate` (requerido): Fecha de fin (ISO 8601)
- `limit` (opcional): Número máximo de registros (default: 1000)

**Ejemplo:**
```bash
GET /audit/date-range?startDate=2025-01-01&endDate=2025-01-31&limit=500
Authorization: Bearer {token}
```

### GET /audit/stats/:actorId

Obtiene estadísticas de actividad de un usuario.

**Ejemplo:**
```bash
GET /audit/stats/5
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "CREATE": 10,
  "UPDATE": 5,
  "DELETE": 2,
  "MOVE": 3,
  "READ": 50
}
```

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Ver el historial de un usuario

```bash
# Ver todas las acciones realizadas por el usuario con ID 5
GET /audit/actor/5?limit=100
Authorization: Bearer {token}
```

### Ejemplo 2: Ver quién modificó un usuario específico

```bash
# Ver todas las acciones realizadas sobre el usuario con ID 10
GET /audit/target/10?limit=50
Authorization: Bearer {token}
```

### Ejemplo 3: Ver todas las eliminaciones

```bash
# Ver todas las eliminaciones realizadas en el sistema
GET /audit/action/DELETE?limit=100
Authorization: Bearer {token}
```

### Ejemplo 4: Ver actividad en un departamento

```bash
# Ver todas las acciones realizadas en el departamento Sales (mpath: 1.2.)
GET /audit/scope?path=1.2.&limit=50
Authorization: Bearer {token}
```

### Ejemplo 5: Generar reporte mensual

```bash
# Ver todas las acciones del mes de enero 2025
GET /audit/date-range?startDate=2025-01-01&endDate=2025-01-31&limit=1000
Authorization: Bearer {token}
```

### Ejemplo 6: Ver estadísticas de un administrador

```bash
# Ver cuántas acciones de cada tipo realizó el admin con ID 5
GET /audit/stats/5
Authorization: Bearer {token}
```

---

## 🔍 Consultas Avanzadas

### Usando el Servicio Directamente

```typescript
import { AuditService } from '@/audit/audit.service';

// Inyectar el servicio
constructor(private readonly auditService: AuditService) {}

// Consulta 1: Logs de un usuario en un período específico
const logs = await this.auditService.findByDateRange(
  new Date('2025-01-01'),
  new Date('2025-01-31')
);
const userLogs = logs.filter(log => log.actorId === userId);

// Consulta 2: Logs de eliminaciones en un departamento
const deleteLogs = await this.auditService.findByAction('DELETE');
const deptDeleteLogs = deleteLogs.filter(log => log.scope.startsWith('1.2.'));

// Consulta 3: Actividad reciente de todos los admins
const allLogs = await this.auditService.findByDateRange(
  new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24 horas
  new Date()
);
const adminLogs = allLogs.filter(log => 
  log.actorRole === 'OU_ADMIN' || log.actorRole === 'SUPER_ADMIN'
);
```

### Usando TypeORM Directamente

```typescript
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditLog } from '@/audit/entities/audit-log.entity';

constructor(
  @InjectRepository(AuditLog)
  private readonly auditRepository: Repository<AuditLog>,
) {}

// Consulta compleja con QueryBuilder
const logs = await this.auditRepository
  .createQueryBuilder('audit')
  .where('audit.actorRole = :role', { role: 'OU_ADMIN' })
  .andWhere('audit.action IN (:...actions)', { actions: ['CREATE', 'DELETE'] })
  .andWhere('audit.createdAt >= :start', { start: startDate })
  .andWhere('audit.createdAt <= :end', { end: endDate })
  .orderBy('audit.createdAt', 'DESC')
  .limit(100)
  .getMany();
```

---

## 🎯 Casos de Uso

### 1. Compliance y Auditoría

**Escenario:** Necesitas generar un reporte de todas las acciones administrativas del último trimestre para una auditoría de seguridad.

**Solución:**
```bash
GET /audit/date-range?startDate=2025-01-01&endDate=2025-03-31&limit=5000
```

### 2. Debugging y Troubleshooting

**Escenario:** Un usuario reporta que su información fue modificada sin su consentimiento. Necesitas investigar quién y cuándo.

**Solución:**
```bash
# Ver el historial completo del usuario
GET /audit/target/10?limit=100
```

### 3. Detección de Actividad Sospechosa

**Escenario:** Quieres detectar si algún administrador está realizando eliminaciones masivas.

**Solución:**
```bash
# Ver todas las eliminaciones recientes
GET /audit/action/DELETE?limit=200

# Luego analizar las estadísticas de cada admin
GET /audit/stats/5
GET /audit/stats/6
```

### 4. Reportes de Actividad por Departamento

**Escenario:** El gerente de Sales quiere ver todas las acciones realizadas en su departamento.

**Solución:**
```bash
# Ver actividad en Sales (mpath: 1.2.)
GET /audit/scope?path=1.2.&limit=100
```

### 5. Análisis de Productividad

**Escenario:** Quieres ver cuántas acciones realizó cada administrador en el último mes.

**Solución:**
```bash
# Para cada admin
GET /audit/stats/5
GET /audit/stats/6
GET /audit/stats/7
```

---

## ⚡ Performance

### Índices Optimizados

El sistema utiliza índices compuestos para optimizar las consultas más comunes:

1. **`actorId` + `createdAt`**: Optimiza consultas por usuario
2. **`targetId` + `createdAt`**: Optimiza consultas por objetivo
3. **`action` + `createdAt`**: Optimiza consultas por tipo de acción

### Límites Recomendados

- **Consultas por usuario/objetivo**: 50-100 registros
- **Consultas por acción**: 100-200 registros
- **Consultas por rango de fechas**: 500-1000 registros
- **Consultas por scope**: 50-100 registros

### Paginación

Para grandes volúmenes de datos, se recomienda implementar paginación:

```typescript
// Página 1
GET /audit/actor/5?limit=50

// Página 2 (implementar offset en el servicio)
// Actualmente no implementado, pero se puede agregar fácilmente
```

---

## 🔒 Seguridad

### Control de Acceso

- ✅ Solo usuarios con rol `SUPER_ADMIN` o `OU_ADMIN` pueden consultar logs
- ✅ Los logs son de solo lectura (no se pueden modificar ni eliminar)
- ✅ Cada consulta requiere autenticación JWT válida

### Privacidad

- ✅ Los logs incluyen IP y User Agent para trazabilidad
- ✅ No se almacenan passwords ni datos sensibles en metadata
- ✅ Los logs se mantienen indefinidamente (implementar política de retención según necesidad)

---

## 📝 Notas Técnicas

### Metadata JSONB

El campo `metadata` es de tipo JSONB, lo que permite almacenar información adicional flexible:

```json
{
  "parentId": 2,
  "nodeType": "USER",
  "oldValue": "old@example.com",
  "newValue": "new@example.com",
  "reason": "User requested email change"
}
```

### Campos Opcionales

Los siguientes campos son opcionales y pueden ser `null`:
- `targetId`, `targetName`, `targetType` (para acciones globales)
- `metadata` (si no hay información adicional)
- `ipAddress`, `userAgent` (si no están disponibles)
- `errorMessage` (si la acción fue exitosa)

---

## 🚀 Próximas Mejoras

1. **Paginación**: Implementar offset para consultas grandes
2. **Filtros Combinados**: Permitir múltiples filtros en una sola consulta
3. **Exportación**: Generar reportes en PDF/Excel
4. **Alertas**: Notificaciones automáticas para actividad sospechosa
5. **Retención**: Política de retención de logs (ej: 1 año)
6. **Dashboard**: Interfaz web para visualizar logs y estadísticas

---

## 📚 Referencias

- **Entidad**: `src/audit/entities/audit-log.entity.ts`
- **Servicio**: `src/audit/audit.service.ts`
- **Controlador**: `src/audit/audit.controller.ts`
- **Módulo**: `src/audit/audit.module.ts`
- **DTO**: `src/audit/dto/create-audit-log.dto.ts`
- **Tests**: `test/audit.e2e-spec.ts`

---

## 💬 Soporte

Para reportar bugs o solicitar features relacionadas con el sistema de auditoría, abrir un issue en GitHub con el tag `audit`.
