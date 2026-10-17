import { test } from "node:test";
import assert from "node:assert/strict";
import { YieldMath } from "../dist/index.js";

test("1. Exact-value single-unit deposit (regression test for numerator bug)", () => {
  // Empty vault: 0 assets, 0 shares, virtual offset 1,000, virtual asset 1
  // Expected: (1 * 1000) / (0 + 1) = 1,000 shares
  // Buggy code calculated: (1 + 1) * 1000 / 1 = 2,000 shares (100% overcredit)
  const sharesForOneAsset = YieldMath.convertToShares(1n, 0n, 0n);
  assert.equal(sharesForOneAsset, 1000n, "Single unit deposit must not be over-credited");

  // Depositing 100 assets: (100 * 1000) / 1 = 100,000 shares
  const sharesFor100Assets = YieldMath.convertToShares(100n, 0n, 0n);
  assert.equal(sharesFor100Assets, 100_000n);
});

test("2. Preview functions consistency and rounding invariants", () => {
  const totalAssets = 10_000n;
  const totalShares = 10_000n;

  // previewDeposit rounds down in favor of vault
  const depositAssets = 333n;
  const sharesOut = YieldMath.previewDeposit(depositAssets, totalAssets, totalShares);
  assert.equal(sharesOut, YieldMath.convertToShares(depositAssets, totalAssets, totalShares));

  // previewMint rounds up (assets required >= assets from convertToAssets)
  const targetShares = 333n;
  const assetsRequired = YieldMath.previewMint(targetShares, totalAssets, totalShares);
  const assetsConverted = YieldMath.convertToAssets(targetShares, totalAssets, totalShares);
  assert.ok(assetsRequired >= assetsConverted, "previewMint must round up against user");

  // previewWithdraw rounds up (shares burned >= shares from convertToShares)
  const targetWithdrawAssets = 500n;
  const sharesRequired = YieldMath.previewWithdraw(targetWithdrawAssets, totalAssets, totalShares);
  const sharesConverted = YieldMath.convertToShares(targetWithdrawAssets, totalAssets, totalShares);
  assert.ok(sharesRequired >= sharesConverted, "previewWithdraw must round up against user");

  // previewRedeem rounds down
  const redeemShares = 500n;
  const redeemAssets = YieldMath.previewRedeem(redeemShares, totalAssets, totalShares);
  assert.equal(redeemAssets, YieldMath.convertToAssets(redeemShares, totalAssets, totalShares));
});

test("3. Multiple depositors with exact share conservation", () => {
  let totalAssets = 0n;
  let totalShares = 0n;

  // Alice deposits 1,000 assets into empty vault
  const aliceAssets = 1000n;
  const aliceShares = YieldMath.convertToShares(aliceAssets, totalAssets, totalShares);
  assert.equal(aliceShares, 1_000_000n); // (1000 * 1000) / 1
  totalAssets += aliceAssets;
  totalShares += aliceShares;

  // Bob deposits 2,000 assets into now-populated vault
  // (2000 * (1,000,000 + 1000)) / (1000 + 1) = (2000 * 1,001,000) / 1001 = 2,000,000 shares
  const bobAssets = 2000n;
  const bobShares = YieldMath.convertToShares(bobAssets, totalAssets, totalShares);
  assert.equal(bobShares, 2_000_000n);
  totalAssets += bobAssets;
  totalShares += bobShares;

  // Share ratio between Bob and Alice must exactly equal 2:1
  assert.equal(bobShares / aliceShares, 2n);
  assert.equal(totalAssets, 3000n);
  assert.equal(totalShares, 3_000_000n);
});

test("4. Inflation / Donation attack mitigation with exact bounds", () => {
  // Attacker deposits 1 wei asset, mints initial shares, then donates 1,000,000 assets without minting shares
  let totalAssets = 1n;
  let totalShares = 1000n; // Attacker has 1,000 shares for 1 wei

  // Attacker donates 1,000,000 assets
  totalAssets += 1_000_000n; // totalAssets = 1,000,001

  // Victim deposits 50,000 assets
  // In vulnerable ERC-4626 without virtual offset, victim gets 0 shares!
  // With virtual offset (1,000 shares):
  // numerator = 50,000 * (1000 + 1000) = 100,000,000
  // denominator = 1,000,001 + 1 = 1,000,002
  // shares = 100,000,000 / 1,000,002 = 99 shares (positive non-zero, front-running defeated)
  const victimAssets = 50_000n;
  const victimShares = YieldMath.convertToShares(victimAssets, totalAssets, totalShares);

  assert.ok(victimShares > 0n, "Victim must receive non-zero shares");
  assert.equal(victimShares, 99n);
});

test("5. Full withdrawal and share-conservation property", () => {
  let totalAssets = 500_000n;
  let totalShares = 500_000n;

  const depositAssets = 10_000n;
  const shares = YieldMath.convertToShares(depositAssets, totalAssets, totalShares);
  totalAssets += depositAssets;
  totalShares += shares;

  // User withdraws all minted shares immediately (zero yield elapsed)
  const assetsReturned = YieldMath.convertToAssets(shares, totalAssets, totalShares);
  // Assets returned should be <= depositAssets (due to integer floor rounding), preserving vault assets
  assert.ok(assetsReturned <= depositAssets);
  assert.ok(assetsReturned >= depositAssets - 1n, "At most 1 wei rounding difference");
});

test("6. Harvest compounding and performance fee", () => {
  const totalAssetsBefore = 100_000n;
  const totalShares = 100_000n;
  const grossProfit = 10_000n;
  const feeBps = 1000; // 10% fee

  const res = YieldMath.processHarvest(grossProfit, totalAssetsBefore, totalShares, feeBps);

  assert.equal(res.grossProfitUsd, 10_000n);
  assert.equal(res.performanceFeeUsd, 1000n);
  assert.equal(res.netProfitUsd, 9000n);
  assert.equal(res.totalAssetsAfter, 109_000n);
  assert.ok(res.sharePriceAfter > 1.0);
});
