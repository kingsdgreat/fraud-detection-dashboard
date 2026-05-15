import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Only create a connection when DATABASE_URL is available (production mode)
function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. The production database is only available when DATABASE_URL is configured. ' +
      'If you are running in demo mode, use the client-side data context instead.'
    );
  }
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

// Lazy singleton — only instantiated when first accessed
let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

// Type export for use across the app
export type Database = ReturnType<typeof createDb>;

// Re-export schema for convenience
export { schema };
