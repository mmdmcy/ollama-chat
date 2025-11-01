#!/usr/bin/env bash

set -euo pipefail

# Simple launcher for Linux Mint (and most Linux distros)
# Mirrors the Windows start.bat behavior: opens the browser and serves the app

PORT="8000"

command_exists() {
	command -v "$1" >/dev/null 2>&1
}

# Pick python command
PYTHON_BIN=""
if command_exists python3; then
	PYTHON_BIN="python3"
elif command_exists python; then
	PYTHON_BIN="python"
else
	echo "Python is required but not found. Install it with: sudo apt install python3" >&2
	exit 1
fi

# If port is taken, bump until free (max +10 tries)
TRY=0
while lsof -i TCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
	TRY=$((TRY+1))
	if [ "$TRY" -gt 10 ]; then
		echo "No free port found near 8000. Stop something using the port and retry." >&2
		exit 1
	fi
	PORT=$((PORT+1))
done

URL="http://localhost:${PORT}"
echo "Starting local web server on ${URL}"

# Open the browser if possible
if command_exists xdg-open; then
	xdg-open "$URL" >/dev/null 2>&1 || true
fi

exec "$PYTHON_BIN" -m http.server "$PORT"


