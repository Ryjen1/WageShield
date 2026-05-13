/**
 * App-level configuration. Values come from `NEXT_PUBLIC_*` env vars at build time.
 * The four addresses + chain ID are populated by the deploy script
 * (`packages/contracts/scripts/deploy.ts`) — copy them into `apps/web/.env.local`
 * after a fresh deploy.
 *
 * Missing-config behaviour: instead of throwing (which crashes the whole page render
 * including landing/about that don't actually need the address), we fall back to the
 * zero address and surface a `configError` flag. UI components that *do* need the
 * address — worker / attorney / regulator pages — should check `configError` and
 * show a hint to the user. Pure-content pages (home, about) render fine.
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
  /**
   * Set when one of the *required* env vars is missing. Components that depend on
   * those vars should render an error banner instead of attempting to use the
   * placeholder addresses.
   */
  configError: string | null;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * IMPORTANT: Next.js inlines `process.env.NEXT_PUBLIC_*` references into the client
 * bundle ONLY when accessed via direct property syntax — e.g. `process.env.FOO`.
 * Bracket access via a string variable (`process.env["FOO"]`) does NOT get inlined,
 * so the value is `undefined` in the browser. Every NEXT_PUBLIC_* read here uses
 * direct dot syntax. Don't refactor this into a generic helper that takes a `key`
 * string parameter — that breaks the build-time inlining and makes everything
 * `undefined` client-side, which is exactly what caused the bug this comment exists
 * to document.
 *
 * Refs:
 *   • https://nextjs.org/docs/pages/api-reference/next-config-js/env
 *   • https://github.com/vercel/next.js/discussions/16306
 */
function readAddress(value: string | undefined): { value: Address; missing: boolean } {
  if (!value || value === "" || value === "0x" || value === "0x0") {
    return { value: ZERO_ADDRESS, missing: true };
  }
  return { value: value as Address, missing: false };
}

export function getAppConfig(): AppConfig {
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

  // Direct dot access — see the IMPORTANT note above. DO NOT refactor.
  const wageClaim = readAddress(process.env.NEXT_PUBLIC_WAGECLAIM_ADDRESS);
  const resolver = readAddress(process.env.NEXT_PUBLIC_RESOLVER_ADDRESS);
  const policy = readAddress(process.env.NEXT_PUBLIC_POLICY_ADDRESS);
  const registry = readAddress(process.env.NEXT_PUBLIC_REGISTRY_ADDRESS);

  const configError = wageClaim.missing
    ? "NEXT_PUBLIC_WAGECLAIM_ADDRESS is missing. Make sure apps/web/.env.local has it set, then restart `npm run dev` (the env file is read once at server start)."
    : null;

  return {
    network,
    chainId,
    wageClaim: wageClaim.value,
    resolver: resolver.value,
    policy: policy.value,
    registry: registry.value,
    issuerUrl: process.env.NEXT_PUBLIC_ISSUER_URL ?? "http://localhost:4001",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? rpcByNet[network],
    explorerUrl: explorerByNet[network],
    configError,
  };
}
