import Link from "next/link";

export default function AboutPage() {
  return (
    <article className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">About WageShield</h1>
        <p className="text-xl text-ink-500">
          Privacy-by-design wage-theft claims. A worker proves they're owed money —
          without disclosing who they are, how many hours they worked, what their rate
          was, or which employer is being claimed against (in plaintext).
        </p>
      </header>

      <Section title="The architecture">
        <ol className="list-decimal pl-6 space-y-3 text-ink-700 dark:text-ink-200">
          <li>
            A trusted timeclock issuer (mock Homebase / 7shifts / worker-center co-op
            signer) signs an EIP-712 <Code>TimeclockAttestation</Code> committing to
            the worker's hours and rate. The plaintext values are committed-to in the
            signature, not revealed on-chain.
          </li>
          <li>
            The worker's app encrypts hours and rate locally via{" "}
            <Code>@cofhe/sdk</Code> (Fhenix CoFHE), producing ZK-proven{" "}
            <Code>InEuint*</Code> inputs.
          </li>
          <li>
            <Code>WageClaim.submitClaim(...)</Code> verifies the issuer signature,
            computes <Code>FHE.mul(eHours, eRate)</Code> on the encrypted inputs, and
            folds the result into a per-employer encrypted aggregate.
          </li>
          <li>
            The contract emits a subpoena-resistant <Code>ClaimSubmitted</Code> event
            with no PII — only an employer commitment, a 15-minute time bucket, the
            EIP-712 digest, and the issuer address.
          </li>
          <li>
            Off-chain, the worker decrypts their own owed amount via a CoFHE permit.
            They can grant decrypt access to a specific attorney via{" "}
            <Code>grantAttorneyAccess</Code>. A registered regulator can decrypt the
            per-employer <em>aggregate</em>, never individual claims.
          </li>
        </ol>
      </Section>

      <Section title="Why FHE specifically">
        <p className="text-ink-700 dark:text-ink-200">
          ZK proves a fact to a verifier without revealing the witness, but the
          verifier sees the assertion. TEE-based privacy outsources trust to Intel's
          chain of attestation. FHE keeps the data encrypted while it's being computed
          on — the contract operator, the chain, and observers all see only
          ciphertexts. For the wage-theft use case this matters because the
          per-employer aggregate is a sum across multiple workers' encrypted
          submissions; ZK can't aggregate without a joint proof, and TEE requires
          trusting an off-chain enclave operator with the plaintexts.
        </p>
      </Section>

      <Section title="Differentiator vs Compass-OG">
        <p className="text-ink-700 dark:text-ink-200">
          <ExternalLink href="https://github.com/StephenSook/Compass-OG-">
            Compass-OG-
          </ExternalLink>{" "}
          is the spiritual cousin of WageShield (private eligibility firewall on 0G,
          Phala TDX + SD-JWT VCs). Its honest-limits document flags one structural
          weakness:{" "}
          <em>
            on-chain attestation verification is gas-prohibitive, so the TEE quote is
            verified off-chain
          </em>
          . WageShield removes the TEE entirely. The policy evaluator runs in encrypted
          EVM — no Intel, no enclave operator, no off-chain attestation chain.
        </p>
      </Section>

      <Section title="Live deployment — Arbitrum Sepolia">
        <p className="text-ink-700 dark:text-ink-200">
          See <Link href="/" className="text-seal-500 underline">the home page</Link>{" "}
          for the live testnet transaction proving the full pipeline. Contract
          addresses and reproduce-it-yourself instructions live in the project README.
        </p>
      </Section>

      <Section title="What's not in this demo">
        <ul className="list-disc pl-6 space-y-3 text-ink-700 dark:text-ink-200">
          <li>
            <strong>Real worker identity / authentication.</strong> The mock issuer
            signs whatever the worker types — production would OAuth into Homebase /
            7shifts and sign only what the upstream platform vouches for.
          </li>
          <li>
            <strong>Privara <Code>ConfidentialEscrow</Code> wiring.</strong> The
            resolver and policy contracts are ABI-ready, but the end-to-end
            settlement-pool funding flow is a Wave 5 deliverable.
          </li>
          <li>
            <strong>k-anonymity gating</strong> on regulator aggregate decrypt. v1
            leaks single-claim aggregates; the regulator UI displays a warning when
            N=1.
          </li>
          <li>
            <strong>Mainnet.</strong> Fhenix CoFHE production support is forthcoming.
          </li>
        </ul>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-sm bg-ink-100 dark:bg-ink-700 px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-seal-500 underline hover:text-seal-600"
    >
      {children}
    </a>
  );
}
