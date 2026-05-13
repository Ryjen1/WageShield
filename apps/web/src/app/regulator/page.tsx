"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import {
  decryptAggregate,
  hashEmployerLabel,
  requestAggregateDecryption as sdkRequestAggregateDecryption,
  WAGECLAIM_ABI,
  type Hex32,
} from "@wageshield/sdk";
import { useCofheClient } from "@/hooks/useCofheClient";
import { getAppConfig } from "@/lib/config";
import { getEthersProvider, getEthersSigner } from "@/lib/ethers-bridge";

export default function RegulatorPage() {
  const cfg = getAppConfig();
  const { isConnected } = useAccount();
  const { client, connecting, error: cofheError } = useCofheClient();
  const { data: walletClient } = useWalletClient();

  const [employerLabel, setEmployerLabel] = useState("EIN-12-3456789");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestTx, setRequestTx] = useState<Hex32 | null>(null);
  const [aggCents, setAggCents] = useState<bigint | null>(null);
  const [claimCount, setClaimCount] = useState<bigint | null>(null);

  const employerCommitment = employerLabel
    ? hashEmployerLabel(employerLabel)
    : null;

  async function handleRequest() {
    if (!walletClient || !employerCommitment) return;
    setError(null);
    setBusy("request");
    try {
      const signer = await getEthersSigner();
      const tx = await sdkRequestAggregateDecryption({
        signer,
        wageClaimAddress: cfg.wageClaim,
        employerCommitment,
      });
      setRequestTx(tx);
    } catch (e: any) {
      setError(
        e?.message?.includes("NotRegulator")
          ? "Your address is not registered as a regulator. Ask the contract owner to call addRegulator(yourAddress) first."
          : e?.message ?? String(e),
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleDecrypt() {
    if (!client || !employerCommitment) return;
    setError(null);
    setBusy("decrypt");
    try {
      const provider = getEthersProvider();
      // Read claim count alongside (plaintext, view call) so we can warn about k=1.
      const wageClaim = new ethers.Contract(cfg.wageClaim, WAGECLAIM_ABI, provider);
      const count: bigint = await wageClaim.employerClaimCount(employerCommitment);
      setClaimCount(count);

      const total = await decryptAggregate({
        client,
        provider,
        wageClaimAddress: cfg.wageClaim,
        employerCommitment,
      });
      setAggCents(total);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  if (cfg.configError) return <Hint tone="error">{cfg.configError}</Hint>;
  if (!isConnected) return <Hint>Connect a registered regulator wallet.</Hint>;
  if (connecting) return <Hint>Setting up encrypted compute…</Hint>;
  if (cofheError) return <Hint tone="error">CoFHE error: {cofheError}</Hint>;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Regulator dashboard</h1>
        <p className="text-ink-500">
          Look up an employer by label. The dashboard reveals the <em>aggregate</em>{" "}
          stolen-wage exposure across all encrypted claims for that employer — never
          individual amounts, never identities.
        </p>
      </header>

      <div className="space-y-3 border border-ink-200 dark:border-ink-700 rounded-xl p-5">
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-ink-500">
            Employer label (must match the workers' input exactly)
          </span>
          <input
            className="w-full bg-ink-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg px-3 py-2 font-mono text-sm"
            value={employerLabel}
            onChange={(e) => setEmployerLabel(e.target.value)}
          />
        </label>
        {employerCommitment && (
          <div className="text-xs text-ink-500 font-mono break-all">
            commitment = {employerCommitment}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button
            className="bg-seal-600 hover:bg-seal-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            disabled={busy !== null || !employerCommitment}
            onClick={handleRequest}
          >
            {busy === "request" ? "Submitting…" : "1. Request aggregate decrypt"}
          </button>
          <button
            className="bg-evidence-600 hover:bg-evidence-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            disabled={busy !== null || !client || !requestTx}
            onClick={handleDecrypt}
          >
            {busy === "decrypt" ? "Decrypting…" : "2. Decrypt aggregate"}
          </button>
        </div>
        {requestTx && (
          <a
            href={`${cfg.explorerUrl}/tx/${requestTx}`}
            target="_blank"
            rel="noreferrer"
            className="text-seal-500 underline text-sm"
          >
            ACL grant tx → {requestTx.slice(0, 10)}…
          </a>
        )}
      </div>

      {aggCents !== null && (
        <section className="border border-evidence-500/40 rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-semibold">
            Exposure for <code className="font-mono">{employerLabel}</code>
          </h2>
          <div className="text-4xl font-mono text-evidence-500">
            ${(Number(aggCents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-ink-500">
            across {claimCount?.toString() ?? "?"} encrypted claim
            {claimCount === 1n ? "" : "s"}
          </div>
          {claimCount === 1n && (
            <Hint tone="error">
              ⚠ Only one claim is in this aggregate. Decryption effectively reveals
              that claim's amount. Production should enforce a minimum-N k-anonymity
              gate before allowing aggregate decrypt.
            </Hint>
          )}
        </section>
      )}

      {error && <Hint tone="error">{error}</Hint>}
    </div>
  );
}

function Hint({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "error";
}) {
  return (
    <div
      className={`p-4 rounded-lg ${
        tone === "error"
          ? "bg-alarm-500/10 text-alarm-500"
          : "bg-seal-100 dark:bg-seal-700/20 text-seal-700 dark:text-seal-100"
      }`}
    >
      {children}
    </div>
  );
}
