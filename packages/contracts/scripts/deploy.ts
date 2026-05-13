/**
 * WageShield deploy script.
 *
 * Deploys (in order):
 *   1. TimeclockIssuerRegistry  (owner = deployer)
 *   2. WageClaim                (owner = deployer, registry = step 1)
 *   3. WageTheftResolver        (Privara IConditionResolver plugin)
 *   4. WageTheftPolicy          (Privara IUnderwriterPolicy plugin)
 *
 * Optional post-deploy actions (controlled by env):
 *   ISSUER_PUBKEY=0x...   — register a trusted timeclock issuer
 *   ISSUER_LABEL=...      — label for that issuer (default: "Mock Homebase")
 *
 * Run:
 *   npx hardhat run scripts/deploy.ts --network arb-sepolia
 *
 * Output is written to deployments/<network>.json so the SDK + web app can pick it up.
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentRecord {
  network: string;
  chainId: string;
  deployer: string;
  contracts: Record<string, string>;
  metadata: {
    deployedAt: string;
    issuerRegistered?: { address: string; label: string };
  };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = hre.network.name;

  console.log("\n=========================================================");
  console.log(`WageShield deploy → ${networkName} (chainId ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);
  console.log("=========================================================\n");

  // 1. TimeclockIssuerRegistry
  const RegFactory = await ethers.getContractFactory("TimeclockIssuerRegistry");
  const registry = await RegFactory.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`✓ TimeclockIssuerRegistry: ${registryAddr}`);

  // 2. WageClaim
  const ClaimFactory = await ethers.getContractFactory("WageClaim");
  const wageClaim = await ClaimFactory.deploy(registryAddr, deployer.address);
  await wageClaim.waitForDeployment();
  const wageClaimAddr = await wageClaim.getAddress();
  console.log(`✓ WageClaim:               ${wageClaimAddr}`);

  // 3. WageTheftResolver
  const ResolverFactory = await ethers.getContractFactory("WageTheftResolver");
  const resolver = await ResolverFactory.deploy();
  await resolver.waitForDeployment();
  const resolverAddr = await resolver.getAddress();
  console.log(`✓ WageTheftResolver:       ${resolverAddr}`);

  // 4. WageTheftPolicy
  const PolicyFactory = await ethers.getContractFactory("WageTheftPolicy");
  const policy = await PolicyFactory.deploy();
  await policy.waitForDeployment();
  const policyAddr = await policy.getAddress();
  console.log(`✓ WageTheftPolicy:         ${policyAddr}`);

  // 5. Optionally register a trusted issuer
  let issuerRegistered: { address: string; label: string } | undefined;
  const issuerPubkey = process.env.ISSUER_PUBKEY;
  if (issuerPubkey) {
    const issuerLabel = process.env.ISSUER_LABEL || "Mock Homebase";
    const tx = await registry.trustIssuer(issuerPubkey, issuerLabel);
    await tx.wait();
    issuerRegistered = { address: issuerPubkey, label: issuerLabel };
    console.log(`✓ Trusted issuer:          ${issuerPubkey} ("${issuerLabel}")`);
  } else {
    console.log("ℹ  Skipped issuer registration (set ISSUER_PUBKEY to enable)");
  }

  // Persist record
  const record: DeploymentRecord = {
    network: networkName,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    contracts: {
      TimeclockIssuerRegistry: registryAddr,
      WageClaim: wageClaimAddr,
      WageTheftResolver: resolverAddr,
      WageTheftPolicy: policyAddr,
    },
    metadata: {
      deployedAt: new Date().toISOString(),
      issuerRegistered,
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${networkName}.json`);
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2));
  console.log(`\n📝 Deployment record written to ${path.relative(process.cwd(), outFile)}`);
  console.log("\nDone.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
