# Proof of Intent Mechanism

## Overview

Cognivern implements a **Verifiable Intent** framework to ensure that every agent decision is observable, auditable, and cryptographically provable. This moves beyond simple result tracking by capturing the "why" behind every "what."

## The Forensic Chain of Trust

1.  **Reasoning Capture**: As an agent processes information, its internal thoughts, observations, and planned actions are captured in real-time.
2.  **Confidential Execution**: Reasoning occurs within Trusted Execution Environments (TEEs) or confidential enclaves (via CRE Confidential HTTP), ensuring that sensitive logic remains private while the process remains verifiable.
3.  **On-Chain Anchoring (EAS)**: Key decisions and forecasts are submitted as **Ethereum Attestation Service (EAS)** attestations on Arbitrum. These attestations include:
    *   `conditionId`: The specific market or task identifier.
    *   `probability`: The agent's confidence level.
    *   `reasoningHash`: A cryptographic hash of the full reasoning path.
4.  **Forensic Storage (Filecoin)**: The full reasoning trace, corresponding to the `reasoningHash`, is stored on **Filecoin (FVM)**. This provides permanent, verifiable cold storage for forensic audits.
5.  **Real-Time Coordination (Polkadot)**: The hot-path coordination and policy enforcement are managed via **Polkadot (REVM/PVM)**, ensuring high-performance governance.

## Privacy & Security of Intent

To ensure that agents never reveal private information (PII, API keys, or proprietary data) in public facing proofs, Cognivern employs a multi-layered privacy strategy:

1.  **Client-Side Redaction**: The UI automatically redacts sensitive patterns (keys, tokens, emails) from raw trace metadata before display.
2.  **Confidential Computing (TEEs)**: Reasoning occurs within Trusted Execution Environments. Only the `reasoningHash` is public; the full trace is stored in encrypted format on Filecoin/Recall.
3.  **ZK-Attestations**: For high-security integrations (e.g., OpenClaw, Hermes), Cognivern supports Zero-Knowledge proofs of intent, allowing an agent to prove it followed a policy without revealing the underlying data.
4.  **Selective Disclosure**: Users can toggle which parts of the cognitive path are public vs. private in the Governance Dashboard.

## Verification Process

To verify a "Proof of Intent," an auditor follows these steps:

1.  **Locate Attestation**: Retrieve the EAS attestation from the Arbitrum blockchain using the transaction hash or attestation ID.
2.  **Retrieve Reasoning**: Use the `reasoningHash` from the attestation to fetch the full reasoning trace from Filecoin/Recall Network.
3.  **Validate Hash**: Re-hash the retrieved reasoning trace and ensure it matches the `reasoningHash` stored on-chain.
4.  **Audit Logic**: Review the cognitive path (observations -> thoughts -> actions) to ensure compliance with established governance policies.

## Benefits

*   **Non-Repudiation**: Agents cannot "deny" their reasoning after the fact.
*   **Auditability**: Complete transparency into the decision-making process for regulatory or internal review.
*   **Trust**: Building user confidence in autonomous systems by providing "Forensic Evidence" of their intent.
