"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
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
import { Eyebrow } from "@/components/primitives/Eyebrow";
import { PillButton } from "@/components/primitives/PillButton";

export default function RegulatorPage() {
  const cfg = getAppConfig();
  const { isConnected } = useAccount();
  const { client, connecting, error: cofheError } = useCofheClient();

  const [employerLabel, setEmployerLabel] = useState("EIN-12-3456789");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestTx, setRequestTx] = useState<Hex32 | null>(null);
  const [aggCents, setAggCents] = useState<bigint | null>(null);
  const [claimCount, setClaimCount] = useState<bigint | null>(null);

  const employerCommitment = employerLabel ? hashEmployerLabel(employerLabel) : null;

  async function handleRequest() {
    if (!employerCommitment) return;
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

  if (cfg.configError) return <Message tone="error" text={cfg.configError} />;
  if (!isConnected) return <Message text="Connect a registered regulator wallet." />;
  if (connecting) return <Message text="Setting up encrypted compute…" />;
  if (cofheError) return <Message tone="error" text={`CoFHE error: ${cofheError}`} />;

  return (
    <div className="px-6 pt-32 pb-24 space-y-12 max-w-4xl mx-auto w-full">
      <header className="space-y-4">
        <Eyebrow>Regulator · employer dashboard</Eyebrow>
        <h1 className="text-4xl sm:text-5xl font-medium tracking-tight leading-tight">
          Aggregate exposure, <span className="font-serif italic">never the individuals.</span>
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
          Enter an employer label. The dashboard reveals the total stolen-wage
          exposure across every encrypted claim against that employer — but never
          which worker filed what amount.
        </p>
      </header>

      <section className="liquid-glass rounded-2xl p-6 space-y-5 max-w-3xl">
        <label className="block space-y-1">
          <span className="eyebrow">Employer label · must match what workers entered</span>
          <input
            value={employerLabel}
            onChange={(e) => setEmployerLabel(e.target.value)}
            className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-seal-400/60 transition"
          />
        </label>
        {employerCommitment && (
          <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/70 break-all">
            commitment = {employerCommitment}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <PillButton onClick={handleRequest} disabled={busy !== null || !employerCommitment} variant="primary">
            {busy === "request" ? "Submitting…" : "1 · Request access"}
          </PillButton>
          <PillButton onClick={handleDecrypt} disabled={busy !== null || !client || !requestTx} variant="evidence">
            {busy === "decrypt" ? "Decrypting…" : "2 · Reveal aggregate"}
          </PillButton>
        </div>
        {requestTx && (
          <a
            href={`${cfg.explorerUrl}/tx/${requestTx}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-foreground transition"
          >
            ACL grant tx → {requestTx.slice(0, 10)}… ↗
          </a>
        )}
      </section>

      {aggCents !== null && (
        <section className="liquid-glass rounded-2xl p-6 space-y-4 max-w-3xl">
          <Eyebrow>Exposure for {employerLabel}</Eyebrow>
          <div className="font-mono text-5xl sm:text-6xl text-evidence-400 tracking-tight">
            ${(Number(aggCents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-muted-foreground">
            across {claimCount?.toString() ?? "?"} encrypted claim
            {claimCount === 1n ? "" : "s"}
          </div>
          {claimCount === 1n && (
            <div className="rounded-xl border border-alarm-500/40 bg-alarm-500/10 px-4 py-3 text-sm text-alarm-500 leading-relaxed">
              ⚠ Only one claim is in this aggregate. Decryption effectively reveals
              that claim's amount. Production should enforce a minimum-N k-anonymity
              gate before allowing aggregate decrypt.
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="rounded-2xl border border-alarm-500/40 bg-alarm-500/10 px-5 py-4 text-sm text-alarm-500 max-w-3xl">
          {error}
        </div>
      )}
    </div>
  );
}

function Message({ text, tone = "info" }: { text: string; tone?: "info" | "error" }) {
  return (
    <div className="min-h-[100svh] flex items-center justify-center px-6">
      <div className={`max-w-md text-center space-y-4 ${tone === "error" ? "text-alarm-500" : "text-muted-foreground"}`}>
        <Eyebrow className="text-center">{tone === "error" ? "Error" : "Hint"}</Eyebrow>
        <p className="text-base leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
