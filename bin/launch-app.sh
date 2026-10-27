#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_ROOT="${AI_JOB_SEARCH_ROOT:-$APP_ROOT}"
APP_PORT="${AI_JOB_SEARCH_PORT:-$((41000 + RANDOM % 8000))}"
INSTANCE_TOKEN="launcher-$(date +%s)-$$"
APP_URL="http://127.0.0.1:${APP_PORT}"
cd "$APP_ROOT"

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required. Install it from https://bun.sh and retry." >&2
  exit 1
fi

mkdir -p "$DATA_ROOT/data"
LOG_FILE="$DATA_ROOT/data/server.log"
AI_JOB_SEARCH_APP_ROOT="$APP_ROOT" AI_JOB_SEARCH_ROOT="$DATA_ROOT" AI_JOB_SEARCH_INSTANCE_TOKEN="$INSTANCE_TOKEN" PORT="$APP_PORT" bun run app/server.ts >"$LOG_FILE" 2>&1 &

RUNNING=false
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl --silent --fail --max-time 1 "$APP_URL/api/health" | grep -q "$INSTANCE_TOKEN"; then
    RUNNING=true
    break
  fi
  sleep 0.25
done

if [ "$RUNNING" != true ]; then
  echo "AI Job Search Studio could not start on port $APP_PORT." >&2
  echo "Check $LOG_FILE, confirm Bun can run, or set AI_JOB_SEARCH_PORT to a free port." >&2
  exit 1
fi

if [[ "${OSTYPE:-}" == darwin* ]]; then
  open "$APP_URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP_URL" >/dev/null 2>&1 &
else
  echo "Job Search Studio is ready at $APP_URL"
fi
