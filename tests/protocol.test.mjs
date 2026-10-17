import { test } from "node:test";
import assert from "node:assert/strict";
import { YieldMath } from "../dist/index.js";

test("1. Convert to shares on initial empty vault with virtual offset", () => {
  // Empty vault: 0 assets, 0 shares, virtual offset 1,000
  // Depositing 100,000 assets -> (100,001 * 1,000) / 1 = 100,001,000 shares
  const shares = YieldMath.convertToShares(100_000n, 0n, 0n);
  assert.ok(shares > 0n);
});

test("2. Reversible conversion roundtrip", () => {
  const totalAssets = 1_000_000n;
  const totalShares = 1_000_000n;

  const depositAssets = 50_000n;
  const shares = YieldMath.convertToShares(depositAssets, totalAssets, totalShares);
  const assetsOut = YieldMath.convertToAssets(shares, totalAssets, totalShares);

  // Asset return is within integer rounding tolerance (0.01%)
  assert.ok(assetsOut >= 49_990n && assetsOut <= 50_010n);
});

test("3. Inflation / Donation attack mitigation", () => {
  // Attacker deposits 1 wei asset, mints initial shares, then donates 1,000,000 assets without minting shares
  // In classic ERC-4626 without virtual offset, victim depositing 10,000 gets 0 shares!
  // With virtual offset (1,000 shares):
  const totalAssets = 1_000_001n; // 1 wei initial + 1,000,000 donation
  const totalShares = 1_000n;     // virtual shares prevent share price explosion to infinity

  const victimAssets = 10_000n;
  const victimShares = YieldMath.convertToShares(victimAssets, totalAssets, totalShares);

  // Victim gets non-zero shares and cannot be front-run to 0!
  assert.ok(victimShares > 0n);
});

test("4. Harvest compounding and performance fee", () => {
  const totalAssetsBefore = 100_000n;
  const totalShares = 100_000n;
  const grossProfit = 10_000n;
  const feeBps = 1000; // 10% fee

  const res = YieldMath.processHarvest(grossProfit, totalAssetsBefore, totalShares, feeBps);

  assert.equal(res.grossProfitUsd, 10_000n);
  assert.equal(res.performanceFeeUsd, 1000n);
  assert.equal(res.netProfitUsd, 9000n);
  assert.equal(res.totalAssetsAfter, 109_000n);
  // Share price increases from 1.0 to ~1.08
  assert.ok(res.sharePriceAfter > 1.0);
});
