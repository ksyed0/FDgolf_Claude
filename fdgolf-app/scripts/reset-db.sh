#!/usr/bin/env bash
# Reset local Supabase DB, apply all migrations, and load dev seed data.
# Usage: npm run db:reset
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Resetting local Supabase database..."
npx supabase db reset

echo "→ Loading dev seed data..."
npx supabase db execute --file supabase/seed-dev.sql

echo "✓ Database reset complete."
echo ""
echo "Test accounts:"
echo "  Admin:  admin@fdgolf.dev  / password: Admin1234!"
echo "  Player: alice@example.com / password: Player123!"
echo "  Player: bob@example.com   / password: Player123!"
