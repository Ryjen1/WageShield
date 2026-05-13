/**
 * @wageshield/issuer — mock timeclock attestation service.
 *
 * What this is
 * ------------
 * A standalone HTTP API that mimics what a real third-party time-tracking platform
 * (Homebase, 7shifts, When-I-Work) or a worker-center co-op signer would expose: an
 * endpoint that, given (worker address, employer ID, hours, hourly rate, work period),
 * returns an EIP-712 signed `TimeclockAttestation` struct. The struct's signer is the
 * server's `ISSUER_PRIVATE_KEY`.
 *
 * What this isn't
 * ---------------
 * Real authentication — there is no login, no JWT, no rate limit, no abuse prevention.
 * In production, this service would (1) authenticate the requesting worker via OAuth
 * to the upstream time-tracking platform, (2) fetch their canonical hours/rate from the
 * platform's authoritative API, and (3) sign only what the platform vouches for. Here we
 * trust whatever JSON the worker's UI hands us, because the demo's threat model is
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
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as dotenvConfig } from "dotenv";

// --------------------------------------------------------------------------------
//  Env loading — auto-discover the monorepo root and load .env.local / .env from it
// --------------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// packages/issuer/src/index.ts -> repo root is two dirs up from packages/issuer/
const repoRoot = resolve(__dirname, "..", "..", "..");
for (const file of [".env.local", ".env"]) {
  const p = resolve(repoRoot, file);
  if (existsSync(p)) dotenvConfig({ path: p, override: false });
}

// --------------------------------------------------------------------------------
//  Config
// --------------------------------------------------------------------------------

const PORT = Number(process.env.ISSUER_PORT ?? 4001);
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
    "FATAL: WAGECLAIM_ADDRESS env var must be the deployed WageClaim contract address."
  );
  process.exit(1);
}

const wallet = new ethers.Wallet(ISSUER_PK);
console.log(`[issuer] Signing as: ${wallet.address}`);
console.log(`[issuer] WageClaim:  ${WAGECLAIM_ADDRESS}`);
console.log(`[issuer] Chain:      ${CHAIN_ID}`);

const DOMAIN = {
  name: "WageShield.WageClaim",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: WAGECLAIM_ADDRESS,
} as const;

const TYPES = {
  TimeclockAttestation: [
    { name: "worker", type: "address" },
    { name: "employerId", type: "bytes32" },
    { name: "hoursWorked", type: "uint64" },
    { name: "hourlyRateCents", type: "uint32" },
    { name: "periodStart", type: "uint64" },
    { name: "periodEnd", type: "uint64" },
    { name: "issuedAt", type: "uint64" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

// --------------------------------------------------------------------------------
//  Validation
// --------------------------------------------------------------------------------

const AttestRequest = z.object({
  worker: z.string().refine(ethers.isAddress, "worker must be a valid address"),
  /** Plaintext employer identifier; the contract hashes this with keccak256. */
  employerId: z
    .string()
    .min(1)
    .max(256, "employerId too long")
    .describe("plaintext employer label, e.g. EIN-12-3456789"),
  /** Hours worked in the period. uint64. */
  hoursWorked: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((v) => BigInt(v))
    .refine((v) => v >= 0n && v <= 0xffffffffffffffffn, "uint64 range"),
  /** Hourly rate in **cents** (US$). uint32. */
  hourlyRateCents: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((v) => Number(v))
    .refine(
      (v) => Number.isInteger(v) && v >= 0 && v <= 0xffffffff,
      "uint32 range"
    ),
  /** Period start, unix seconds. uint64. */
  periodStart: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((v) => BigInt(v))
    .refine((v) => v > 0n && v <= 0xffffffffffffffffn, "uint64 range"),
  /** Period end, unix seconds. uint64. */
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
    chainId: CHAIN_ID,
    domain: DOMAIN,
  });
});

/**
 * POST /attest
 *
 * Request body:
 *   {
 *     worker: "0x...",
 *     employerId: "EIN-12-3456789",
 *     hoursWorked: 240,
 *     hourlyRateCents: 1500,
 *     periodStart: 1746230400,
 *     periodEnd:   1748908800
 *   }
 *
 * Response:
 *   {
 *     attestation: {
 *       worker, employerId (bytes32), hoursWorked, hourlyRateCents,
 *       periodStart, periodEnd, issuedAt, nonce
 *     },
 *     signature: "0x...",      // 65 bytes
 *     signer: "0x..."           // wallet address (must match registry entry)
 *   }
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
  // Hash the employer label to a 32-byte commitment (the same way WageClaim does on-chain).
  const employerIdBytes32 = ethers.id(v.employerId); // keccak256(utf8 bytes)

  const issuedAt = BigInt(Math.floor(Date.now() / 1000));
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const message = {
    worker: v.worker,
    employerId: employerIdBytes32,
    hoursWorked: v.hoursWorked,
    hourlyRateCents: v.hourlyRateCents,
    periodStart: v.periodStart,
    periodEnd: v.periodEnd,
    issuedAt,
    nonce,
  };

  const signature = await wallet.signTypedData(DOMAIN, TYPES, message);
  const digest = ethers.TypedDataEncoder.hash(DOMAIN, TYPES, message);

  return res.json({
    attestation: {
      worker: message.worker,
      employerId: message.employerId,
      hoursWorked: message.hoursWorked.toString(),
      hourlyRateCents: message.hourlyRateCents,
      periodStart: message.periodStart.toString(),
      periodEnd: message.periodEnd.toString(),
      issuedAt: message.issuedAt.toString(),
      nonce: message.nonce,
    },
    signature,
    signer: wallet.address,
    digest,
    domain: DOMAIN,
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[issuer] error:", err);
  res.status(500).json({ error: "internal_error", message: err.message });
});

app.listen(PORT, () => {
  console.log(`[issuer] listening on http://0.0.0.0:${PORT}`);
});
