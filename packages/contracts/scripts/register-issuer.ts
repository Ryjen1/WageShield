/**
 * Register the local mock issuer (derived from ISSUER_PRIVATE_KEY) on the deployed
 * TimeclockIssuerRegistry. Idempotent: skips if already trusted.
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const networkName = hre.network.name;
  const deploymentFile = path.join(__dirname, "..", "deployments", `${networkName}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`No deployment record found at ${deploymentFile}`);
  }
  const dep = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const registryAddr: string = dep.contracts.TimeclockIssuerRegistry;

  const issuerPk = process.env.ISSUER_PRIVATE_KEY;
  if (!issuerPk || !issuerPk.startsWith("0x")) {
    throw new Error("ISSUER_PRIVATE_KEY env var (0x-prefixed) is required");
  }
  const issuerWallet = new ethers.Wallet(issuerPk);
  const issuerAddr = issuerWallet.address;
  const label = process.env.ISSUER_LABEL ?? "Mock Homebase";

  const [signer] = await ethers.getSigners();
  console.log(`Network:   ${networkName}`);
  console.log(`Registry:  ${registryAddr}`);
  console.log(`Issuer:    ${issuerAddr} ("${label}")`);
  console.log(`Signing as ${signer.address} (must be registry owner)`);

  const Registry = await ethers.getContractFactory("TimeclockIssuerRegistry");
  const registry = Registry.attach(registryAddr) as any;

  const alreadyTrusted: boolean = await registry.isTrusted(issuerAddr);
  if (alreadyTrusted) {
    console.log("✓ already trusted — no-op");
    return;
  }

  const tx = await registry.trustIssuer(issuerAddr, label);
  console.log(`tx: ${tx.hash}`);
  await tx.wait();
  console.log("✓ issuer registered");

  // Update deployment record
  dep.metadata = dep.metadata || {};
  dep.metadata.issuerRegistered = { address: issuerAddr, label };
  fs.writeFileSync(deploymentFile, JSON.stringify(dep, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
