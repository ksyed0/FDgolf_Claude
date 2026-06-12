# FDgolf

Web-enabled golf scoring app — mobile-first, offline-capable, built for the CIBC ARC Golf 2026 tournament.

**Stack:** Next.js 14 App Router · TypeScript · Supabase · Mapbox · Tailwind CSS · shadcn/ui

---

## Contributor Setup

> **Time estimate:** ~20 minutes on a clean machine.

### 1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | https://nodejs.org or `nvm install 20` |
| Git | ≥ 2.39 | https://git-scm.com |
| GitHub CLI | ≥ 2.x | https://cli.github.com |
| Docker / OrbStack | latest | https://orbstack.dev (recommended) or https://docker.com |
| Claude Code | latest | see §4 below |

### 2. Clone and install

```bash
# Clone via SSH (preferred for contributors)
git clone git@github.com:ksyed0/FDgolf_Claude.git
cd FDgolf_Claude

# Install root tooling (PlanVisualizer, Conductor scripts)
npm install

# Install app dependencies
cd fdgolf-app && npm install && cd ..
```

### 3. Environment variables

```bash
cp fdgolf-app/.env.example fdgolf-app/.env.local
```

Then open `fdgolf-app/.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=        # from Supabase project settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # from Supabase project settings → API
NEXT_PUBLIC_MAPBOX_TOKEN=        # from mapbox.com → Tokens
NEXT_PUBLIC_MAPBOX_STYLE_URL=    # optional: custom Mapbox style URL
```

For local development, the Supabase values are auto-provided by the local stack (see §5).

### 4. Claude Code — install and update

Claude Code is the AI coding assistant used to build this project. It reads `CLAUDE.md` and `docs/agents/` to understand the codebase.

**Install (first time):**

```bash
npm install -g @anthropic/claude-code
```

**Authenticate:**

```bash
claude auth login
```

This opens a browser to authenticate with your Anthropic account. You need an active Claude plan (Pro or Team).

**Verify:**

```bash
claude --version
```

**Update to latest:**

```bash
npm update -g @anthropic/claude-code
```

**Configure for this repo:**

Claude Code reads its project instructions from `CLAUDE.md` at the repo root. No extra configuration is needed — just `cd` into the repo and run `claude`.

```bash
cd FDgolf_Claude
claude
```

Claude Code will automatically discover `CLAUDE.md`, `MEMORY.md`, and `progress.md` on startup.

### 5. Local Supabase stack

```bash
cd fdgolf-app

# Start local Supabase (requires Docker/OrbStack running)
npm run supabase:start

# Output includes local credentials — copy these into .env.local:
#   API URL:  http://127.0.0.1:54321
#   anon key: <long JWT>
```

The local stack auto-applies all migrations in `supabase/migrations/` and seeds clubs from `supabase/seed.sql`.

**Stop when done:**

```bash
npm run supabase:stop
```

### 6. Run the dev server

```bash
cd fdgolf-app
npm run dev
# → http://localhost:3000
```

### 7. Verify your setup

```bash
cd fdgolf-app

npm run type-check   # TypeScript — should exit 0
npm run lint         # ESLint — should exit 0
npm run format:check # Prettier — should exit 0
npm test             # Vitest — should show 370+ passing
```

---

## GitHub — Connect as a Contributor

### Request access

Contact **@ksyed0** on GitHub to be added as a collaborator on `ksyed0/FDgolf_Claude`.

### Authenticate the GitHub CLI

```bash
gh auth login
# Select: GitHub.com → HTTPS or SSH → authenticate via browser
```

Verify:

```bash
gh auth status
```

### Set up SSH key (recommended over HTTPS)

```bash
# Generate a key if you don't have one
ssh-keygen -t ed25519 -C "your@email.com"

# Add to GitHub
gh ssh-key add ~/.ssh/id_ed25519.pub --title "My MacBook"

# Test
ssh -T git@github.com
# Expected: "Hi <username>! You've successfully authenticated..."
```

### Configure git identity

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Branch workflow

```
develop ← feature/US-XXXX-short-name  (your work)
main    ← develop                      (release cuts only)
```

```bash
# Start a feature
git checkout develop && git pull
git checkout -b feature/US-XXXX-short-name

# Push and open a PR
git push -u origin feature/US-XXXX-short-name
gh pr create --base develop
```

See `CLAUDE.md` → "Git workflow" for the full commit message format.

---

## Pre-commit hooks

Prettier runs automatically on staged files before every commit via `husky` + `lint-staged`. No manual formatting required — just commit and the hook fixes it.

If the hook is not running after cloning, re-initialize it:

```bash
# From repo root
npm run prepare
```

---

## Key docs

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project instructions for Claude Code |
| `MEMORY.md` | Cross-session context (updated each session) |
| `progress.md` | Session log and current state |
| `docs/RELEASE_PLAN.md` | Stories, tasks, acceptance criteria |
| `docs/ARCHITECTURE.md` | Component boundaries and data flows |
| `docs/ID_REGISTRY.md` | Artifact ID registry — read before creating any ID |
| `docs/LESSONS.md` | Accumulated lessons from previous sessions |
