/**
 * Seed the production database with initial users.
 * Usage: npx tsx src/lib/db/seed.ts
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { users } from './schema';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  console.log('Seeding users...');

  await db.insert(users).values([
    {
      email: 'admin@spectrum.com',
      name: 'System Administrator',
      role: 'admin',
      team: 'IT',
    },
    {
      email: 'manager@spectrum.com',
      name: 'Sarah Chen',
      role: 'manager',
      team: 'Fraud Operations',
    },
    {
      email: 'analyst1@spectrum.com',
      name: 'Marcus Johnson',
      role: 'analyst',
      team: 'Fraud Operations',
    },
    {
      email: 'analyst2@spectrum.com',
      name: 'Priya Patel',
      role: 'analyst',
      team: 'Fraud Operations',
    },
    {
      email: 'analyst3@spectrum.com',
      name: 'David Kim',
      role: 'analyst',
      team: 'Fraud Operations',
    },
  ]).onConflictDoNothing();

  console.log('Seed completed!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
