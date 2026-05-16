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
import { useAccount } from "wagmi";
import { getAppConfig } from "@/lib/config";
import { useEthersSigner } from "@/lib/ethers-bridge";
import { Eyebrow } from "@/components/primitives/Eyebrow";
import { PillButton } from "@/components/primitives/PillButton";

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
  const { isConnected } = useAccount();
  const { client, connecting, error: cofheError, reason: cofheReason } =
    useCofheClient();
  const ethersBridge = useEthersSigner();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedAttestation, setSignedAttestation] = useState<SignedAttestation | null>(null);
  const [result, setResult] = useState<SubmitClaimResult | null>(null);
  const [decryptedOwed, setDecryptedOwed] = useState<bigint | null>(null);

  const [attorneyInput, setAttorneyInput] = useState("");
  const [grantTx, setGrantTx] = useState<Hex32 | null>(null);

  async function handleGetAttestation() {
    setError(null);
    setBusy("attestation");
    try {
      const signer = await ethersBridge.getSigner();
      const workerAddress = await signer.getAddress();
      const periodStartUnix = Math.floor(new Date(form.periodStart).getTime() / 1000);
      const periodEndUnix = Math.floor(new Date(form.periodEnd).getTime() / 1000);
      const r = await fetch(`${cfg.issuerUrl}/attest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          worker: workerAddress,
          employerLabel: form.employerLabel,
          hoursWorked: Number(form.hoursWorked),
          hourlyRateCents: Number(form.hourlyRateCents),
          periodStart: periodStartUnix,
          periodEnd: periodEndUnix,
        }),
      });
      if (!r.ok) throw new Error(`Issuer responded ${r.status}: ${await r.text()}`);
      const data = await r.json();
      const domain = buildAttestationDomain({
        chainId: cfg.chainId,
        wageClaimAddress: cfg.wageClaim,
      });
      setSignedAttestation({
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
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    if (!client || !signedAttestation) return;
    setError(null);
    setBusy("submit");
    try {
      const signer = await ethersBridge.getSigner();
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

  async function handleDecrypt() {
    if (!client || !result) return;
    setError(null);
    setBusy("decrypt");
    try {
      const provider = await ethersBridge.getProvider();
      const owed = await decryptOwed({
        client,
        provider,
        wageClaimAddress: cfg.wageClaim,
        claimId: result.claimId,
      });
      setDecryptedOwed(owed);
    } catch (e: any) {
      const msg: string = e?.message ?? String(e);
      const isAccessDenied =
        /\b(403|forbidden|acl|denied|unauthorized|not authorized)\b/i.test(msg);
      setError(
        isAccessDenied
          ? "Access denied. The wallet currently connected isn't the one that filed this claim, so the FHE network refused the decrypt. Reconnect with the original submitting wallet."
          : msg,
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleGrantAttorney() {
    if (!result || !attorneyInput) return;
    setError(null);
    setBusy("grant");
    try {
      const signer = await ethersBridge.getSigner();
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

  if (cfg.configError)
    return <PageMessage tone="error" message={cfg.configError} />;
  if (!isConnected)
    return <PageMessage message="Connect your wallet to file a claim." />;
  if (connecting) return <PageMessage message="Setting up encrypted compute…" />;
  if (cofheError) return <PageMessage tone="error" message={`CoFHE error: ${cofheError}`} />;

  return (
    <div className="px-6 pt-32 pb-24 space-y-16">
      <Header />

      <Step n="01" title={<>Get a <span className="font-serif italic">timeclock attestation</span></>}>
        <Field label="Employer label" value={form.employerLabel} onChange={(v) => setForm({ ...form, employerLabel: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hours worked" value={form.hoursWorked} type="number" onChange={(v) => setForm({ ...form, hoursWorked: v })} />
          <Field label="Hourly rate (cents)" value={form.hourlyRateCents} type="number" onChange={(v) => setForm({ ...form, hourlyRateCents: v })} />
          <Field label="Period start" value={form.periodStart} type="date" onChange={(v) => setForm({ ...form, periodStart: v })} />
          <Field label="Period end" value={form.periodEnd} type="date" onChange={(v) => setForm({ ...form, periodEnd: v })} />
        </div>
        <PillButton onClick={handleGetAttestation} disabled={busy !== null} variant="primary">
          {busy === "attestation" ? "Requesting…" : "Request attestation"}
        </PillButton>
        {signedAttestation && (
          <pre className="receipt">
{`signer    : ${signedAttestation.signer}
employerId: ${signedAttestation.attestation.employerId}
digest    : ${signedAttestation.digest}
nonce     : ${signedAttestation.attestation.nonce}`}
          </pre>
        )}
      </Step>

      <Step n="02" title={<>Encrypt and <span className="font-serif italic">submit on-chain</span></>} dim={!signedAttestation}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The SDK encrypts hours + rate via @cofhe/sdk on your device, then
          calls submitClaim on Fhenix CoFHE. The contract computes encrypted
          owed = hours × rate via FHE.mul, never seeing the plaintext.
        </p>

        {/* Status diagnostic — explicit reason the button is/isn't ready. */}
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase space-y-1 text-muted-foreground">
          <div>
            attestation: {signedAttestation ? <span className="text-evidence-400">ready ✓</span> : <span className="text-alarm-500">missing — click Step 1</span>}
          </div>
          <div>
            cofhe client: {client ? (
              <span className="text-evidence-400">ready ✓</span>
            ) : connecting ? (
              <span className="text-amber-400">connecting…</span>
            ) : cofheError ? (
              <span className="text-alarm-500" title={cofheError}>error — see hint below</span>
            ) : (
              <span className="text-alarm-500">{cofheReason}</span>
            )}
          </div>
        </div>

        {cofheError && (
          <div className="rounded-2xl border border-alarm-500/40 bg-alarm-500/10 px-4 py-3 text-xs text-alarm-500 leading-relaxed font-mono">
            {cofheError}
          </div>
        )}

        <PillButton onClick={handleSubmit} disabled={busy !== null || !signedAttestation || !client} variant="primary">
          {busy === "submit" ? "Encrypting + submitting…" : "Encrypt and submit"}
        </PillButton>
        {result && (
          <>
            <pre className="receipt">
{`claimId            : ${result.claimId}
tx                 : ${result.txHash}
block              : ${result.blockNumber}
gas                : ${result.gasUsed}
employerCommitment : ${result.event.employerCommitment}
timestampBucket    : ${result.event.timestampBucket}
issuer             : ${result.event.issuer}`}
            </pre>
            <a
              href={`${cfg.explorerUrl}/tx/${result.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-foreground transition"
            >
              View on block explorer ↗
            </a>
          </>
        )}
      </Step>

      <Step n="03" title={<>Reveal the <span className="font-serif italic">owed amount</span> — you only</>} dim={!result}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Off-chain decrypt via a CoFHE permit. Only your wallet can do this — the
          chain never sees the plaintext.
        </p>
        <PillButton onClick={handleDecrypt} disabled={busy !== null || !result} variant="evidence">
          {busy === "decrypt" ? "Decrypting…" : "Reveal owed amount"}
        </PillButton>
        {decryptedOwed !== null && (
          <div className="font-mono text-5xl sm:text-6xl text-evidence-400 tracking-tight">
            ${(Number(decryptedOwed) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        )}
      </Step>

      <Step n="04" title={<>Grant your <span className="font-serif italic">attorney</span> access</>} dim={!result}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The attorney sees only the claims you authorise — never your aggregate,
          never another worker's claim.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Field label="" placeholder="0xAttorneyAddress…" value={attorneyInput} onChange={setAttorneyInput} />
          <PillButton onClick={handleGrantAttorney} disabled={busy !== null || !ethers.isAddress(attorneyInput)} variant="primary">
            {busy === "grant" ? "Granting…" : "Grant access"}
          </PillButton>
        </div>
        {grantTx && (
          <a
            href={`${cfg.explorerUrl}/tx/${grantTx}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-foreground transition"
          >
            Grant tx → {grantTx.slice(0, 10)}… ↗
          </a>
        )}
      </Step>

      {error && (
        <div className="max-w-3xl rounded-2xl border border-alarm-500/40 bg-alarm-500/10 px-5 py-4 text-sm text-alarm-500">
          {error}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------
 *  Internals
 * -------------------------------------------------------------------------------- */

function Header() {
  return (
    <header className="max-w-3xl space-y-4">
      <Eyebrow>Worker · file a claim</Eyebrow>
      <h1 className="text-4xl sm:text-5xl font-medium tracking-tight leading-tight">
        Four steps. Nothing identifying <span className="font-serif italic">hits the chain.</span>
      </h1>
      <p className="text-base text-muted-foreground leading-relaxed">
        Issuer signs your timeclock. Your hours and rate are encrypted before they
        leave your device. The chain stores ciphertexts and a non-identifying receipt.
      </p>
    </header>
  );
}

function Step({
  n,
  title,
  dim,
  children,
}: {
  n: string;
  title: React.ReactNode;
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`max-w-3xl border-t border-white/[0.06] pt-10 transition-opacity ${
        dim ? "opacity-40" : ""
      }`}
    >
      <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[120px_1fr] gap-4 sm:gap-8">
        <div className="font-mono text-xs tracking-[0.3em] text-muted-foreground/60 pt-1">{n}</div>
        <div className="space-y-5">
          <h2 className="text-xl sm:text-2xl font-medium tracking-tight">{title}</h2>
          {children}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1 flex-1">
      {label && <span className="eyebrow">{label}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-seal-400/60 transition"
      />
    </label>
  );
}

function PageMessage({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "info" | "error";
}) {
  return (
    <div className="min-h-[100svh] flex items-center justify-center px-6">
      <div
        className={`max-w-md text-center space-y-4 ${
          tone === "error" ? "text-alarm-500" : "text-muted-foreground"
        }`}
      >
        <Eyebrow className="text-center">{tone === "error" ? "Error" : "Hint"}</Eyebrow>
        <p className="text-base leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
