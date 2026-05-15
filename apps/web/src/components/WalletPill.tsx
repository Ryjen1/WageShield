"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { getAppConfig } from "@/lib/config";

/**
 * Wallet pill — three visible states:
 *  - disconnected: "Connect" pill → opens a wallet chooser
 *  - connected, wrong chain: TWO pills side-by-side — a red "Wrong chain"
 *    action (clicking switches), and the address pill (clicking disconnects).
 *    This is more useful than collapsing into a single red pill: the user can
 *    still see they're connected as themselves, and choose to either switch
 *    chain or disconnect entirely.
 *  - connected, right chain: address pill only (clicking disconnects).
 *
 * Wallet picker: uses wagmi's EIP-6963 multi-injected discovery so each
 * installed wallet shows up as its own connector entry. User picks explicitly
 * (MetaMask vs Binance vs Rabby vs whatever else is installed).
 *
 * Implementation note: chain detection MUST come from `useAccount()` not
 * `useChainId()`. `useChainId()` falls back to the wagmi-config default when
 * the wallet is on an unsupported chain, hiding the mismatch. `useAccount()`
 * returns the wallet's actual chainId regardless.
 */
export function WalletPill() {
  const cfg = getAppConfig();
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { connect, connectors, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();

  const [chooserOpen, setChooserOpen] = useState(false);
  const wrongChain =
    isConnected && walletChainId !== undefined && walletChainId !== cfg.chainId;

  // Close the chooser once a wallet successfully connects.
  useEffect(() => {
    if (isConnected) setChooserOpen(false);
  }, [isConnected]);

  // --------------------------------------------------------------- disconnected
  if (!isConnected) {
    return (
      <>
        <button
          className="font-mono text-[10px] tracking-[0.3em] uppercase rounded-full border border-white/30 px-4 py-1.5 text-foreground hover:border-white/60 transition disabled:opacity-50"
          disabled={isPending}
          onClick={() => setChooserOpen(true)}
        >
          {isPending ? "···" : "Connect"}
        </button>
        {chooserOpen && (
          <WalletChooser
            connectors={connectors}
            isPending={isPending}
            error={connectError?.message}
            onPick={(c) => connect({ connector: c })}
            onClose={() => setChooserOpen(false)}
          />
        )}
      </>
    );
  }

  // ------------------------------------------- connected, with optional warning
  return (
    <div className="flex items-center gap-2">
      {wrongChain && (
        <button
          onClick={() => switchChain({ chainId: cfg.chainId })}
          disabled={isSwitching}
          className="font-mono text-[10px] tracking-[0.3em] uppercase rounded-full border border-alarm-500/60 bg-alarm-500/10 px-3 py-1.5 text-alarm-500 hover:bg-alarm-500/20 transition disabled:opacity-50"
          title={
            switchError?.message ??
            `Wallet on chain ${walletChainId}, need ${cfg.chainId} (${cfg.network}). Click to switch.`
          }
        >
          {isSwitching ? "Switching…" : `Wrong chain · Switch to ${cfg.network}`}
        </button>
      )}
      <button
        onClick={() => disconnect()}
        className="font-mono text-[10px] tracking-[0.3em] uppercase rounded-full border border-white/15 px-4 py-1.5 text-muted-foreground hover:text-foreground hover:border-white/40 transition"
        title="Disconnect wallet"
      >
        {address?.slice(0, 6)}···{address?.slice(-4)}
      </button>
    </div>
  );
}

/* --------------------------------------------------------------------------------
 *  Wallet picker modal — lists every EIP-6963 connector wagmi has discovered.
 * -------------------------------------------------------------------------------- */

type Connector = ReturnType<typeof useConnect>["connectors"][number];

function WalletChooser({
  connectors,
  isPending,
  error,
  onPick,
  onClose,
}: {
  connectors: readonly Connector[];
  isPending: boolean;
  error?: string;
  onPick: (c: Connector) => void;
  onClose: () => void;
}) {
  // De-duplicate by `id` (some hosts announce the same wallet twice during HMR).
  const seen = new Set<string>();
  const unique = connectors.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="liquid-glass rounded-2xl p-6 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground">
            Pick a wallet
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground transition"
          >
            ×
          </button>
        </header>

        {unique.length === 0 && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            No wallet extensions detected. Install MetaMask, Rabby, or another
            EIP-6963-compatible browser wallet and reload.
          </p>
        )}

        <ul className="space-y-2">
          {unique.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onPick(c)}
                disabled={isPending}
                className="w-full flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/30 hover:border-seal-400/60 hover:bg-seal-500/10 transition px-4 py-3 text-left disabled:opacity-50"
              >
                {c.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.icon}
                    alt={`${c.name} icon`}
                    width={28}
                    height={28}
                    className="rounded"
                  />
                ) : (
                  <div className="w-7 h-7 rounded bg-white/[0.06]" />
                )}
                <span className="font-medium text-foreground">{c.name}</span>
                <span className="ml-auto font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                  {c.type}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {error && (
          <p className="text-xs text-alarm-500 leading-relaxed">{error}</p>
        )}
      </div>
    </div>
  );
}
