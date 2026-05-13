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
 */
export function useCofheClient() {
  const cfg = getAppConfig();
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [client, setClient] = useState<ReturnType<typeof buildCofheClient> | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const c = buildCofheClient(cfg.network);
        await c.connect(publicClient as any, walletClient as any);
        if (!cancelled) setClient(c);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setConnecting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, chainId, publicClient, walletClient, cfg.network]);

  return { client, connecting, error, address, chainId };
}
