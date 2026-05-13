import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="prose dark:prose-invert max-w-3xl">
      <h1>About WageShield</h1>

      <p className="lead">
        Privacy-by-design wage-theft claims. A worker proves they're owed money — without
        disclosing who they are, how many hours they worked, what their rate was, or
        which employer is being claimed against (in plaintext).
      </p>

      <h2>The architecture</h2>
      <ol>
        <li>
          A trusted timeclock issuer (mock Homebase / 7shifts / worker-center co-op
          signer) signs an EIP-712 <code>TimeclockAttestation</code> committing to the
          worker's hours and rate. The plaintext values are committed-to in the
          signature, not revealed on-chain.
        </li>
        <li>
          The worker's app encrypts hours and rate locally via{" "}
          <code>@cofhe/sdk</code> (Fhenix CoFHE), producing ZK-proven{" "}
          <code>InEuint*</code> inputs.
        </li>
        <li>
          <code>WageClaim.submitClaim(...)</code> verifies the issuer signature, computes{" "}
          <code>FHE.mul(eHours, eRate)</code> on the encrypted inputs, and folds the
          result into a per-employer encrypted aggregate.
        </li>
        <li>
          The contract emits a subpoena-resistant <code>ClaimSubmitted</code> event with
          no PII — only an employer commitment, a 15-minute time bucket, the EIP-712
          digest, and the issuer address.
        </li>
        <li>
          Off-chain, the worker decrypts their own owed amount via a CoFHE permit. They
          can grant decrypt access to a specific attorney via{" "}
          <code>grantAttorneyAccess</code>. A registered regulator can decrypt the
          per-employer <em>aggregate</em>, never individual claims.
        </li>
      </ol>

      <h2>Why FHE specifically</h2>
      <p>
        ZK proves a fact to a verifier without revealing the witness, but the verifier
        sees the assertion. TEE-based privacy outsources trust to Intel's chain of
        attestation. FHE keeps the data encrypted while it's being computed on — the
        contract operator, the chain, and observers all see only ciphertexts. For the
        wage-theft use case this matters because the per-employer aggregate is a sum
        across multiple workers' encrypted submissions; ZK can't aggregate without a
        joint proof, and TEE requires trusting an off-chain enclave operator with the
        plaintexts.
      </p>

      <h2>Differentiator vs Compass-OG</h2>
      <p>
        <Link href="https://github.com/StephenSook/Compass-OG-">Compass-OG-</Link> is the
        spiritual cousin of WageShield (private eligibility firewall on 0G, Phala TDX +
        SD-JWT VCs). Its honest-limits document flags one structural weakness:{" "}
        <em>on-chain attestation verification is gas-prohibitive, so the TEE quote is
        verified off-chain</em>. WageShield removes the TEE entirely. The policy
        evaluator runs in encrypted EVM — no Intel, no enclave operator, no off-chain
        attestation chain.
      </p>

      <h2>Live deployment — Arbitrum Sepolia</h2>
      <p>
        See <Link href="/">the home page</Link> for the live testnet transaction proving
        the full pipeline. Contract addresses and reproduce-it-yourself instructions
        live in the project README.
      </p>

      <h2>What's not in this demo</h2>
      <ul>
        <li>
          Real worker identity / authentication. The mock issuer signs whatever the
          worker types — production would OAuth into Homebase / 7shifts and sign only
          what the upstream platform vouches for.
        </li>
        <li>
          Privara <code>ConfidentialEscrow</code> wiring. The resolver and policy
          contracts are ABI-ready, but the end-to-end settlement-pool funding flow is
          a Wave 5 deliverable.
        </li>
        <li>
          k-anonymity gating on regulator aggregate decrypt. v1 leaks single-claim
          aggregates; the regulator UI displays a warning when N=1.
        </li>
        <li>
          Mainnet. Fhenix CoFHE production support is forthcoming.
        </li>
      </ul>
    </div>
  );
}
