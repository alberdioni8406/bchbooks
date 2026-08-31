/**
 * Basic BCH address validation helpers.
 * Accepts CashAddr (preferred) and legacy formats.
 * Full cryptographic validation is left to the provider.
 */

const CASHADDR_PREFIX = 'bitcoincash:';
const LEGACY_REGEX = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const CASHADDR_REGEX = /^(bitcoincash:)?[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{42,}$/i;

export function normalizeAddress(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase().startsWith(CASHADDR_PREFIX)) {
    return trimmed.toLowerCase();
  }
  // If it looks like cashaddr without prefix, add it
  if (/^[qp][a-z0-9]{41,}$/i.test(trimmed)) {
    return `${CASHADDR_PREFIX}${trimmed.toLowerCase()}`;
  }
  return trimmed;
}

export function isValidBchAddressFormat(input: string): boolean {
  const a = input.trim();
  if (!a) return false;
  if (LEGACY_REGEX.test(a)) return true;
  if (CASHADDR_REGEX.test(a)) return true;
  return false;
}

export function shortAddress(addr: string, chars = 6): string {
  const a = addr.replace(CASHADDR_PREFIX, '');
  if (a.length <= chars * 2 + 3) return addr;
  return `${a.slice(0, chars)}…${a.slice(-chars)}`;
}
