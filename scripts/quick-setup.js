/**
 * Quick database setup: creates enums, tables, indexes, and seeds users.
 * Usage: node scripts/quick-setup.js
 */
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('✗ DATABASE_URL not set in .env.local'); process.exit(1); }

const sql = neon(DATABASE_URL);

async function run() {
  console.log('▸ Testing database connection...');
  const v = await sql`SELECT version()`;
  console.log('  ✓ Connected:', v[0].version.split('(')[0].trim());

  // ── Step 1: Create enums ──────────────────────────────────
  console.log('\n▸ Creating enums...');
  const enums = [
    ["user_role", "('analyst', 'manager', 'admin')"],
    ["order_type", "('connect', 'disconnect', 'transfer')"],
    ["case_status", "('open', 'in_review', 'escalated', 'resolved', 'dismissed')"],
    ["case_priority", "('low', 'normal', 'high', 'urgent')"],
    ["case_resolution", "('confirmed_fraud', 'false_positive', 'inconclusive')"],
    ["risk_band", "('low', 'medium', 'high', 'critical')"],
    ["comment_type", "('note', 'status_change', 'assignment', 'escalation', 'system')"],
    ["batch_source", "('csv_upload', 'api', 'manual')"],
    ["batch_status", "('pending', 'processing', 'completed', 'failed')"],
  ];
  for (const [name, vals] of enums) {
    try {
      await sql.query(`CREATE TYPE ${name} AS ENUM ${vals}`);
      console.log(`  ✓ ${name}`);
    } catch (e) {
      if (e.message?.includes('already exists')) console.log(`  ○ ${name} (exists)`);
      else throw e;
    }
  }

  // ── Step 2: Create tables ─────────────────────────────────
  console.log('\n▸ Creating tables...');

  const tables = [
    ['users', `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      email_verified TIMESTAMPTZ,
      image TEXT,
      role user_role NOT NULL DEFAULT 'analyst',
      team VARCHAR(100),
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`],
    ['accounts', `CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(255) NOT NULL,
      provider VARCHAR(255) NOT NULL,
      provider_account_id VARCHAR(255) NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type VARCHAR(255),
      scope VARCHAR(255),
      id_token TEXT,
      session_state VARCHAR(255)
    )`],
    ['sessions', `CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_token VARCHAR(255) NOT NULL UNIQUE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TIMESTAMPTZ NOT NULL
    )`],
    ['verification_tokens', `CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier VARCHAR(255) NOT NULL,
      token VARCHAR(255) NOT NULL,
      expires TIMESTAMPTZ NOT NULL
    )`],
    ['ingestion_batches', `CREATE TABLE IF NOT EXISTS ingestion_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source batch_source NOT NULL,
      filename VARCHAR(255),
      uploaded_by UUID REFERENCES users(id),
      total_records INTEGER,
      processed_records INTEGER,
      failed_records INTEGER,
      status batch_status NOT NULL DEFAULT 'pending',
      error_log JSONB,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`],
    ['orders', `CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      external_id VARCHAR(100) UNIQUE,
      order_date DATE NOT NULL,
      order_type order_type NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      address TEXT NOT NULL,
      city VARCHAR(100),
      state VARCHAR(2),
      zip VARCHAR(10),
      phone_hash VARCHAR(64),
      email_hash VARCHAR(64),
      payment_method_hash VARCHAR(64),
      ssn_last4_hash VARCHAR(64),
      equipment_id VARCHAR(100),
      channel VARCHAR(50),
      agent_id VARCHAR(50),
      region VARCHAR(50),
      promo_code VARCHAR(50),
      account_number VARCHAR(50),
      disconnect_reason VARCHAR(100),
      delinquent_balance DECIMAL(10,2),
      batch_id UUID REFERENCES ingestion_batches(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`],
    ['cases', `CREATE TABLE IF NOT EXISTS cases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_number SERIAL UNIQUE,
      order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
      risk_score INTEGER NOT NULL,
      risk_band risk_band NOT NULL,
      evidence JSONB NOT NULL,
      identity_signals JSONB,
      financial_impact JSONB,
      status case_status NOT NULL DEFAULT 'open',
      priority case_priority NOT NULL DEFAULT 'normal',
      assigned_to UUID REFERENCES users(id),
      assigned_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      resolution case_resolution,
      sla_due_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`],
    ['case_comments', `CREATE TABLE IF NOT EXISTS case_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      author_id UUID REFERENCES users(id),
      type comment_type NOT NULL,
      content TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`],
    ['audit_log', `CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID,
      changes JSONB,
      ip_address INET,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`],
  ];

  for (const [name, ddl] of tables) {
    try {
      await sql.query(ddl);
      console.log(`  ✓ ${name}`);
    } catch (e) {
      console.log(`  ✗ ${name}: ${e.message?.slice(0, 80)}`);
    }
  }

  // ── Step 3: Create indexes ────────────────────────────────
  console.log('\n▸ Creating indexes...');
  const indexes = [
    'CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)',
    'CREATE INDEX IF NOT EXISTS users_role_idx ON users(role)',
    'CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider_account_idx ON accounts(provider, provider_account_id)',
    'CREATE UNIQUE INDEX IF NOT EXISTS verification_tokens_token_idx ON verification_tokens(token)',
    'CREATE INDEX IF NOT EXISTS orders_date_idx ON orders(order_date)',
    'CREATE INDEX IF NOT EXISTS orders_phone_hash_idx ON orders(phone_hash)',
    'CREATE INDEX IF NOT EXISTS orders_email_hash_idx ON orders(email_hash)',
    'CREATE INDEX IF NOT EXISTS orders_payment_hash_idx ON orders(payment_method_hash)',
    'CREATE INDEX IF NOT EXISTS orders_ssn_hash_idx ON orders(ssn_last4_hash)',
    'CREATE INDEX IF NOT EXISTS orders_equipment_idx ON orders(equipment_id)',
    'CREATE INDEX IF NOT EXISTS orders_agent_idx ON orders(agent_id)',
    'CREATE INDEX IF NOT EXISTS orders_account_idx ON orders(account_number)',
    'CREATE INDEX IF NOT EXISTS orders_batch_idx ON orders(batch_id)',
    'CREATE INDEX IF NOT EXISTS cases_risk_score_idx ON cases(risk_score)',
    'CREATE INDEX IF NOT EXISTS cases_risk_band_idx ON cases(risk_band)',
    'CREATE INDEX IF NOT EXISTS cases_status_idx ON cases(status)',
    'CREATE INDEX IF NOT EXISTS cases_assigned_to_idx ON cases(assigned_to)',
    'CREATE INDEX IF NOT EXISTS cases_sla_due_idx ON cases(sla_due_at)',
    'CREATE INDEX IF NOT EXISTS case_comments_case_idx ON case_comments(case_id)',
    'CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log(actor_id)',
    'CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action)',
    'CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_id)',
  ];

  let idxCount = 0;
  for (const idx of indexes) {
    try { await sql.query(idx); idxCount++; } catch (e) { /* ignore */ }
  }
  console.log(`  ✓ ${idxCount} indexes created`);

  // ── Step 4: Seed users ────────────────────────────────────
  console.log('\n▸ Seeding initial users...');
  const users = [
    { email: 'admin@spectrum.com', name: 'System Administrator', role: 'admin', team: 'IT' },
    { email: 'manager@spectrum.com', name: 'Sarah Chen', role: 'manager', team: 'Fraud Operations' },
    { email: 'analyst1@spectrum.com', name: 'Marcus Johnson', role: 'analyst', team: 'Fraud Operations' },
    { email: 'analyst2@spectrum.com', name: 'Priya Patel', role: 'analyst', team: 'Fraud Operations' },
    { email: 'analyst3@spectrum.com', name: 'David Kim', role: 'analyst', team: 'Fraud Operations' },
  ];

  for (const u of users) {
    try {
      await sql`
        INSERT INTO users (email, name, role, team)
        VALUES (${u.email}, ${u.name}, ${u.role}::user_role, ${u.team})
        ON CONFLICT (email) DO NOTHING
      `;
      console.log(`  ✓ ${u.name} (${u.email}) — ${u.role}`);
    } catch (e) {
      console.log(`  ○ ${u.email} — ${e.message?.slice(0, 60)}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────
  const allTables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const userCount = await sql`SELECT count(*) as c FROM users`;

  console.log('\n══════════════════════════════════════════════');
  console.log(`  Database ready!`);
  console.log(`  ${allTables.length} tables: ${allTables.map(t => t.tablename).join(', ')}`);
  console.log(`  ${userCount[0].c} users seeded`);
  console.log('');
  console.log('  Next: npm run dev');
  console.log('  Sign in: admin@spectrum.com (any password)');
  console.log('══════════════════════════════════════════════\n');
}

run().catch(e => {
  console.error('\n✗ Setup failed:', e.message);
  process.exit(1);
});
