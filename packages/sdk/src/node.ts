/**
 * @wageshield/sdk/node — Node-only entry point.
 *
 * Exports the CoFHE client constructor that uses `@cofhe/sdk/node` + the Ethers6
 * adapter. This subpath is for Hardhat scripts, CLI tools, and SSR environments
 * where it's OK to depend on Node's `fs` module.
 *
 * Browser apps should NOT import from here — instead, construct a CoFHE client
 * via `@cofhe/sdk/web` directly and pass it into the helpers exported from
 * `@wageshield/sdk` (the main entry point).
 */

export * from "./client";
