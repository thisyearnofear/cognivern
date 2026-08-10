package extension

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/types"

	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"

	"github.com/flare-foundation/tee-node/pkg/processorutils"
)

type policyLimits struct {
	dailyLimit        *big.Int
	perTxLimit        *big.Int
	approvalThreshold *big.Int
}

type spendCounter struct {
	spentToday  *big.Int
	windowStart int64 // UTC day index
}

type Extension struct {
	mu     sync.RWMutex
	Server *http.Server

	policies  map[string]policyLimits
	counters  map[string]spendCounter // key: agentId
	evalCount int
	lastOutcome    string
	lastDecisionID string
}

// --- DO NOT MODIFY: New(), actionHandler() are boilerplate.
func New(extensionPort, signPort int) *Extension {
	e := &Extension{
		policies: make(map[string]policyLimits),
		counters: make(map[string]spendCounter),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /state", e.stateHandler)
	mux.HandleFunc("POST /action", e.actionHandler)

	e.Server = &http.Server{Addr: fmt.Sprintf(":%d", extensionPort), Handler: mux}
	_ = signPort
	return e
}

func (e *Extension) stateHandler(w http.ResponseWriter, r *http.Request) {
	e.mu.RLock()
	stateResponse := types.StateResponse{
		StateVersion: teeutils.ToHash(config.Version),
		State: types.State{
			PolicyCount:     len(e.policies),
			EvaluationCount: e.evalCount,
			LastOutcome:     e.lastOutcome,
			LastDecisionID:  e.lastDecisionID,
			Version:         config.Version,
		},
	}
	e.mu.RUnlock()

	err := json.NewEncoder(w).Encode(stateResponse)
	if err != nil {
		http.Error(w, fmt.Sprintf("sending response: %v", err), http.StatusInternalServerError)
		return
	}
}

func (e *Extension) processAction(action teetypes.Action) (int, []byte) {
	dataFixed, err := processorutils.Parse[instruction.DataFixed](action.Data.Message)
	if err != nil {
		return http.StatusBadRequest, []byte(fmt.Sprintf("decoding fixed data: %v", err))
	}

	switch {
	case dataFixed.OPType == teeutils.ToHash(config.OPTypeSpendPolicy):
		return e.processSpendPolicy(action, dataFixed)
	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op type: received %s, expected %s (%s)",
			dataFixed.OPType.Hex(), teeutils.ToHash(config.OPTypeSpendPolicy).Hex(), config.OPTypeSpendPolicy,
		))
	}
}

func (e *Extension) processSpendPolicy(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandRegisterPolicy):
		ar := e.processRegisterPolicy(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b
	case df.OPCommand == teeutils.ToHash(config.OPCommandEvaluateSpend):
		ar := e.processEvaluateSpend(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b
	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op command: received %s, expected one of [%s (%s), %s (%s)]",
			df.OPCommand.Hex(),
			teeutils.ToHash(config.OPCommandRegisterPolicy).Hex(), config.OPCommandRegisterPolicy,
			teeutils.ToHash(config.OPCommandEvaluateSpend).Hex(), config.OPCommandEvaluateSpend,
		))
	}
}

func (e *Extension) processRegisterPolicy(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	var req types.RegisterPolicyRequest
	dec := json.NewDecoder(bytes.NewReader(df.OriginalMessage))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding request: %w", err))
	}
	if req.PolicyID == "" {
		return buildResult(action, df, nil, 0, fmt.Errorf("policyId must not be empty"))
	}
	daily, err := parseAmount(req.DailyLimit)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("dailyLimit: %w", err))
	}
	perTx, err := parseAmount(req.PerTxLimit)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("perTxLimit: %w", err))
	}
	threshold, err := parseAmount(req.ApprovalThreshold)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("approvalThreshold: %w", err))
	}

	e.mu.Lock()
	e.policies[normalizeID(req.PolicyID)] = policyLimits{
		dailyLimit:        daily,
		perTxLimit:        perTx,
		approvalThreshold: threshold,
	}
	e.mu.Unlock()

	resp := types.RegisterPolicyResponse{PolicyID: req.PolicyID, OK: true}
	data, _ := json.Marshal(resp)
	return buildResult(action, df, data, 1, nil)
}

func (e *Extension) processEvaluateSpend(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	var req types.EvaluateSpendRequest
	dec := json.NewDecoder(bytes.NewReader(df.OriginalMessage))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding request: %w", err))
	}
	if req.AgentID == "" || req.PolicyID == "" {
		return buildResult(action, df, nil, 0, fmt.Errorf("agentId and policyId are required"))
	}
	amount, err := parseAmount(req.Amount)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("amount: %w", err))
	}

	policyKey := normalizeID(req.PolicyID)
	agentKey := normalizeID(req.AgentID)

	e.mu.Lock()
	defer e.mu.Unlock()

	limits, ok := e.policies[policyKey]
	if !ok {
		return buildResult(action, df, nil, 0, fmt.Errorf("policy missing"))
	}

	day := time.Now().UTC().Unix() / 86400
	counter := e.counters[agentKey]
	if counter.spentToday == nil || counter.windowStart < day {
		counter = spendCounter{spentToday: big.NewInt(0), windowStart: day}
	}

	outcome := "approve"
	reason := "within_limits"
	if amount.Cmp(limits.perTxLimit) > 0 {
		outcome = "deny"
		reason = "per_tx_limit"
	} else {
		newSpent := new(big.Int).Add(counter.spentToday, amount)
		if newSpent.Cmp(limits.dailyLimit) > 0 {
			outcome = "deny"
			reason = "daily_limit"
		} else if amount.Cmp(limits.approvalThreshold) > 0 {
			outcome = "hold"
			reason = "approval_threshold"
			counter.spentToday = newSpent
			counter.windowStart = day
			e.counters[agentKey] = counter
		} else {
			counter.spentToday = newSpent
			counter.windowStart = day
			e.counters[agentKey] = counter
		}
	}

	decisionID := hashDecision(req.AgentID, req.PolicyID, req.Amount, req.VendorHash, action.Data.ID.Hex())
	e.evalCount++
	e.lastOutcome = outcome
	e.lastDecisionID = decisionID

	resp := types.EvaluateSpendResponse{
		DecisionID: decisionID,
		Outcome:    outcome,
		Reason:     reason,
		AgentID:    req.AgentID,
		PolicyID:   req.PolicyID,
	}
	data, _ := json.Marshal(resp)
	return buildResult(action, df, data, 1, nil)
}

func parseAmount(s string) (*big.Int, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, fmt.Errorf("empty amount")
	}
	v, ok := new(big.Int).SetString(s, 10)
	if !ok {
		return nil, fmt.Errorf("not a decimal integer: %q", s)
	}
	if v.Sign() < 0 {
		return nil, fmt.Errorf("negative amount")
	}
	return v, nil
}

func normalizeID(id string) string {
	return strings.ToLower(strings.TrimSpace(id))
}

func hashDecision(parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		_, _ = h.Write([]byte(p))
		_, _ = h.Write([]byte{0})
	}
	return "0x" + hex.EncodeToString(h.Sum(nil))
}
