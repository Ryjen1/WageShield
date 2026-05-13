# Contributing to WageShield

Thanks for your interest. WageShield is an active hackathon build (Fhenix Privacy-by-Design
Buildathon, Wave 4 → Wave 5). Below is the lightweight workflow we follow during the
buildathon; expect this to harden post-Wave 5.

## Repository layout

This repo is an npm-workspaces monorepo:

```
fhenix_project/
├── packages/
│   ├── contracts/   ← Solidity (Hardhat + CoFHE) + tests + deploy scripts
│   ├── issuer/      ← Mock timeclock attestation HTTP service
│   └── sdk/         ← Shared TS client SDK (Wave 5)
├── apps/
│   └── web/         ← Next.js front-end (Wave 5)
├── docs/            ← Whitepaper, threat model, architecture, outreach log
└── deployments/...  ← under packages/contracts/deployments/
```

## Local setup

```bash
git clone <fork-or-repo>
cd fhenix_project
npm install --legacy-peer-deps    # workspaces install, takes 3-6 min
cp .env.example .env.local
# fill in PRIVATE_KEY (Arbitrum Sepolia, funded) + ISSUER_PRIVATE_KEY

# Compile + run mock-env tests (no testnet needed)
npm run compile
npm run test
```

## Testing your changes

| Layer | Command | Notes |
|---|---|---|
| Contracts (mock env) | `npm run test` | 5 tests, ~1 second |
| Contracts (live testnet e2e) | `npm run e2e:arb-sepolia` | Costs ~$0.10 in arb-sepolia ETH |
| Issuer service | `npm run issuer:serve` | Listens on `:4001` by default |

## Style & conventions

### Solidity

- `solc 0.8.28`, `evmVersion: cancun`, `viaIR: true`, optimizer 200 runs
- Use **custom errors** over `require` strings for gas
- Always pair encrypted writes with `FHE.allowThis(...)` and (where appropriate)
  `FHE.allow(handle, beneficiary)`
- Document the **ACL boundary** for every encrypted handle in NatSpec
- Imports: `@openzeppelin/contracts/`, `@fhenixprotocol/cofhe-contracts/`

### TypeScript

- `target: es2020+`, `strict: true`, `esModuleInterop: true`
- Test files: live next to the contract under `packages/contracts/test/<Contract>.test.ts`
- Scripts: live under `packages/contracts/scripts/` and prefer pure-functions over side-effects

### Commits

Conventional Commits format. Keep commits scoped to one workspace where possible:

```
feat(contracts): add aggregate-by-employer threshold check
fix(issuer): reject attestations with periodEnd <= periodStart
docs: expand honest-limits with bucket k-anonymity caveat
```

## Branching

- `main` is the trunk; everything else lives on short-lived feature branches.
- Open a PR even for solo work — diff review catches FHE access-control mistakes that are
  invisible at runtime.

## What's in / out of scope right now

**In scope (Wave 4):** core contract surface, mock-env test coverage, live testnet e2e,
docs that explain the FHE-vs-TEE upgrade story.

**In scope (Wave 5):** TypeScript SDK, web app (3 views), Privara `ConfidentialEscrow`
end-to-end demo, threat model, honest-limits, NGO/state-AG outreach log, demo video.

**Out of scope for hackathon:** mainnet, audit-ready hardening, real worker onboarding.

## Reporting issues

Please file issues with:
1. What you ran (exact command + workspace context).
2. What you expected.
3. What actually happened (full error, including stack trace).
4. Output of `npx hardhat --version && node --version`.

## License

By contributing you agree your contributions are licensed under the MIT license — see
[`LICENSE`](LICENSE).
