#!/bin/bash
# reset-demo.sh - get ready for another take of the demo.
#
# Run via: npm run reset-demo
#
#   1. Deletes data/heirloom/items.json (Mai seals her items again on /vault).
#      Keeps data/heirloom/policies.json and data/heirloom/demo-ids.json.
#   2. Lists PENDING change requests in the heirloom realm (read-only).
#
# It NEVER authorizes, approves, commits or denies a change request. Deny leftovers by hand
# in the TideCloak console, in a seat's own browser profile.
#
# Prerequisites: curl, jq, KC_BOOTSTRAP_ADMIN_PASSWORD in .env

set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Windows / Git Bash: Docker Desktop and winget jq are not on PATH in non-login shells ---
for _d in "/c/Program Files/Docker/Docker/resources/bin" /c/Users/*/AppData/Local/Microsoft/WinGet/Packages/jqlang.jq_*; do
  [ -d "$_d" ] && PATH="$_d:$PATH"
done
export PATH

for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "ERROR: $cmd is not installed or not on PATH." >&2; exit 1; }
done

# --- Master-admin credentials: from .env, never hardcoded ---
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a; . "$PROJECT_DIR/.env"; set +a
fi

TIDECLOAK_URL="${TIDECLOAK_URL:-http://localhost:8080}"
REALM_NAME="${REALM_NAME:-heirloom}"
KC_BOOTSTRAP_ADMIN_USERNAME="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
ITEMS_FILE="$PROJECT_DIR/data/heirloom/items.json"

# --- 1. Local data: items only ---
if [ -f "$ITEMS_FILE" ]; then
  rm -f "$ITEMS_FILE"
  echo "==> Deleted $ITEMS_FILE"
else
  echo "==> $ITEMS_FILE already absent"
fi
echo "    Kept: data/heirloom/policies.json, data/heirloom/demo-ids.json"

# --- 2. Pending change requests (read-only) ---
if [ -z "${KC_BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
  echo "ERROR: KC_BOOTSTRAP_ADMIN_PASSWORD is not set (put it in $PROJECT_DIR/.env); cannot list change requests." >&2
  exit 1
fi

get_token() {
  # --data-urlencode so a password containing &, =, + or spaces still works.
  # Master-admin tokens live ~60 SECONDS, so call this per operation, not once.
  curl -s -X POST "$TIDECLOAK_URL/realms/master/protocol/openid-connect/token" \
    -d "client_id=admin-cli" -d "grant_type=password" \
    --data-urlencode "username=$KC_BOOTSTRAP_ADMIN_USERNAME" \
    --data-urlencode "password=$KC_BOOTSTRAP_ADMIN_PASSWORD" \
    | jq -r '.access_token // empty'
}

TOKEN="$(get_token)"
if [ -z "$TOKEN" ]; then
  echo "ERROR: could not get a master-admin token from $TIDECLOAK_URL (is TideCloak up?)." >&2
  exit 1
fi

BODY="$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/iga/change-requests?status=PENDING" \
  -H "Authorization: Bearer $TOKEN")"

if ! printf '%s' "$BODY" | jq -e 'type=="array"' >/dev/null 2>&1; then
  echo "ERROR: unexpected reply listing change requests: $BODY" >&2
  exit 1
fi

COUNT="$(printf '%s' "$BODY" | jq 'length')"
echo ""
echo "==> PENDING change requests in '$REALM_NAME': $COUNT"
if [ "$COUNT" -gt 0 ]; then
  echo "id actionType entityId authorizationCount/threshold"
  # Count from authorizationCount; if absent, say so rather than printing 0.
  printf '%s' "$BODY" | jq -r '.[] | "\(.id) \(.actionType) \(.entityId // "-") \(if .authorizationCount == null then (if .readyToCommit then "ready" else "?" end) else (.authorizationCount|tostring) end)/\(.threshold // "?")"'
  echo ""
  echo "Deny these in the TideCloak console (Change Requests) before a take."
  echo "    $TIDECLOAK_URL/admin/$REALM_NAME/console/"
else
  echo "    Nothing to deny."
fi
