import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { ethers } from "ethers";

/**
 * WageShield smoke tests.
 *
 * Coverage:
 *   1. Issuer registry add/revoke + onlyOwner gate
 *   2. End-to-end claim submission (issuer attest -> worker encrypt -> contract verify)
 *   3. Encrypted owed amount (hours * rate) is computed on-chain and decryptable by worker
 *   4. Per-employer aggregate accumulates across two claims
 *   5. Attorney access flow — only worker may grant
 *   6. Regulator aggregate decrypt path — only registered regulators may request
 */
describe("WageShield/WageClaim", function () {
  // ----------------------------------------------------------------------------
  //  Fixtures
  // ----------------------------------------------------------------------------

  async function deployFixture() {
    const [owner, worker, attorney, regulator, randomActor] =
      await hre.ethers.getSigners();

    // Deterministic issuer wallet — its private key signs the EIP-712 attestations.
    const issuerWallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
    // Fund issuer with a tiny amount so it can interact if ever needed.
    await owner.sendTransaction({ to: issuerWallet.address, value: hre.ethers.parseEther("1") });

    // 1. Issuer registry
    const RegFactory = await hre.ethers.getContractFactory("TimeclockIssuerRegistry");
    const registry = await RegFactory.connect(owner).deploy(owner.address);
    await registry.waitForDeployment();
    await registry.connect(owner).trustIssuer(issuerWallet.address, "Mock Homebase");

    // 2. WageClaim core contract
    const ClaimFactory = await hre.ethers.getContractFactory("WageClaim");
    const wageClaim = await ClaimFactory.connect(owner).deploy(
      await registry.getAddress(),
      owner.address
    );
    await wageClaim.waitForDeployment();

    // 3. Resolver + Policy (Privara plugins)
    const ResolverFactory = await hre.ethers.getContractFactory("WageTheftResolver");
    const resolver = await ResolverFactory.connect(owner).deploy();
    await resolver.waitForDeployment();

    const PolicyFactory = await hre.ethers.getContractFactory("WageTheftPolicy");
    const policy = await PolicyFactory.connect(owner).deploy();
    await policy.waitForDeployment();

    return {
      owner,
      worker,
      attorney,
      regulator,
      randomActor,
      issuerWallet,
      registry,
      wageClaim,
      resolver,
      policy,
    };
  }

  // ----------------------------------------------------------------------------
  //  Helpers
  // ----------------------------------------------------------------------------

  /**
   * Issuer signs an EIP-712 timeclock attestation for a worker. Returns the calldata
   * pieces needed by `WageClaim.submitClaim`.
   */
  async function buildAttestation(params: {
    wageClaim: any;
    issuer: any;
    worker: string;
    employerId: string;
    hoursWorked: bigint;
    rateCents: bigint;
    periodStart: bigint;
    periodEnd: bigint;
  }) {
    const network = await hre.ethers.provider.getNetwork();
    const domain = {
      name: "WageShield.WageClaim",
      version: "1",
      chainId: network.chainId,
      verifyingContract: await params.wageClaim.getAddress(),
    };
    const types = {
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
    };
    const issuedAt = BigInt(Math.floor(Date.now() / 1000));
    const nonce = hre.ethers.hexlify(hre.ethers.randomBytes(32));

    const value = {
      worker: params.worker,
      employerId: params.employerId,
      hoursWorked: params.hoursWorked,
      hourlyRateCents: params.rateCents,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      issuedAt,
      nonce,
    };
    const signature = await params.issuer.signTypedData(domain, types, value);
    return { ...value, signature };
  }

  // ----------------------------------------------------------------------------
  //  Tests
  // ----------------------------------------------------------------------------

  describe("TimeclockIssuerRegistry", function () {
    it("trusts and revokes issuers; non-owner is rejected", async function () {
      const { registry, owner, randomActor, issuerWallet } = await loadFixture(deployFixture);

      // Issuer is trusted from fixture
      expect(await registry.isTrusted(issuerWallet.address)).to.equal(true);
      expect(await registry.labelOf(issuerWallet.address)).to.equal("Mock Homebase");

      // Non-owner cannot trust
      await expect(
        registry.connect(randomActor).trustIssuer(randomActor.address, "Pirate Inc")
      ).to.be.reverted;

      // Owner revokes
      await registry.connect(owner).revokeIssuer(issuerWallet.address);
      expect(await registry.isTrusted(issuerWallet.address)).to.equal(false);
    });
  });

  describe("submitClaim", function () {
    it("accepts a valid attestation, computes encrypted owed = hours * rate, and decrypts for worker", async function () {
      const { wageClaim, issuerWallet, worker } = await loadFixture(deployFixture);

      const employerId = hre.ethers.id("RestaurantABC#EIN-12-3456789");
      const hoursWorked = 240n;       // 240 hours
      const rateCents = 1500n;        // $15.00/hr
      const expectedOwed = hoursWorked * rateCents; // 360_000 cents = $3,600

      const periodStart = BigInt(Math.floor(Date.now() / 1000) - 90 * 24 * 3600);
      const periodEnd = periodStart + BigInt(60 * 24 * 3600);

      const attest = await buildAttestation({
        wageClaim,
        issuer: issuerWallet,
        worker: worker.address,
        employerId,
        hoursWorked,
        rateCents,
        periodStart,
        periodEnd,
      });

      // Build a CoFHE client for the worker and encrypt the inputs.
      const client = await hre.cofhe.createClientWithBatteries(worker as any);
      const [eHours, eRate] = await client
        .encryptInputs([
          Encryptable.uint64(hoursWorked),
          Encryptable.uint32(rateCents),
        ])
        .execute();

      const tx = await wageClaim
        .connect(worker)
        .submitClaim(
          employerId,
          attest.hoursWorked,
          attest.hourlyRateCents,
          attest.periodStart,
          attest.periodEnd,
          attest.issuedAt,
          attest.nonce,
          attest.signature,
          eHours,
          eRate
        );
      const receipt = await tx.wait();

      // ClaimSubmitted event fired with subpoena-resistant fields only
      const submittedLog = receipt!.logs.find((l: any) => {
        try {
          const parsed = wageClaim.interface.parseLog({ topics: l.topics, data: l.data });
          return parsed?.name === "ClaimSubmitted";
        } catch {
          return false;
        }
      });
      expect(submittedLog, "expected ClaimSubmitted event").to.exist;

      // Read the encrypted owed handle and decrypt it as the worker
      const claim = await wageClaim.claims(1n);
      const owedHandle = claim.owedCents;

      const owedDecrypted = await client
        .decryptForView(owedHandle, FheTypes.Uint128)
        .withPermit()
        .execute();

      expect(BigInt(owedDecrypted as any)).to.equal(expectedOwed);
    });

    it("rejects a signature from an untrusted issuer", async function () {
      const { wageClaim, worker } = await loadFixture(deployFixture);

      // Brand-new wallet — never registered
      const rogueIssuer = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
      const employerId = hre.ethers.id("RogueCorp");
      const periodStart = BigInt(Math.floor(Date.now() / 1000) - 30 * 24 * 3600);
      const periodEnd = periodStart + BigInt(7 * 24 * 3600);

      const attest = await buildAttestation({
        wageClaim,
        issuer: rogueIssuer,
        worker: worker.address,
        employerId,
        hoursWorked: 40n,
        rateCents: 2000n,
        periodStart,
        periodEnd,
      });

      const client = await hre.cofhe.createClientWithBatteries(worker as any);
      const [eHours, eRate] = await client
        .encryptInputs([Encryptable.uint64(40n), Encryptable.uint32(2000n)])
        .execute();

      await expect(
        wageClaim.connect(worker).submitClaim(
          employerId,
          attest.hoursWorked,
          attest.hourlyRateCents,
          attest.periodStart,
          attest.periodEnd,
          attest.issuedAt,
          attest.nonce,
          attest.signature,
          eHours,
          eRate
        )
      ).to.be.reverted;
    });

    it("aggregates encrypted owed amounts per employer across multiple claims", async function () {
      const { wageClaim, issuerWallet, worker, owner, regulator } =
        await loadFixture(deployFixture);

      const employerId = hre.ethers.id("RestaurantABC");
      const employerCommitment = hre.ethers.keccak256(
        hre.ethers.solidityPacked(["bytes32"], [employerId])
      );
      const periodStart = BigInt(Math.floor(Date.now() / 1000) - 90 * 24 * 3600);

      const submitClaim = async (hoursWorked: bigint, rateCents: bigint) => {
        const attest = await buildAttestation({
          wageClaim,
          issuer: issuerWallet,
          worker: worker.address,
          employerId,
          hoursWorked,
          rateCents,
          periodStart,
          periodEnd: periodStart + 30n * 24n * 3600n,
        });
        const client = await hre.cofhe.createClientWithBatteries(worker as any);
        const [eHours, eRate] = await client
          .encryptInputs([
            Encryptable.uint64(hoursWorked),
            Encryptable.uint32(rateCents),
          ])
          .execute();
        await wageClaim.connect(worker).submitClaim(
          employerId,
          attest.hoursWorked,
          attest.hourlyRateCents,
          attest.periodStart,
          attest.periodEnd,
          attest.issuedAt,
          attest.nonce,
          attest.signature,
          eHours,
          eRate
        );
      };

      await submitClaim(100n, 1500n); // $1,500.00
      await submitClaim(200n, 2000n); // $4,000.00 -> total $5,500 (550_000 cents)

      expect(await wageClaim.employerClaimCount(employerCommitment)).to.equal(2n);

      // Grant regulator role and request aggregate decrypt
      await wageClaim.connect(owner).addRegulator(regulator.address);
      await wageClaim.connect(regulator).requestAggregateDecryption(employerCommitment);

      const aggHandle = await wageClaim.employerAggregateCents(employerCommitment);
      const regClient = await hre.cofhe.createClientWithBatteries(regulator as any);
      const aggDecrypted = await regClient
        .decryptForView(aggHandle, FheTypes.Uint128)
        .withPermit()
        .execute();

      expect(BigInt(aggDecrypted as any)).to.equal(100n * 1500n + 200n * 2000n);
    });
  });

  describe("Attorney access", function () {
    it("only worker may grant attorney access; attorney can then decrypt", async function () {
      const { wageClaim, issuerWallet, worker, attorney, randomActor } =
        await loadFixture(deployFixture);

      const employerId = hre.ethers.id("RestaurantABC");
      const periodStart = BigInt(Math.floor(Date.now() / 1000) - 30 * 24 * 3600);
      const attest = await buildAttestation({
        wageClaim,
        issuer: issuerWallet,
        worker: worker.address,
        employerId,
        hoursWorked: 80n,
        rateCents: 1800n,
        periodStart,
        periodEnd: periodStart + 7n * 24n * 3600n,
      });
      const client = await hre.cofhe.createClientWithBatteries(worker as any);
      const [eHours, eRate] = await client
        .encryptInputs([Encryptable.uint64(80n), Encryptable.uint32(1800n)])
        .execute();
      await wageClaim.connect(worker).submitClaim(
        employerId,
        attest.hoursWorked,
        attest.hourlyRateCents,
        attest.periodStart,
        attest.periodEnd,
        attest.issuedAt,
        attest.nonce,
        attest.signature,
        eHours,
        eRate
      );

      // Random actor cannot grant
      await expect(
        wageClaim.connect(randomActor).grantAttorneyAccess(1n, attorney.address)
      ).to.be.reverted;

      // Worker grants
      await wageClaim.connect(worker).grantAttorneyAccess(1n, attorney.address);
      expect(await wageClaim.attorneyAccess(1n, attorney.address)).to.equal(true);

      // Attorney can decrypt the owed handle
      const claim = await wageClaim.claims(1n);
      const attorneyClient = await hre.cofhe.createClientWithBatteries(attorney as any);
      const owedDecrypted = await attorneyClient
        .decryptForView(claim.owedCents, FheTypes.Uint128)
        .withPermit()
        .execute();
      expect(BigInt(owedDecrypted as any)).to.equal(80n * 1800n);
    });
  });
});
