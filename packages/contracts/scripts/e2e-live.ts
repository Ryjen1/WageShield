/**
 * End-to-end integration check against the live Arbitrum Sepolia deployment.
 *
 * Drives the full happy path through the @wageshield/sdk surface:
 *   1. Read deployment record + create CoFHE client (testnet, via Ethers6 adapter).
 *   2. Build + sign a `TimeclockAttestation` with ISSUER_PRIVATE_KEY.
 *   3. SDK.submitClaim(...) — encrypts inputs, sends tx, parses event.
 *   4. SDK.decryptOwed(...) — creates self-permit, decrypts encrypted owedCents.
 *   5. Assert it equals plaintext hours × rate.
 *
 * Self-contained: signs the attestation locally with ISSUER_PRIVATE_KEY rather than
 * fetching from the issuer HTTP service. (The HTTP service is identical logic — see
 * packages/issuer/src/index.ts — but spawning it as a sidecar inside the agent's bash
 * sandbox is brittle, so we sign in-process for this test.)
 *
 * Pre-requisites:
 *   • `.env.local` has PRIVATE_KEY funded on arb-sepolia AND ISSUER_PRIVATE_KEY.
 *   • Issuer registered on TimeclockIssuerRegistry (run scripts/register-issuer.ts first).
 *
 * Run: npm run e2e:arb-sepolia
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import {
  buildAttestation,
  buildAttestationDomain,
  createWageShieldClient,
  decryptOwed,
  signAttestation,
  submitClaim,
  type Address,
  type SupportedNetwork,
} from "@wageshield/sdk";

async function main() {
  // ------- 1. Load deployment + signers ------------------------------------
  const networkName = hre.network.name as SupportedNetwork;
  const recordPath = path.join(__dirname, "..", "deployments", `${networkName}.json`);
  if (!fs.existsSync(recordPath)) {
    throw new Error(`No deployment record at ${recordPath}; run scripts/deploy.ts first`);
  }
  const dep = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  const wageClaimAddr = dep.contracts.WageClaim as Address;

  const [worker] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`[1/5] Network: ${networkName} (chainId ${network.chainId})`);
  console.log(`      WageClaim: ${wageClaimAddr}`);
  console.log(`      Worker:    ${worker.address}`);

  const client = await createWageShieldClient({
    network: networkName,
    provider: ethers.provider,
    signer: worker,
  });
  console.log(`      ✓ CoFHE client connected (testnet)`);

  // ------- 2. Build + sign attestation -------------------------------------
  const issuerPk = process.env.ISSUER_PRIVATE_KEY;
  if (!issuerPk || !issuerPk.startsWith("0x")) {
    throw new Error("ISSUER_PRIVATE_KEY required in .env.local");
  }
  const issuerWallet = new ethers.Wallet(issuerPk);
  console.log(`      Issuer:    ${issuerWallet.address}`);

  const employerLabel = "EIN-12-3456789";
  const hoursWorked = 240n;
  const hourlyRateCents = 1500;
  const periodStart = BigInt(Math.floor(Date.now() / 1000) - 90 * 24 * 3600);
  const periodEnd = periodStart + BigInt(60 * 24 * 3600);
  const expectedOwedCents = hoursWorked * BigInt(hourlyRateCents);

  const domain = buildAttestationDomain({
    chainId: network.chainId,
    wageClaimAddress: wageClaimAddr,
  });
  const attestation = buildAttestation({
    worker: worker.address as Address,
    employerLabel,
    hoursWorked,
    hourlyRateCents,
    periodStart,
    periodEnd,
  });
  const signedAttestation = await signAttestation({
    signer: issuerWallet,
    domain,
    attestation,
  });
  console.log(`[2/5] Attestation signed (digest binds worker + employer + hours + rate + period)`);

  // ------- 3. SDK.submitClaim — encrypts + sends tx ------------------------
  console.log(`[3/5] SDK.submitClaim — encrypting inputs and sending tx...`);
  const result = await submitClaim({
    client,
    signer: worker,
    wageClaimAddress: wageClaimAddr,
    signedAttestation,
  });
  console.log(`      tx: ${result.txHash}`);
  console.log(`      https://sepolia.arbiscan.io/tx/${result.txHash}`);
  console.log(
    `      ✓ mined in block ${result.blockNumber}, gas ${result.gasUsed}, claimId=${result.claimId}`,
  );

  // ------- 4. SDK.decryptOwed — permit + decrypt ---------------------------
  console.log(`[4/5] SDK.decryptOwed — creating self-permit and decrypting...`);
  const decrypted = await decryptOwed({
    client,
    provider: ethers.provider,
    wageClaimAddress: wageClaimAddr,
    claimId: result.claimId,
  });

  // ------- 5. Verify -------------------------------------------------------
  const match = decrypted === expectedOwedCents;
  console.log(`\n=========================================================`);
  console.log(`  Decrypted owed:   ${decrypted} cents ($${Number(decrypted) / 100})`);
  console.log(`  Expected owed:    ${expectedOwedCents} cents ($${Number(expectedOwedCents) / 100})`);
  console.log(`  Match: ${match ? "✓ E2E PASSED (via @wageshield/sdk)" : "✗ MISMATCH"}`);
  console.log(`=========================================================\n`);

  if (!match) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
