# Plan de Desarrollo: Directory Service (NestJS + Materialized Path)

Basado en las funcionalidades descritas en README.md.

## Fase 1: Configuración Inicial
- [x] **Init:** Inicializar proyecto NestJS & Docker para Postgres.
- [x] **TypeORM Config:** Configurar conexión asíncrona a la BD.

## Fase 2: Implementación del Árbol (Materialized Path)
- [x] **Entity Definition:** Crear la entidad `DirectoryNode`.
    - Usar decorador `@Tree("materialized-path")`.
    - Definir columna `@TreeParent()` y `@TreeChildren()`.
- [x] **Migration:** Generar migración inicial. Verificar que TypeORM cree la columna `mpath` (o nombre similar generado automáticamente).
- [x] **Indexing:** Crear manualmente un índice en la columna de path si el ORM no lo hace por defecto:
    - `CREATE INDEX idx_directory_mpath ON directory_node (mpath varchar_pattern_ops);` (Optimización clave para consultas `LIKE 'abc%'`).

## Fase 3: Gestión de Nodos (CRUD Especializado)
- [x] **Create Node:** Endpoint para insertar nodos (DC, OU, User).
    - TypeORM calcula automáticamente el string del path al guardar con `repository.save()`.
- [x] **Get Subtree (Read):** Implementar búsqueda eficiente.
    - Usar `repository.findDescendants(node)` para traer toda la rama.
    - O usar QueryBuilder: `WHERE mpath LIKE :path || '%'` para control manual.
- [x] **Move Node (The Heavy Operation):** Endpoint para mover una rama (cambiar de padre).
    - **Reto:** Al cambiar el padre, TypeORM debe actualizar el `mpath` del nodo Y de todos sus descendientes.
    - **Task:** Crear test de integración específico para verificar que no queden "paths rotos" tras un movimiento masivo.
- [x] **Get Ancestors:** Endpoint para mostrar "breadcrumbs" (migas de pan) del usuario (ej: com > myco > devs > Juan).
    - Usar `repository.findAncestors(node)`.

## Fase 4: Seguridad y Autenticación (Features del README)
- [x] **Autenticación Centralizada:**
    - [x] Implementar módulo de Auth con Passport y JWT.
    - [x] Crear endpoint de Login para validación de credenciales.
    - [x] Definir estrategias de guardado de contraseñas (hashing con bcrypt).
- [x] **Guards y Strategies:**
    - [x] LocalStrategy para validación de username/password
    - [x] JwtStrategy para validación de tokens
    - [x] LocalAuthGuard para proteger endpoint de login
    - [x] JwtAuthGuard para proteger rutas autenticadas
- [x] **RBAC Jerárquico:**
    - *Lógica:* Si soy admin de una OU, tengo permisos sobre todos los nodos descendientes (usando la lógica de `mpath`).
    - Crear Guard/Decorator para validar permisos basados en jerarquía.

## Fase 5: Lógica de Negocio y Restricciones
- [x] **Constraints:** Validar que no se puedan crear dos nodos con el mismo nombre bajo el mismo padre (Unicidad de hermanos).
- [x] **Type Safety:** Asegurar reglas de negocio:
    - Un `USER` no puede tener hijos.
    - Un `DC` (Domain Component) suele ser raíz. Use validadores de class-validator.

## Fase 6: Búsqueda Avanzada y Rendimiento
- [x] **Flat Search:** Buscar usuarios por email/nombre ignorando la jerarquía.
- [x] **Scoped Search:** Buscar usuarios "dentro de la OU X".
    - Lógica: Encontrar el `mpath` de la OU X, y hacer query `LIKE` sobre ese path.

## Fase 7: Pruebas de Carga
- [ ] **Seed Masivo:** Script para generar 10,000 nodos (profundidad 10 niveles).
- [ ] **Benchmark:** Medir tiempo de respuesta al mover una rama con 1,000 hijos (validar impacto de Materialized Path en escritura).