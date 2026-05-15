"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import {
  decryptHoursAndRate,
  readClaimMeta,
  type Address,
} from "@wageshield/sdk";
import { useCofheClient } from "@/hooks/useCofheClient";
import { getAppConfig } from "@/lib/config";
import { useEthersSigner } from "@/lib/ethers-bridge";
import { Eyebrow } from "@/components/primitives/Eyebrow";
import { PillButton } from "@/components/primitives/PillButton";

interface DecryptedClaim {
  claimId: bigint;
  worker: Address;
  employerCommitment: string;
  hoursWorked: bigint;
  hourlyRateCents: bigint;
  owedCents: bigint;
  disputed: boolean;
  resolved: boolean;
}

export default function AttorneyPage() {
  const cfg = getAppConfig();
  const { isConnected } = useAccount();
  const { client, connecting, error: cofheError } = useCofheClient();
  const ethersBridge = useEthersSigner();
  const [claimIdInput, setClaimIdInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claim, setClaim] = useState<DecryptedClaim | null>(null);

  async function handleOpen() {
    if (!client || !claimIdInput) return;
    setError(null);
    setClaim(null);
    setBusy(true);
    try {
      const claimId = BigInt(claimIdInput);
      const provider = await ethersBridge.getProvider();
      const meta = await readClaimMeta({ provider, wageClaimAddress: cfg.wageClaim, claimId });
      const decrypted = await decryptHoursAndRate({ client, provider, wageClaimAddress: cfg.wageClaim, claimId });
      setClaim({
        claimId,
        worker: meta.worker,
        employerCommitment: meta.employerCommitment,
        hoursWorked: decrypted.hoursWorked,
        hourlyRateCents: decrypted.hourlyRateCents,
        owedCents: decrypted.owedCents,
        disputed: meta.disputed,
        resolved: meta.resolved,
      });
    } catch (e: any) {
      const msg: string = e?.message ?? String(e);
      // The CoFHE threshold network returns HTTP 403 when the calling wallet
      // doesn't have an ACL grant on the requested ciphertext. Different SDK
      // versions phrase this slightly differently ("ACL denied", "Forbidden",
      // "sealOutput request failed: HTTP 403", "access denied", etc.) so match
      // broadly. The user-facing message has to make clear this is the system
      // *working*, not a bug.
      const isAccessDenied =
        /\b(403|forbidden|acl|denied|unauthorized|not authorized)\b/i.test(msg);
      setError(
        isAccessDenied
          ? "Access denied — this wallet has no permit for that claim. The worker must call grantAttorneyAccess(claimId, your-address) on-chain before you can decrypt. (This is the FHE access control working as designed.)"
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  if (cfg.configError) return <Message tone="error" text={cfg.configError} />;
  if (!isConnected)
    return (
      <Message text="Connect your attorney wallet. The worker must have called grantAttorneyAccess(claimId, your-address) for you to decrypt." />
    );
  if (connecting) return <Message text="Setting up encrypted compute…" />;
  if (cofheError) return <Message tone="error" text={`CoFHE error: ${cofheError}`} />;

  return (
    <div className="px-6 pt-32 pb-24 space-y-12 max-w-4xl mx-auto w-full">
      <header className="space-y-4">
        <Eyebrow>Attorney · case inbox</Eyebrow>
        <h1 className="text-4xl sm:text-5xl font-medium tracking-tight leading-tight">
          Open a claim by ID. <span className="font-serif italic">Only the cases your client authorised.</span>
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
          You see hours, hourly rate, and the computed owed amount — but only for
          claims the worker has explicitly granted your address to view.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end max-w-2xl">
        <label className="block space-y-1 flex-1">
          <span className="eyebrow">claim id</span>
          <input
            value={claimIdInput}
            onChange={(e) => setClaimIdInput(e.target.value)}
            placeholder="e.g. 1"
            className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-seal-400/60 transition"
          />
        </label>
        <PillButton onClick={handleOpen} disabled={busy || !claimIdInput || !client} variant="primary">
          {busy ? "Decrypting…" : "Open claim"}
        </PillButton>
      </div>

      {claim && (
        <section className="liquid-glass rounded-2xl p-6 space-y-5">
          <header className="flex items-center justify-between flex-wrap gap-3">
            <Eyebrow>Claim #{claim.claimId.toString()}</Eyebrow>
            <div className="flex gap-2 text-xs">
              {claim.disputed && (
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase border border-alarm-500/40 text-alarm-500 rounded-full px-2.5 py-1">
                  disputed
                </span>
              )}
              {claim.resolved && (
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase border border-evidence-400/40 text-evidence-400 rounded-full px-2.5 py-1">
                  resolved
                </span>
              )}
            </div>
          </header>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Detail label="Worker">
              <code className="font-mono text-sm text-muted-foreground break-all">
                {claim.worker}
              </code>
            </Detail>
            <Detail label="Employer commitment">
              <code className="font-mono text-sm text-muted-foreground break-all">
                {claim.employerCommitment.slice(0, 10)}…{claim.employerCommitment.slice(-6)}
              </code>
            </Detail>
            <Detail label="Hours worked">
              <span className="font-mono text-base text-foreground">{claim.hoursWorked.toString()}</span>
            </Detail>
            <Detail label="Hourly rate">
              <span className="font-mono text-base text-foreground">
                ${(Number(claim.hourlyRateCents) / 100).toFixed(2)}
              </span>
            </Detail>
            <Detail label="Owed (decrypted)" wide>
              <span className="font-mono text-3xl text-evidence-400 tracking-tight">
                ${(Number(claim.owedCents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </Detail>
          </dl>

          <p className="text-xs text-muted-foreground/80 leading-relaxed pt-3 border-t border-white/[0.06]">
            These plaintext values are visible to your address only because the worker
            granted you ACL access. They are not visible to the contract operator, the
            chain, or any other party.
          </p>
        </section>
      )}

      {error && (
        <div className="rounded-2xl border border-alarm-500/40 bg-alarm-500/10 px-5 py-4 text-sm text-alarm-500">
          {error}
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-1 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="eyebrow">{label}</dt>
      <dd>{children}</dd>
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
