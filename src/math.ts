import { VaultConfig, HarvestResult } from "./types.js";

/**
 * ERC-4626 Tokenized Vault Mathematical Invariants
 * Implements standard virtual assets (1) and virtual shares offset to defeat
 * first-depositor inflation and donation front-running attacks.
 */
export class YieldMath {
  public static readonly BPS_DIVISOR = 10_000n;
  public static readonly DEFAULT_VIRTUAL_OFFSET = 1_000n;
  public static readonly VIRTUAL_ASSETS = 1n;

  /**
   * ERC-4626 standard convertToShares:
   * shares = (assets * (totalShares + virtualShares)) / (totalAssets + virtualAssets)
   * Rounds DOWN (floor division)
   */
  public static convertToShares(
    assets: bigint,
    totalAssets: bigint,
    totalShares: bigint,
    virtualSharesOffset: bigint = this.DEFAULT_VIRTUAL_OFFSET
  ): bigint {
    if (assets <= 0n) return 0n;
    const numerator = assets * (totalShares + virtualSharesOffset);
    const denominator = totalAssets + this.VIRTUAL_ASSETS;
    return numerator / denominator;
  }

  /**
   * ERC-4626 standard convertToAssets:
   * assets = (shares * (totalAssets + virtualAssets)) / (totalShares + virtualShares)
   * Rounds DOWN (floor division)
   */
  public static convertToAssets(
    shares: bigint,
    totalAssets: bigint,
    totalShares: bigint,
    virtualSharesOffset: bigint = this.DEFAULT_VIRTUAL_OFFSET
  ): bigint {
    if (shares <= 0n) return 0n;
    const numerator = shares * (totalAssets + this.VIRTUAL_ASSETS);
    const denominator = totalShares + virtualSharesOffset;
    return numerator / denominator;
  }

  /**
   * ERC-4626 previewDeposit:
   * Returns exact shares minted for assets. Rounds DOWN in favor of vault.
   */
  public static previewDeposit(
    assets: bigint,
    totalAssets: bigint,
    totalShares: bigint,
    virtualSharesOffset: bigint = this.DEFAULT_VIRTUAL_OFFSET
  ): bigint {
    return this.convertToShares(assets, totalAssets, totalShares, virtualSharesOffset);
  }

  /**
   * ERC-4626 previewMint:
   * Returns required assets to mint given shares. Rounds UP against user.
   */
  public static previewMint(
    shares: bigint,
    totalAssets: bigint,
    totalShares: bigint,
    virtualSharesOffset: bigint = this.DEFAULT_VIRTUAL_OFFSET
  ): bigint {
    if (shares <= 0n) return 0n;
    const numerator = shares * (totalAssets + this.VIRTUAL_ASSETS);
    const denominator = totalShares + virtualSharesOffset;
    return (numerator + denominator - 1n) / denominator;
  }

  /**
   * ERC-4626 previewWithdraw:
   * Returns shares to burn to withdraw given assets. Rounds UP against user.
   */
  public static previewWithdraw(
    assets: bigint,
    totalAssets: bigint,
    totalShares: bigint,
    virtualSharesOffset: bigint = this.DEFAULT_VIRTUAL_OFFSET
  ): bigint {
    if (assets <= 0n) return 0n;
    const numerator = assets * (totalShares + virtualSharesOffset);
    const denominator = totalAssets + this.VIRTUAL_ASSETS;
    return (numerator + denominator - 1n) / denominator;
  }

  /**
   * ERC-4626 previewRedeem:
   * Returns assets returned for burning shares. Rounds DOWN in favor of vault.
   */
  public static previewRedeem(
    shares: bigint,
    totalAssets: bigint,
    totalShares: bigint,
    virtualSharesOffset: bigint = this.DEFAULT_VIRTUAL_OFFSET
  ): bigint {
    return this.convertToAssets(shares, totalAssets, totalShares, virtualSharesOffset);
  }

  /**
   * Calculates share price formatted as float (1.0 = par value).
   */
  public static calculateSharePrice(
    totalAssets: bigint,
    totalShares: bigint,
    virtualSharesOffset: bigint = this.DEFAULT_VIRTUAL_OFFSET
  ): number {
    const assetsWithVirtual = totalAssets + this.VIRTUAL_ASSETS;
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
