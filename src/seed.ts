import { AppDataSource } from './data-source';
import { DirectoryNode, NodeType } from './directory/entities/directory-node.entity';
import { Role } from './auth/enums/role.enum';

async function bootstrap() {
  try {
    console.log('🌱 Inicializando conexión a la base de datos...');
    await AppDataSource.initialize();
    console.log('✅ Base de datos conectada.');

    // console.log('🔄 Ejecutando migraciones para asegurar esquema...');
    // await AppDataSource.runMigrations();
    // console.log('✅ Migraciones completadas.');

    const nodeRepo = AppDataSource.getRepository(DirectoryNode);

    // 1. Crear Nodo Raíz (Domain Component)
    console.log('🔍 Buscando nodo raíz...');
    let rootNode = await nodeRepo.findOne({
      where: { name: 'root', type: NodeType.DC },
    });

    if (!rootNode) {
      console.log('✨ Creando nodo raíz...');
      rootNode = new DirectoryNode();
      rootNode.name = 'root';
      rootNode.type = NodeType.DC;
      rootNode.attributes = { description: 'Root Domain Component' };
      await nodeRepo.save(rootNode);
      console.log('✅ Nodo raíz creado (ID: ' + rootNode.id + ')');
    } else {
      console.log('ℹ️ El nodo raíz ya existe.');
    }

    // 2. Crear Usuario Admin
    console.log('🔍 Buscando usuario admin...');
    let adminUser = await nodeRepo.findOne({
      where: { name: 'admin' },
    });

    if (!adminUser) {
      console.log('✨ Creando usuario admin...');
      adminUser = new DirectoryNode();
      adminUser.name = 'admin';
      adminUser.type = NodeType.USER;
      adminUser.password = 'ChangeMe123!'; // Contraseña por defecto
      adminUser.roles = [Role.SUPER_ADMIN];
      adminUser.parent = rootNode;
      adminUser.attributes = {
        email: 'admin@localhost',
        displayName: 'System Administrator',
      };

      // La contraseña se hasheará automáticamente gracias al hook @BeforeInsert en la entidad
      await nodeRepo.save(adminUser);
      console.log('✅ Usuario admin creado.');
      console.log('🔑 Credenciales iniciales -> Usuario: admin | Pass: ChangeMe123!');
    } else {
      console.log('ℹ️ El usuario admin ya existe.');
    }

    // 3. Crear Estructura Organizacional de Prueba
    console.log('🔍 Buscando OU operaciones...');
    let opsOU = await nodeRepo.findOne({
      where: { name: 'operaciones', type: NodeType.OU },
    });

    if (!opsOU) {
      console.log('✨ Creando OU operaciones...');
      opsOU = new DirectoryNode();
      opsOU.name = 'operaciones';
      opsOU.type = NodeType.OU;
      opsOU.parent = rootNode;
      await nodeRepo.save(opsOU);
      console.log('✅ OU operaciones creada.');
    }

    // 4. Crear Usuarios Adicionales
    const testUsers = [
      {
        name: 'operador',
        role: Role.USER,
        pass: 'UserPass123!',
        displayName: 'Operador Vial',
      },
      {
        name: 'auditor',
        role: Role.READONLY,
        pass: 'AuditPass123!',
        displayName: 'Auditor de Sistema',
      },
      {
        name: 'admin_ops',
        role: Role.OU_ADMIN,
        pass: 'OpsPass123!',
        displayName: 'Administrador de Operaciones',
        adminOf: true,
      },
    ];

    for (const u of testUsers) {
      console.log(`🔍 Buscando usuario ${u.name}...`);
      let userNode = await nodeRepo.findOne({
        where: { name: u.name },
      });

      if (!userNode) {
        console.log(`✨ Creando usuario ${u.name}...`);
        userNode = new DirectoryNode();
        userNode.name = u.name;
        userNode.type = NodeType.USER;
        userNode.password = u.pass;
        userNode.roles = [u.role];
        userNode.parent = opsOU;
        userNode.attributes = {
          email: `${u.name}@localhost`,
          displayName: u.displayName,
        };
        if (u.adminOf) {
          userNode.adminOfNodeId = opsOU.id;
        }

        await nodeRepo.save(userNode);
        console.log(`✅ Usuario ${u.name} creado.`);
      } else {
        console.log(`ℹ️ El usuario ${u.name} ya existe.`);
      }
    }

    console.log('🌱 Seeding completado exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante el seeding:', error);
    process.exit(1);
  }
}

bootstrap();
