import hre from "hardhat";
import { ethers } from "hardhat";

async function main() {
  const [d] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(d.address);
  const net = await ethers.provider.getNetwork();
  console.log(`Network: ${hre.network.name} (chainId ${net.chainId})`);
  console.log(`Deployer: ${d.address}`);
  console.log(`Balance:  ${ethers.formatEther(bal)} ETH`);
  if (bal === 0n) {
    console.error("\n⚠  Zero balance. Get Arbitrum Sepolia ETH:");
    console.error("   • https://faucet.quicknode.com/arbitrum/sepolia");
    console.error("   • https://www.alchemy.com/faucets/arbitrum-sepolia");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
