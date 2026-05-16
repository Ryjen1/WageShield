/**
 * @wageshield/issuer — mock timeclock attestation service.
 *
 * What this is
 * ------------
 * A standalone HTTP API that mimics what a real third-party time-tracking platform
 * (Homebase, 7shifts, When-I-Work) or a worker-center co-op signer would expose: an
 * endpoint that, given (worker address, employer label, hours, hourly rate, work period),
 * returns an EIP-712 signed `TimeclockAttestation` struct. The struct's signer is the
 * server's `ISSUER_PRIVATE_KEY`.
 *
 * What this isn't
 * ---------------
 * Real authentication — there is no login, no JWT, no rate limit, no abuse prevention.
 * In production this would (1) authenticate the requesting worker via OAuth into the
 * upstream time-tracking platform, (2) fetch their canonical hours/rate from the
 * platform's authoritative API, and (3) sign only what the platform vouches for. Here
 * we trust whatever JSON the worker's UI hands us, because the demo's threat model is
 * **the chain not knowing who/what is being claimed**, not the issuer's own validation.
 *
 * Trust model
 * -----------
 * The on-chain `TimeclockIssuerRegistry` is the arbiter. If the address derived from
 * `ISSUER_PRIVATE_KEY` is registered as trusted there, our signatures verify; otherwise,
 * `WageClaim.submitClaim` reverts with `UntrustedIssuer`. Rotating the issuer is a
 * registry transaction, not a code change.
 */
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import { ethers } from "ethers";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as dotenvConfig } from "dotenv";
import {
  buildAttestation,
  buildAttestationDomain,
  signAttestation,
  hashEmployerLabel,
  type Address,
} from "@wageshield/sdk";

// --------------------------------------------------------------------------------
//  Env loading — auto-discover the monorepo root and load .env.local / .env from it
// --------------------------------------------------------------------------------

// `__dirname` is provided by CJS at runtime; tsx wires this up automatically for
// .ts files that aren't part of an ESM package. packages/issuer/src/index.ts
// resolves to the repo root two levels up.
const repoRoot = resolve(__dirname, "..", "..", "..");
for (const file of [".env.local", ".env"]) {
  const p = resolve(repoRoot, file);
  if (existsSync(p)) dotenvConfig({ path: p, override: false });
}

// --------------------------------------------------------------------------------
//  Config
// --------------------------------------------------------------------------------

// Host providers (Render, Railway, Fly.io, etc.) inject the public-facing port
// as PORT; honour that first, then fall back to our project-specific override,
// then the local dev default 4001.
const PORT = Number(process.env.PORT ?? process.env.ISSUER_PORT ?? 4001);
const ISSUER_PK = process.env.ISSUER_PRIVATE_KEY ?? "";
const NETWORK = process.env.NETWORK ?? "arb-sepolia";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";

// Resolve WageClaim address + chain ID. Priority:
//   1. explicit WAGECLAIM_ADDRESS / CHAIN_ID env vars
//   2. deployments/<NETWORK>.json (auto-discovered from the contracts workspace)
function loadDeployment(): { wageClaim?: string; chainId?: number } {
  try {
    const f = resolve(repoRoot, "packages", "contracts", "deployments", `${NETWORK}.json`);
    if (!existsSync(f)) return {};
    const dep = JSON.parse(readFileSync(f, "utf8"));
    return {
      wageClaim: dep.contracts?.WageClaim,
      chainId: dep.chainId ? Number(dep.chainId) : undefined,
    };
  } catch {
    return {};
  }
}
const fromDeployment = loadDeployment();
const WAGECLAIM_ADDRESS = process.env.WAGECLAIM_ADDRESS ?? fromDeployment.wageClaim ?? "";
const CHAIN_ID = Number(
  process.env.CHAIN_ID ?? fromDeployment.chainId ?? 421614
);

if (!ISSUER_PK || !ISSUER_PK.startsWith("0x")) {
  console.error(
    "FATAL: ISSUER_PRIVATE_KEY env var must be a 0x-prefixed 32-byte hex string."
  );
  process.exit(1);
}
if (!WAGECLAIM_ADDRESS || !ethers.isAddress(WAGECLAIM_ADDRESS)) {
  console.error(
    "FATAL: WAGECLAIM_ADDRESS env var (or deployments record) must yield a valid contract address."
  );
  process.exit(1);
}

