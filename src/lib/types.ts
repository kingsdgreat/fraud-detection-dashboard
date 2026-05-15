import { z } from 'zod';

// ── Evidence Types ──────────────────────────────────────────────
export const EvidenceTypeEnum = z.enum([
  'address_match',
  'address_disconnect_reuse',
  'identity_match',
  'agent_cluster',
  'equipment_swap',
  'promo_reset',
  'rapid_reconnect',
  'same_customer_new_address',
  'delinquency_bypass',
  'payment_method_reuse',
  'phone_reuse',
]);
export type EvidenceType = z.infer<typeof EvidenceTypeEnum>;

export const EvidenceSchema = z.object({
  type: EvidenceTypeEnum,
  confidence: z.number().min(0).max(1),
  weight: z.number().min(0).max(1),
  details: z.record(z.string(), z.unknown()),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// ── Fraud Archetypes ────────────────────────────────────────────
export const FraudArchetypeEnum = z.enum([
  'same_customer_same_address',
  'same_customer_new_address',
  'fake_name_same_address',
  'delinquent_balance_bypass',
  'promo_reset_after_disconnect',
  'equipment_swap_reconnect',
  'agent_company_cluster',
  'internal_retention_edge',
]);
export type FraudArchetype = z.infer<typeof FraudArchetypeEnum>;

// ── Legitimate Edge Case Types ──────────────────────────────────
export const LegitEdgeCaseEnum = z.enum([
  'actual_move',
  'new_tenant',
  'customer_returns_normal_gap',
  'retention_save',
  'shared_building_false_positive',
]);
export type LegitEdgeCase = z.infer<typeof LegitEdgeCaseEnum>;

// ── Channel & Risk ──────────────────────────────────────────────
export const ChannelEnum = z.enum([
  'third_party_door_to_door',
  'third_party_retail',
  'third_party_telemarketing',
  'internal_online',
  'internal_call_center',
  'retention',
]);
export type Channel = z.infer<typeof ChannelEnum>;

export const RiskBandEnum = z.enum(['Low', 'Medium', 'High', 'Critical']);
export type RiskBand = z.infer<typeof RiskBandEnum>;

// ── Identity Signals ────────────────────────────────────────────
export const IdentitySignalsSchema = z.object({
  phoneHash: z.string().optional(),
  emailHash: z.string().optional(),
  paymentMethodHash: z.string().optional(),
  equipmentSerialHistory: z.array(z.string()).optional(),
  ssnLast4Hash: z.string().optional(),
});
export type IdentitySignals = z.infer<typeof IdentitySignalsSchema>;

// ── Order ───────────────────────────────────────────────────────
export const OrderSchema = z.object({
  id: z.string(),
  orderDate: z.string(), // ISO date
  customerName: z.string(),
  normalizedName: z.string(),
  address: z.string(),
  normalizedAddress: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  region: z.string(),
  channel: ChannelEnum,
  agentCode: z.string(),
  companyCode: z.string(),
  companyName: z.string(),
  accountNumber: z.string(),
  priorAccountNumber: z.string().optional(),
  priorBillAmount: z.number().optional(),
  newPromoBillAmount: z.number().optional(),
  promoName: z.string().optional(),
  disconnectDate: z.string().optional(), // ISO date
  disconnectReason: z.string().optional(),
  daysSinceDisconnect: z.number().optional(),
  delinquentBalance: z.number().optional(),
  equipmentSerials: z.array(z.string()).optional(),
  identitySignals: IdentitySignalsSchema,
  commissionAmount: z.number(),
  monthlyRecurring: z.number(),
  // Generator metadata (for synthetic validation)
  _isFraud: z.boolean(),
  _isCompanion: z.boolean().optional(), // Historical disconnect record, not a real new order
  _archetype: FraudArchetypeEnum.optional(),
  _legitEdgeCase: LegitEdgeCaseEnum.optional(),
});
export type Order = z.infer<typeof OrderSchema>;

// ── Scored Case ─────────────────────────────────────────────────
export const ScoredCaseSchema = z.object({
  order: OrderSchema,
  riskScore: z.number().min(0).max(100),
  riskBand: RiskBandEnum,
  evidence: z.array(EvidenceSchema),
  identityMatchCount: z.number(),
  identityMatchConfidence: z.enum(['none', 'low', 'medium', 'high']),
  commissionAtRisk: z.number(),
  mrrLoss: z.number(),
  annualizedExposure: z.number(),
  recommendedAction: z.string(),
  analystSummary: z.string(),
  similarCaseIds: z.array(z.string()),
  flagged: z.boolean(),
});
export type ScoredCase = z.infer<typeof ScoredCaseSchema>;

// ── Financial Assumptions ───────────────────────────────────────
export const FinancialAssumptionsSchema = z.object({
  avgCommission: z.number().default(150),
  recoveryProbability: z.number().min(0).max(1).default(0.15),
  avgMonthlyBill: z.number().default(120),
  avgPromoBill: z.number().default(49.99),
  annualizationMonths: z.number().default(12),
});
export type FinancialAssumptions = z.infer<typeof FinancialAssumptionsSchema>;

// ── Generator Config ────────────────────────────────────────────
export const GeneratorConfigSchema = z.object({
  orderCount: z.number().default(1500),
  seed: z.string().default('DEMO_SEED'),
  overallFraudRate: z.number().default(0.10),
  thirdPartyFraudRate: z.number().default(0.50),
  internalFraudRate: z.number().default(0.02),
  dateRangeStart: z.string().default('2024-01-01'),
  dateRangeEnd: z.string().default('2024-06-30'),
  regions: z.array(z.string()).default(['Northeast', 'Southeast', 'Midwest', 'West', 'Southwest']),
  agentCount: z.number().default(80),
  companyCount: z.number().default(15),
});
export type GeneratorConfig = z.infer<typeof GeneratorConfigSchema>;

// ── Validation Metrics ──────────────────────────────────────────
export const ValidationMetricsSchema = z.object({
  truePositives: z.number(),
  falsePositives: z.number(),
  trueNegatives: z.number(),
  falseNegatives: z.number(),
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
  totalCases: z.number(),
  flaggedCount: z.number(),
  actualFraudCount: z.number(),
});
export type ValidationMetrics = z.infer<typeof ValidationMetricsSchema>;
