import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function daysBetween(a: string, b: string): number {
  const msPerDay = 86400000;
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / msPerDay
  );
}

export function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function normalizeAddress(addr: string): string {
  return addr
    .toUpperCase()
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .replace(/\bLANE\b/g, 'LN')
    .replace(/\bCOURT\b/g, 'CT')
    .replace(/\bAPARTMENT\b/g, 'APT')
    .replace(/\bSUITE\b/g, 'STE')
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function riskBandColor(band: string): string {
  switch (band) {
    case 'Critical': return 'text-red-700 bg-red-50 border-red-200';
    case 'High': return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'Medium': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'Low': return 'text-green-700 bg-green-50 border-green-200';
    default: return 'text-gray-700 bg-gray-50 border-gray-200';
  }
}

export function riskBandDot(band: string): string {
  switch (band) {
    case 'Critical': return 'bg-red-500';
    case 'High': return 'bg-orange-500';
    case 'Medium': return 'bg-yellow-500';
    case 'Low': return 'bg-green-500';
    default: return 'bg-gray-400';
  }
}

export function evidenceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    address_match: 'Address Match',
    address_disconnect_reuse: 'Address Disconnect Reuse',
    identity_match: 'Identity Match',
    agent_cluster: 'Agent/Company Cluster',
    equipment_swap: 'Equipment Swap',
    promo_reset: 'Promo Reset',
    rapid_reconnect: 'Rapid Reconnect',
    same_customer_new_address: 'Same Customer, New Address',
    delinquency_bypass: 'Delinquency Bypass',
    payment_method_reuse: 'Payment Method Reuse',
    phone_reuse: 'Phone Number Reuse',
  };
  return labels[type] || type;
}

export function archetypeLabel(type: string): string {
  const labels: Record<string, string> = {
    same_customer_same_address: 'Same Customer/Address',
    same_customer_new_address: 'Same Customer, New Address',
    fake_name_same_address: 'Fake Name / Same Address',
    delinquent_balance_bypass: 'Delinquent Balance Bypass',
    promo_reset_after_disconnect: 'Promo Reset',
    equipment_swap_reconnect: 'Equipment Swap',
    agent_company_cluster: 'Agent/Company Cluster',
    internal_retention_edge: 'Internal/Retention Edge',
  };
  return labels[type] || type;
}

export function channelLabel(ch: string): string {
  const labels: Record<string, string> = {
    third_party_door_to_door: '3P Door-to-Door',
    third_party_retail: '3P Retail',
    third_party_telemarketing: '3P Telemarketing',
    internal_online: 'Internal Online',
    internal_call_center: 'Internal Call Center',
    retention: 'Retention',
  };
  return labels[ch] || ch;
}

export function isThirdParty(channel: string): boolean {
  return channel.startsWith('third_party');
}
