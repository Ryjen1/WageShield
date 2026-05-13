"use client";

import { useState } from "react";
import { ethers } from "ethers";
import {
  buildAttestationDomain,
  decryptOwed,
  grantAttorneyAccess as sdkGrantAttorneyAccess,
  submitClaim,
  type Address,
  type Hex32,
  type SignedAttestation,
  type SubmitClaimResult,
} from "@wageshield/sdk";
import { useCofheClient } from "@/hooks/useCofheClient";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { getAppConfig } from "@/lib/config";
import { getEthersProvider, getEthersSigner } from "@/lib/ethers-bridge";

interface FormState {
  employerLabel: string;
  hoursWorked: string;
  hourlyRateCents: string;
  periodStart: string;
  periodEnd: string;
}

const DEFAULT_FORM: FormState = {
  employerLabel: "EIN-12-3456789",
  hoursWorked: "240",
  hourlyRateCents: "1500",
  periodStart: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
  periodEnd: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
};

export default function WorkerPage() {
  const cfg = getAppConfig();
  const { address, isConnected } = useAccount();
  const { client, connecting, error: cofheError } = useCofheClient();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedAttestation, setSignedAttestation] = useState<SignedAttestation | null>(null);
  const [result, setResult] = useState<SubmitClaimResult | null>(null);
  const [decryptedOwed, setDecryptedOwed] = useState<bigint | null>(null);

  const [attorneyInput, setAttorneyInput] = useState("");
  const [grantTx, setGrantTx] = useState<Hex32 | null>(null);

  // ---- Step 1: get attestation from issuer ---------------------------------
  async function handleGetAttestation() {
    if (!address) return;
    setError(null);
    setBusy("attestation");
    try {
      const periodStartUnix = Math.floor(new Date(form.periodStart).getTime() / 1000);
      const periodEndUnix = Math.floor(new Date(form.periodEnd).getTime() / 1000);
      const r = await fetch(`${cfg.issuerUrl}/attest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          worker: address,
          employerLabel: form.employerLabel,
          hoursWorked: Number(form.hoursWorked),
          hourlyRateCents: Number(form.hourlyRateCents),
          periodStart: periodStartUnix,
          periodEnd: periodEndUnix,
        }),
      });
      if (!r.ok) {
        throw new Error(`Issuer responded ${r.status}: ${await r.text()}`);
      }
      const data = await r.json();
      const domain = buildAttestationDomain({
        chainId: cfg.chainId,
        wageClaimAddress: cfg.wageClaim,
      });
      // Reconstruct the bigint-typed attestation from the JSON-string fields.
      const signed: SignedAttestation = {
        attestation: {
          worker: data.attestation.worker as Address,
          employerId: data.attestation.employerId as Hex32,
          hoursWorked: BigInt(data.attestation.hoursWorked),
          hourlyRateCents: Number(data.attestation.hourlyRateCents),
          periodStart: BigInt(data.attestation.periodStart),
          periodEnd: BigInt(data.attestation.periodEnd),
          issuedAt: BigInt(data.attestation.issuedAt),
          nonce: data.attestation.nonce as Hex32,
        },
        signature: data.signature,
        signer: data.signer,
        digest: data.digest,
        domain,
      };
      setSignedAttestation(signed);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  // ---- Step 2: encrypt + submit --------------------------------------------
  async function handleSubmit() {
    if (!client || !walletClient || !signedAttestation) return;
    setError(null);
    setBusy("submit");
    try {
      const signer = await getEthersSigner();
      const r = await submitClaim({
        client,
        signer,
        wageClaimAddress: cfg.wageClaim,
        signedAttestation,
      });
      setResult(r);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  // ---- Step 3: decrypt the owed amount via permit --------------------------
  async function handleDecrypt() {
    if (!client || !result || !publicClient) return;
    setError(null);
    setBusy("decrypt");
    try {
      const provider = getEthersProvider();
      const owed = await decryptOwed({
        client,
        provider,
        wageClaimAddress: cfg.wageClaim,
        claimId: result.claimId,
      });
      setDecryptedOwed(owed);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  // ---- Step 4: grant attorney access ---------------------------------------
  async function handleGrantAttorney() {
    if (!result || !walletClient || !attorneyInput) return;
    setError(null);
    setBusy("grant");
    try {
      const signer = await getEthersSigner();
      const tx = await sdkGrantAttorneyAccess({
        signer,
        wageClaimAddress: cfg.wageClaim,
        claimId: result.claimId,
        attorney: attorneyInput as Address,
      });
      setGrantTx(tx);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  if (cfg.configError) return <Hint tone="error">{cfg.configError}</Hint>;
  if (!isConnected) {
    return <Hint>Connect your wallet to file a claim.</Hint>;
  }
  if (connecting) return <Hint>Setting up encrypted compute…</Hint>;
  if (cofheError) return <Hint tone="error">CoFHE error: {cofheError}</Hint>;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">File a wage-theft claim</h1>
        <p className="text-ink-500">
          Step 1 — Issuer signs your timeclock. Step 2 — your hours and rate are encrypted
          before they leave your device. Step 3 — the chain stores only the encrypted
          handles + a non-identifying receipt event.
        </p>
      </header>

      <Step n={1} title="Get a timeclock attestation">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employer label">
            <input
              className={inputCls}
              value={form.employerLabel}
              onChange={(e) => setForm({ ...form, employerLabel: e.target.value })}
            />
          </Field>
          <Field label="Hours worked">
            <input
              className={inputCls}
              type="number"
              value={form.hoursWorked}
              onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })}
            />
          </Field>
          <Field label="Hourly rate (cents)">
            <input
              className={inputCls}
              type="number"
              value={form.hourlyRateCents}
              onChange={(e) => setForm({ ...form, hourlyRateCents: e.target.value })}
            />
          </Field>
          <Field label="Period start">
            <input
              className={inputCls}
              type="date"
              value={form.periodStart}
              onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
            />
          </Field>
          <Field label="Period end">
            <input
              className={inputCls}
              type="date"
              value={form.periodEnd}
              onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
            />
          </Field>
        </div>
        <button
          className="bg-seal-600 hover:bg-seal-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          disabled={busy !== null}
          onClick={handleGetAttestation}
        >
          {busy === "attestation" ? "Requesting…" : "Get attestation"}
        </button>
        {signedAttestation && (
          <pre className="receipt">
            {`Signed by:    ${signedAttestation.signer}
EmployerId:   ${signedAttestation.attestation.employerId}
Digest:       ${signedAttestation.digest}
Nonce:        ${signedAttestation.attestation.nonce}`}
          </pre>
        )}
      </Step>

      <Step n={2} title="Encrypt and submit on-chain" disabled={!signedAttestation}>
        <p className="text-sm text-ink-500">
          The SDK encrypts hours + rate via @cofhe/sdk (ZK-proven inputs), then calls
          submitClaim on Fhenix CoFHE. The contract computes encrypted owed = hours ×
          rate via FHE.mul.
        </p>
        <button
          className="bg-seal-600 hover:bg-seal-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          disabled={busy !== null || !signedAttestation || !client}
          onClick={handleSubmit}
        >
          {busy === "submit" ? "Encrypting + submitting…" : "Encrypt + submit"}
        </button>
        {result && (
          <pre className="receipt">
            {`claimId:           ${result.claimId}
tx:                ${result.txHash}
block:             ${result.blockNumber}
gas:               ${result.gasUsed}
employerCommitment ${result.event.employerCommitment}
timestampBucket:   ${result.event.timestampBucket}
issuer:            ${result.event.issuer}`}
          </pre>
        )}
        {result && (
          <a
            href={`${cfg.explorerUrl}/tx/${result.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-seal-500 underline text-sm"
          >
            View on block explorer →
          </a>
        )}
      </Step>

      <Step n={3} title="Reveal the owed amount (you only)" disabled={!result}>
        <p className="text-sm text-ink-500">
          Off-chain decrypt via a CoFHE permit. Only your wallet can do this — the chain
          itself never sees the plaintext.
        </p>
        <button
          className="bg-evidence-600 hover:bg-evidence-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          disabled={busy !== null || !result}
          onClick={handleDecrypt}
        >
          {busy === "decrypt" ? "Decrypting…" : "Reveal owed amount"}
        </button>
        {decryptedOwed !== null && (
          <div className="text-3xl font-mono text-evidence-500">
            ${(Number(decryptedOwed) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        )}
      </Step>

      <Step n={4} title="Grant your attorney decrypt access" disabled={!result}>
        <p className="text-sm text-ink-500">
          The attorney sees only the claims you authorise — never your aggregate, never
          another worker's claim.
        </p>
        <div className="flex gap-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="0xAttorneyAddress…"
            value={attorneyInput}
            onChange={(e) => setAttorneyInput(e.target.value)}
          />
          <button
            className="bg-seal-600 hover:bg-seal-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            disabled={busy !== null || !ethers.isAddress(attorneyInput)}
            onClick={handleGrantAttorney}
          >
            {busy === "grant" ? "Granting…" : "Grant access"}
          </button>
        </div>
        {grantTx && (
          <a
            href={`${cfg.explorerUrl}/tx/${grantTx}`}
            target="_blank"
            rel="noreferrer"
            className="text-seal-500 underline text-sm"
          >
            Grant tx → {grantTx.slice(0, 10)}…
          </a>
        )}
      </Step>

      {error && <Hint tone="error">{error}</Hint>}
    </div>
  );
}

// --------------------------------------------------------------------------------
//  Local helpers
// --------------------------------------------------------------------------------

const inputCls =
  "w-full bg-ink-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg px-3 py-2 font-mono text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wider text-ink-500">{label}</span>
      {children}
    </label>
  );
}

function Step({
  n,
  title,
  disabled,
  children,
}: {
  n: number;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`space-y-3 border-l-2 pl-5 py-2 ${
        disabled
          ? "border-ink-200 dark:border-ink-700 opacity-50"
          : "border-seal-500"
      }`}
    >
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <span className="bg-seal-100 text-seal-700 rounded-full w-6 h-6 text-sm flex items-center justify-center">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
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


