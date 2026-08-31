/** Provider interface – BCHBooks never talks to a specific API directly from the accounting layer */

export interface ProviderTx {
  txid: string;
  blockHeight: number | null;
  blockTime: number | null; // unix seconds
  confirmations: number | null;
  feeSats: number | null;
  vin: Array<{
    address: string | null;
    valueSats: number | null;
    isCoinbase?: boolean;
  }>;
  vout: Array<{
    address: string | null;
    valueSats: number;
    n: number;
  }>;
  memo?: string | null;
}

export interface ProviderAddressInfo {
  address: string;
  balanceSats: number;
  totalReceivedSats: number;
  totalSentSats: number;
  txCount: number;
  unconfirmedBalanceSats?: number;
}

export interface BchProvider {
  name: string;
  getAddressInfo(address: string): Promise<ProviderAddressInfo>;
  getAddressTransactions(
    address: string,
    options?: { limit?: number; afterTxid?: string }
  ): Promise<ProviderTx[]>;
  getTransaction?(txid: string): Promise<ProviderTx | null>;
}
