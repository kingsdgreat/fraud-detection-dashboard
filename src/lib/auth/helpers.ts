import { auth } from './index';
import { NextResponse } from 'next/server';

export type UserRole = 'analyst' | 'manager' | 'admin';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Get the current authenticated user from a server component or API route.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  return {
    id: (session.user as any).id,
    email: session.user.email!,
    name: session.user.name!,
    role: (session.user as any).role || 'analyst',
  };
}

/**
 * Require authentication for an API route. Returns the user or a 401 response.
 */
export async function requireAuth(): Promise<AuthUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return user;
}

/**
 * Require a minimum role level for an API route.
 */
export async function requireRole(minimumRole: UserRole): Promise<AuthUser | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;

  const roleHierarchy: Record<UserRole, number> = {
    analyst: 0,
    manager: 1,
    admin: 2,
  };

  if (roleHierarchy[result.role] < roleHierarchy[minimumRole]) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return result;
}

/**
 * Check if we're in demo mode (no auth required).
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}
