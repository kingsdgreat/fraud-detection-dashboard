import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * NextAuth.js v5 configuration.
 *
 * Production auth: Google OAuth with optional domain restriction.
 * Development auth: Credentials provider accepts any password for seeded users.
 *
 * We use JWT strategy (no database sessions) and handle user creation
 * manually in the signIn callback rather than using DrizzleAdapter.
 * This avoids adapter compatibility issues and gives us full control
 * over our custom fields (role, team, isActive).
 *
 * Set ALLOWED_EMAIL_DOMAIN to restrict Google sign-in to a specific domain
 * (e.g., "yourcompany.com"). Leave unset to allow any Google account.
 */

const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN; // e.g. "yourcompany.com"

export const authConfig: NextAuthConfig = {
  // No adapter — we handle user creation manually in signIn callback.
  // JWT strategy means sessions live in the cookie, not in the DB.
  session: { strategy: 'jwt' },
  useSecureCookies: !process.env.NEXTAUTH_URL?.startsWith('http://'),
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [
    // ── Google OAuth (production) ──────────────────────────
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // Disable OAuth checks — PKCE and state cookies don't persist
            // reliably across Vercel serverless function invocations in
            // next-auth v5 beta. Safe for internal tools behind domain restriction.
            checks: ['none'],
            authorization: {
              params: {
                prompt: 'consent',
                access_type: 'offline',
                response_type: 'code',
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
    async signIn({ user, account, profile }) {
      // Domain restriction: block Google sign-ins from outside the allowed domain
      if (account?.provider === 'google' && allowedDomain) {
        const email = user.email || '';
        if (!email.endsWith(`@${allowedDomain}`)) {
          console.log(`[auth] Blocked sign-in from ${email} — not in @${allowedDomain}`);
          return false;
        }
      }

      // For Google OAuth: ensure the user exists in our database
      if (account?.provider === 'google' && user.email) {
        try {
          const db = getDb();
          const [existing] = await db
            .select()
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);

          if (!existing) {
            // First-time Google sign-in: create the user record
            await db.insert(users).values({
              email: user.email,
              name: user.name || user.email.split('@')[0],
              image: user.image || null,
              emailVerified: new Date(),
              role: 'analyst',
              isActive: true,
            });
            console.log(`[auth] Created new user for ${user.email}`);
          } else {
            // Returning user: update last login and image
            await db
              .update(users)
              .set({
                lastLoginAt: new Date(),
                image: user.image || existing.image,
                emailVerified: existing.emailVerified || new Date(),
              })
              .where(eq(users.email, user.email));
          }
        } catch (err) {
          console.error('[auth] Error syncing Google user to DB:', err);
          // Still allow sign-in even if DB sync fails — JWT has the basics
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // On initial sign-in, look up the user's role from the database
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
