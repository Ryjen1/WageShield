/**
 * End-to-end integration check against the live Arbitrum Sepolia deployment.
 *
 * Self-contained: signs the attestation locally with ISSUER_PRIVATE_KEY rather than
 * fetching from the issuer HTTP service.
 *
 * Flow:
 *   1. Read deployment record + create CoFHE client (testnet, via Ethers6 adapter).
 *   2. Sign an EIP-712 TimeclockAttestation with ISSUER_PRIVATE_KEY.
 *   3. Encrypt hours/rate via @cofhe/sdk.
 *   4. Call WageClaim.submitClaim — encrypted FHE.mul runs on-chain.
 *   5. Decrypt encrypted owedCents via CoFHE permit.
 *   6. Assert it equals plaintext hours × rate.
 *
 * Run: npx hardhat run scripts/e2e-live.ts --network arb-sepolia
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { createCofheConfig, createCofheClient } from "@cofhe/sdk/node";
import { chains } from "@cofhe/sdk/chains";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";

async function main() {
  const networkName = hre.network.name;
  const recordPath = path.join(__dirname, "..", "deployments", `${networkName}.json`);
  if (!fs.existsSync(recordPath)) {
    throw new Error(`No deployment record at ${recordPath}; run scripts/deploy.ts first`);
  }
  const dep = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  const wageClaimAddr: string = dep.contracts.WageClaim;

  const [worker] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`[1/6] Network: ${networkName} (chainId ${network.chainId})`);
  console.log(`      WageClaim: ${wageClaimAddr}`);
  console.log(`      Worker:    ${worker.address}`);

  // Resolve which CoFHE chain config to use based on hardhat network
  const chainMap: Record<string, any> = {
    "arb-sepolia": chains.arbSepolia,
    "eth-sepolia": chains.sepolia,
    "base-sepolia": chains.baseSepolia,
  };
  const cofheChain = chainMap[networkName];
  if (!cofheChain) throw new Error(`Unsupported network: ${networkName}`);

  // ------- Build CoFHE client for testnet using the Ethers6 adapter --------
  const provider = ethers.provider;
  const wallet = worker as any; // hardhat's signer satisfies the adapter

  const { publicClient, walletClient } = await Ethers6Adapter(provider as any, wallet);

  const config = createCofheConfig({ supportedChains: [cofheChain] });
  const client = createCofheClient(config);
  await client.connect(publicClient, walletClient);
  console.log(`      ✓ CoFHE client connected (env=${cofheChain.environment})`);

  // ------- 2. Sign attestation with ISSUER_PRIVATE_KEY ---------------------
  const issuerPk = process.env.ISSUER_PRIVATE_KEY;
  if (!issuerPk || !issuerPk.startsWith("0x")) {
    throw new Error("ISSUER_PRIVATE_KEY required in .env.local");
  }
  const issuerWallet = new ethers.Wallet(issuerPk);
  console.log(`      Issuer:    ${issuerWallet.address}`);

  const employerLabel = "EIN-12-3456789";
  const employerId = ethers.id(employerLabel);
  const hoursWorked = 240n;
  const hourlyRateCents = 1500n;
  const periodStart = BigInt(Math.floor(Date.now() / 1000) - 90 * 24 * 3600);
  const periodEnd = periodStart + BigInt(60 * 24 * 3600);
  const issuedAt = BigInt(Math.floor(Date.now() / 1000));
  const nonce = ethers.hexlify(ethers.randomBytes(32));
  const expectedOwedCents = hoursWorked * hourlyRateCents;

  const domain = {
    name: "WageShield.WageClaim",
    version: "1",
    chainId: network.chainId,
    verifyingContract: wageClaimAddr,
  };
  const types = {
    TimeclockAttestation: [
      { name: "worker", type: "address" },
      { name: "employerId", type: "bytes32" },
      { name: "hoursWorked", type: "uint64" },
      { name: "hourlyRateCents", type: "uint32" },
      { name: "periodStart", type: "uint64" },
      { name: "periodEnd", type: "uint64" },
      { name: "issuedAt", type: "uint64" },
      { name: "nonce", type: "bytes32" },
    ],
  };
  const value = {
    worker: worker.address,
    employerId,
    hoursWorked,
    hourlyRateCents,
    periodStart,
    periodEnd,
    issuedAt,
    nonce,
  };
  const signature = await issuerWallet.signTypedData(domain, types, value);
  console.log(`[2/6] Attestation signed (digest binds worker + employer + hours + rate + period)`);

  // ------- 3. Encrypt hours + rate via @cofhe/sdk --------------------------
  console.log(`[3/6] Encrypting hours (${hoursWorked}) and rate (${hourlyRateCents}c)...`);
  const [eHours, eRate] = await client
    .encryptInputs([
      Encryptable.uint64(hoursWorked),
      Encryptable.uint32(hourlyRateCents),
    ])
    .onStep((step: string) => console.log(`      encrypt step: ${step}`))
    .execute();
  console.log(`      ✓ inputs encrypted`);

  // ------- 4. submitClaim → encrypted FHE.mul on-chain ---------------------
  console.log(`[4/6] Calling submitClaim...`);
  const wageClaim = await ethers.getContractAt("WageClaim", wageClaimAddr, worker);
  const tx = await wageClaim.submitClaim(
    employerId,
    hoursWorked,
    hourlyRateCents,
    periodStart,
    periodEnd,
    issuedAt,
    nonce,
    signature,
    eHours,
    eRate
  );
  console.log(`      tx: ${tx.hash}`);
  console.log(`      https://sepolia.arbiscan.io/tx/${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`      ✓ mined in block ${receipt!.blockNumber}, gas ${receipt!.gasUsed.toString()}`);

  const submittedTopic = wageClaim.interface.getEvent("ClaimSubmitted")!.topicHash;
  const log = receipt!.logs.find((l: any) => l.topics[0] === submittedTopic);
  if (!log) throw new Error("no ClaimSubmitted event found");
  const parsed = wageClaim.interface.parseLog({ topics: log.topics, data: log.data });
  const claimId: bigint = parsed!.args[0];
  console.log(`      ✓ claimId = ${claimId}`);

  // ------- 5. Decrypt encrypted owedCents via permit -----------------------
  console.log(`[5/6] Creating self-permit and decrypting owedCents...`);
  await client.permits.getOrCreateSelfPermit();
  const claim = await wageClaim.claims(claimId);
  const decrypted = await client
    .decryptForView(claim.owedCents, FheTypes.Uint128)
    .execute();

  // ------- 6. Verify ------------------------------------------------------
  console.log(`\n=========================================================`);
  console.log(`  Decrypted owed:   ${decrypted} cents ($${Number(decrypted) / 100})`);
  console.log(`  Expected owed:    ${expectedOwedCents} cents ($${Number(expectedOwedCents) / 100})`);
  const match = BigInt(decrypted as any) === expectedOwedCents;
  console.log(`  Match: ${match ? "✓ E2E PASSED" : "✗ MISMATCH"}`);
  console.log(`=========================================================\n`);

  if (!match) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
