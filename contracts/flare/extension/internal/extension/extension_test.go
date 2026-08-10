package extension

import (
	"encoding/json"
	"net/http"
	"testing"

	"extension-scaffold/internal/config"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"
)

func toHash(s string) common.Hash { return teeutils.ToHash(s) }

func buildTestAction(opType, opCommand common.Hash, originalMessage []byte) teetypes.Action {
	type dataFixed struct {
		InstructionID      common.Hash    `json:"instructionId"`
		TeeID              common.Address `json:"teeId"`
		Timestamp          uint64         `json:"timestamp"`
		RewardEpochID      uint32         `json:"rewardEpochId"`
		OPType             common.Hash    `json:"opType"`
		OPCommand          common.Hash    `json:"opCommand"`
		Cosigners          []string       `json:"cosigners"`
		CosignersThreshold uint64         `json:"cosignersThreshold"`
		OriginalMessage    hexutil.Bytes  `json:"originalMessage"`
	}

	df := dataFixed{
		OPType:          opType,
		OPCommand:       opCommand,
		OriginalMessage: originalMessage,
	}
	msg, _ := json.Marshal(df)

	return teetypes.Action{
		Data: teetypes.ActionData{
			ID:            common.HexToHash("0x1234"),
			SubmissionTag: "submit",
			Message:       msg,
		},
	}
}

func TestProcessAction_UnknownOPType(t *testing.T) {
	e := New(0, 0)
	action := buildTestAction(toHash("UNKNOWN"), toHash(config.OPCommandEvaluateSpend), nil)
	status, _ := e.processAction(action)
	if status != http.StatusNotImplemented {
		t.Fatalf("expected %d, got %d", http.StatusNotImplemented, status)
	}
}

func TestRegisterAndEvaluate_ApproveHoldDeny(t *testing.T) {
	e := New(0, 0)

	regMsg, _ := json.Marshal(map[string]string{
		"policyId":          "0x01",
		"dailyLimit":        "1000",
		"perTxLimit":        "100",
		"approvalThreshold": "50",
	})
	regAction := buildTestAction(
		toHash(config.OPTypeSpendPolicy),
		toHash(config.OPCommandRegisterPolicy),
		regMsg,
	)
	status, body := e.processAction(regAction)
	if status != http.StatusOK {
		t.Fatalf("register status %d body %s", status, body)
	}

	cases := []struct {
		amount  string
		outcome string
	}{
		{"25", "approve"},
		{"75", "hold"},
		{"150", "deny"},
	}
	for _, tc := range cases {
		evalMsg, _ := json.Marshal(map[string]string{
			"agentId":    "0xaa",
			"policyId":   "0x01",
			"amount":     tc.amount,
			"vendorHash": "0xbb",
		})
		action := buildTestAction(
			toHash(config.OPTypeSpendPolicy),
			toHash(config.OPCommandEvaluateSpend),
			evalMsg,
		)
		status, body := e.processAction(action)
		if status != http.StatusOK {
			t.Fatalf("evaluate %s status %d body %s", tc.amount, status, body)
		}
		var ar struct {
			Status uint8         `json:"status"`
			Data   hexutil.Bytes `json:"data"`
		}
		if err := json.Unmarshal(body, &ar); err != nil {
			t.Fatal(err)
		}
		if ar.Status != 1 {
			t.Fatalf("amount %s action status %d body %s", tc.amount, ar.Status, body)
		}
		var resp struct {
			Outcome string `json:"outcome"`
		}
		if err := json.Unmarshal(ar.Data, &resp); err != nil {
			t.Fatal(err)
		}
		if resp.Outcome != tc.outcome {
			t.Fatalf("amount %s: got %s want %s", tc.amount, resp.Outcome, tc.outcome)
		}
	}
}

func TestEvaluate_MissingPolicy(t *testing.T) {
	e := New(0, 0)
	evalMsg, _ := json.Marshal(map[string]string{
		"agentId": "0xaa", "policyId": "missing", "amount": "1", "vendorHash": "0xbb",
	})
	action := buildTestAction(
		toHash(config.OPTypeSpendPolicy),
		toHash(config.OPCommandEvaluateSpend),
		evalMsg,
	)
	status, body := e.processAction(action)
	if status != http.StatusOK {
		t.Fatalf("expected 200 with status=0 payload, got %d", status)
	}
	var ar struct {
		Status uint8 `json:"status"`
	}
	_ = json.Unmarshal(body, &ar)
	if ar.Status != 0 {
		t.Fatalf("expected error status 0, got %d body %s", ar.Status, body)
	}
}
