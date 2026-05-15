# Spectrum Fraud Detection — Deployment Guide

## Quick Start

```bash
bash scripts/setup-production.sh
```

This interactive script walks through all setup steps. Or follow the manual steps below.

---

## Manual Setup

### 1. Create Neon Database

1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project: `spectrum-fraud-detection`
3. Copy the connection string (looks like `postgresql://user:pass@host/dbname?sslmode=require`)

### 2. Configure Environment

Edit `.env.local`:

```env
NEXT_PUBLIC_DEMO_MODE=false
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
AUTH_SECRET=<run: openssl rand -base64 32>
AUTH_DEV_MODE=true
```

### 3. Run Database Migration

Option A — Using the migration script:
```bash
npx tsx src/lib/db/migrate.ts
```

Option B — Using Neon SQL Editor:
Copy and paste `drizzle/migrations/0000_initial_schema.sql` into the Neon console SQL editor.

### 4. Seed Users

```bash
npx tsx src/lib/db/seed.ts
```

Creates 5 initial users:
| Email | Role |
|-------|------|
| admin@spectrum.com | Admin |
| manager@spectrum.com | Manager |
| analyst1@spectrum.com | Analyst |
| analyst2@spectrum.com | Analyst |
| analyst3@spectrum.com | Analyst |

### 5. Run Locally

```bash
npm run dev
```

Sign in at `http://localhost:3000/auth/signin` with any seeded email (any password works in dev mode).

### 6. Deploy to Vercel

#### Option A: GitHub Integration (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit — fraud detection dashboard"
   git remote add origin https://github.com/YOUR_USERNAME/fraud-dashboard.git
   git push -u origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click "Import Git Repository" and select your repo
   - Framework will auto-detect as Next.js

3. **Set environment variables** in the Vercel project settings (Settings → Environment Variables):

   | Variable | Value | Notes |
   |----------|-------|-------|
   | `DATABASE_URL` | `postgresql://neondb_owner:...@....neon.tech/neondb?sslmode=require` | Your Neon connection string |
   | `AUTH_SECRET` | *(run `openssl rand -base64 32`)* | Random secret for JWT signing |
   | `NEXT_PUBLIC_DEMO_MODE` | `false` | Enables production mode with auth + DB |
   | `NEXTAUTH_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL |

4. **Deploy** — click "Deploy". Vercel builds and deploys automatically.

5. **Verify** — visit your deployment URL. You should see the sign-in page. Log in with `admin@spectrum.com` (any password in dev auth mode).

#### Option B: Vercel CLI

```bash
npm i -g vercel
vercel          # follow prompts to link/create project
vercel env add DATABASE_URL
vercel env add AUTH_SECRET
vercel env add NEXT_PUBLIC_DEMO_MODE    # set to: false
vercel env add NEXTAUTH_URL             # set to your deployment URL
vercel --prod   # deploy to production
```

#### After Deployment

- **Auto-deploys**: Every push to `main` triggers a new deployment
- **Preview deploys**: Pull requests get unique preview URLs
- **Neon region**: The `vercel.json` pins to `iad1` (US East) to match Neon's US East region for low latency
- **Function timeouts**: CSV upload has 60s timeout, scoring has 30s timeout (configured in `vercel.json`)

#### Switching Between Demo and Production

- Demo site: Set `NEXT_PUBLIC_DEMO_MODE=true` — no database needed, synthetic data
- Production site: Set `NEXT_PUBLIC_DEMO_MODE=false` — requires `DATABASE_URL` and `AUTH_SECRET`
- You can run both by creating two Vercel projects from the same repo with different env vars

---

## Architecture

```
Demo Mode (NEXT_PUBLIC_DEMO_MODE=true)
├── Client-side synthetic data generation
├── No database, no auth
└── Everything runs in the browser

Production Mode (NEXT_PUBLIC_DEMO_MODE=false)
├── PostgreSQL (Neon) for persistent storage
├── NextAuth.js for authentication
├── REST API at /api/v1/*
├── Case management workflow
└── CSV + API data ingestion
```

## Database Commands

```bash
npm run db:generate   # Generate new migration from schema changes
npm run db:migrate    # Run pending migrations
npm run db:push       # Push schema directly (dev only)
npm run db:studio     # Open Drizzle Studio (visual DB browser)
```
