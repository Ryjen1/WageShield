# Live Deployment Evidence

WageShield's full pipeline (issuer attestation → CoFHE-encrypted submission → on-chain
encrypted multiplication → permit-gated decryption) has been verified end-to-end on the
**live Arbitrum Sepolia + Fhenix CoFHE testnet** infrastructure. This page links every
artifact a judge or reviewer needs to verify it themselves.

## Network

| Field | Value |
|---|---|
| Network | Arbitrum Sepolia |
| Chain ID | `421614` |
| CoFHE environment | `TESTNET` |
| CoFHE coprocessor | `https://testnet-cofhe.fhenix.zone` |
| Threshold network | `https://testnet-cofhe-tn.fhenix.zone` |
| Input verifier | `https://testnet-cofhe-vrf.fhenix.zone` |

## Deployed contracts

| Contract | Address | Explorer |
|---|---|---|
| `TimeclockIssuerRegistry` | `0xB0b85AF6f8ed8cee97D321d4B0FE15428cB0268f` | [Arbiscan](https://sepolia.arbiscan.io/address/0xB0b85AF6f8ed8cee97D321d4B0FE15428cB0268f) |
| `WageClaim` | `0x93D7Be555723CCbC964761087C644368049a5AE3` | [Arbiscan](https://sepolia.arbiscan.io/address/0x93D7Be555723CCbC964761087C644368049a5AE3) |
| `WageTheftResolver` | `0xc3022f3De7043261DaccdCd1C9Ea8e4BB05ADb53` | [Arbiscan](https://sepolia.arbiscan.io/address/0xc3022f3De7043261DaccdCd1C9Ea8e4BB05ADb53) |
| `WageTheftPolicy` | `0x4ce036ea7AF8ED9c187d0d69e52621EdE6d70F42` | [Arbiscan](https://sepolia.arbiscan.io/address/0x4ce036ea7AF8ED9c187d0d69e52621EdE6d70F42) |
| Trusted issuer (mock Homebase) | `0x8335bf7fac9786d1877b6E6c613458B4968C8146` | — |

> The deployer / contract-owner address is on-chain in the constructor of each
> contract; if you need it for verification, query
> `WageClaim.owner()` on Arbiscan.

## Reproducible end-to-end transaction

**Live e2e tx:** [`0xacd2bb10f959326e49a03443381846ded2130bba9ad77c14ee9535d87158b162`](https://sepolia.arbiscan.io/tx/0xacd2bb10f959326e49a03443381846ded2130bba9ad77c14ee9535d87158b162)

| Field | Value |
|---|---|
| Block | `267997665` |
| Gas used | `602,845` |
| Method | `submitClaim` |
| Result | Encrypted hours (240) × encrypted rate ($15.00) → encrypted owed (`$3,600`) |
| Worker decrypt | matches plaintext exactly |

The on-chain `ClaimSubmitted` event for this tx:

```
ClaimSubmitted(
    claimId            = 1,
    employerCommitment = keccak256("EIN-12-3456789"),
    timestampBucket    = (block.timestamp // 900) * 900,
    attestationDigest  = <EIP-712 digest>,
    issuer             = 0x8335bf7fac9786d1877b6E6c613458B4968C8146
)
```

No PII. No employer identity (only a commitment). No worker address. No hours, rate, or
owed amount. Just enough for an attorney with the worker's permission to find the right
claim, and for a regulator to compute aggregate exposure.

## Reproduce yourself

```bash
git clone <this-repo>
cd fhenix_project
npm install --legacy-peer-deps
cp .env.example .env.local
# fill in PRIVATE_KEY (funded on arb-sepolia) + ISSUER_PRIVATE_KEY (any 0x-prefixed key)

npx hardhat compile
npx hardhat test                                          # 5/5 mock-environment tests
npx hardhat run scripts/deploy.ts --network arb-sepolia   # deploys 4 contracts
npx hardhat run scripts/register-issuer.ts --network arb-sepolia
npx hardhat run scripts/e2e-live.ts --network arb-sepolia # encrypted FHE.mul + decrypt
```

Expected output:

```
[1/6] Network: arb-sepolia (chainId 421614)
      WageClaim: 0x93D7Be555723CCbC964761087C644368049a5AE3
      Worker:    0x...
      ✓ CoFHE client connected (env=TESTNET)
      Issuer:    0x...
[2/6] Attestation signed (digest binds worker + employer + hours + rate + period)
[3/6] Encrypting hours (240) and rate (1500c)...
      encrypt step: initTfhe → fetchKeys → pack → prove → verify
      ✓ inputs encrypted
[4/6] Calling submitClaim...
      tx: 0x...
      ✓ mined in block N, gas ~600k
      ✓ claimId = 1
[5/6] Creating self-permit and decrypting owedCents...

  Decrypted owed:   360000 cents ($3600)
  Expected owed:    360000 cents ($3600)
  Match: ✓ E2E PASSED
```

## What this proves

1. **The issuer EIP-712 attestation flow works.** A trusted timeclock signer can vouch
   for a worker's hours/rate without that data hitting the chain in plaintext.
2. **`@cofhe/sdk` encrypts client-side and ships an input-validity proof** to the
   testnet input verifier (`prove` → `verify` steps in the log). The proof shows
   the ciphertext is well-formed and the submitter knows the plaintext, so the
   contract can safely accept it.
3. **`FHE.mul(eHours, eRateCents)` runs on-chain inside the CoFHE coprocessor** — the
   encrypted owed amount is computed without ever decrypting the inputs.
4. **CoFHE permits scope decryption to authorized addresses only.** The worker's
   self-permit decrypts to the correct plaintext; without it (or with the wrong
   address's permit) the threshold network refuses the request.
5. **The `ClaimSubmitted` event is subpoena-shaped from day one.** A discovery order
   can copy that event verbatim and learn nothing identifying.

## Honest limits seen in this transaction

* **Gas: ~600k for one submission with one FHE.mul + one FHE.add.** Aggregating across
  N claims for a single employer adds ~N × `FHE.add` ops; for N > 30 we'd batch the
  aggregate update off-chain or split across multiple txs.
* **`encryptInputs` round-trip took ~10s** in this run, due to the input-validity
   proving + verifier-network round trip. This is interactive UX for a worker
   but not free.
* **Per-receipt CoFHE permit must be re-signed if the worker switches devices** —
  permits are stored per (chainId × account) in the SDK's local store.

These are documented in `docs/honest-limits.md` (Wave 5 deliverable).
