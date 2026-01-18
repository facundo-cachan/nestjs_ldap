# 📊 Sistema de Auditoría - Trazabilidad Enterprise

## 🎯 Descripción General
El sistema de auditoría registra de forma inmutable todas las acciones administrativas y eventos de seguridad críticos. Está diseñado para cumplimiento (compliance) y análisis forense.

## 📋 Acciones Auditadas

| Categoría | Acción | Descripción |
|-----------|--------|-------------|
| **Directorio** | `CREATE`, `UPDATE`, `DELETE`, `MOVE` | Cambios en la jerarquía o atributos de nodos. |
| **Seguridad** | `LDAP_BIND` | Intentos de autenticación vía Gateway LDAP. |
| **Seguridad** | `LDAP_SEARCH` | Consultas realizadas al Gateway LDAP. |
| **Sesión** | `LOGIN`, `LOGOUT` | Inicio y cierre de sesión (revocación de token). |
| **Sesión** | `REFRESH` | Uso y rotación de Refresh Tokens. |

## 📦 Estructura del Log
Cada entrada en `AuditLog` contiene:
- **Actor**: ID, Nombre y Rol del usuario (o `SYSTEM`).
- **Acción**: El tipo de operación realizada.
- **Target**: ID y Nombre del recurso afectado (si aplica).
- **Scope**: El Materialized Path del actor al momento de la acción.
- **Metadata**: JSON flexible con detalles (ej: filtros LDAP, IPs, User Agents).
- **Status**: `SUCCESS`, `FAILED` o `DENIED`.

## ⚙️ Integración con Servicios

### Gateway LDAP
Registra cada búsqueda para detectar escaneos masivos de directorio:
```typescript
// Ejemplo de log de búsqueda
metadata: { 
  dn: 'dc=organizacion,dc=com', 
  filter: '(uid=juan)', 
  scope: 'sub' 
}
```

### AuthService (Seguridad)
Registra el ciclo de vida de los tokens:
- **Logout**: Almacena el ID del token revocado.
- **Refresh**: Registra la rotación para trazabilidad de sesiones largas.

## 🔍 Consultas de Auditoría
Disponibles vía API protegida (Solo `SUPER_ADMIN`):
- `GET /audit/actor/:id`: Historial de un usuario.
- `GET /audit/action/:action`: Ver todos los eventos de un tipo (ej: `DELETE`).
- `GET /audit/stats/:id`: Resumen de actividad.

---
© 2026 Facundo Cachan – Auditoría y Control
