#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

PORT=3333

# Check if server is already running
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "AI Job Search Studio is already running on http://localhost:$PORT"
else
    echo "Starting AI Job Search Studio on http://localhost:$PORT..."
    bun run app/server.ts &
    sleep 1
fi

# Open in browser based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS: Prefer standalone app window if Chrome exists, otherwise default browser
    if [ -d "/Applications/Google Chrome.app" ]; then
        open -na "Google Chrome" --args --app="http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT"
    else
        open "http://localhost:$PORT"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v xdg-open > /dev/null 2>&1; then
        xdg-open "http://localhost:$PORT"
    elif command -v google-chrome > /dev/null 2>&1; then
        google-chrome --app="http://localhost:$PORT" &
    else
        echo "Please open http://localhost:$PORT in your web browser."
    fi
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    start "http://localhost:$PORT"
else
    echo "AI Job Search Studio running at http://localhost:$PORT"
fi

echo "App launched successfully!"
