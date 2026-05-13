/**
 * App-level configuration. Values come from `NEXT_PUBLIC_*` env vars at build time.
 * The four addresses + chain ID are populated by the deploy script
 * (`packages/contracts/scripts/deploy.ts`) — copy them into `.env.local` after a
 * fresh deploy.
 */

import type { Address, SupportedNetwork } from "@wageshield/sdk";

export interface AppConfig {
  network: SupportedNetwork;
  chainId: number;
  wageClaim: Address;
  resolver: Address;
  policy: Address;
  registry: Address;
  issuerUrl: string;
  rpcUrl: string;
  /** Public block-explorer base URL for tx links. */
  explorerUrl: string;
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function fallback(key: string, def: string): string {
  return process.env[key] ?? def;
}

export function getAppConfig(): AppConfig {
  // Default to arb-sepolia — the only network we actively deploy to.
  const network = (process.env.NEXT_PUBLIC_NETWORK ?? "arb-sepolia") as SupportedNetwork;
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 421614);
  const explorerByNet: Record<SupportedNetwork, string> = {
    "arb-sepolia": "https://sepolia.arbiscan.io",
    "eth-sepolia": "https://sepolia.etherscan.io",
    "base-sepolia": "https://sepolia.basescan.org",
  };
  const rpcByNet: Record<SupportedNetwork, string> = {
    "arb-sepolia": "https://sepolia-rollup.arbitrum.io/rpc",
    "eth-sepolia": "https://ethereum-sepolia-rpc.publicnode.com",
    "base-sepolia": "https://sepolia.base.org",
  };

  return {
    network,
    chainId,
    wageClaim: required("NEXT_PUBLIC_WAGECLAIM_ADDRESS") as Address,
    resolver: (process.env.NEXT_PUBLIC_RESOLVER_ADDRESS ?? "0x0") as Address,
    policy: (process.env.NEXT_PUBLIC_POLICY_ADDRESS ?? "0x0") as Address,
    registry: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? "0x0") as Address,
    issuerUrl: fallback("NEXT_PUBLIC_ISSUER_URL", "http://localhost:4001"),
    rpcUrl: fallback("NEXT_PUBLIC_RPC_URL", rpcByNet[network]),
    explorerUrl: explorerByNet[network],
  };
}
