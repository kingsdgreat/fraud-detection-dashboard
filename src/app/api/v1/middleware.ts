import { NextResponse } from 'next/server';
import { getCurrentUser, isDemoMode } from '@/lib/auth/helpers';
import type { UserRole } from '@/lib/auth/helpers';

/**
 * Wraps an API route handler with authentication and role checks.
 * In demo mode, creates a fake admin user so routes can still function.
 */
export function withAuth(
  handler: (req: Request, user: { id: string; email: string; name: string; role: UserRole }) => Promise<NextResponse>,
  minimumRole: UserRole = 'analyst'
) {
  return async (req: Request) => {
    try {
      // Demo mode: bypass auth with a synthetic user
      if (isDemoMode()) {
        const demoUser = {
          id: 'demo-user-001',
          email: 'demo@spectrum.com',
          name: 'Demo User',
          role: 'admin' as UserRole,
        };
        return handler(req, demoUser);
      }

      // Production: check real auth
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const roleHierarchy: Record<UserRole, number> = {
        analyst: 0,
        manager: 1,
        admin: 2,
      };

      if (roleHierarchy[user.role] < roleHierarchy[minimumRole]) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return handler(req, user);
    } catch (error) {
      console.error('API Error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Standard paginated response helper.
 */
export function paginatedResponse<T>(data: T[], total: number, page: number, pageSize: number) {
  return NextResponse.json({
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

/**
 * Parse pagination params from URL search params.
 */
export function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '25')));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}
