// Package types contains types for Cognivern confidential spend-policy on FCC.
package types

import (
	"github.com/ethereum/go-ethereum/common"
)

// RegisterPolicyRequest seeds TEE-private policy limits.
// Amounts are decimal integer strings (wei) to avoid JSON number precision loss.
type RegisterPolicyRequest struct {
	PolicyID           string `json:"policyId"`
	DailyLimit         string `json:"dailyLimit"`
	PerTxLimit         string `json:"perTxLimit"`
	ApprovalThreshold  string `json:"approvalThreshold"`
}

// RegisterPolicyResponse confirms TEE-side registration.
type RegisterPolicyResponse struct {
	PolicyID string `json:"policyId"`
	OK       bool   `json:"ok"`
}

// EvaluateSpendRequest asks the TEE to evaluate a spend against private state.
type EvaluateSpendRequest struct {
	AgentID    string `json:"agentId"`
	PolicyID   string `json:"policyId"`
	Amount     string `json:"amount"`
	VendorHash string `json:"vendorHash"`
}

// EvaluateSpendResponse is the confidential decision (plaintext only inside TEE result).
// Outcome: "approve" | "hold" | "deny"
type EvaluateSpendResponse struct {
	DecisionID string `json:"decisionId"`
	Outcome    string `json:"outcome"`
	Reason     string `json:"reason"`
	AgentID    string `json:"agentId"`
	PolicyID   string `json:"policyId"`
}

// State is returned by GET /state (no secret limits — counts only).
type State struct {
	PolicyCount       int    `json:"policyCount"`
	EvaluationCount   int    `json:"evaluationCount"`
	LastOutcome       string `json:"lastOutcome"`
	LastDecisionID    string `json:"lastDecisionId"`
	Version           string `json:"version"`
}

// --- DO NOT MODIFY below this line. ---

// StateResponse is the envelope returned by GET /state.
type StateResponse struct {
	StateVersion common.Hash `json:"stateVersion"`
	State        State       `json:"state"`
}
