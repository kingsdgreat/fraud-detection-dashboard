import seedrandom from 'seedrandom';
import type { Order, GeneratorConfig, Channel, FraudArchetype, LegitEdgeCase } from '../types';
import { hashCode, normalizeAddress, normalizeName } from '../utils';

// ── Name / Address Pools ────────────────────────────────────────
const FIRST_NAMES = [
  'James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda',
  'David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica',
  'Thomas','Sarah','Charles','Karen','Christopher','Lisa','Daniel','Nancy',
  'Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley',
  'Steven','Dorothy','Andrew','Kimberly','Paul','Emily','Joshua','Donna',
];
const LAST_NAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
  'Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson',
  'Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson',
  'White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
];
const STREETS = [
  'Oak St','Maple Ave','Pine Dr','Cedar Ln','Elm Blvd','Walnut Ct',
  'Birch Rd','Spruce Way','Willow Dr','Ash St','Cherry Ln','Poplar Ave',
  'Hickory Dr','Cypress Ct','Magnolia Blvd','Sycamore Rd','Juniper Way',
  'Alder St','Beech Ave','Laurel Ln','Dogwood Dr','Hazel Ct','Ivy Rd',
];
const CITIES: Record<string, { cities: string[]; states: string[]; zips: string[] }> = {
  Northeast: { cities: ['Hartford','Stamford','Bridgeport','New Haven','Waterbury'], states: ['CT'], zips: ['06101','06902','06604','06510','06702'] },
  Southeast: { cities: ['Charlotte','Raleigh','Durham','Greensboro','Winston-Salem'], states: ['NC'], zips: ['28202','27601','27701','27401','27101'] },
  Midwest: { cities: ['Columbus','Cleveland','Cincinnati','Dayton','Akron'], states: ['OH'], zips: ['43215','44113','45202','45402','44308'] },
  West: { cities: ['Los Angeles','San Diego','San Jose','Fresno','Sacramento'], states: ['CA'], zips: ['90012','92101','95113','93721','95814'] },
  Southwest: { cities: ['Dallas','Austin','San Antonio','Houston','Fort Worth'], states: ['TX'], zips: ['75201','78701','78205','77002','76102'] },
};
const PROMO_NAMES = [
  'New Connect $49.99/mo','Triple Play Intro $59.99/mo','Internet Essentials $39.99/mo',
  'Premium Bundle $79.99/mo','Stream Starter $44.99/mo','Family Value Pack $54.99/mo',
];
const DISCONNECT_REASONS = ['Non-payment','Customer request','Seasonal','Moved','Service issue','Price'];
const COMPANIES = [
  { code: 'SCA', name: 'SmartConnect Authorized' },
  { code: 'PDS', name: 'Premier Door Sales' },
  { code: 'NRG', name: 'NRG Retail Group' },
  { code: 'TLS', name: 'TeleSales National' },
  { code: 'ACS', name: 'ACS Partners' },
  { code: 'DVS', name: 'DigiVision Sales' },
  { code: 'BCS', name: 'BrightConnect Solutions' },
  { code: 'FSI', name: 'FiberStar Inc' },
  { code: 'WVS', name: 'WaveLink Services' },
  { code: 'NCG', name: 'NetConnect Group' },
  { code: 'CSL', name: 'CableStar LLC' },
  { code: 'TPI', name: 'TechPoint Inc' },
  { code: 'INT', name: 'Spectrum Internal' },
  { code: 'RET', name: 'Spectrum Retention' },
  { code: 'ONL', name: 'Spectrum Online' },
];

const CHANNELS: Channel[] = [
  'third_party_door_to_door','third_party_retail','third_party_telemarketing',
  'internal_online','internal_call_center','retention',
];
const THIRD_PARTY_CHANNELS: Channel[] = ['third_party_door_to_door','third_party_retail','third_party_telemarketing'];
const INTERNAL_CHANNELS: Channel[] = ['internal_online','internal_call_center','retention'];

