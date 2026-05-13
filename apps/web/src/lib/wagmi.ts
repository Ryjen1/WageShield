/**
 * wagmi v2 configuration. We support arb-sepolia / eth-sepolia / base-sepolia, with
 * arb-sepolia as the default since it's the network we actively deploy to. Connectors:
 * `injected` (browser wallet — MetaMask, Rabby, etc.) is enough for the demo; we can add
 * WalletConnect / Coinbase later.
 */

"use client";

import { createConfig, http } from "wagmi";
import { arbitrumSepolia, baseSepolia, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia, sepolia, baseSepolia],
  connectors: [injected()],
  transports: {
    [arbitrumSepolia.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});
