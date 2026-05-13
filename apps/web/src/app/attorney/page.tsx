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
import { getEthersProvider } from "@/lib/ethers-bridge";

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
      const provider = getEthersProvider();
      const meta = await readClaimMeta({
        provider,
        wageClaimAddress: cfg.wageClaim,
        claimId,
      });
      const decrypted = await decryptHoursAndRate({
        client,
        provider,
        wageClaimAddress: cfg.wageClaim,
        claimId,
      });
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
      setError(
        e?.message?.includes("ACL") || e?.message?.includes("denied")
          ? "Decryption denied. Has the worker granted you access via grantAttorneyAccess?"
          : e?.message ?? String(e),
      );
    } finally {
      setBusy(false);
    }
  }

  if (cfg.configError) return <Hint tone="error">{cfg.configError}</Hint>;
  if (!isConnected) {
    return (
      <Hint>
        Connect your attorney wallet. The worker must have called
        `grantAttorneyAccess(claimId, your-address)` for you to decrypt.
      </Hint>
    );
  }
  if (connecting) return <Hint>Setting up encrypted compute…</Hint>;
  if (cofheError) return <Hint tone="error">CoFHE error: {cofheError}</Hint>;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Attorney inbox</h1>
        <p className="text-ink-500">
          Open a claim by ID. You see hours, hourly rate, and the computed owed amount —
          but only for claims the worker has explicitly authorised your address to view.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          className="bg-ink-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg px-3 py-2 font-mono w-32"
          placeholder="claimId"
          value={claimIdInput}
          onChange={(e) => setClaimIdInput(e.target.value)}
        />
        <button
          className="bg-seal-600 hover:bg-seal-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          disabled={busy || !claimIdInput || !client}
          onClick={handleOpen}
        >
          {busy ? "Decrypting…" : "Open claim"}
        </button>
      </div>

      {claim && (
        <section className="border border-evidence-500/30 rounded-xl p-5 space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Claim #{claim.claimId.toString()}</h2>
            <div className="flex gap-2 text-xs">
              {claim.disputed && (
                <span className="bg-alarm-500/20 text-alarm-500 px-2 py-1 rounded">
                  disputed
                </span>
              )}
              {claim.resolved && (
                <span className="bg-evidence-500/20 text-evidence-500 px-2 py-1 rounded">
                  resolved
                </span>
              )}
            </div>
          </header>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Worker" mono>
              {claim.worker}
            </Detail>
            <Detail label="EmployerCommitment" mono>
              {claim.employerCommitment.slice(0, 10)}…
              {claim.employerCommitment.slice(-6)}
            </Detail>
            <Detail label="Hours worked">{claim.hoursWorked.toString()}</Detail>
            <Detail label="Hourly rate">${(Number(claim.hourlyRateCents) / 100).toFixed(2)}</Detail>
            <Detail label="Owed (decrypted)">
              <span className="text-evidence-500 font-semibold">
                ${(Number(claim.owedCents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </Detail>
          </div>
          <p className="text-xs text-ink-500">
            These plaintext values are visible to your address only because the worker
            granted you ACL access. They are not visible to the contract operator, the
            chain, or any other party.
          </p>
        </section>
      )}

      {error && <Hint tone="error">{error}</Hint>}
    </div>
  );
}

function Detail({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
      <div className={mono ? "font-mono text-sm break-all" : "text-base"}>{children}</div>
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
