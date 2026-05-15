import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * NextAuth.js v5 configuration.
 *
 * In development, uses a Credentials provider for easy testing.
 * In production, add SSO providers (Azure AD, Google Workspace, etc.)
 *
 * This module is only loaded when DATABASE_URL is configured (production mode).
 */
export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(getDb()),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [
    // Credentials provider for development/testing
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'analyst@spectrum.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          console.log('[auth] No email provided');
          return null;
        }

        try {
          const db = getDb();
          const email = credentials.email as string;
          console.log('[auth] Looking up user:', email);

          // Look up user by email
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (!user) {
            console.log('[auth] User not found:', email);
            return null;
          }

          if (!user.isActive) {
            console.log('[auth] User inactive:', email);
            return null;
          }

          console.log('[auth] User found:', user.email, 'role:', user.role);
          console.log('[auth] NODE_ENV:', process.env.NODE_ENV);
          console.log('[auth] AUTH_DEV_MODE:', process.env.AUTH_DEV_MODE);

          // In development, accept any password for seeded users
          // AUTH_DEV_MODE=true allows this in production too (for staging/testing)
          if (process.env.NODE_ENV === 'development' || process.env.AUTH_DEV_MODE === 'true') {
            console.log('[auth] Dev mode auth — granting access');
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            };
          }

          console.log('[auth] Production mode — no dev auth, returning null');
          // Production: This should be replaced with SSO or proper auth
          return null;
        } catch (err) {
          console.error('[auth] Error in authorize:', err);
          return null;
        }
      },
    }),
    // Add production providers here:
    // AzureAD({ clientId: ..., clientSecret: ..., tenantId: ... }),
    // Google({ clientId: ..., clientSecret: ... }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, persist role into JWT
      if (user) {
        token.role = (user as any).role || 'analyst';
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose role and userId in the client session
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.userId;
      }
      return session;
    },
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith('/auth');
      const isApiRoute = nextUrl.pathname.startsWith('/api/v1');
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

      // Demo mode: allow all access (no auth required)
      if (isDemoMode) return true;

      // Auth pages: redirect to dashboard if already logged in
      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL('/prod', nextUrl));
        return true;
      }

      // API routes: handled by individual route middleware
      if (isApiRoute) return true;

      // All other pages require login
      return isLoggedIn;
    },
  },
};
