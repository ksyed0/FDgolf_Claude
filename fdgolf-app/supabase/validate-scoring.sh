#!/usr/bin/env bash
# Runs the EPIC-0006 scoring pgTAP suite against the local Supabase DB.
# Mirrors the validate-*.sh pattern; exits non-zero on any failing test.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ Running scoring pgTAP suite (supabase test db)…"
supabase test db
echo "✓ Scoring pgTAP suite passed."
