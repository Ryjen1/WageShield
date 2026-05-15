"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { buildCofheClient } from "@/lib/cofhe";
import { getAppConfig } from "@/lib/config";

/**
 * Returns a CoFHE client connected to the user's currently-connected wallet, or `null`
 * if the wallet isn't ready yet. The returned client is memoised by (account, chainId);
 * switching wallet / chain rebuilds it.
 *
 * Status flags:
 *   • `client === null` and `connecting === true`  -> still wiring viem clients
 *   • `client === null` and `connecting === false` -> not connected yet (no wallet)
 *   • `client !== null`                            -> ready to encrypt / decrypt
 *
 * `reason` exposes which prerequisite is missing so the UI can show an explicit
 * status message instead of a silent "not ready".
 */
export function useCofheClient() {
  const cfg = getAppConfig();
  const { address, chainId, isConnected, connector } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient, error: walletClientError, isLoading: walletClientLoading } =
    useWalletClient();

  const [client, setClient] = useState<ReturnType<typeof buildCofheClient> | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute the explicit reason the client isn't ready yet (or is).
  let reason = "ok";
  if (!isConnected) reason = "wallet not connected";
  else if (!address) reason = "no account address";
  else if (chainId !== cfg.chainId)
    reason = `wrong chain (connected ${chainId}, expected ${cfg.chainId})`;
  else if (!publicClient) reason = "wagmi publicClient not ready";
  else if (walletClientLoading) reason = "wagmi walletClient loading";
  else if (walletClientError)
    reason = `walletClient error: ${walletClientError.message}`;
  else if (!walletClient) reason = "wagmi walletClient unavailable";

  useEffect(() => {
    let cancelled = false;
    if (!address || !publicClient || !walletClient) {
      setClient(null);
      return;
    }
    setConnecting(true);
    setError(null);
    (async () => {
      try {
        // eslint-disable-next-line no-console
        console.info("[CoFHE] connecting...", {
          network: cfg.network,
          account: address,
          chainId,
          connector: connector?.name,
        });
        const c = buildCofheClient(cfg.network);
        await c.connect(publicClient as any, walletClient as any);
        if (!cancelled) {
          setClient(c);
          // eslint-disable-next-line no-console
          console.info("[CoFHE] connected ✓");
        }
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error("[CoFHE] connect failed:", e);
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setConnecting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, chainId, publicClient, walletClient, cfg.network, cfg.chainId, connector]);

  return { client, connecting, error, address, chainId, reason };
}
