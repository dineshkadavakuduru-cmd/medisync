import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

async function seedDatabase() {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/arogyasetu';
  
  console.log('Connecting to database for seeding...');
  const sql = postgres(databaseUrl, { max: 1 });
  
  try {
    // Read and execute seed data
    const seedPath = join(__dirname, 'seed.sql');
    const seed = readFileSync(seedPath, 'utf-8');
    
    console.log('Executing seed data...');
    await sql.unsafe(seed);
    
    console.log('Seed data executed successfully!');
    
  } catch (error) {
    console.error('Database seeding failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seedDatabase();