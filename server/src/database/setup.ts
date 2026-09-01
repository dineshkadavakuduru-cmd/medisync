import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

async function setupDatabase() {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/medisync';
  
  console.log('Connecting to database...');
  const sql = postgres(databaseUrl, { max: 1 });
  
  try {
    // Read and execute schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    console.log('Executing schema...');
    await sql.unsafe(schema);
    
    console.log('Schema executed successfully!');
    
    // Verify tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('Created tables:', tables.map(t => t.table_name).join(', '));
    
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

setupDatabase();