import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("ConfidentialSpendPolicy", function () {
  async function deployFixture() {
    const [owner, operator, auditor] = await hre.ethers.getSigners();

    const ConfidentialSpendPolicy = await hre.ethers.getContractFactory(
      "ConfidentialSpendPolicy",
    );
    const contract = await ConfidentialSpendPolicy.deploy();
    await contract.waitForDeployment();

    const contractAddr = await contract.getAddress();

    return { contract, contractAddr, owner, operator, auditor };
  }

  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("should start with no policies registered", async function () {
      const { contract } = await loadFixture(deployFixture);
      const policyId = hre.ethers.zeroPadValue("0x01", 32);
      const policy = await contract.policies(policyId);
      expect(policy.initialized).to.be.false;
    });
  });

  describe("Policy Registration", function () {
    it("should register a policy with encrypted parameters", async function () {
      const { contract, operator } = await loadFixture(deployFixture);
      const policyId = hre.ethers.zeroPadValue("0x01", 32);

      // InEuint128 calldata format: (ctHash, securityZone, utype, signature)
      const dailyLimitCt = {
        ctHash: 1000n,
        securityZone: 0,
        utype: 2,
        signature: "0x",
      };
      const perTxLimitCt = {
        ctHash: 100n,
        securityZone: 0,
        utype: 2,
        signature: "0x",
      };
      const approvalThresholdCt = {
        ctHash: 50n,
        securityZone: 0,
        utype: 2,
        signature: "0x",
      };

      await expect(
        contract
          .connect(operator)
          .registerPolicy(
            policyId,
            dailyLimitCt,
            perTxLimitCt,
            approvalThresholdCt,
          ),
      )
        .to.emit(contract, "PolicyRegistered")
        .withArgs(policyId, operator.address);

      const policy = await contract.policies(policyId);
      expect(policy.initialized).to.be.true;
      expect(policy.operator).to.equal(operator.address);
    });

    it("should reject duplicate policy registration", async function () {
      const { contract } = await loadFixture(deployFixture);
      const policyId = hre.ethers.zeroPadValue("0x01", 32);

      const ct = { ctHash: 1000n, securityZone: 0, utype: 2, signature: "0x" };

      await contract.registerPolicy(policyId, ct, ct, ct);
      await expect(
        contract.registerPolicy(policyId, ct, ct, ct),
      ).to.be.revertedWith("policy exists");
    });
  });

  describe("Spend Evaluation", function () {
    it("should reject spend with unregistered policy", async function () {
      const { contract } = await loadFixture(deployFixture);
      const agentId = hre.ethers.zeroPadValue("0xaa", 32);
      const policyId = hre.ethers.zeroPadValue("0xbb", 32);
      const amountCt = {
        ctHash: 10n,
        securityZone: 0,
        utype: 2,
        signature: "0x",
      };
      const vendorHash = hre.ethers.zeroPadValue("0x00", 32);

      await expect(
        contract.evaluateSpend(agentId, policyId, amountCt, vendorHash),
      ).to.be.revertedWith("policy missing");
    });
  });

  describe("Decision Resolution (legacy operator fallback)", function () {
    // Option B lifts onlyOwner on resolveDecision. Any caller may invoke it,
    // preserving the path that the FheDecisionWatcher + operator-side tooling
    // already use. The require guards that previously masked this behaviour
    // (resolvedOutcomes default = Deny, not Pending) still reject attempts
    // to call resolveDecision without first invoking evaluateSpend; tests
    // below capture that surface.

    it("any caller can attempt resolveDecision (onlyOwner lifted)", async function () {
      const { contract, operator } = await loadFixture(deployFixture);
      const decisionId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("test-decision"),
      );

      // No evaluateSpend has run, so resolvedOutcomes[decisionId] is the
      // default Outcome (Deny). The require checks Outcome != Pending first,
      // then `resolvedOutcomes == Pending` — the latter reverts with
      // "already resolved" because Deny ≠ Pending. This is the same gate
      // the original contract enforced via onlyOwner; the lift means *who*
      // calls is no longer restricted, but *when* (post-evaluateSpend) is.
      await expect(
        contract.connect(operator).resolveDecision(decisionId, 2),
      ).to.be.revertedWith("already resolved");
    });

    it("should reject resolving with Pending outcome", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const decisionId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("test-pending"),
      );

      await expect(
        contract.connect(owner).resolveDecision(decisionId, 3), // 3 = Pending
      ).to.be.revertedWith("outcome must be resolved");
    });

    it("should return false for unresolved decisions", async function () {
      const { contract } = await loadFixture(deployFixture);
      const decisionId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("unresolved"),
      );

      expect(await contract.isDecisionApproved(decisionId)).to.be.false;
    });
  });

  describe("publishDeFiAction (Option B user-decrypt-and-publish)", function () {
    // Mirrors the publishSpendResult identity-gate coverage for the
    // requestDeFiAction flow. Happy-path commit requires requestDeFiAction
    // to have run with the CoFHE runtime (out of scope for plain hardhat
    // tests); what's exercised here is the trust-gate surface on a
    // never-evaluated decisionId.

    it("should reject publishDeFiAction from a non-submitter", async function () {
      const { contract, operator } = await loadFixture(deployFixture);
      const decisionId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("defi-never-evaluated"),
      );

      // pendingDecisions[decisionId] is the zero-value struct, so
      // pending.submitter == address(0). Any real caller fails the
      // identity check with "not original submitter" before outcome is
      // examined, exercising the trust gate end-to-end.
      await expect(
        contract
          .connect(operator)
          .publishDeFiAction(decisionId, 2),
      ).to.be.revertedWith("not original submitter");
    });

    it("should reject publishDeFiAction with invalid outcome from non-submitter", async function () {
      const { contract, operator } = await loadFixture(deployFixture);
      const decisionId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("defi-bad-outcome"),
      );

      // Identity gate fires before outcome gate, so the same
      // "not original submitter" revert is returned — confirms require
      // ordering matches the contract (identity first, outcome second,
      // then the already-resolved guard).
      await expect(
        contract
          .connect(operator)
          .publishDeFiAction(decisionId, 99),
      ).to.be.revertedWith("not original submitter");
    });
  });

  describe("publishSpendResult (Option B user-decrypt-and-publish)", function () {
    // The publishSpendResult path replaces the operator-decrypt-then-call
    // pattern. None of these tests exercise the happy-path commit (that
    // requires evaluateSpend to have run with the CoFHE runtime, which
    // hardhat tests cannot set up); they exercise the identity gate and
    // outcome-bound check on an un-evaluated decisionId. The
    // happy-path commit is covered by the FhenixPolicyService integration
    // suite under a mock CoFHE client.

    it("should reject publishSpendResult from a non-submitter", async function () {
      const { contract, operator } = await loadFixture(deployFixture);
      const decisionId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("never-evaluated"),
      );

      // pendingDecisions[decisionId] is the zero-value struct, so
      // pending.submitter == address(0). Any real caller fails the
      // identity check with "not original submitter" before outcome is
      // examined, exercising the trust gate end-to-end.
      await expect(
        contract.connect(operator).publishSpendResult(decisionId, 2),
      ).to.be.revertedWith("not original submitter");
    });

    it("should reject publishSpendResult from any caller with invalid outcome", async function () {
      const { contract, operator } = await loadFixture(deployFixture);
      const decisionId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("bad-outcome"),
      );

      // Identity gate fires before the outcome gate (u3 → u2 in the
      // require order), so the same "not original submitter" revert is
      // returned — we exercise this simply to confirm the require order
      // matches the source (identity first, outcome second, then the
      // already-resolved guard). Tests of the outcome gate alone
      // require a non-zero submitter, which means running evaluateSpend
      // with the CoFHE runtime — out of scope for this contract test
      // file.
      await expect(
        contract.connect(operator).publishSpendResult(decisionId, 99),
      ).to.be.revertedWith("not original submitter");
    });
  });

  describe("Hyperlane Configuration", function () {
    it("should configure Hyperlane bridge from owner", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const mailbox = hre.ethers.Wallet.createRandom().address;
      const domain = 1952;
      const recipient = hre.ethers.zeroPadValue(
        hre.ethers.Wallet.createRandom().address,
        32,
      );
      const vault = hre.ethers.zeroPadValue(
        hre.ethers.Wallet.createRandom().address,
        32,
      );

      await contract
        .connect(owner)
        .setHyperlaneConfig(mailbox, domain, recipient, vault);

      expect(await contract.mailbox()).to.equal(mailbox);
      expect(await contract.xLayerDestinationDomain()).to.equal(domain);
      expect(await contract.xLayerRecipient()).to.equal(recipient);
      expect(await contract.xLayerDeFiVault()).to.equal(vault);
    });

    it("should reject Hyperlane config from non-owner", async function () {
      const { contract, operator } = await loadFixture(deployFixture);

      await expect(
        contract
          .connect(operator)
          .setHyperlaneConfig(
            hre.ethers.ZeroAddress,
            0,
            hre.ethers.ZeroHash,
            hre.ethers.ZeroHash,
          ),
      ).to.be.revertedWith("not owner");
    });
  });
});
