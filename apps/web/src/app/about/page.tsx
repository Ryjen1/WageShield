import { Eyebrow } from "@/components/primitives/Eyebrow";
import { PillButton } from "@/components/primitives/PillButton";

export default function AboutPage() {
  return (
    <article className="px-6 pt-32 pb-24 space-y-24">
      <Header />
      <HowItWorks />
      <WhyFHE />
      <Status />
      <Footer />
    </article>
  );
}

function Header() {
  return (
    <header className="mx-auto max-w-3xl space-y-6">
      <Eyebrow>About</Eyebrow>
      <h1 className="text-4xl sm:text-6xl font-medium tracking-tight leading-tight">
        Bounded disclosure, <span className="font-serif italic">on the wire.</span>
      </h1>
      <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
        WageShield is a confidential wage-theft claims layer on Fhenix CoFHE.
        Settlement pools pay. Subpoenas reach bucketed timestamps and cryptographic
        commitments — no name, no employer, no amount.
      </p>
    </header>
  );
}

function HowItWorks() {
  const steps: Array<{ n: string; title: React.ReactNode; body: string }> = [
    {
      n: "01",
      title: <>Issuer signs a <span className="font-serif italic">timeclock attestation</span></>,
      body: "A trusted issuer (mock Homebase / 7shifts / worker-center co-op signer) EIP-712-signs (worker, employerId, hours, rate, period). Plaintext values are committed to in the signature — never revealed on-chain.",
    },
    {
      n: "02",
      title: <>Worker encrypts <span className="font-serif italic">on their device</span></>,
      body: "@cofhe/sdk encrypts hours + rate locally on the worker's device. The encrypted inputs ship with a CoFHE input-validity proof so the contract knows the ciphertext is well-formed. Plaintext never leaves the browser.",
    },
    {
      n: "03",
      title: <>Contract runs <span className="font-serif italic">FHE.mul</span> on encrypted state</>,
      body: "WageClaim.submitClaim verifies the issuer signature, computes owedCents = hours × rate via FHE.mul, folds the result into a per-employer encrypted aggregate via FHE.add.",
    },
    {
      n: "04",
      title: <>Receipt commits to <span className="font-serif italic">a hash, not a person</span></>,
      body: "ClaimSubmitted emits: claimId, employerCommitment hash, 15-min timestamp bucket, EIP-712 digest, issuer address. That's the whole on-chain disclosure.",
    },
    {
      n: "05",
      title: <>Decryption is <span className="font-serif italic">role-scoped, off-chain</span></>,
      body: "Worker decrypts their own claim. Attorney decrypts only the claims the worker granted them. Regulator decrypts only the per-employer aggregate. Public sees ciphertexts.",
    },
  ];
  return (
    <section className="mx-auto max-w-4xl space-y-10">
      <div className="space-y-3 max-w-2xl">
        <Eyebrow>Architecture</Eyebrow>
        <h2 className="text-3xl sm:text-4xl font-medium tracking-tight">
          Five steps. No plaintext on-chain.
        </h2>
      </div>
      <ol className="space-y-8">
        {steps.map((s) => (
          <li key={s.n} className="grid grid-cols-[64px_1fr] sm:grid-cols-[120px_1fr] gap-4 sm:gap-8 border-t border-white/[0.06] pt-8 first:border-t-0 first:pt-0">
            <div className="font-mono text-xs tracking-[0.3em] text-muted-foreground/60 pt-1">
              {s.n}
            </div>
            <div className="space-y-3">
              <h3 className="text-xl sm:text-2xl font-medium tracking-tight">{s.title}</h3>
              <p className="text-base text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function WhyFHE() {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Eyebrow>Why FHE specifically</Eyebrow>
      <h2 className="text-3xl sm:text-4xl font-medium tracking-tight">
        Cross-worker aggregation breaks <span className="font-serif italic">every other privacy primitive.</span>
      </h2>
      <div className="space-y-4 text-base text-muted-foreground leading-relaxed">
        <p>
          ZK proves a fact to a verifier without revealing the witness — but it
          requires a joint proof from every contributor. Workers submit claims
          asynchronously, across weeks, across jurisdictions. There is no
          coordinated moment to produce a joint ZK proof.
        </p>
        <p>
          TEE-based privacy outsources trust to a hardware vendor's attestation
          chain and an off-chain enclave operator. The moment that operator is
          subpoenaed, every worker's plaintext leaks retroactively.
        </p>
        <p>
          FHE keeps the data encrypted <em>while it's being computed on</em>. The
          per-employer aggregate is computed as <code className="font-mono text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">FHE.add</code> across
          each worker's independently-submitted ciphertext. No joint proof. No
          shared enclave. No vendor attestation. The trust assumption is "FHE
          soundness holds" — that's it.
        </p>
      </div>
    </section>
  );
}

function Status() {
  const rows: Array<{ component: string; status: "real" | "draft" | "planned"; note: string }> = [
    { component: "WageClaim.sol — encrypted claims registry", status: "real", note: "Live on Arbitrum Sepolia. 5/5 mock-env tests passing." },
    { component: "WageTheftResolver — Privara IConditionResolver", status: "real", note: "Gates escrow release on dispute window + resolution flags." },
    { component: "WageTheftPolicy — Privara IUnderwriterPolicy", status: "real", note: "Encrypted risk score + dispute judgment." },
    { component: "TimeclockIssuerRegistry — trusted-issuer allow-list", status: "real", note: "v1 owner-managed; v2 spec'd as 5-of-7 quorum + 7-day timelock." },
    { component: "Live testnet e2e (encrypted FHE.mul + permit decrypt)", status: "real", note: "tx 0xb00687...dcb03 on Arbitrum Sepolia. Decrypted $3,600 — exact match." },
    { component: "Web app (worker / attorney / regulator / about)", status: "real", note: "Next.js 14 + wagmi + @cofhe/sdk. You're using it now." },
    { component: "Mock timeclock issuer service", status: "real", note: "Express + EIP-712 signer. Auto-discovers deployed WageClaim." },
    { component: "Privara ConfidentialEscrow end-to-end demo", status: "draft", note: "Resolver + Policy ABI-ready; SDK glue lands in Wave 5." },
    { component: "k-anonymity gate on regulator aggregate decrypt", status: "planned", note: "v1 leaks single-claim aggregates; UI warns when N=1." },
    { component: "Real time-tracker integrations (Homebase / 7shifts OAuth)", status: "planned", note: "Mock issuer proves the cryptographic shape; production needs real upstream." },
    { component: "Mainnet deployment", status: "planned", note: "Pending Fhenix CoFHE production launch." },
  ];
  const toneByStatus: Record<string, string> = {
    real: "text-evidence-400 border-evidence-400/40",
    draft: "text-amber-400 border-amber-400/40",
    planned: "text-muted-foreground border-white/15",
  };
  return (
    <section className="mx-auto max-w-4xl space-y-10">
      <div className="space-y-3 max-w-2xl">
        <Eyebrow>What's real / what's mocked</Eyebrow>
        <h2 className="text-3xl sm:text-4xl font-medium tracking-tight">
          The <span className="font-serif italic">honest scope</span> table.
        </h2>
      </div>
      <div className="divide-y divide-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
        {rows.map((r) => (
          <div key={r.component} className="grid grid-cols-[1fr_88px] gap-4 px-5 py-4 hover:bg-white/[0.02] transition">
            <div className="space-y-1">
              <div className="text-base font-medium text-foreground">{r.component}</div>
              <div className="text-sm text-muted-foreground">{r.note}</div>
            </div>
            <div className="flex items-start justify-end">
              <span
                className={`font-mono text-[10px] tracking-[0.3em] uppercase border rounded-full px-2.5 py-1 ${toneByStatus[r.status]}`}
              >
                {r.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <section className="mx-auto max-w-3xl space-y-6 text-center">
      <Eyebrow className="text-center">Try it</Eyebrow>
      <h2 className="text-3xl sm:text-4xl font-medium tracking-tight">
        File a claim. Decrypt the amount. <span className="font-serif italic">No one else can.</span>
      </h2>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4 pt-2">
        <PillButton href="/worker" variant="primary">
          File a claim
        </PillButton>
        <PillButton
          href="https://github.com/Ryjen1/WageShield"
          variant="ghost"
          arrow={false}
        >
          Source on GitHub ↗
        </PillButton>
      </div>
    </section>
  );
}
