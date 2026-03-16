#!/bin/bash
# AOS - Track tool execution

TOOL="$1"
shift

node ~/aos-telemetry/cli.js track-tool "$TOOL" "$@"
