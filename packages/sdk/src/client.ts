/**
 * CoFHE client construction helpers.
 *
 * The `@cofhe/sdk` setup involves a config + client + viem PublicClient/WalletClient
 * pair connected via an adapter. For the WageShield demo the worker / attorney /
 * regulator UIs all use ethers v6 via `Ethers6Adapter`; this module hides the
 * boilerplate so consumers just call `createWageShieldClient(...)`.
 */
import { ethers } from "ethers";
import { createCofheConfig, createCofheClient } from "@cofhe/sdk/node";
import { chains } from "@cofhe/sdk/chains";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import type { SupportedNetwork } from "./types";

/**
 * Map our `SupportedNetwork` strings onto `@cofhe/sdk`'s chain configs. These point
 * at the Fhenix CoFHE testnet coprocessor / threshold network / input verifier URLs.
 */
const CHAIN_BY_NETWORK: Record<SupportedNetwork, any> = {
  "arb-sepolia": chains.arbSepolia,
  "eth-sepolia": chains.sepolia,
  "base-sepolia": chains.baseSepolia,
};

/**
 * Resolve the `@cofhe/sdk/chains` entry for a supported network. Throws if the
 * network is unsupported (so the consumer fails fast instead of silently using
 * undefined chain config).
 */
export function resolveCofheChain(network: SupportedNetwork) {
  const chain = CHAIN_BY_NETWORK[network];
  if (!chain) {
    throw new Error(`Unsupported network for CoFHE: ${network}`);
  }
  return chain;
}

/**
 * Build a connected CoFHE client around an ethers v6 provider + signer. The
 * returned client can encrypt inputs, decrypt results, and manage permits.
 *
 * Usage:
 *   ```ts
 *   const provider = new JsonRpcProvider(rpcUrl);
 *   const signer = new Wallet(privateKey, provider);
 *   const client = await createWageShieldClient({ network: "arb-sepolia", provider, signer });
 *   ```
 */
export async function createWageShieldClient(args: {
  network: SupportedNetwork;
  provider: ethers.Provider;
  signer: ethers.Signer;
}): Promise<any> {
  // Return type is `any` deliberately: the underlying CofheClient type lives in a
  // private file of @cofhe/sdk that TypeScript can't reference portably across
  // packages. The runtime contract is unchanged; consumers treat it as a CoFHE
  // client and use its methods directly.
  const cofheChain = resolveCofheChain(args.network);
  const { publicClient, walletClient } = await Ethers6Adapter(
    args.provider as any,
    args.signer as any,
  );
  const config = createCofheConfig({ supportedChains: [cofheChain] });
  const client = createCofheClient(config);
  await client.connect(publicClient, walletClient);
  return client;
}

/** Convenience type alias so consumers don't need to import from `@cofhe/sdk` directly. */
export type WageShieldClient = Awaited<ReturnType<typeof createWageShieldClient>>;
