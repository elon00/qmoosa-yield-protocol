import { VaultConfig, HarvestResult } from "./types.js";

export class YieldMath {
  public static readonly BPS_DIVISOR = 10_000n;
  public static readonly DEFAULT_VIRTUAL_OFFSET = 1_000n;

  /**
   * ERC-4626 standard convertToShares:
   * shares = ((assets + 1) * (totalShares + virtualShares)) / (totalAssets + 1)
   */
  public static convertToShares(
    assets: bigint,
    totalAssets: bigint,
    totalShares: bigint,
    virtualSharesOffset: bigint = this.DEFAULT_VIRTUAL_OFFSET
  ): bigint {
    if (assets <= 0n) return 0n;
    const numerator = (assets + 1n) * (totalShares + virtualSharesOffset);
    const denominator = totalAssets + 1n;
    return numerator / denominator;
  }

  /**
   * ERC-4626 standard convertToAssets:
   * assets = (shares * (totalAssets + 1)) / (totalShares + virtualShares)
   */
  public static convertToAssets(
    shares: bigint,
    totalAssets: bigint,
    totalShares: bigint,
    virtualSharesOffset: bigint = this.DEFAULT_VIRTUAL_OFFSET
  ): bigint {
    if (shares <= 0n) return 0n;
    const numerator = shares * (totalAssets + 1n);
    const denominator = totalShares + virtualSharesOffset;
    return numerator / denominator;
  }

  /**
   * Calculates share price formatted as float (1.0 = par value).
   */
  public static calculateSharePrice(
    totalAssets: bigint,
    totalShares: bigint,
    virtualSharesOffset: bigint = this.DEFAULT_VIRTUAL_OFFSET
  ): number {
    const assetsWithVirtual = totalAssets + 1n;
    const sharesWithVirtual = totalShares + virtualSharesOffset;
    return Number((assetsWithVirtual * 10_000n) / sharesWithVirtual) / 10_000;
  }

  /**
   * Processes harvest profit and applies performance fee.
   */
  public static processHarvest(
    grossProfitUsd: bigint,
    totalAssetsBefore: bigint,
    totalShares: bigint,
    performanceFeeBps: number
  ): HarvestResult {
    if (grossProfitUsd <= 0n) {
      return {
        grossProfitUsd: 0n,
        performanceFeeUsd: 0n,
        netProfitUsd: 0n,
        totalAssetsAfter: totalAssetsBefore,
        sharePriceAfter: this.calculateSharePrice(totalAssetsBefore, totalShares)
      };
    }

    const performanceFeeUsd = (grossProfitUsd * BigInt(performanceFeeBps)) / this.BPS_DIVISOR;
    const netProfitUsd = grossProfitUsd - performanceFeeUsd;
    const totalAssetsAfter = totalAssetsBefore + netProfitUsd;

    return {
      grossProfitUsd,
      performanceFeeUsd,
      netProfitUsd,
      totalAssetsAfter,
      sharePriceAfter: this.calculateSharePrice(totalAssetsAfter, totalShares)
    };
  }
}
