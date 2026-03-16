#!/bin/bash
# AOS - Query traces

LIMIT="${1:-10}"

node ~/aos-telemetry/cli.js query traces --limit "$LIMIT"
