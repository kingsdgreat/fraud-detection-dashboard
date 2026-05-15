/**
 * Run database migrations.
 * Usage: npx tsx src/lib/db/migrate.ts
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Please configure .env.local');
    process.exit(1);
  }

  console.log('Running migrations...');
  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('Migrations completed successfully!');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
