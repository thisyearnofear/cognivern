const { expect } = require("chai");
const hre = require("hardhat");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");

const OP_TYPE_SPEND_POLICY = hre.ethers.encodeBytes32String("SPEND_POLICY");
const OP_REGISTER = hre.ethers.encodeBytes32String("REGISTER_POLICY");
const OP_EVALUATE = hre.ethers.encodeBytes32String("EVALUATE_SPEND");

async function expectRevert(promise, message) {
  let reverted = false;
  try {
    await promise;
  } catch (err) {
    reverted = true;
    expect(String(err.message)).to.include(message);
  }
  expect(reverted, `expected revert containing "${message}"`).to.equal(true);
}

function parseSpendEvaluated(contract, receipt) {
  return receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed && parsed.name === "SpendEvaluated");
}

describe("ConfidentialSpendPolicy (Flare / FCC)", function () {
  async function deployFixture() {
    const [owner, operator, stranger] = await hre.ethers.getSigners();

    const Mock = await hre.ethers.getContractFactory("MockTeeRegistries");
    const registry = await Mock.deploy();
    await registry.waitForDeployment();
    const registryAddr = await registry.getAddress();

    const Policy = await hre.ethers.getContractFactory("ConfidentialSpendPolicy");
    const contract = await Policy.deploy(registryAddr, registryAddr);
    await contract.waitForDeployment();
    const contractAddr = await contract.getAddress();

    await registry.setInstructionSender(0x10000n, contractAddr);
    await contract.setExtensionId();
    await contract.authorizeEvaluator(operator.address);

    return { contract, registry, owner, operator, stranger, contractAddr };
  }

  describe("Deployment + extension id", function () {
    it("sets the deployer as owner and authorized evaluator", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
      expect(await contract.authorizedEvaluators(owner.address)).to.equal(true);
    });

    it("resolves extension id from the registry", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.extensionId()).to.equal(0x10000n);
    });

    it("rejects zero registry addresses", async function () {
      const Policy = await hre.ethers.getContractFactory("ConfidentialSpendPolicy");
      await expectRevert(
        Policy.deploy(hre.ethers.ZeroAddress, hre.ethers.ZeroAddress),
        "TeeExtensionRegistry cannot be zero address",
      );
    });
  });

  describe("registerPolicy", function () {
    it("sends REGISTER_POLICY to the TEE registry and marks policy registered", async function () {
      const { contract, registry, operator } = await loadFixture(deployFixture);
      const policyId = hre.ethers.zeroPadValue("0x01", 32);
      const message = hre.ethers.toUtf8Bytes(
        JSON.stringify({
          dailyLimit: "1000",
          perTxLimit: "100",
          approvalThreshold: "50",
        }),
      );

      const tx = await contract.connect(operator).registerPolicy(policyId, message);
      const receipt = await tx.wait();
      const registered = receipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === "PolicyRegistered");

      expect(registered).to.not.equal(undefined);
      expect(registered.args.policyId).to.equal(policyId);
      expect(registered.args.operator).to.equal(operator.address);
      expect(await contract.policyRegistered(policyId)).to.equal(true);
      expect(await registry.lastOpType()).to.equal(OP_TYPE_SPEND_POLICY);
      expect(await registry.lastOpCommand()).to.equal(OP_REGISTER);
      expect(await registry.lastMessage()).to.equal(hre.ethers.hexlify(message));
    });

    it("rejects unauthorized callers", async function () {
      const { contract, stranger } = await loadFixture(deployFixture);
      const policyId = hre.ethers.zeroPadValue("0x01", 32);
      await expectRevert(
        contract.connect(stranger).registerPolicy(policyId, "0x01"),
        "not authorized",
      );
    });
  });

  describe("evaluateSpend + publishDecision", function () {
    async function registeredFixture() {
      const base = await loadFixture(deployFixture);
      const policyId = hre.ethers.zeroPadValue("0x01", 32);
      const agentId = hre.ethers.zeroPadValue("0xaa", 32);
      const vendorHash = hre.ethers.zeroPadValue("0xbb", 32);
      const message = hre.ethers.toUtf8Bytes(
        JSON.stringify({ agentId, policyId, amount: "25", vendorHash }),
      );
      await base.contract.connect(base.operator).registerPolicy(policyId, "0xabcd");
      return { ...base, policyId, agentId, vendorHash, message };
    }

    it("emits SpendEvaluated(Pending) and records pending decision", async function () {
      const {
        contract,
        registry,
        operator,
        policyId,
        agentId,
        vendorHash,
        message,
      } = await registeredFixture();

      const tx = await contract
        .connect(operator)
        .evaluateSpend(agentId, policyId, vendorHash, message);
      const receipt = await tx.wait();
      const evaluated = parseSpendEvaluated(contract, receipt);

      expect(evaluated).to.not.equal(undefined);
      expect(evaluated.args.outcome).to.equal(3n); // Outcome.Pending
      expect(await registry.lastOpCommand()).to.equal(OP_EVALUATE);

      const decisionId = evaluated.args.decisionId;
      expect(await contract.resolvedOutcomes(decisionId)).to.equal(3n);
      const pending = await contract.pendingDecisions(decisionId);
      expect(pending.submitter).to.equal(operator.address);
      expect(pending.policyId).to.equal(policyId);
    });

    it("rejects evaluateSpend for unregistered policy", async function () {
      const { contract, operator } = await loadFixture(deployFixture);
      await expectRevert(
        contract
          .connect(operator)
          .evaluateSpend(
            hre.ethers.zeroPadValue("0xaa", 32),
            hre.ethers.zeroPadValue("0x01", 32),
            hre.ethers.zeroPadValue("0xbb", 32),
            "0x01",
          ),
        "policy missing",
      );
    });

    it("publishDecision resolves Pending → Approve", async function () {
      const { contract, operator, policyId, agentId, vendorHash, message } =
        await registeredFixture();

      const tx = await contract
        .connect(operator)
        .evaluateSpend(agentId, policyId, vendorHash, message);
      const receipt = await tx.wait();
      const evaluated = parseSpendEvaluated(contract, receipt);
      const decisionId = evaluated.args.decisionId;

      const attestation = hre.ethers.toUtf8Bytes(
        '{"outcome":"approve","tee":true}',
      );
      const publishTx = await contract
        .connect(operator)
        .publishDecision(decisionId, 2, attestation);
      const publishReceipt = await publishTx.wait();
      const resolved = publishReceipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === "DecisionResolved");

      expect(resolved).to.not.equal(undefined);
      expect(resolved.args.outcome).to.equal(2n);
      expect(await contract.resolvedOutcomes(decisionId)).to.equal(2n);
      expect(await contract.isDecisionApproved(decisionId)).to.equal(true);
    });

    it("rejects double-publish", async function () {
      const { contract, operator, policyId, agentId, vendorHash, message } =
        await registeredFixture();
      const tx = await contract
        .connect(operator)
        .evaluateSpend(agentId, policyId, vendorHash, message);
      const receipt = await tx.wait();
      const evaluated = parseSpendEvaluated(contract, receipt);
      const decisionId = evaluated.args.decisionId;

      await contract.connect(operator).publishDecision(decisionId, 0, "0x");
      await expectRevert(
        contract.connect(operator).publishDecision(decisionId, 2, "0x"),
        "already resolved",
      );
    });
  });
});
