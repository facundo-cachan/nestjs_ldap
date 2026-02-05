# Usuarios y Roles de Prueba (RBAC)

Este documento detalla los usuarios creados para pruebas de integración entre `sigesta-back_end` y `nestjs_ldap`.

## 👥 Tabla de Usuarios

| Usuario | Contraseña | Rol Principal | Nodo (OU) | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| `admin` | `ChangeMe123!` | `SUPER_ADMIN` | `root` | Acceso total al sistema. |
| `admin_ops` | `OpsPass123!` | `OU_ADMIN` | `operaciones` | Administrador de la unidad de operaciones. |
| `operador` | `UserPass123!` | `USER` | `operaciones` | Operador vial estándar. |
| `auditor` | `AuditPass123!` | `READONLY` | `operaciones` | Acceso de solo lectura para auditoría. |

## 🛡️ Definición de Roles

- **SUPER_ADMIN**: Puede gestionar todos los nodos, usuarios y roles en todo el árbol jerárquico.
- **OU_ADMIN**: Tiene permisos administrativos limitados a su nodo (`mpath`) y descendientes.
- **USER**: Usuario estándar con permisos de operación básicos definidos por el sistema.
- **READONLY**: No puede realizar modificaciones, solo consultas.

## 🌳 Estructura Jerárquica (mpath)

1. `root` (id: 1, mpath: 1.)
   - `admin` (id: 2, mpath: 1.2.)
   - `operaciones` (id: 3, mpath: 1.3.)
     - `operador` (id: 4, mpath: 1.3.4.)
     - `auditor` (id: 5, mpath: 1.3.5.)
     - `admin_ops` (id: 6, mpath: 1.3.6., adminOf: 3)

---
*Nota: Las contraseñas se hashean automáticamente en la base de datos.*
