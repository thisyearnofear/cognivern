import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("GovernanceContract — Pause & Security", function () {
  async function deployFixture() {
    const [owner, evaluator, user] = await hre.ethers.getSigners();

    const GovernanceContract = await hre.ethers.getContractFactory(
      "GovernanceContract",
    );
    const contract = await GovernanceContract.deploy();
    await contract.waitForDeployment();

    return { contract, owner, evaluator, user };
  }

  describe("createPolicy access control", function () {
    it("allows authorized evaluators to create policies", async function () {
      const { contract, evaluator } = await loadFixture(deployFixture);
      const policyId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("test-policy"),
      );
      const rulesHash = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("rules"),
      );

      await expect(
        contract
          .connect(evaluator)
          .createPolicy(policyId, "Test", "Test policy", rulesHash),
      )
        .to.emit(contract, "PolicyCreated")
        .withArgs(policyId, "Test", evaluator.address);
    });

    it("rejects policy creation from unauthorized accounts", async function () {
      const { contract, user } = await loadFixture(deployFixture);
      const policyId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("test-policy"),
      );
      const rulesHash = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("rules"),
      );

      await expect(
        contract
          .connect(user)
          .createPolicy(policyId, "Test", "Test policy", rulesHash),
      ).to.be.revertedWith("Not authorized evaluator");
    });
  });

  describe("Pause mechanism", function () {
    it("allows owner to pause and unpause", async function () {
      const { contract, owner } = await loadFixture(deployFixture);

      await expect(contract.connect(owner).pause())
        .to.emit(contract, "Paused")
        .withArgs(owner.address);

      expect(await contract.paused()).to.be.true;

      await expect(contract.connect(owner).unpause())
        .to.emit(contract, "Unpaused")
        .withArgs(owner.address);

      expect(await contract.paused()).to.be.false;
    });

    it("rejects pause from non-owner", async function () {
      const { contract, user } = await loadFixture(deployFixture);
      await expect(contract.connect(user).pause()).to.be.revertedWith(
        "Only owner can call this function",
      );
    });

    it("rejects unpause from non-owner", async function () {
      const { contract, owner, user } = await loadFixture(deployFixture);
      await contract.connect(owner).pause();
      await expect(contract.connect(user).unpause()).to.be.revertedWith(
        "Only owner can call this function",
      );
    });

    it("prevents double pause", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await contract.connect(owner).pause();
      await expect(contract.connect(owner).pause()).to.be.revertedWith(
        "Already paused",
      );
    });

    it("prevents unpause when not paused", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await expect(contract.connect(owner).unpause()).to.be.revertedWith(
        "Not paused",
      );
    });

    it("blocks evaluateAction when paused", async function () {
      const { contract, owner, evaluator } = await loadFixture(deployFixture);

      const policyId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("policy-1"),
      );
      const rulesHash = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("rules"),
      );
      await contract
        .connect(evaluator)
        .createPolicy(policyId, "P", "Policy", rulesHash);
      await contract.connect(evaluator).updatePolicyStatus(policyId, 1);

      const agentId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("agent-1"),
      );
      await contract
        .connect(evaluator)
        .registerAgent(agentId, "A", ["test"], policyId);
      await contract.connect(evaluator).updateAgentStatus(agentId, 1);

      await contract.connect(owner).pause();

      const actionId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("action-1"),
      );
      await expect(
        contract
          .connect(evaluator)
          .evaluateAction(
            actionId,
            agentId,
            "test",
            hre.ethers.ZeroHash,
            true,
          ),
      ).to.be.revertedWith("Contract is paused");
    });

    it("blocks registerAgent when paused", async function () {
      const { contract, owner, evaluator } = await loadFixture(deployFixture);

      const policyId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("policy-1"),
      );
      const rulesHash = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("rules"),
      );
      await contract
        .connect(evaluator)
        .createPolicy(policyId, "P", "Policy", rulesHash);
      await contract.connect(evaluator).updatePolicyStatus(policyId, 1);

      await contract.connect(owner).pause();

      const agentId = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes("agent-1"),
      );
      await expect(
        contract
          .connect(evaluator)
          .registerAgent(agentId, "A", ["test"], policyId),
      ).to.be.revertedWith("Contract is paused");
    });
  });

  describe("HyperlaneConfigUpdated event", function () {
    it("emits event when Hyperlane config is set", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const mailbox = hre.ethers.Wallet.createRandom().address;
      const domain = 195;
      const sender = hre.ethers.zeroPadValue(
        hre.ethers.Wallet.createRandom().address,
        32,
      );

      await expect(
        contract.connect(owner).setHyperlaneConfig(mailbox, domain, sender),
      )
        .to.emit(contract, "HyperlaneConfigUpdated")
        .withArgs(mailbox, domain, sender);
    });
  });
});
