import { AmbientShield } from "@/components/primitives/AmbientShield";
import { BlurText } from "@/components/primitives/BlurText";
import { Eyebrow } from "@/components/primitives/Eyebrow";
import { PillButton } from "@/components/primitives/PillButton";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Receipts />
      <StatRow />
    </>
  );
}

/* --------------------------------------------------------------------------------
 *  Hero — full viewport, ambient SVG, italic-serif emphasis on "identity".
 * -------------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">
      <AmbientShield />

      <Eyebrow className="relative z-10 mb-6 sm:mb-8">
        Confidential wage-theft claims on Fhenix CoFHE
      </Eyebrow>

      <h1 className="relative z-10 max-w-4xl text-center text-3xl leading-tight font-medium text-foreground sm:text-5xl md:text-7xl tracking-tight">
        <BlurText text="Recover stolen wages, without revealing identity." italicWords={["identity."]} />
      </h1>

      <p className="relative z-10 mt-8 max-w-2xl text-center text-sm text-muted-foreground sm:mt-10 sm:text-base md:text-lg leading-relaxed">
        $50&nbsp;billion is stolen from US workers every year. Fewer than 1% file
        claims — naming yourself in court of record is a recipe for retaliation.
        WageShield lets a worker prove they're owed money, encrypted on-chain,
        without disclosing who they are.
      </p>

      <div className="relative z-10 mt-10 flex flex-col items-center gap-3 sm:mt-12 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
        <PillButton href="/worker" variant="primary">
          File a claim
        </PillButton>
        <PillButton href="/about" variant="ghost">
          How it works
        </PillButton>
        <PillButton
          href="https://sepolia.arbiscan.io/tx/0xb00687265c98de102ff83ba8e8e9ded8498272d20d660eafb8643060f3ddcb03"
          variant="ghost"
          arrow={false}
        >
          See the live tx ↗
        </PillButton>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------------
 *  Receipts — the "what a subpoena retrieves" scene + the "what the worker sees".
 *  Cinematic split that visually proves the privacy claim.
 * -------------------------------------------------------------------------------- */

function Receipts() {
  return (
    <section className="relative px-6 py-24 sm:py-32 border-t border-white/[0.06]">
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="space-y-3 max-w-2xl">
          <Eyebrow>The shouldn't-be-possible moment</Eyebrow>
          <h2 className="text-3xl font-medium tracking-tight sm:text-5xl">
            When a court asks <span className="font-serif italic">who filed claim #4721,</span> this is what it gets.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <ReceiptCard
            label="Public — anyone, including a subpoena"
            tone="muted"
            lines={[
              "claimId            : 4721",
              "employerCommitment : 0xa46e...b3f2",
              "timestampBucket    : 14:30 UTC ± 15 min",
              "attestationDigest  : 0x7c9b...0e51",
              "issuer             : 0x8335...8146   (Mock Homebase)",
              "",
              "/* no name. no employer. no amount. */",
            ]}
          />
          <ReceiptCard
            label="Worker — only this wallet, only with permit"
            tone="evidence"
            lines={[
              "claimId            : 4721",
              "worker             : 0x····...····   (you)",
              "hoursWorked        : 240",
              "hourlyRate         : $15.00",
              "owedCents          : 360000",
              "─────────────────────────────",
              "amount owed        : $3,600.00",
            ]}
          />
        </div>

        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Same on-chain claim. Two views. The chain stores ciphertexts, an employer
          commitment hash, and a bucketed timestamp — nothing else. Decryption is
          off-chain via CoFHE permits, scoped per role.
        </p>
      </div>
    </section>
  );
}

function ReceiptCard({
  label,
  tone,
  lines,
}: {
  label: string;
  tone: "muted" | "evidence";
  lines: string[];
}) {
  return (
    <div className="liquid-glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            tone === "evidence" ? "bg-evidence-400" : "bg-muted-foreground/50"
          }`}
        />
      </div>
      <pre
        className={`font-mono text-[11px] sm:text-xs leading-6 whitespace-pre overflow-x-auto ${
          tone === "evidence" ? "text-evidence-400" : "text-muted-foreground"
        }`}
      >
{lines.join("\n")}
      </pre>
    </div>
  );
}

/* --------------------------------------------------------------------------------
 *  Stat row — three numbers that hit hard. Mono, restrained.
 * -------------------------------------------------------------------------------- */

function StatRow() {
  return (
    <section className="px-6 py-24 sm:py-32 border-t border-white/[0.06]">
      <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-10">
        <Stat
          eyebrow="Stolen per year"
          number="$50B"
          body="Lower-bound estimate (EPI, Cooper & Kroeger 2017). 75% of low-wage workers experience some form of wage theft annually."
        />
        <Stat
          eyebrow="File a claim"
          number="< 1%"
          body="Bobo, Wage Theft in America (2014). The Department of Labor's process is public record — retaliation and immigration fear deter the rest."
        />
        <Stat
          eyebrow="Live testnet"
          number="$3,600"
          body="One encrypted claim, mined on Arbitrum Sepolia. The chain saw a hash; the worker saw the dollar figure."
          href="https://sepolia.arbiscan.io/tx/0xb00687265c98de102ff83ba8e8e9ded8498272d20d660eafb8643060f3ddcb03"
          tone="evidence"
        />
      </div>
    </section>
  );
}

function Stat({
  eyebrow,
  number,
  body,
  href,
  tone,
}: {
  eyebrow: string;
  number: string;
  body: string;
  href?: string;
  tone?: "evidence";
}) {
  const inner = (
    <div className="space-y-3 group">
      <Eyebrow>{eyebrow}</Eyebrow>
      <div
        className={`text-5xl sm:text-6xl font-medium tracking-tight ${
          tone === "evidence" ? "text-evidence-400" : "text-foreground"
        }`}
      >
        {number}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {body}
        {href && (
          <span className="block mt-2 text-foreground/80 group-hover:text-foreground transition">
            View on Arbiscan ↗
          </span>
        )}
      </p>
    </div>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return inner;
}
