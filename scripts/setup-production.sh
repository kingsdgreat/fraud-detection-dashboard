#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Spectrum Fraud Detection System — Production Setup Script
# ─────────────────────────────────────────────────────────────────
#
# This script walks you through setting up the production environment.
# Prerequisites:
#   - Node.js 18+ installed
#   - A Neon account (https://neon.tech) — free tier works for setup
#   - A Vercel account (https://vercel.com)
#   - Git repository initialized
#
# Usage: bash scripts/setup-production.sh
# ─────────────────────────────────────────────────────────────────

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Spectrum Fraud Detection — Production Setup           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Check prerequisites ──────────────────────────────────
echo "▸ Step 1: Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found. Install from https://nodejs.org"
  exit 1
fi
echo "  ✓ Node.js $(node -v)"

if ! command -v npm &> /dev/null; then
  echo "  ✗ npm not found"
  exit 1
fi
echo "  ✓ npm $(npm -v)"

if ! command -v npx &> /dev/null; then
  echo "  ✗ npx not found"
  exit 1
fi
echo "  ✓ npx available"
echo ""

# ── Step 2: Install dependencies ─────────────────────────────────
echo "▸ Step 2: Installing dependencies..."
npm install
echo "  ✓ Dependencies installed"
echo ""

# ── Step 3: Database setup ───────────────────────────────────────
echo "▸ Step 3: Database configuration"
echo ""
echo "  You need a PostgreSQL connection string from Neon."
echo "  1. Go to https://console.neon.tech"
echo "  2. Create a new project (e.g., 'spectrum-fraud-detection')"
echo "  3. Copy the connection string"
echo ""

if [ -f .env.local ]; then
  # Check if DATABASE_URL is already set
  if grep -q "^DATABASE_URL=" .env.local 2>/dev/null; then
    echo "  ✓ DATABASE_URL already configured in .env.local"
  else
    read -p "  Paste your DATABASE_URL: " DB_URL
    if [ -n "$DB_URL" ]; then
      # Update the .env.local file
      sed -i.bak 's|# DATABASE_URL=.*|DATABASE_URL='"$DB_URL"'|' .env.local
      rm -f .env.local.bak
      echo "  ✓ DATABASE_URL saved to .env.local"
    else
      echo "  ⚠ Skipped. Set DATABASE_URL in .env.local before continuing."
    fi
  fi
else
  echo "  ✗ .env.local not found. Creating from template..."
  cp .env.local.example .env.local 2>/dev/null || echo "  ⚠ Create .env.local manually"
fi
echo ""

# ── Step 4: Generate auth secret ─────────────────────────────────
echo "▸ Step 4: Generating AUTH_SECRET..."
AUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

if grep -q "^AUTH_SECRET=" .env.local 2>/dev/null; then
  echo "  ✓ AUTH_SECRET already set"
else
  sed -i.bak 's|# AUTH_SECRET=.*|AUTH_SECRET='"$AUTH_SECRET"'|' .env.local
  rm -f .env.local.bak
  echo "  ✓ AUTH_SECRET generated and saved"
fi
echo ""

# ── Step 5: Switch to production mode ────────────────────────────
echo "▸ Step 5: Setting production mode..."
sed -i.bak 's|NEXT_PUBLIC_DEMO_MODE=true|NEXT_PUBLIC_DEMO_MODE=false|' .env.local
rm -f .env.local.bak
echo "  ✓ DEMO_MODE set to false"

# Enable dev credentials
if ! grep -q "^AUTH_DEV_MODE=" .env.local 2>/dev/null; then
  echo "AUTH_DEV_MODE=true" >> .env.local
else
  sed -i.bak 's|# AUTH_DEV_MODE=.*|AUTH_DEV_MODE=true|' .env.local
  rm -f .env.local.bak
fi
echo "  ✓ AUTH_DEV_MODE enabled for local testing"
echo ""

# ── Step 6: Run database migration ──────────────────────────────
echo "▸ Step 6: Running database migration..."
if grep -q "^DATABASE_URL=" .env.local 2>/dev/null; then
  # Run the SQL migration directly using the migrate script
  echo "  Running migration SQL..."
  npx tsx src/lib/db/migrate.ts 2>&1 || {
    echo ""
    echo "  ⚠ Auto-migration failed. Run the SQL manually:"
    echo "    1. Open Neon Console → SQL Editor"
    echo "    2. Paste contents of drizzle/migrations/0000_initial_schema.sql"
    echo "    3. Click Run"
  }
else
  echo "  ⚠ DATABASE_URL not set. Skipping migration."
  echo "    Run the migration SQL from drizzle/migrations/0000_initial_schema.sql"
fi
echo ""

# ── Step 7: Seed initial users ───────────────────────────────────
echo "▸ Step 7: Seeding initial users..."
if grep -q "^DATABASE_URL=" .env.local 2>/dev/null; then
  npx tsx src/lib/db/seed.ts 2>&1 || echo "  ⚠ Seed failed (users may already exist)"
else
  echo "  ⚠ Skipped (no DATABASE_URL)"
fi
echo ""

# ── Step 8: Test locally ─────────────────────────────────────────
echo "▸ Step 8: Ready to test!"
echo ""
echo "  Run the development server:"
echo "    npm run dev"
echo ""
echo "  Then sign in with one of the seeded accounts:"
echo "    admin@spectrum.com    (Admin role)"
echo "    manager@spectrum.com  (Manager role)"
echo "    analyst1@spectrum.com (Analyst role)"
echo ""
echo "  In dev mode, any password works."
echo ""

# ── Step 9: Vercel deployment ────────────────────────────────────
echo "▸ Step 9: Deploy to Vercel"
echo ""
echo "  1. Push your code to GitHub"
echo "  2. Import the repo in Vercel (https://vercel.com/new)"
echo "  3. Set these environment variables in Vercel:"
echo ""
echo "     DATABASE_URL          = <your Neon connection string>"
echo "     AUTH_SECRET            = <generated secret>"
echo "     NEXT_PUBLIC_DEMO_MODE  = false"
echo ""
echo "  4. Deploy!"
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Setup complete! Your fraud detection system is ready."
echo "══════════════════════════════════════════════════════════"
echo ""
