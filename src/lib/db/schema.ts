import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  date,
  timestamp,
  jsonb,
  pgEnum,
  serial,
  inet,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['analyst', 'manager', 'admin']);

export const orderTypeEnum = pgEnum('order_type', ['connect', 'disconnect', 'transfer']);

export const caseStatusEnum = pgEnum('case_status', [
  'open',
  'in_review',
  'escalated',
  'resolved',
  'dismissed',
]);

export const casePriorityEnum = pgEnum('case_priority', ['low', 'normal', 'high', 'urgent']);

export const caseResolutionEnum = pgEnum('case_resolution', [
  'confirmed_fraud',
  'false_positive',
  'inconclusive',
]);

export const riskBandEnum = pgEnum('risk_band', ['low', 'medium', 'high', 'critical']);

export const commentTypeEnum = pgEnum('comment_type', [
  'note',
  'status_change',
  'assignment',
  'escalation',
  'system',
]);

export const batchSourceEnum = pgEnum('batch_source', ['csv_upload', 'api', 'manual']);

export const batchStatusEnum = pgEnum('batch_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

// Users — extended NextAuth user table
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    emailVerified: timestamp('email_verified', { mode: 'date', withTimezone: true }),
    image: text('image'),
    role: userRoleEnum('role').notNull().default('analyst'),
    team: varchar('team', { length: 100 }),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_role_idx').on(table.role),
  ]
);

// NextAuth accounts (OAuth providers)
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: varchar('token_type', { length: 255 }),
    scope: varchar('scope', { length: 255 }),
    idToken: text('id_token'),
    sessionState: varchar('session_state', { length: 255 }),
  },
  (table) => [
    uniqueIndex('accounts_provider_account_idx').on(table.provider, table.providerAccountId),
  ]
);

// NextAuth sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
});

// NextAuth verification tokens (magic links)
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull(),
    expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex('verification_tokens_token_idx').on(table.token)]
);

// Orders — raw service orders from CSV/API ingestion
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalId: varchar('external_id', { length: 100 }).unique(),
    orderDate: date('order_date', { mode: 'date' }).notNull(),
    orderType: orderTypeEnum('order_type').notNull(),
    customerName: varchar('customer_name', { length: 255 }).notNull(),
    address: text('address').notNull(),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 2 }),
    zip: varchar('zip', { length: 10 }),
    phoneHash: varchar('phone_hash', { length: 64 }),
    emailHash: varchar('email_hash', { length: 64 }),
    paymentMethodHash: varchar('payment_method_hash', { length: 64 }),
    ssnLast4Hash: varchar('ssn_last4_hash', { length: 64 }),
    equipmentId: varchar('equipment_id', { length: 100 }),
    channel: varchar('channel', { length: 50 }),
    agentId: varchar('agent_id', { length: 50 }),
    region: varchar('region', { length: 50 }),
    promoCode: varchar('promo_code', { length: 50 }),
    accountNumber: varchar('account_number', { length: 50 }),
    disconnectReason: varchar('disconnect_reason', { length: 100 }),
    delinquentBalance: decimal('delinquent_balance', { precision: 10, scale: 2 }),
    batchId: uuid('batch_id').references(() => ingestionBatches.id),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('orders_date_idx').on(table.orderDate),
    index('orders_phone_hash_idx').on(table.phoneHash),
    index('orders_email_hash_idx').on(table.emailHash),
    index('orders_payment_hash_idx').on(table.paymentMethodHash),
    index('orders_ssn_hash_idx').on(table.ssnLast4Hash),
    index('orders_equipment_idx').on(table.equipmentId),
    index('orders_agent_idx').on(table.agentId),
    index('orders_account_idx').on(table.accountNumber),
    index('orders_batch_idx').on(table.batchId),
  ]
);

// Cases — scored fraud cases
export const cases = pgTable(
  'cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseNumber: serial('case_number').unique(),
    orderId: uuid('order_id')
      .notNull()
      .unique()
      .references(() => orders.id),
    riskScore: integer('risk_score').notNull(),
    riskBand: riskBandEnum('risk_band').notNull(),
    evidence: jsonb('evidence').notNull(),
    identitySignals: jsonb('identity_signals'),
    financialImpact: jsonb('financial_impact'),
    status: caseStatusEnum('status').notNull().default('open'),
    priority: casePriorityEnum('priority').notNull().default('normal'),
    assignedTo: uuid('assigned_to').references(() => users.id),
    assignedAt: timestamp('assigned_at', { mode: 'date', withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { mode: 'date', withTimezone: true }),
    resolution: caseResolutionEnum('resolution'),
    slaDueAt: timestamp('sla_due_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cases_risk_score_idx').on(table.riskScore),
    index('cases_risk_band_idx').on(table.riskBand),
    index('cases_status_idx').on(table.status),
    index('cases_assigned_to_idx').on(table.assignedTo),
    index('cases_sla_due_idx').on(table.slaDueAt),
  ]
);

// Case comments — notes, status changes, audit trail per case
export const caseComments = pgTable(
  'case_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id),
    type: commentTypeEnum('type').notNull(),
    content: text('content'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('case_comments_case_idx').on(table.caseId)]
);

// Ingestion batches — tracks CSV uploads and API batch imports
export const ingestionBatches = pgTable('ingestion_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: batchSourceEnum('source').notNull(),
  filename: varchar('filename', { length: 255 }),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  totalRecords: integer('total_records'),
  processedRecords: integer('processed_records'),
  failedRecords: integer('failed_records'),
  status: batchStatusEnum('status').notNull().default('pending'),
  errorLog: jsonb('error_log'),
  startedAt: timestamp('started_at', { mode: 'date', withTimezone: true }),
  completedAt: timestamp('completed_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});

// Audit log — immutable compliance trail
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id'),
    changes: jsonb('changes'),
    ipAddress: inet('ip_address'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_actor_idx').on(table.actorId),
    index('audit_log_action_idx').on(table.action),
    index('audit_log_entity_idx').on(table.entityId),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  assignedCases: many(cases, { relationName: 'assignedCases' }),
  comments: many(caseComments),
  batches: many(ingestionBatches),
  auditEntries: many(auditLog),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  batch: one(ingestionBatches, { fields: [orders.batchId], references: [ingestionBatches.id] }),
  case: one(cases),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
  order: one(orders, { fields: [cases.orderId], references: [orders.id] }),
  assignee: one(users, {
    fields: [cases.assignedTo],
    references: [users.id],
    relationName: 'assignedCases',
  }),
  comments: many(caseComments),
}));

export const caseCommentsRelations = relations(caseComments, ({ one }) => ({
  case: one(cases, { fields: [caseComments.caseId], references: [cases.id] }),
  author: one(users, { fields: [caseComments.authorId], references: [users.id] }),
}));

export const ingestionBatchesRelations = relations(ingestionBatches, ({ one, many }) => ({
  uploader: one(users, { fields: [ingestionBatches.uploadedBy], references: [users.id] }),
  orders: many(orders),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorId], references: [users.id] }),
}));