function pick<T>(rng: seedrandom.PRNG, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(rng: seedrandom.PRNG, arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}

function randInt(rng: seedrandom.PRNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randDate(rng: seedrandom.PRNG, start: string, end: string): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + rng() * (e - s)).toISOString().split('T')[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function generateAddress(rng: seedrandom.PRNG, region: string) {
  const num = randInt(rng, 100, 9999);
  const street = pick(rng, STREETS);
  const geo = CITIES[region];
  const cityIdx = Math.floor(rng() * geo.cities.length);
  return {
    address: `${num} ${street}`,
    city: geo.cities[cityIdx],
    state: geo.states[0],
    zip: geo.zips[cityIdx],
  };
}

function generateIdentity(rng: seedrandom.PRNG, name: string, extra?: Partial<Record<string, string>>) {
  const base = hashCode(name + rng().toString());
  return {
    phoneHash: extra?.phoneHash || `ph_${base.slice(0, 8)}`,
    emailHash: extra?.emailHash || `em_${base.slice(0, 8)}`,
    paymentMethodHash: extra?.paymentMethodHash || `pm_${base.slice(0, 8)}`,
    equipmentSerialHistory: extra?.equipmentSerialHistory
      ? [extra.equipmentSerialHistory]
      : [`EQ${randInt(rng, 100000, 999999)}`],
  };
}

function makeAgentCode(rng: seedrandom.PRNG, companyCode: string, idx: number): string {
  return `${companyCode}-${String(idx).padStart(3, '0')}`;
}

// ── Main Generator ──────────────────────────────────────────────
export function generateOrders(config: Partial<GeneratorConfig> = {}): Order[] {
  const cfg: GeneratorConfig = {
    orderCount: config.orderCount ?? 1500,
    seed: config.seed ?? 'DEMO_SEED',
    overallFraudRate: config.overallFraudRate ?? 0.10,
    thirdPartyFraudRate: config.thirdPartyFraudRate ?? 0.50,
    internalFraudRate: config.internalFraudRate ?? 0.02,
    dateRangeStart: config.dateRangeStart ?? '2024-01-01',
    dateRangeEnd: config.dateRangeEnd ?? '2024-06-30',
    regions: config.regions ?? ['Northeast','Southeast','Midwest','West','Southwest'],
    agentCount: config.agentCount ?? 80,
    companyCount: config.companyCount ?? 15,
  };

  const rng = seedrandom(cfg.seed);
  const orders: Order[] = [];

  // Build agent pool
  const usedCompanies = COMPANIES.slice(0, Math.min(cfg.companyCount, COMPANIES.length));
  const agents: { code: string; companyCode: string; companyName: string; channel: Channel }[] = [];
  for (let i = 0; i < cfg.agentCount; i++) {
    const company = usedCompanies[i % usedCompanies.length];
    const isInternal = ['INT','RET','ONL'].includes(company.code);
    const channel = isInternal ? pick(rng, INTERNAL_CHANNELS) : pick(rng, THIRD_PARTY_CHANNELS);
    agents.push({
      code: makeAgentCode(rng, company.code, i),
      companyCode: company.code,
      companyName: company.name,
      channel,
    });
  }

  // Fraud archetype distribution weights
  const archetypeWeights: { archetype: FraudArchetype; weight: number }[] = [
    { archetype: 'same_customer_same_address', weight: 0.25 },
    { archetype: 'same_customer_new_address', weight: 0.15 },
    { archetype: 'fake_name_same_address', weight: 0.15 },
    { archetype: 'delinquent_balance_bypass', weight: 0.12 },
    { archetype: 'promo_reset_after_disconnect', weight: 0.12 },
    { archetype: 'equipment_swap_reconnect', weight: 0.08 },
    { archetype: 'agent_company_cluster', weight: 0.08 },
    { archetype: 'internal_retention_edge', weight: 0.05 },
  ];

  const legitEdgeCaseWeights: { edgeCase: LegitEdgeCase; weight: number }[] = [
    { edgeCase: 'actual_move', weight: 0.25 },
    { edgeCase: 'new_tenant', weight: 0.25 },
    { edgeCase: 'customer_returns_normal_gap', weight: 0.20 },
    { edgeCase: 'retention_save', weight: 0.15 },
    { edgeCase: 'shared_building_false_positive', weight: 0.15 },
  ];

  function pickWeighted<T>(rng: seedrandom.PRNG, items: { weight: number }[] & { [K: number]: T }): T {
    const total = (items as { weight: number }[]).reduce((s, i) => s + i.weight, 0);
    let r = rng() * total;
    for (const item of items) {
      r -= (item as { weight: number }).weight;
      if (r <= 0) return item as T;
    }
    return items[items.length - 1] as T;
  }

  // Pick a weighted archetype
  function pickArchetype(): FraudArchetype {
    const item = pickWeighted(rng, archetypeWeights as any);
    return (item as typeof archetypeWeights[0]).archetype;
  }

  function pickLegitEdge(): LegitEdgeCase {
    const item = pickWeighted(rng, legitEdgeCaseWeights as any);
    return (item as typeof legitEdgeCaseWeights[0]).edgeCase;
  }

  // Cluster tracking: some agents are "bad actors"
  const badAgentIndices = pickN(rng, Array.from({ length: agents.length }, (_, i) => i), Math.ceil(agents.length * 0.1));
  const badAgentSet = new Set(badAgentIndices);

  let orderId = 1;

  function baseOrder(region: string, agent: typeof agents[0], date: string): Omit<Order, '_isFraud' | '_archetype' | '_legitEdgeCase'> {
    const customerName = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
    const addr = generateAddress(rng, region);
    const promo = pick(rng, PROMO_NAMES);
    const promoAmount = parseFloat(promo.match(/\$(\d+\.\d+)/)?.[1] || '49.99');
    return {
      id: `ORD-${String(orderId++).padStart(6, '0')}`,
      orderDate: date,
      customerName,
      normalizedName: normalizeName(customerName),
      address: addr.address,
      normalizedAddress: normalizeAddress(addr.address),
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      region,
      channel: agent.channel,
      agentCode: agent.code,
      companyCode: agent.companyCode,
      companyName: agent.companyName,
      accountNumber: `ACCT${randInt(rng, 100000000, 999999999)}`,
      newPromoBillAmount: promoAmount,
      promoName: promo,
      commissionAmount: randInt(rng, 80, 250),
      monthlyRecurring: promoAmount,
      identitySignals: generateIdentity(rng, customerName),
    };
  }

  // ── Generate fraud cases ────────────────────────────────────
  const thirdPartyAgents = agents.filter((_, i) => {
    const a = agents[i];
    return a.channel.startsWith('third_party');
  });
  const internalAgents = agents.filter(a => !a.channel.startsWith('third_party'));

  // Calculate target counts per channel type
  const thirdPartyCount = Math.round(cfg.orderCount * 0.6);
  const internalCount = cfg.orderCount - thirdPartyCount;
  const thirdPartyFraudCount = Math.round(thirdPartyCount * cfg.thirdPartyFraudRate);
  const internalFraudCount = Math.round(internalCount * cfg.internalFraudRate);
  const totalFraudCount = thirdPartyFraudCount + internalFraudCount;
  const legitEdgeCaseCount = Math.round(cfg.orderCount * 0.05); // 5% are tricky legit cases
  const cleanCount = cfg.orderCount - totalFraudCount - legitEdgeCaseCount;

  // Generate fraud orders
  for (let i = 0; i < thirdPartyFraudCount; i++) {
    const archetype = pickArchetype();
    if (archetype === 'internal_retention_edge' && thirdPartyAgents.length > 0) {
      // Re-pick for third party
      orders.push(generateFraudOrder(rng, cfg, pick(rng, thirdPartyAgents), 'same_customer_same_address'));
    } else {
      orders.push(generateFraudOrder(rng, cfg, pick(rng, thirdPartyAgents.length ? thirdPartyAgents : agents), archetype));
    }
  }

  for (let i = 0; i < internalFraudCount; i++) {
    orders.push(generateFraudOrder(rng, cfg, pick(rng, internalAgents.length ? internalAgents : agents), 'internal_retention_edge'));
  }

  // Generate legit edge cases
  for (let i = 0; i < legitEdgeCaseCount; i++) {
    const edgeCase = pickLegitEdge();
    const agent = pick(rng, agents);
    orders.push(generateLegitEdgeCase(rng, cfg, agent, edgeCase));
  }

  // Generate companion disconnect orders for fake-name fraud cases.
  // These represent the original account that was disconnected before
  // the agent submitted a new order under a different name.
  const fakeNameOrders = orders.filter(o => o._archetype === 'fake_name_same_address');
  for (const fraudOrder of fakeNameOrders) {
    if (!fraudOrder.disconnectDate) continue;
    const originalName = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
    const companionOrder: Order = {
      id: `ORD-${String(orderId++).padStart(6, '0')}`,
      orderDate: addDays(fraudOrder.disconnectDate, -randInt(rng, 30, 180)), // Original order was placed months before
      customerName: originalName,
      normalizedName: normalizeName(originalName),
      address: fraudOrder.address,
      normalizedAddress: fraudOrder.normalizedAddress,
      city: fraudOrder.city,
      state: fraudOrder.state,
      zip: fraudOrder.zip,
      region: fraudOrder.region,
      channel: pick(rng, INTERNAL_CHANNELS), // Original was likely internal
      agentCode: makeAgentCode(rng, 'INT', randInt(rng, 50, 79)),
      companyCode: 'INT',
      companyName: 'Spectrum Internal',
      accountNumber: fraudOrder.priorAccountNumber || `ACCT${randInt(rng, 100000000, 999999999)}`,
      disconnectDate: fraudOrder.disconnectDate,
      disconnectReason: fraudOrder.disconnectReason || 'Non-payment',
      daysSinceDisconnect: 0,
      priorBillAmount: undefined,
      newPromoBillAmount: randInt(rng, 80, 180),
      commissionAmount: 0,
      monthlyRecurring: randInt(rng, 80, 180),
      identitySignals: {
        phoneHash: fraudOrder.identitySignals.phoneHash, // Same phone as fraud order
        emailHash: `em_${hashCode(originalName).slice(0, 8)}`,
        paymentMethodHash: fraudOrder.identitySignals.paymentMethodHash, // Same payment method
        equipmentSerialHistory: fraudOrder.identitySignals.equipmentSerialHistory,
      },
      _isFraud: false,
      _isCompanion: true,
      _archetype: undefined,
      _legitEdgeCase: undefined,
    };
    orders.push(companionOrder);
  }

  // Also generate companion disconnect orders for same_customer_same_address
  const sameAddrOrders = orders.filter(o => o._archetype === 'same_customer_same_address');
  for (const fraudOrder of sameAddrOrders) {
    if (!fraudOrder.disconnectDate) continue;
    const companionOrder: Order = {
      id: `ORD-${String(orderId++).padStart(6, '0')}`,
      orderDate: addDays(fraudOrder.disconnectDate, -randInt(rng, 30, 180)),
      customerName: fraudOrder.customerName,
      normalizedName: fraudOrder.normalizedName,
      address: fraudOrder.address,
      normalizedAddress: fraudOrder.normalizedAddress,
      city: fraudOrder.city,
      state: fraudOrder.state,
      zip: fraudOrder.zip,
      region: fraudOrder.region,
      channel: pick(rng, INTERNAL_CHANNELS),
      agentCode: makeAgentCode(rng, 'INT', randInt(rng, 50, 79)),
      companyCode: 'INT',
      companyName: 'Spectrum Internal',
      accountNumber: fraudOrder.priorAccountNumber || `ACCT${randInt(rng, 100000000, 999999999)}`,
      disconnectDate: fraudOrder.disconnectDate,
      disconnectReason: fraudOrder.disconnectReason || 'Customer request',
      daysSinceDisconnect: 0,
      commissionAmount: 0,
      monthlyRecurring: randInt(rng, 80, 180),
      identitySignals: {
        ...fraudOrder.identitySignals,
      },
      _isFraud: false,
      _isCompanion: true,
      _archetype: undefined,
      _legitEdgeCase: undefined,
    };
    orders.push(companionOrder);
  }

  // Generate clean orders
  for (let i = 0; i < cleanCount; i++) {
    const agent = pick(rng, agents);
    const region = pick(rng, cfg.regions);
    const date = randDate(rng, cfg.dateRangeStart, cfg.dateRangeEnd);
    const order = baseOrder(region, agent, date);
    orders.push({
      ...order,
      _isFraud: false,
      _archetype: undefined,
      _legitEdgeCase: undefined,
    } as Order);
  }

  // Shuffle deterministically
  orders.sort(() => rng() - 0.5);

  // Assign cluster behavior to bad agents (boost their orders)
  for (const order of orders) {
    const agentIdx = agents.findIndex(a => a.code === order.agentCode);
    if (badAgentSet.has(agentIdx) && !order._isFraud && rng() < 0.3) {
      // Some orders from bad agents look slightly suspicious but aren't fraud
    }
  }

  return orders;
}

function generateFraudOrder(
  rng: seedrandom.PRNG,
  cfg: GeneratorConfig,
  agent: { code: string; companyCode: string; companyName: string; channel: Channel },
  archetype: FraudArchetype
): Order {
  const region = pick(rng, cfg.regions);
  const disconnectDate = randDate(rng, cfg.dateRangeStart, addDays(cfg.dateRangeEnd, -60));
  const daysSinceDisconnect = randInt(rng, 1, archetype === 'agent_company_cluster' ? 45 : 21);
  const orderDate = addDays(disconnectDate, daysSinceDisconnect);
  const customerName = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
  const addr = generateAddress(rng, region);
  const priorBill = randInt(rng, 80, 220);
  const promo = pick(rng, PROMO_NAMES);
  const promoAmount = parseFloat(promo.match(/\$(\d+\.\d+)/)?.[1] || '49.99');
  const priorAcct = `ACCT${randInt(rng, 100000000, 999999999)}`;
  const baseIdentity = generateIdentity(rng, customerName);
  const equipSerial = `EQ${randInt(rng, 100000, 999999)}`;

  const base: Partial<Order> = {
    id: `ORD-${String(Math.floor(rng() * 900000) + 100000).padStart(6, '0')}`,
    orderDate,
    customerName,
    normalizedName: normalizeName(customerName),
    address: addr.address,
    normalizedAddress: normalizeAddress(addr.address),
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    region,
    channel: agent.channel,
    agentCode: agent.code,
    companyCode: agent.companyCode,
    companyName: agent.companyName,
    accountNumber: `ACCT${randInt(rng, 100000000, 999999999)}`,
    priorAccountNumber: priorAcct,
    priorBillAmount: priorBill,
    newPromoBillAmount: promoAmount,
    promoName: promo,
    disconnectDate,
    disconnectReason: pick(rng, DISCONNECT_REASONS),
    daysSinceDisconnect,
    commissionAmount: randInt(rng, 100, 280),
    monthlyRecurring: promoAmount,
    _isFraud: true,
    _archetype: archetype,
    _legitEdgeCase: undefined,
  };

  switch (archetype) {
    case 'same_customer_same_address':
      base.identitySignals = {
        ...baseIdentity,
        equipmentSerialHistory: [equipSerial],
      };
      base.equipmentSerials = [equipSerial];
      break;

    case 'same_customer_new_address': {
      const newAddr = generateAddress(rng, region);
      base.address = newAddr.address;
      base.normalizedAddress = normalizeAddress(newAddr.address);
      base.city = newAddr.city;
      base.zip = newAddr.zip;
      // Identity signals match
      base.identitySignals = {
        ...baseIdentity,
        equipmentSerialHistory: [equipSerial],
      };
      break;
    }

    case 'fake_name_same_address': {
      // Slightly altered name
      const fakeName = `${pick(rng, FIRST_NAMES)} ${customerName.split(' ')[1]}`;
      base.customerName = fakeName;
      base.normalizedName = normalizeName(fakeName);
      // Same address, some identity signals match
      base.identitySignals = {
        phoneHash: baseIdentity.phoneHash,
        emailHash: `em_${hashCode(fakeName).slice(0, 8)}`, // Different email
        paymentMethodHash: baseIdentity.paymentMethodHash, // Same payment
        equipmentSerialHistory: [equipSerial],
      };
      break;
    }

    case 'delinquent_balance_bypass':
      base.delinquentBalance = randInt(rng, 150, 800);
      base.disconnectReason = 'Non-payment';
      base.identitySignals = {
        ...baseIdentity,
        equipmentSerialHistory: [equipSerial],
      };
      break;

    case 'promo_reset_after_disconnect':
      base.priorBillAmount = randInt(rng, 120, 250);
      base.newPromoBillAmount = promoAmount;
      base.identitySignals = {
        ...baseIdentity,
        equipmentSerialHistory: [equipSerial],
      };
      break;

    case 'equipment_swap_reconnect': {
      const oldSerial = `EQ${randInt(rng, 100000, 999999)}`;
      const newSerial = `EQ${randInt(rng, 100000, 999999)}`;
      base.equipmentSerials = [newSerial];
      base.identitySignals = {
        ...baseIdentity,
        equipmentSerialHistory: [oldSerial, newSerial],
      };
      break;
    }

    case 'agent_company_cluster':
      base.daysSinceDisconnect = randInt(rng, 5, 30);
      base.identitySignals = {
        ...baseIdentity,
        equipmentSerialHistory: [equipSerial],
      };
      break;

    case 'internal_retention_edge':
      base.channel = pick(rng, ['retention', 'internal_call_center'] as Channel[]);
      base.daysSinceDisconnect = randInt(rng, 1, 14);
      base.disconnectReason = 'Customer request';
      base.identitySignals = {
        ...baseIdentity,
        equipmentSerialHistory: [equipSerial],
      };
      break;
  }

  return base as Order;
}

function generateLegitEdgeCase(
  rng: seedrandom.PRNG,
  cfg: GeneratorConfig,
  agent: { code: string; companyCode: string; companyName: string; channel: Channel },
  edgeCase: LegitEdgeCase
): Order {
  const region = pick(rng, cfg.regions);
  const orderDate = randDate(rng, cfg.dateRangeStart, cfg.dateRangeEnd);
  const customerName = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
  const addr = generateAddress(rng, region);
  const promo = pick(rng, PROMO_NAMES);
  const promoAmount = parseFloat(promo.match(/\$(\d+\.\d+)/)?.[1] || '49.99');
  const identity = generateIdentity(rng, customerName);

  const base: Partial<Order> = {
    id: `ORD-${String(Math.floor(rng() * 900000) + 100000).padStart(6, '0')}`,
    orderDate,
    customerName,
    normalizedName: normalizeName(customerName),
    address: addr.address,
    normalizedAddress: normalizeAddress(addr.address),
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    region,
    channel: agent.channel,
    agentCode: agent.code,
    companyCode: agent.companyCode,
    companyName: agent.companyName,
    accountNumber: `ACCT${randInt(rng, 100000000, 999999999)}`,
    newPromoBillAmount: promoAmount,
    promoName: promo,
    commissionAmount: randInt(rng, 80, 200),
    monthlyRecurring: promoAmount,
    identitySignals: identity,
    _isFraud: false,
    _archetype: undefined,
    _legitEdgeCase: edgeCase,
  };

  switch (edgeCase) {
    case 'actual_move': {
      // Customer with prior account at different address, 30-90 day gap
      const disconnectDate = addDays(orderDate, -randInt(rng, 30, 90));
      const newAddr = generateAddress(rng, pick(rng, cfg.regions));
      base.address = newAddr.address;
      base.normalizedAddress = normalizeAddress(newAddr.address);
      base.city = newAddr.city;
      base.state = newAddr.state;
      base.zip = newAddr.zip;
      base.disconnectDate = disconnectDate;
      base.daysSinceDisconnect = randInt(rng, 30, 90);
      base.priorAccountNumber = `ACCT${randInt(rng, 100000000, 999999999)}`;
      base.disconnectReason = 'Moved';
      break;
    }
    case 'new_tenant': {
      // Different person at address that recently had a disconnect
      base.disconnectDate = addDays(orderDate, -randInt(rng, 5, 30));
      base.daysSinceDisconnect = randInt(rng, 5, 30);
      // Completely different identity
      base.identitySignals = generateIdentity(rng, customerName + '_new');
      break;
    }
    case 'customer_returns_normal_gap':
      base.disconnectDate = addDays(orderDate, -randInt(rng, 90, 365));
      base.daysSinceDisconnect = randInt(rng, 90, 365);
      base.disconnectReason = 'Customer request';
      base.priorAccountNumber = `ACCT${randInt(rng, 100000000, 999999999)}`;
      break;
    case 'retention_save':
      base.channel = 'retention' as Channel;
      base.disconnectDate = addDays(orderDate, -randInt(rng, 0, 3));
      base.daysSinceDisconnect = randInt(rng, 0, 3);
      base.disconnectReason = 'Customer request';
      base.priorBillAmount = randInt(rng, 100, 200);
      break;
    case 'shared_building_false_positive':
      // Same or similar address, different person entirely
      base.daysSinceDisconnect = randInt(rng, 3, 20);
      base.disconnectDate = addDays(orderDate, -(base.daysSinceDisconnect || 10));
      base.address = `${randInt(rng, 100, 999)} ${pick(rng, STREETS)} APT ${randInt(rng, 1, 20)}`;
      base.normalizedAddress = normalizeAddress(base.address);
      base.identitySignals = generateIdentity(rng, customerName + '_building');
      break;
  }

  return base as Order;
}
