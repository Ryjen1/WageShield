/**
 * Bridge from the wagmi-selected wallet to an ethers v6 Signer / Provider.
 *
 * IMPORTANT: do NOT use `window.ethereum` here. When multiple wallet extensions
 * are installed (MetaMask + Binance + Rabby + ...), they fight for the global
 * `window.ethereum` property and one of them wins arbitrarily. wagmi uses
 * EIP-6963 to ask each wallet to identify itself and lets the user pick — that
 * choice lives in the wagmi config, not in `window.ethereum`.
 *
 * This module asks wagmi for the *active connector's* provider and wraps it in
 * an ethers BrowserProvider. The hook variants (`useEthersSigner`,
 * `useEthersProvider`) are the recommended path; the plain functions exist for
 * legacy callers but require the wagmi config and account passed in explicitly.
 */

"use client";

import { useMemo } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import type { Connector } from "wagmi";

/**
 * React hook: returns an ethers signer connected to the wagmi-selected wallet,
 * or `null` if no wallet is connected yet. The signer is memoised by
 * (connector, account, chainId) so a stable reference is handed to consumers
 * across re-renders.
 */
export function useEthersSigner(): {
  getSigner: () => Promise<ethers.Signer>;
  getProvider: () => Promise<ethers.Provider>;
  ready: boolean;
} {
  const { connector, address, chainId } = useAccount();
  return useMemo(
    () => ({
      ready: !!connector && !!address,
      getSigner: async () => {
        if (!connector) {
          throw new Error("No wallet connected. Click Connect in the top right.");
        }
        const provider = await getEthersBrowserProvider(connector);
        return provider.getSigner();
      },
      getProvider: async () => {
        if (!connector) {
          throw new Error("No wallet connected. Click Connect in the top right.");
        }
        return getEthersBrowserProvider(connector);
      },
    }),
    [connector, address, chainId],
  );
}

/**
 * Build an ethers BrowserProvider from a wagmi `Connector`. wagmi's connector
 * exposes its EIP-1193 provider via `connector.getProvider()`. That provider is
 * scoped to the *specific* wallet the user picked from the chooser modal —
 * unlike `window.ethereum` which is whichever extension won the race.
 */
export async function getEthersBrowserProvider(
  connector: Connector,
): Promise<ethers.BrowserProvider> {
  const provider = (await connector.getProvider()) as any;
  if (!provider) {
    throw new Error(
      `Connector ${connector.name} did not return a provider. ` +
        `Disconnect and reconnect, or pick a different wallet.`,
    );
  }
  return new ethers.BrowserProvider(provider);
}
