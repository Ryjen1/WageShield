/**
 * wagmi v2 configuration.
 *
 * Connector strategy: rely on wagmi's built-in EIP-6963 multi-injected discovery.
 * Each installed wallet extension that supports EIP-6963 (MetaMask, Rabby, Coinbase
 * Wallet, Brave Wallet, etc.) announces itself to the page via the standard
 * `eip6963:announceProvider` event. wagmi listens for those announcements and
 * surfaces each wallet as its own connector entry — that's what lets the UI render
 * a "pick your wallet" chooser instead of silently grabbing whichever extension
 * won the global `window.ethereum` race.
 *
 * We pass `multiInjectedProviderDiscovery: true` explicitly (it's the default in
 * wagmi v2 but we set it for clarity) and DO NOT add the bare `injected()`
 * connector, because that would re-add the "grab window.ethereum and hope" path
 * we're trying to escape.
 */

"use client";

import { createConfig, http } from "wagmi";
import { arbitrumSepolia, baseSepolia, sepolia } from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia, sepolia, baseSepolia],
  multiInjectedProviderDiscovery: true,
  connectors: [],
  transports: {
    [arbitrumSepolia.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});
