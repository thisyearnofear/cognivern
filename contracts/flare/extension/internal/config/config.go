// Package config contains configuration values and defaults used by the extension.
package config

import (
	"os"
	"strconv"
	"time"
)

const (
	Version = "0.2.0"

	OPTypeSpendPolicy         = "SPEND_POLICY"
	OPCommandRegisterPolicy   = "REGISTER_POLICY"
	OPCommandEvaluateSpend    = "EVALUATE_SPEND"

	TimeoutShutdown = 5 * time.Second
)

// Defaults (overridden by TEE node env EXTENSION_PORT / SIGN_PORT).
var (
	ExtensionPort = 8080
	SignPort      = 9090
)

func init() {
	ep := os.Getenv("EXTENSION_PORT")
	sp := os.Getenv("SIGN_PORT")

	if ep != "" {
		if v, err := strconv.Atoi(ep); err == nil {
			ExtensionPort = v
		}
	}
	if sp != "" {
		if v, err := strconv.Atoi(sp); err == nil {
			SignPort = v
		}
	}
}
