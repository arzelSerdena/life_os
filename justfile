# Life OS commands. Run `just` to list them.

set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

# List the commands
default:
    @just --list --unsorted

# Build the frontend, apply migrations and run the app at http://127.0.0.1:8000
app port="8000": build migrate (serve port)

# Run the app from the last build, without rebuilding or migrating
[working-directory: 'backend']
serve port="8000":
    uv run uvicorn app.main:app --host 127.0.0.1 --port {{port}}

# Run the API (8000, reloading) and the Vite dev server (5173) together
[parallel]
dev: dev-api dev-web

# Run the API with reload, for the Vite dev server
[working-directory: 'backend']
dev-api:
    uv run uvicorn app.main:app --reload

# Run the Vite dev server (needs the API)
[working-directory: 'frontend']
dev-web:
    pnpm dev

# Install backend and frontend dependencies
install: (backend "uv sync") (frontend "pnpm install")

# Build the frontend into frontend/dist, which the API serves
[working-directory: 'frontend']
build:
    pnpm build

# Apply database migrations
[working-directory: 'backend']
migrate:
    uv run alembic upgrade head

# Fix lint and formatting in both halves
fmt: (backend "uv run ruff check --fix .") (backend "uv run ruff format .") (frontend "pnpm format")

# Type-check both halves
typecheck: (backend "uv run pyright") (frontend "pnpm typecheck")

# Run the backend and frontend unit tests
test: (backend "uv run pytest") (frontend "pnpm test")

# Run the browser tests (own API on 8100 and Vite on 5180, on a throwaway database)
[working-directory: 'frontend']
e2e:
    pnpm e2e

# Everything to run before a PR
check: fmt typecheck test e2e

# Regenerate the API client after a backend API change
[working-directory: 'frontend']
api:
    pnpm api:generate

[private]
[working-directory: 'backend']
backend command:
    {{command}}

[private]
[working-directory: 'frontend']
frontend command:
    {{command}}
