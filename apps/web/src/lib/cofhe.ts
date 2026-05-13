/**
 * Browser-side @cofhe/sdk client construction. Lazy-initialised: we only construct
 * the CoFHE client after the user has connected a wallet, since the constructor
 * needs viem's PublicClient + WalletClient.
 *
 * Hooks (useCofheClient) live in src/hooks/useCofheClient.ts.
 */

"use client";

import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { chains } from "@cofhe/sdk/chains";
import type { SupportedNetwork } from "@wageshield/sdk";

const CHAIN_BY_NETWORK = {
  "arb-sepolia": chains.arbSepolia,
  "eth-sepolia": chains.sepolia,
  "base-sepolia": chains.baseSepolia,
} as const;

/**
 * Build (but do not connect) a CoFHE client for the given network. Connection is
 * established later via `client.connect(publicClient, walletClient)` once the user's
 * wallet is available.
 */
export function buildCofheClient(network: SupportedNetwork) {
  const chain = CHAIN_BY_NETWORK[network];
  if (!chain) throw new Error(`Unsupported CoFHE network: ${network}`);
  const config = createCofheConfig({ supportedChains: [chain] });
  return createCofheClient(config);
}