const wallet = new ethers.Wallet(ISSUER_PK);
const domain = buildAttestationDomain({
  chainId: CHAIN_ID,
  wageClaimAddress: WAGECLAIM_ADDRESS as Address,
});

console.log(`[issuer] Signing as: ${wallet.address}`);
console.log(`[issuer] WageClaim:  ${WAGECLAIM_ADDRESS}`);
console.log(`[issuer] Network:    ${NETWORK} (chainId ${CHAIN_ID})`);

// --------------------------------------------------------------------------------
//  Validation
// --------------------------------------------------------------------------------

const AttestRequest = z.object({
  worker: z.string().refine(ethers.isAddress, "worker must be a valid address"),
  employerLabel: z
    .string()
    .min(1)
    .max(256, "employerLabel too long")
    .describe("plaintext employer label, e.g. EIN-12-3456789"),
  hoursWorked: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((v) => BigInt(v))
    .refine((v) => v >= 0n && v <= 0xffffffffffffffffn, "uint64 range"),
  hourlyRateCents: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((v) => Number(v))
    .refine(
      (v) => Number.isInteger(v) && v >= 0 && v <= 0xffffffff,
      "uint32 range"
    ),
  periodStart: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((v) => BigInt(v))
    .refine((v) => v > 0n && v <= 0xffffffffffffffffn, "uint64 range"),
  periodEnd: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((v) => BigInt(v))
    .refine((v) => v > 0n && v <= 0xffffffffffffffffn, "uint64 range"),
});

// --------------------------------------------------------------------------------
//  Server
// --------------------------------------------------------------------------------

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: "32kb" }));
app.use(morgan("tiny"));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    issuer: wallet.address,
    wageClaim: WAGECLAIM_ADDRESS,
    network: NETWORK,
    chainId: CHAIN_ID,
    domain,
  });
});

/**
 * POST /attest
 *
 * Request body:
 *   {
 *     worker: "0x...",
 *     employerLabel: "EIN-12-3456789",
 *     hoursWorked: 240,
 *     hourlyRateCents: 1500,
 *     periodStart: 1746230400,
 *     periodEnd:   1748908800
 *   }
 *
 * Response: a `SignedAttestation` from @wageshield/sdk.
 *
 * Bigint fields are JSON-serialised as strings (`hoursWorked`, `periodStart`, etc.)
 * because JSON does not support `bigint` natively. Clients must `BigInt(...)` them
 * before passing into `submitClaim`.
 */
app.post("/attest", async (req: Request, res: Response) => {
  const parsed = AttestRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
  }

  const v = parsed.data;
  if (v.periodEnd <= v.periodStart) {
    return res.status(400).json({ error: "period_end_must_exceed_period_start" });
  }

  // Pure-function builder — same code path the worker would use locally if they had
  // direct access to a trusted issuer's signing key.
  const attestation = buildAttestation({
    worker: v.worker as Address,
    employerLabel: v.employerLabel,
    hoursWorked: v.hoursWorked,
    hourlyRateCents: v.hourlyRateCents,
    periodStart: v.periodStart,
    periodEnd: v.periodEnd,
  });

  const signed = await signAttestation({
    signer: wallet,
    domain,
    attestation,
  });

  // Serialise bigints as strings so JSON.stringify works.
  return res.json({
    attestation: {
      worker: signed.attestation.worker,
      employerId: signed.attestation.employerId,
      hoursWorked: signed.attestation.hoursWorked.toString(),
      hourlyRateCents: signed.attestation.hourlyRateCents,
      periodStart: signed.attestation.periodStart.toString(),
      periodEnd: signed.attestation.periodEnd.toString(),
      issuedAt: signed.attestation.issuedAt.toString(),
      nonce: signed.attestation.nonce,
    },
    signature: signed.signature,
    signer: signed.signer,
    digest: signed.digest,
    domain: signed.domain,
    /** Convenience: the same hash the contract derives from `employerLabel`. */
    employerCommitment: hashEmployerLabel(v.employerLabel),
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[issuer] error:", err);
  res.status(500).json({ error: "internal_error", message: err.message });
});

app.listen(PORT, () => {
  console.log(`[issuer] listening on http://0.0.0.0:${PORT}`);
});
