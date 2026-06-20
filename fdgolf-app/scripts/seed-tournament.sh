#!/usr/bin/env bash
# Full reset + Lionhead seed. Use --no-reset to skip migration replay.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NO_RESET=false
for arg in "$@"; do [[ "$arg" == "--no-reset" ]] && NO_RESET=true; done

# Pre-flight (hard errors only)
if ! bash "$SCRIPT_DIR/check-local.sh" 2>&1 | grep -v '^⚠'; then
  echo "✗ Pre-flight failed — aborting." >&2; exit 1
fi

if [[ "$NO_RESET" == "false" ]]; then
  echo "→ Resetting database (applies all migrations)…"
  cd "$SCRIPT_DIR/.." && npx supabase db reset
  echo "✓ Migration reset complete."
fi

echo "→ Seeding Lionhead tournament…"
bash "$SCRIPT_DIR/seed-lionhead.sh"
