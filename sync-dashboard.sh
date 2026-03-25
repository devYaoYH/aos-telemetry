#!/bin/bash
# sync-dashboard.sh - Periodic sync for AOS dashboard
# Run this via cron every 30 minutes to keep dashboard updated

cd ~/aos-telemetry
node auto-sync.js

# No need to restart API server - it reads the file on each request
