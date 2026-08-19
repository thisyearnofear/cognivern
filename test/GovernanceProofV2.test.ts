import assert from 'node:assert/strict';
import hre from 'hardhat';

const { ethers } = hre;

function hash(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

function parsedEvent(contract: any, receipt: any, name: string): any {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === name) return parsed;
    } catch {
      // Ignore logs emitted by another contract/interface.
    }
  }
  return undefined;
}

async function expectRevert(action: () => Promise<unknown>, fragment: string) {
  let error: unknown;
  try {
    await action();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, `expected transaction to revert with ${fragment}`);
  assert.match(String(error), new RegExp(fragment));
}

describe('GovernanceProofV2', function () {
  async function deployFixture() {
    const [deployer, poster, replacementPoster, nextAdmin, other] = await ethers.getSigners();
    const GovernanceProofV2 = await ethers.getContractFactory('GovernanceProofV2');
    const contract = await GovernanceProofV2.deploy(deployer.address, poster.address);
    await contract.waitForDeployment();
    return {
      contract,
      deployer,
      poster,
      replacementPoster,
      nextAdmin,
      other,
    };
  }

  async function validDecisionTimestamp(): Promise<number> {
    const block = await ethers.provider.getBlock('latest');
    if (!block) throw new Error('latest block unavailable');
    return block.timestamp;
  }

  it('requires admin and poster roles to remain separate', async function () {
    const [account] = await ethers.getSigners();
    const GovernanceProofV2 = await ethers.getContractFactory('GovernanceProofV2');

    await expectRevert(
      () => GovernanceProofV2.deploy(account.address, account.address),
      'RolesMustBeSeparate',
    );
  });

  it('initializes separate admin and poster roles', async function () {
    const { contract, deployer, poster } = await deployFixture();

    assert.equal(await contract.admin(), deployer.address);
    assert.equal(await contract.poster(), poster.address);
    assert.equal(await contract.proofCount(), 0n);
    assert.equal(await contract.SCHEMA_VERSION(), 2n);
  });

  it('records a commitment without publishing audit payload details', async function () {
    const { contract, poster } = await deployFixture();
    const runIdHash = hash('run-1');
    const evidenceHash = hash('canonical-evidence');
    const policySetHash = hash('policy-set-v3');
    const timestamp = await validDecisionTimestamp();

    const tx = await contract
      .connect(poster)
      .recordDecision(runIdHash, evidenceHash, policySetHash, 1, timestamp);
    const receipt = await tx.wait();
    assert.ok(receipt);

    const event = parsedEvent(contract, receipt, 'GovernanceDecision');
    assert.ok(event);
    const proofId = await contract.computeProofId(
      runIdHash,
      evidenceHash,
      policySetHash,
      1,
      timestamp,
    );
    assert.equal(event.args.proofId, proofId);
    assert.equal(event.args.evidenceHash, evidenceHash);
    assert.equal(event.args.policySetHash, policySetHash);
    assert.equal(event.args.decision, 1n);
    assert.equal(event.args.decisionTimestamp, BigInt(timestamp));
    assert.ok(event.args.recordedAt >= BigInt(timestamp));

    assert.equal(await contract.proofCount(), 1n);
    assert.ok((await contract.proofBlock(proofId)) > 0n);
    assert.ok((await contract.runBlock(runIdHash)) > 0n);
    assert.equal(await contract.runProofId(runIdHash), proofId);
    assert.equal(
      await contract.computeProofId(runIdHash, evidenceHash, policySetHash, 1, timestamp),
      proofId,
    );
  });

  it('rejects unauthorized posting and invalid decision values', async function () {
    const { contract, poster, other } = await deployFixture();
    const timestamp = await validDecisionTimestamp();

    await expectRevert(
      () =>
        contract
          .connect(other)
          .recordDecision(hash('run-1'), hash('evidence'), hash('policy'), 1, timestamp),
      'NotPoster',
    );

    await expectRevert(
      () =>
        contract
          .connect(poster)
          .recordDecision(hash('run-2'), hash('evidence'), hash('policy'), 0, timestamp),
      'InvalidDecision',
    );

    await expectRevert(
      () =>
        contract
          .connect(poster)
          .recordDecision(hash('run-3'), hash('evidence'), hash('policy'), 4, timestamp),
      'InvalidDecision',
    );
  });

  it('rejects duplicates, empty commitments, and timestamps too far in the future', async function () {
    const { contract, poster } = await deployFixture();
    const runIdHash = hash('run-duplicate');
    const evidenceHash = hash('evidence');
    const policySetHash = hash('policy');
    const timestamp = await validDecisionTimestamp();

    await contract
      .connect(poster)
      .recordDecision(runIdHash, evidenceHash, policySetHash, 2, timestamp);

    await expectRevert(
      () =>
        contract
          .connect(poster)
          .recordDecision(runIdHash, evidenceHash, policySetHash, 2, timestamp),
      'RunAlreadyRecorded',
    );

    await expectRevert(
      () =>
        contract
          .connect(poster)
          .recordDecision(runIdHash, evidenceHash, policySetHash, 3, timestamp + 1),
      'RunAlreadyRecorded',
    );

    await expectRevert(
      () =>
        contract
          .connect(poster)
          .recordDecision(ethers.ZeroHash, evidenceHash, policySetHash, 1, timestamp),
      'InvalidRunIdHash',
    );

    await expectRevert(
      () =>
        contract
          .connect(poster)
          .recordDecision(hash('run-empty-evidence'), ethers.ZeroHash, policySetHash, 1, timestamp),
      'InvalidEvidenceHash',
    );

    await expectRevert(
      () =>
        contract
          .connect(poster)
          .recordDecision(hash('run-empty-policy'), evidenceHash, ethers.ZeroHash, 1, timestamp),
      'InvalidPolicySetHash',
    );

    const futureTimestamp = (await validDecisionTimestamp()) + 1000;
    await expectRevert(
      () =>
        contract
          .connect(poster)
          .recordDecision(hash('run-future'), evidenceHash, policySetHash, 1, futureTimestamp),
      'InvalidDecisionTimestamp',
    );
  });

  it('protects role separation across pending admin and poster changes', async function () {
    const { contract, deployer, poster, replacementPoster, nextAdmin } = await deployFixture();

    await expectRevert(
      () => contract.connect(deployer).transferAdmin(poster.address),
      'RolesMustBeSeparate',
    );

    await contract.connect(deployer).transferAdmin(nextAdmin.address);
    await expectRevert(
      () => contract.connect(deployer).setPoster(nextAdmin.address),
      'RolesMustBeSeparate',
    );
    await contract.connect(deployer).cancelAdminTransfer();
    assert.equal(await contract.pendingAdmin(), ethers.ZeroAddress);
  });

  it('uses two-step admin rotation and keeps poster rotation admin-only', async function () {
    const { contract, deployer, poster, replacementPoster, nextAdmin, other } =
      await deployFixture();

    const transferTx = await contract.connect(deployer).transferAdmin(nextAdmin.address);
    const transferReceipt = await transferTx.wait();
    assert.ok(transferReceipt);
    const started = parsedEvent(contract, transferReceipt, 'AdminTransferStarted');
    assert.ok(started);
    assert.equal(started.args.pendingAdmin, nextAdmin.address);

    const acceptTx = await contract.connect(nextAdmin).acceptAdmin();
    await acceptTx.wait();
    assert.equal(await contract.admin(), nextAdmin.address);

    await expectRevert(
      () => contract.connect(deployer).setPoster(replacementPoster.address),
      'NotAdmin',
    );

    const posterTx = await contract.connect(nextAdmin).setPoster(replacementPoster.address);
    const posterReceipt = await posterTx.wait();
    assert.ok(posterReceipt);
    const updated = parsedEvent(contract, posterReceipt, 'PosterUpdated');
    assert.ok(updated);
    assert.equal(updated.args.previousPoster, poster.address);
    assert.equal(updated.args.newPoster, replacementPoster.address);

    await expectRevert(() => contract.connect(other).acceptAdmin(), 'AdminTransferNotPending');
  });

  it('domain-separates proof IDs by contract deployment', async function () {
    const [deployer, poster] = await ethers.getSigners();
    const GovernanceProofV2 = await ethers.getContractFactory('GovernanceProofV2');
    const first = await GovernanceProofV2.deploy(deployer.address, poster.address);
    const second = await GovernanceProofV2.deploy(deployer.address, poster.address);
    await first.waitForDeployment();
    await second.waitForDeployment();

    const args = [hash('run-domain'), hash('evidence'), hash('policy'), 1, 1000] as const;
    assert.notEqual(await first.computeProofId(...args), await second.computeProofId(...args));
  });
});
