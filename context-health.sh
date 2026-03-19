#!/bin/bash
# Context Health Check - Get current context usage status

NODE_BIN="${NODE_BIN:-node}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$NODE_BIN" "$SCRIPT_DIR/cli.js" context-health "$@"
