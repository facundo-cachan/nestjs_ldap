# Migraciones de Base de Datos

Este directorio contiene las migraciones de TypeORM para la base de datos del proyecto.

## Estructura de la Base de Datos

### Tabla: `directory_node`

Tabla principal que implementa un árbol jerárquico usando la estrategia **Materialized Path**.

**Columnas:**
- `id` (SERIAL): Identificador único del nodo
- `name` (VARCHAR): Nombre del nodo (ej: "juan.perez", "Engineering")
- `type` (ENUM): Tipo de nodo (`DC`, `OU`, `GROUP`, `USER`)
- `password` (VARCHAR, nullable): Contraseña hasheada (solo para nodos USER)
- `attributes` (JSONB): Atributos flexibles (email, firstName, lastName, etc.)
- `createdAt` (TIMESTAMP): Fecha de creación
- `updatedAt` (TIMESTAMP): Fecha de última actualización
- `mpath` (VARCHAR): **Columna crítica** - Path materializado generado automáticamente por TypeORM
- `parentId` (INTEGER, FK): Referencia al nodo padre

**Índices:**
- `PK_0368842f3dd67882de9b889a540`: Primary key en `id`
- `IDX_3b444ab8a14a2b5658c1ea633f`: Índice en `name` para búsquedas rápidas
- **`IDX_directory_node_mpath`**: Índice CRÍTICO en `mpath` con `varchar_pattern_ops`
  - Optimiza búsquedas en sub-árboles usando `LIKE 'path%'`
  - Sin este índice, las búsquedas jerárquicas serían extremadamente lentas

## Comandos Disponibles

### Crear una nueva migración vacía
```bash
pnpm migration:create src/migrations/MiNombreDeMigracion
```

### Generar migración automática desde cambios en entidades
```bash
pnpm migration:generate src/migrations/MiNombreDeMigracion
```

### Ejecutar migraciones pendientes
```bash
pnpm migration:run
```

### Revertir la última migración
```bash
pnpm migration:revert
```

### Ver estado de migraciones
```bash
pnpm migration:show
```

## Aplicar Índice a Base de Datos Existente

Si ya tienes una base de datos en desarrollo con `synchronize: true`, puedes aplicar el índice mpath con:

```bash
docker exec -i backend-postgres psql -U admin -d nestjs_ldap < src/migrations/add-mpath-index.sql
```

## Migraciones Disponibles

### 1766602689166-InitialSchema.ts
Migración inicial que crea:
- Tipo ENUM `directory_node_type_enum`
- Tabla `directory_node` con todas sus columnas
- Índices optimizados:
  - Índice en `name`
  - **Índice en `mpath` con `varchar_pattern_ops`** (crítico para rendimiento)
- Foreign key constraint para `parentId`

## Estrategia Materialized Path

TypeORM genera automáticamente la columna `mpath` que contiene la ruta completa del nodo en formato:
```
Ejemplo: "1.5.12."
```

Esto permite:
- **Búsquedas eficientes en sub-árboles**: `WHERE mpath LIKE '1.5.%'`
- **Obtener ancestros**: Parseando el string del path
- **Mover ramas completas**: TypeORM actualiza automáticamente todos los descendientes

**⚠️ IMPORTANTE**: El índice `varchar_pattern_ops` es CRÍTICO para que las búsquedas LIKE sean eficientes. Sin él, PostgreSQL haría table scans completos.

## Notas de Producción

1. **Nunca uses `synchronize: true` en producción**
2. Siempre usa migraciones para cambios de esquema
3. Prueba las migraciones en staging antes de producción
4. Mantén backups antes de ejecutar migraciones
5. El índice mpath es esencial - no lo elimines
