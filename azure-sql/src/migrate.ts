import Postgrator from 'postgrator';
import { dbConfig } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const postgrator = new Postgrator({
  migrationPattern: path.join(__dirname, '../migrations/*'),
  driver: 'mssql',
  host: dbConfig.server,
  port: dbConfig.port,
  database: dbConfig.database,
  username: dbConfig.user,
  password: dbConfig.password,
  schemaTable: 'migration_version',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  }
} as any);

async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    const appliedMigrations = await postgrator.migrate();
    
    if (appliedMigrations.length === 0) {
      console.log('No migrations to apply');
    } else {
      console.log(`Applied ${appliedMigrations.length} migrations:`);
      appliedMigrations.forEach(migration => {
        console.log(`  - ${migration.filename}`);
      });
    }
    
    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();