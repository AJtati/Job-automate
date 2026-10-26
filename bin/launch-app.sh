#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PORT="${AI_JOB_SEARCH_PORT:-3333}"
APP_URL="http://127.0.0.1:${APP_PORT}"
cd "$APP_ROOT"

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required. Install it from https://bun.sh and retry." >&2
  exit 1
fi

if ! curl --silent --fail --max-time 1 "$APP_URL/api/jobs" >/dev/null 2>&1; then
  AI_JOB_SEARCH_PORT="$APP_PORT" bun run app/server.ts >/tmp/ai-job-search-studio.log 2>&1 &
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl --silent --fail --max-time 1 "$APP_URL/api/jobs" >/dev/null 2>&1 && break
    sleep 0.25
  done
fi

if [[ "${OSTYPE:-}" == darwin* ]]; then
  open "$APP_URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP_URL" >/dev/null 2>&1 &
else
  echo "Job Search Studio is ready at $APP_URL"
fi
