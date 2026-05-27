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
      const vendorSetRoot = hre.ethers.zeroPadValue("0x00", 32);

      await expect(
        contract
          .connect(operator)
          .registerPolicy(
            policyId,
            dailyLimitCt,
            perTxLimitCt,
            approvalThresholdCt,
            vendorSetRoot,
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

      await contract.registerPolicy(
        policyId,
        ct,
        ct,
        ct,
        hre.ethers.zeroPadValue("0x00", 32),
      );
      await expect(
        contract.registerPolicy(
          policyId,
          ct,
          ct,
          ct,
          hre.ethers.zeroPadValue("0x00", 32),
        ),
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

  describe("Decision Resolution", function () {
    it("should resolve a pending decision", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const decisionId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("test-decision"),
      );

      await expect(contract.connect(owner).resolveDecision(decisionId, 2)) // 2 = Approve
        .to.emit(contract, "DecisionResolved")
        .withArgs(decisionId, 2);

      expect(await contract.isDecisionApproved(decisionId)).to.be.true;
    });

    it("should reject resolution from non-owner", async function () {
      const { contract, operator } = await loadFixture(deployFixture);
      const decisionId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test"));

      await expect(
        contract.connect(operator).resolveDecision(decisionId, 2),
      ).to.be.revertedWith("not owner");
    });

    it("should reject resolving with Pending outcome", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const decisionId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test"));

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
