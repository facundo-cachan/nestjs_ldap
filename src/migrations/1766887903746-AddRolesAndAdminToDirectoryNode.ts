import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRolesAndAdminToDirectoryNode1766887903746 implements MigrationInterface {
    name = 'AddRolesAndAdminToDirectoryNode1766887903746'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_node" ADD "roles" text`);
        await queryRunner.query(`ALTER TABLE "directory_node" ADD "adminOfNodeId" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_node" DROP COLUMN "adminOfNodeId"`);
        await queryRunner.query(`ALTER TABLE "directory_node" DROP COLUMN "roles"`);
    }

}
