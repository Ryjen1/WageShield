import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <h1 className="text-5xl font-semibold tracking-tight">
          Recover stolen wages.
          <br />
          <span className="text-seal-500">Without revealing who you are.</span>
        </h1>
        <p className="text-xl text-ink-500 max-w-2xl">
          WageShield is a confidential wage-theft claims layer on Fhenix CoFHE.
          Workers prove they're owed money — without disclosing their name,
          immigration status, hours, or rate. Attorneys see the cases their clients
          authorise. Regulators see employer-level totals. The chain sees nothing
          identifying.
        </p>
        <div className="flex gap-3">
          <Link
            href="/worker"
            className="bg-seal-600 hover:bg-seal-700 text-white px-5 py-3 rounded-lg font-medium"
          >
            File a claim →
          </Link>
          <Link
            href="/about"
            className="px-5 py-3 rounded-lg border border-ink-300 dark:border-ink-700"
          >
            How it works
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          eyebrow="$50B/yr"
          title="Stolen from US workers"
          body="Lower-bound estimate (EPI 2017). 75% of low-wage workers experience some form of theft."
        />
        <Card
          eyebrow="<1%"
          title="File a claim"
          body="The DOL's own filing process requires name + employer + dates — a recipe for retaliation."
        />
        <Card
          eyebrow="$3,600"
          title="Live testnet claim"
          body="Encrypted on-chain in a single tx. The chain sees a commitment hash, not a dollar figure."
          href="https://sepolia.arbiscan.io/tx/0xb00687265c98de102ff83ba8e8e9ded8498272d20d660eafb8643060f3ddcb03"
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">The "shouldn't be possible" moment</h2>
        <p className="text-ink-500 max-w-2xl">
          When a court asks the WageShield contract <em>"who filed claim #4721?"</em>,
          the public record produces:
        </p>
        <pre className="receipt">
{`14:32:00 ± 15 min
Someone with a Homebase-class timeclock attestation
filed a wage-theft claim against an employer whose
ID hashes to 0xa46e…b3f2.

That's all that exists.`}
        </pre>
        <p className="text-sm text-ink-500">
          No name. No address. No immigration status. No dollar amount. No employer
          identity (only a commitment hash). The plaintext is decryptable only by the
          worker, an attorney they explicitly authorise, or a regulator querying
          aggregate exposure.
        </p>
      </section>
    </div>
  );
}

function Card({
  eyebrow,
  title,
  body,
  href,
}: {
  eyebrow: string;
  title: string;
  body: string;
  href?: string;
}) {
  const inner = (
    <div className="border border-ink-200 dark:border-ink-700 rounded-xl p-5 space-y-1 hover:border-seal-400 transition">
      <div className="text-seal-500 font-mono text-sm">{eyebrow}</div>
      <div className="font-medium text-lg">{title}</div>
      <div className="text-ink-500 text-sm">{body}</div>
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    inner
  );
}
