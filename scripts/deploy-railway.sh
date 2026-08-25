#!/usr/bin/env bash
# Migrates apps/api (Go backend) + Postgres, and optionally packages/admin-web,
# to a new Railway project. Idempotent-ish: re-running skips steps whose
# resource already exists, but ALWAYS check `railway service list --json`
# yourself if a step's output looks ambiguous before re-running it.
#
# Usage:
#   ./scripts/deploy-railway.sh                # backend + postgres only
#   DEPLOY_ADMIN_WEB=1 ./scripts/deploy-railway.sh   # also deploy admin-web
#
# Requires: railway CLI installed and authenticated (`railway login`).
set -euo pipefail

PROJECT_NAME="${RAILWAY_PROJECT_NAME:-unghosted}"
API_SERVICE="${RAILWAY_API_SERVICE:-api}"
ADMIN_SERVICE="${RAILWAY_ADMIN_SERVICE:-admin-web}"
DB_SERVICE="Postgres"
SESSION="railway-migrate-$(date +%s)-$$"
export RAILWAY_CALLER="script:deploy-railway.sh"
export RAILWAY_AGENT_SESSION="$SESSION"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

command -v railway >/dev/null || {
  echo "railway CLI not found. Install: bash <(curl -fsSL https://railway.com/install.sh)" >&2
  exit 1
}

echo "==> Checking Railway auth"
railway whoami --json >/dev/null || {
  echo "Not authenticated. Run: railway login" >&2
  exit 1
}

echo "==> Looking for existing project '$PROJECT_NAME'"
EXISTING_PROJECT_ID="$(railway list --json | jq -r --arg n "$PROJECT_NAME" '.[] | select(.name==$n) | .id' | head -n1)"

if [ -z "$EXISTING_PROJECT_ID" ]; then
  echo "==> Creating project '$PROJECT_NAME'"
  railway init --name "$PROJECT_NAME"
else
  echo "==> Linking existing project '$PROJECT_NAME' ($EXISTING_PROJECT_ID)"
  railway link --project "$EXISTING_PROJECT_ID"
fi

PROJECT_ID="$(railway status --json | jq -r '.project.id')"
ENVIRONMENT_ID="$(railway status --json | jq -r '.environment.id')"
echo "==> Project: $PROJECT_ID  Environment: $ENVIRONMENT_ID"

echo "==> Ensuring Postgres exists"
if ! railway service list --json | jq -e --arg n "$DB_SERVICE" '.[] | select(.name==$n)' >/dev/null; then
  railway add --database postgres --json
else
  echo "    Postgres already present, skipping."
fi

echo "==> Ensuring '$API_SERVICE' service exists"
if ! railway service list --json | jq -e --arg n "$API_SERVICE" '.[] | select(.name==$n)' >/dev/null; then
  railway add --service "$API_SERVICE" --json
else
  echo "    Service already present, skipping."
fi

echo "==> Configuring '$API_SERVICE': isolated root dir, Dockerfile builder"
railway environment edit --service-config "$API_SERVICE" source.rootDirectory "/apps/api"
railway environment edit --service-config "$API_SERVICE" build.builder DOCKERFILE
railway environment edit --service-config "$API_SERVICE" build.dockerfilePath "Dockerfile"

echo "==> Wiring env vars on '$API_SERVICE'"
JWT_SECRET_VALUE="$(railway variable list --service "$API_SERVICE" --json 2>/dev/null | jq -r '.JWT_SECRET // empty')"
if [ -z "$JWT_SECRET_VALUE" ]; then
  JWT_SECRET_VALUE="$(openssl rand -hex 32)"
  echo "    Generated a new JWT_SECRET (only shown here — save it if you need it elsewhere)."
fi

if [ -z "${ADMIN_WEB_ORIGIN:-}" ]; then
  echo "Set ADMIN_WEB_ORIGIN to admin-web production URL before running (e.g. https://admin-web-production.up.railway.app, no trailing slash)." >&2
  exit 1
fi

railway variable set \
  DATABASE_URL="\${{Postgres.DATABASE_URL}}" \
  JWT_SECRET="$JWT_SECRET_VALUE" \
  ADMIN_WEB_ORIGIN="$ADMIN_WEB_ORIGIN" \
  PORT="8080" \
  --service "$API_SERVICE"

echo "==> Deploying '$API_SERVICE' (this can take a few minutes for the Go build)"
railway up ./apps/api --path-as-root --service "$API_SERVICE" --environment "$ENVIRONMENT_ID" --detach -m "migrate apps/api to Railway"

echo "==> Polling deployment status"
for i in $(seq 1 40); do
  STATUS="$(railway deployment list --service "$API_SERVICE" --environment "$ENVIRONMENT_ID" --json | jq -r '.[0].status')"
  echo "    [$i] status=$STATUS"
  case "$STATUS" in
    SUCCESS) break ;;
    FAILED|CRASHED) echo "Deploy failed — check: railway logs --service $API_SERVICE --lines 100" >&2; exit 1 ;;
    NEEDS_APPROVAL) echo "Deployment needs manual approval in the Railway dashboard." >&2; exit 1 ;;
  esac
  sleep 10
done

echo "==> Generating a public domain for '$API_SERVICE'"
DOMAIN_JSON="$(railway domain --service "$API_SERVICE" --json || true)"
echo "$DOMAIN_JSON"
GENERATED_DOMAIN="$(echo "$DOMAIN_JSON" | jq -r '.domain // empty')"
if [ -n "$GENERATED_DOMAIN" ]; then
  railway domain update "$GENERATED_DOMAIN" --port 8080 --service "$API_SERVICE" --json || true
  echo "    Backend live at: https://$GENERATED_DOMAIN"
fi

if [ "${DEPLOY_ADMIN_WEB:-0}" = "1" ]; then
  echo "==> Ensuring '$ADMIN_SERVICE' service exists"
  if ! railway service list --json | jq -e --arg n "$ADMIN_SERVICE" '.[] | select(.name==$n)' >/dev/null; then
    railway add --service "$ADMIN_SERVICE" --json
  fi

  echo "==> Configuring '$ADMIN_SERVICE' as a Bun-workspace static build (shared monorepo pattern — no rootDirectory)"
  railway environment edit --service-config "$ADMIN_SERVICE" build.buildCommand "bun install && bun run build:admin"
  railway variable set RAILPACK_STATIC_FILE_ROOT="packages/admin-web/dist" --service "$ADMIN_SERVICE"

  echo "==> Deploying '$ADMIN_SERVICE'"
  railway up . --service "$ADMIN_SERVICE" --environment "$ENVIRONMENT_ID" --detach -m "migrate admin-web to Railway"
  railway domain --service "$ADMIN_SERVICE" --json || true

  echo "NOTE: once admin-web's domain is known, re-run with ADMIN_WEB_ORIGIN set to it so"
  echo "      apps/api's CORS matches, then redeploy '$API_SERVICE'."
fi

echo "==> Done. Seed the first platform admin (runs seedadmin LOCALLY against the"
echo "    production DATABASE_URL that 'railway run' injects):"
echo "    (cd apps/api && railway run --service $API_SERVICE -- go run ./cmd/seedadmin -email you@company.com -password 'change-me')"
