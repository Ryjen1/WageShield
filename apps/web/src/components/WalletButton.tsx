"use client";

import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { getAppConfig } from "@/lib/config";

/**
 * Minimal wallet connector. Uses the `injected` connector (browser wallet). On click:
 *   • if disconnected -> request connection
 *   • if connected on wrong chain -> show the warning + a button to switch
 *   • if connected on the right chain -> show truncated address + disconnect button
 */
export function WalletButton() {
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
        className="bg-seal-600 hover:bg-seal-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
        disabled={!injected || isPending}
        onClick={() => injected && connect({ connector: injected })}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {wrongChain && (
        <span className="text-alarm-500 text-sm">
          Wrong chain (id {chainId}). Switch to {cfg.network}.
        </span>
      )}
      <code className="font-mono text-sm bg-ink-100 dark:bg-ink-700 px-2 py-1 rounded">
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </code>
      <button
        className="text-ink-500 hover:text-alarm-500 text-sm"
        onClick={() => disconnect()}
      >
        disconnect
      </button>
    </div>
  );
}
