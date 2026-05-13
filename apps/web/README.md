# @wageshield/web

Next.js front-end for WageShield. Three primary views:

- `/worker` — submit claim flow (encrypt hours/rate, fetch attestation, sign tx)
- `/attorney` — claim-grant inbox + per-claim decrypt
- `/regulator` — employer aggregate exposure dashboard

> **Status:** scaffold only — full implementation lands in Wave 5. The end-to-end
> flow is currently exercised by the live e2e script at
> [`packages/contracts/scripts/e2e-live.ts`](../../packages/contracts/scripts/e2e-live.ts).
