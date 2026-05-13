/**
 * Browser bridge from `window.ethereum` to `ethers` v6 Signer/Provider.
 *
 * The SDK is typed against ethers — wagmi/viem is the React-side wallet layer.
 * This adapter is intentionally simple for the hackathon demo. Long-term, the
 * SDK could expose viem-native overloads to skip this layer.
 */

import { ethers } from "ethers";

export async function getEthersSigner(): Promise<ethers.Signer> {
  const eth: any = typeof window !== "undefined" ? (window as any).ethereum : null;
  if (!eth) throw new Error("No injected provider (window.ethereum is missing)");
  const provider = new ethers.BrowserProvider(eth);
  return provider.getSigner();
}

export function getEthersProvider(): ethers.Provider {
  const eth: any = typeof window !== "undefined" ? (window as any).ethereum : null;
  if (!eth) throw new Error("No injected provider (window.ethereum is missing)");
  return new ethers.BrowserProvider(eth);
}
