"use client";

import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { getAppConfig } from "@/lib/config";

/**
 * Wallet connector styled as a pill that lives inside the NavPill. Three states:
 *  - disconnected: "Connect" pill button
 *  - connected, wrong chain: amber border + "Wrong chain" label
 *  - connected, right chain: truncated address with disconnect on hover
 */
export function WalletPill() {
  const cfg = getAppConfig();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const wrongChain = isConnected && chainId !== cfg.chainId;

  if (!isConnected) {
    const injected = connectors.find((c) => c.type === "injected");
    return (
      <button
        className="font-mono text-[10px] tracking-[0.3em] uppercase rounded-full border border-white/30 px-4 py-1.5 text-foreground hover:border-white/60 transition disabled:opacity-50"
        disabled={!injected || isPending}
        onClick={() => injected && connect({ connector: injected })}
      >
        {isPending ? "···" : "Connect"}
      </button>
    );
  }

  if (wrongChain) {
    return (
      <button
        onClick={() => disconnect()}
        className="font-mono text-[10px] tracking-[0.3em] uppercase rounded-full border border-alarm-500/50 text-alarm-500 px-4 py-1.5 hover:border-alarm-500 transition"
        title="Wrong chain — click to disconnect"
      >
        Wrong chain
      </button>
    );
  }

  return (
    <button
      onClick={() => disconnect()}
      className="font-mono text-[10px] tracking-[0.3em] uppercase rounded-full border border-white/15 px-4 py-1.5 text-muted-foreground hover:text-foreground hover:border-white/40 transition"
      title="Disconnect wallet"
    >
      {address?.slice(0, 6)}···{address?.slice(-4)}
    </button>
  );
}
