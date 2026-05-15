import { NextResponse } from 'next/server';

/**
 * Debug endpoint to verify auth configuration.
 * DELETE THIS IN PRODUCTION — only for deployment debugging.
 *
 * GET /api/debug/auth
 */
export async function GET() {
  const info: Record<string, any> = {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_DEV_MODE: process.env.AUTH_DEV_MODE,
    AUTH_DEV_MODE_type: typeof process.env.AUTH_DEV_MODE,
    AUTH_DEV_MODE_exact: JSON.stringify(process.env.AUTH_DEV_MODE),
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    HAS_DATABASE_URL: !!process.env.DATABASE_URL,
    HAS_AUTH_SECRET: !!process.env.AUTH_SECRET,
  };

  // Test database connection
  try {
    const { getDb } = await import('@/lib/db');
    const { users } = await import('@/lib/db/schema');
    const db = getDb();
    const allUsers = await db.select({
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
    }).from(users);
    info.dbConnected = true;
    info.userCount = allUsers.length;
    info.users = allUsers.map(u => ({
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
    }));
  } catch (err: any) {
    info.dbConnected = false;
    info.dbError = err.message;
  }

  return NextResponse.json(info, { status: 200 });
}
