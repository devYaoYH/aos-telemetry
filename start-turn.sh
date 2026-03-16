#!/bin/bash
# AOS - Start tracking a turn

TURN_ID="${1:-turn-$(date +%s)}"
shift

node ~/aos-telemetry/cli.js start-turn "$TURN_ID" "$@"
