-- Script para agregar el índice crítico mpath a una base de datos existente
-- Este índice optimiza las búsquedas en sub-árboles con LIKE 'path%'

-- Verificar si el índice ya existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'IDX_directory_node_mpath'
    ) THEN
        -- Crear índice en mpath con varchar_pattern_ops
        CREATE INDEX "IDX_directory_node_mpath" 
        ON "directory_node" ("mpath" varchar_pattern_ops);
        
        RAISE NOTICE 'Índice IDX_directory_node_mpath creado exitosamente';
    ELSE
        RAISE NOTICE 'El índice IDX_directory_node_mpath ya existe';
    END IF;
END
$$;

-- Verificar los índices existentes en la tabla
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'directory_node'
ORDER BY indexname;
