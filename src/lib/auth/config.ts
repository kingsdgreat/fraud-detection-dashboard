import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * NextAuth.js v5 configuration.
 *
 * Production auth: Google OAuth with optional domain restriction.
 * Development auth: Credentials provider accepts any password for seeded users.
 *
 * Set ALLOWED_EMAIL_DOMAIN to restrict Google sign-in to a specific domain
 * (e.g., "yourcompany.com"). Leave unset to allow any Google account.
 */

const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN; // e.g. "yourcompany.com"

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(getDb()),
  // Force JWT strategy so sessions work with both OAuth and Credentials
  session: { strategy: 'jwt' },
  useSecureCookies: !process.env.NEXTAUTH_URL?.startsWith('http://'),
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [
    // ── Google OAuth (production) ──────────────────────────
    // Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
              params: {
                prompt: 'consent',
                access_type: 'offline',
                response_type: 'code',
                // If domain restriction is set, hint the domain to Google
                ...(allowedDomain ? { hd: allowedDomain } : {}),
              },
            },
          }),
        ]
      : []),

    // ── Credentials provider (development only) ───────────
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'analyst@spectrum.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        // Only allow credentials in dev mode
        const isDevMode =
          process.env.NODE_ENV === 'development' || process.env.AUTH_DEV_MODE === 'true';
        if (!isDevMode) return null;

        try {
          const db = getDb();
          const email = credentials.email as string;

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (!user || !user.isActive) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (err) {
          console.error('[auth] Credentials error:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Domain restriction: block Google sign-ins from outside the allowed domain
      if (account?.provider === 'google' && allowedDomain) {
        const email = user.email || '';
        if (!email.endsWith(`@${allowedDomain}`)) {
          console.log(`[auth] Blocked sign-in from ${email} — not in @${allowedDomain}`);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (user) {
        // On initial sign-in, look up the user's role from the database
        // OAuth users may not have a role set yet (new accounts default to 'analyst')
        try {
          const db = getDb();
          const [dbUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, user.email!))
            .limit(1);

          token.role = dbUser?.role || (user as any).role || 'analyst';
          token.userId = dbUser?.id || user.id;
        } catch {
          token.role = (user as any).role || 'analyst';
          token.userId = user.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
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

      if (isDemoMode) return true;

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL('/prod', nextUrl));
        return true;
      }

      if (isApiRoute) return true;

      return isLoggedIn;
    },
  },
};
