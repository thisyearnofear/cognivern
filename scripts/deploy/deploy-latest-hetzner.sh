#!/usr/bin/env bash
set -euo pipefail

bash "$(dirname "$0")/build-backend-artifact.sh"
bash "$(dirname "$0")/deploy-backend-artifact-hetzner.sh"
