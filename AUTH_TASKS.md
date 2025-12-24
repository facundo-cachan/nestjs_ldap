Aquí tienes el archivo **AUTH_TASKS.md**. Este documento está diseñado como una **Lista de Control de Calidad (QA)** y auditoría técnica.

Su objetivo es validar que tu aplicación no sea solo un árbol (LDAP) ni solo un sistema de roles (RBAC), sino una **arquitectura híbrida segura** donde la jerarquía limita el alcance de los roles.

---

# AUTH_TASKS.md (Plan de Verificación Híbrida)

Este documento lista las tareas críticas para verificar la implementación correcta de la estrategia **Híbrida (Jerarquía LDAP + Roles RBAC)**.

## 🟢 Fase 1: Verificación de Arquitectura de Datos

*El objetivo es asegurar que la BD soporta tanto la jerarquía como los roles.*

* [ ] **Validar Entidad Híbrida:** Verificar que la entidad `DirectoryNode` (o una entidad `User` extendida) tenga:
* [ ] Columna de Jerarquía: `mpath` (Materialized Path) o configuración `@Tree`.
* [ ] Columna de Seguridad: `roles` (Array de Strings `['ADMIN', 'EDITOR']` o relación ManyToMany).


* [ ] **Validar Integridad del Path:** Crear un script de prueba que mueva un nodo padre y verificar:
* [ ] ¿Se actualizó el `mpath` del padre?
* [ ] ¿Se actualizaron en cascada los `mpath` de **todos** los descendientes? (Crítico: Si esto falla, la seguridad fallará).


* [ ] **Validar Payload del JWT:** Decodificar un token de acceso y verificar que contenga datos de ambas estrategias para evitar consultas extra a la BD:
* [ ] `roles`: Para el check RBAC rápido.
* [ ] `nodeId` o `scopePath`: Para el check de Jerarquía rápido.



## 🟠 Fase 2: Verificación de RBAC Estándar (El "QUÉ")

*Verificar que los roles funcionan independientemente de la jerarquía.*

* [ ] **Endpoint Protection:** Verificar que los endpoints críticos tengan decoradores de Roles.
* [ ] Ejemplo: `@Roles(Role.ADMIN)` en `DELETE /directory/:id`.


* [ ] **Public vs Private:** Intentar acceder a un endpoint protegido sin Token (Debe devolver `401 Unauthorized`).
* [ ] **Role Mismatch:** Intentar acceder con un usuario `ROLE_USER` a un endpoint `ROLE_ADMIN` (Debe devolver `403 Forbidden`).

## 🔴 Fase 3: Verificación de Lógica Híbrida (El "DÓNDE")

*Esta es la parte crítica. Verificar que un rol alto no rompa las fronteras de su Unidad Organizativa (OU).*

### El "Scope Guard" (Guardia de Alcance)

* [ ] **Implementación del Guard:** Verificar la existencia de un `HierarchyGuard` o `ScopeGuard` que se ejecute después del AuthGuard.
* [ ] **Lógica de Validación:** El Guard debe comparar el `mpath` del *Solicitante* vs el `mpath` del *Objetivo*.
* Lógica: `Target.mpath.startsWith(Requester.mpath)`



### Casos de Prueba Obligatorios (Test Matrix)

| Actor (Solicitante) | Rol Actor | Ubicación Actor | Objetivo (Target) | Ubicación Objetivo | Acción | **Resultado Esperado** | ¿Pasa? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Admin Global** | `SUPER_ADMIN` | `Root (1.)` | User Marketing | `1.5.10.` | Delete | ✅ **PERMITIDO** | [ ] |
| **Gerente Ventas** | `OU_ADMIN` | `Ventas (1.2.)` | User Ventas | `1.2.5.` | Edit | ✅ **PERMITIDO** | [ ] |
| **Gerente Ventas** | `OU_ADMIN` | `Ventas (1.2.)` | User IT | `1.3.8.` | Edit | ❌ **DENEGADO** (Fuera de Scope) | [ ] |
| **Gerente Ventas** | `OU_ADMIN` | `Ventas (1.2.)` | User Root | `1.` | Edit | ❌ **DENEGADO** (No editar ancestros) | [ ] |
| **Usuario Ventas** | `USER` | `Ventas (1.2.)` | User Ventas 2 | `1.2.5.` | Read | ✅ **PERMITIDO** (Si es público) | [ ] |
| **Usuario Ventas** | `USER` | `Ventas (1.2.)` | User Ventas 2 | `1.2.5.` | Delete | ❌ **DENEGADO** (Falta Rol) | [ ] |

## 🔵 Fase 4: Verificación de Seguridad Anti-Escalamiento

*Prevenir que alguien use la jerarquía para ganar privilegios indebidos.*

* [ ] **Prueba de "Auto-Promoción":**
* Un usuario con rol `OU_ADMIN` intenta mover su propio nodo (o el de un aliado) fuera de su rama actual hacia la raíz (`Root`).
* *Resultado Esperado:* Bloqueo. Un administrador de rama no debe poder mover nodos hacia un nivel superior al suyo propio.


* [ ] **Prueba de "Creación Fantasma":**
* Intentar crear un usuario asignándole un `parentId` que no pertenece a la rama del creador.
* *Resultado Esperado:* `403 Forbidden`. Solo puedes crear hijos debajo de ti.


* [ ] **Prueba de "Role Granting":**
* Un `OU_ADMIN` intenta crear un usuario nuevo y asignarle el rol `SUPER_ADMIN`.
* *Resultado Esperado:* Bloqueo. No puedes otorgar un rol superior al que tú mismo tienes.



## 🟣 Fase 5: Auditoría y Logs

*Para cumplir con estándares tipo LDAP/Enterprise.*

* [ ] **Audit Trail:** Verificar que cuando un `OU_ADMIN` modifica un usuario en su rama, se guarde un log:
* `Who`: ID del Manager.
* `What`: Action (UPDATE).
* `Target`: ID del empleado.
* `Scope`: Path en el momento de la acción.



---

### ¿Cómo ejecutar esta verificación?

Te sugiero convertir la **Fase 3 (Casos de Prueba)** en un set de **Tests E2E (End-to-End)** automatizados con NestJS y Jest. Es muy difícil verificar manualmente todas las combinaciones de jerarquía sin cometer errores humanos.

¿Te gustaría que genere el código del **`HierarchyGuard`** (La pieza de código que hace pasar o fallar las pruebas de la Fase 3)?