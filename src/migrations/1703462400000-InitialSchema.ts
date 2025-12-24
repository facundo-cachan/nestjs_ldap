import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1703462400000 implements MigrationInterface {
    name = 'InitialSchema1703462400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Crear la tabla directory_node
        await queryRunner.query(`
            CREATE TYPE "directory_node_type_enum" AS ENUM('DC', 'OU', 'GROUP', 'USER')
        `);

        await queryRunner.query(`
            CREATE TABLE "directory_node" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "type" "directory_node_type_enum" NOT NULL DEFAULT 'OU',
                "password" character varying,
                "attributes" jsonb NOT NULL DEFAULT '{}',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "mpath" character varying DEFAULT '',
                "parentId" integer,
                CONSTRAINT "PK_directory_node_id" PRIMARY KEY ("id")
            )
        `);

        // Crear índice en name para búsquedas rápidas
        await queryRunner.query(`
            CREATE INDEX "IDX_directory_node_name" ON "directory_node" ("name")
        `);

        // Crear índice en mpath con varchar_pattern_ops para optimizar búsquedas LIKE 'path%'
        // Este es el índice CRÍTICO para el rendimiento de búsquedas en sub-árboles
        await queryRunner.query(`
            CREATE INDEX "IDX_directory_node_mpath" ON "directory_node" ("mpath" varchar_pattern_ops)
        `);

        // Crear FK constraint para la relación parent
        await queryRunner.query(`
            ALTER TABLE "directory_node" 
            ADD CONSTRAINT "FK_directory_node_parent" 
            FOREIGN KEY ("parentId") 
            REFERENCES "directory_node"("id") 
            ON DELETE NO ACTION 
            ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar FK constraint
        await queryRunner.query(`
            ALTER TABLE "directory_node" 
            DROP CONSTRAINT "FK_directory_node_parent"
        `);

        // Eliminar índices
        await queryRunner.query(`DROP INDEX "IDX_directory_node_mpath"`);
        await queryRunner.query(`DROP INDEX "IDX_directory_node_name"`);

        // Eliminar tabla
        await queryRunner.query(`DROP TABLE "directory_node"`);

        // Eliminar tipo enum
        await queryRunner.query(`DROP TYPE "directory_node_type_enum"`);
    }

}
