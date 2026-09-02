#!/bin/sh
# Start the service and pull real requests through it.
#
# This is the half of the checking that `npm run typecheck` cannot do. tsc emits
# nothing here; what executes server.ts is Node's type stripper, and tsconfig's
# erasableSyntaxOnly is the only thing keeping the two in agreement. Booting is
# what proves it held.
#
# It deliberately runs from a directory that is not the package. server.ts joins
# public/ onto import.meta.dirname precisely so that the working directory
# cannot matter, and a smoke test started from the package root would pass just
# as happily against the cwd-relative version that does not work.
#
#   sh scripts/smoke.sh          # same command CI runs
#   PORT=9000 sh scripts/smoke.sh

set -eu

PORT=${PORT:-8099}
BASE="http://127.0.0.1:$PORT"
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cd /    # see above

PORT="$PORT" node "$ROOT/server.ts" &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT INT TERM

# Node parses and strips the whole file before it listens, so a first
# connection can lose a race that says nothing about the service.
attempt=0
until curl -fsS -o /dev/null "$BASE/healthz" 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 100 ]; then
        echo "FAIL the server never answered on $BASE/healthz" >&2
        exit 1
    fi
    sleep 0.1
done

fail=0

status() {
    got=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$1")
    if [ "$got" = "$2" ]; then
        echo "ok   $1 -> $got"
    else
        echo "FAIL $1 -> $got, expected $2" >&2
        fail=1
    fi
}

status /healthz 200
status /logo.png 200

# A missing asset must 404 and not fall through to anything else. A mail client
# handed 200 and a body that is not an image draws a broken image and gives the
# reader no way to tell why.
status /nowhere.png 404

# Content-Type is the half of a static server that mail clients act on: a PNG
# served as application/octet-stream is offered as a download rather than
# rendered. express.static infers it from the extension, so this breaks quietly
# the day an asset arrives without one.
type=$(curl -s -o /dev/null -D - "$BASE/logo.png" | tr -d '\r' \
    | awk 'tolower($1) == "content-type:" { print $2 }')
if [ "$type" = "image/png" ]; then
    echo "ok   /logo.png content-type -> $type"
else
    echo "FAIL /logo.png content-type -> ${type:-none}, expected image/png" >&2
    fail=1
fi

exit "$fail"
