/** BCHBooks core domain types */

export type FiatCurrency = 'USD' | 'EUR' | 'GBP' | 'ZAR' | 'MZN';

export type TxDirection = 'incoming' | 'outgoing' | 'internal';

export type TxStatus = 'confirmed' | 'unconfirmed' | 'unavailable';

export type CategoryType = 'revenue' | 'expense' | 'transfer';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  isDefault: boolean;
  createdAt: string;
}

export interface ClassificationRule {
  id: string;
  name: string;
  matchType: 'from_address' | 'to_address';
  address: string;
  categoryId: string;
  createdAt: string;
}

export interface HistoricalValuation {
  fiatAmount: number | null;
  fiatCurrency: FiatCurrency;
  exchangeRate: number | null; // BCH per 1 fiat? or fiat per 1 BCH
  rateTimestamp: string | null;
  provider: string | null;
  available: boolean;
}

export interface NormalizedTransaction {
  id: string; // txid
  address: string; // the watched address this tx belongs to
  txid: string;
  date: string; // ISO
  blockHeight: number | null;
  confirmations: number | null;
  direction: TxDirection;
  amountBch: number; // positive value; direction indicates sign for accounting
  amountSats: number;
  feeBch: number | null;
  memo: string | null;
  categoryId: string | null;
  notes: string | null;
  status: TxStatus;
  valuation: HistoricalValuation;
  counterparty: string | null; // other address if simple
  raw?: unknown; // optional technical details
  createdAt: string;
  updatedAt: string;
}

export interface WatchedAddress {
  id: string;
  address: string; // cashaddr preferred
  label: string;
  addedAt: string;
  lastScannedAt: string | null;
  balanceBch: number | null;
  totalReceivedBch: number | null;
  totalSentBch: number | null;
  txCount: number | null;
}

export interface AppPreferences {
  fiatCurrency: FiatCurrency;
  period: AccountingPeriodPreset | 'custom';
  customFrom: string | null;
  customTo: string | null;
  donationAddress: string;
}

export type AccountingPeriodPreset =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'all_time';

export interface DashboardSummary {
  periodLabel: string;
  revenueFiat: number;
  expensesFiat: number;
  netFiat: number;
  bchReceived: number;
  bchSpent: number;
  transactionCount: number;
  uncategorizedCount: number;
  transfersCount: number;
}

export interface ReportCategoryLine {
  categoryId: string;
  categoryName: string;
  type: CategoryType;
  totalFiat: number;
  totalBch: number;
  count: number;
}

export interface MonthlyReport {
  periodLabel: string;
  revenue: ReportCategoryLine[];
  expenses: ReportCategoryLine[];
  totalRevenueFiat: number;
  totalExpensesFiat: number;
  netFiat: number;
  bchReceived: number;
  bchSpent: number;
  transactionCount: number;
  transfersCount: number;
  uncategorizedCount: number;
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt'>[] = [
  { name: 'Sales', type: 'revenue', isDefault: true },
  { name: 'Services', type: 'revenue', isDefault: true },
  { name: 'Donations', type: 'revenue', isDefault: true },
  { name: 'Other income', type: 'revenue', isDefault: true },
  { name: 'Software', type: 'expense', isDefault: true },
  { name: 'Infrastructure', type: 'expense', isDefault: true },
  { name: 'Contractors', type: 'expense', isDefault: true },
  { name: 'Marketing', type: 'expense', isDefault: true },
  { name: 'Office', type: 'expense', isDefault: true },
  { name: 'Travel', type: 'expense', isDefault: true },
  { name: 'Other expense', type: 'expense', isDefault: true },
  { name: 'Internal transfer', type: 'transfer', isDefault: true },
];

export const DEFAULT_DONATION_ADDRESS =
  'bitcoincash:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqfnhks603'; // REPLACE WITH YOUR REAL BCH ADDRESS
