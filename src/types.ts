export interface VaultConfig {
  vaultAddress: string;
  underlyingAsset: string;
  decimals: number;
  performanceFeeBps: number; // e.g. 1000 = 10%
  managementFeeBps: number;  // e.g. 200 = 2%
  maxCapacityUsd: bigint;
  virtualSharesOffset: bigint; // e.g. 1000n to defeat inflation attack
}

export interface HarvestResult {
  grossProfitUsd: bigint;
  performanceFeeUsd: bigint;
  netProfitUsd: bigint;
  totalAssetsAfter: bigint;
  sharePriceAfter: number;
}
