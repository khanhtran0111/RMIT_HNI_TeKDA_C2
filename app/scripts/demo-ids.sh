#!/bin/bash
# demo-ids.sh - write data/heirloom/demo-ids.json for the operator's "Try to release to Long" button.
#
# Run via: npm run demo-ids
#
# READ-ONLY on TideCloak: two user lookups and two role lookups with the master-admin token.
# It creates, changes, approves or denies nothing.
#
# Output: data/heirloom/demo-ids.json =
#   {"realm","long","heir-bank-mai","heir-care-mai","authServerUrl"}   (3-account cast: no linh)
#
# Prerequisites: curl, jq, a running TideCloak with the heirloom realm, KC_BOOTSTRAP_ADMIN_PASSWORD in .env

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
OUT_DIR="$PROJECT_DIR/data/heirloom"
OUT_FILE="$OUT_DIR/demo-ids.json"

if [ -z "${KC_BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
  echo "ERROR: KC_BOOTSTRAP_ADMIN_PASSWORD is not set (put it in $PROJECT_DIR/.env)." >&2
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

fresh_token() {
  local t
  t="$(get_token)"
  if [ -z "$t" ]; then
    echo "ERROR: could not get a master-admin token from $TIDECLOAK_URL (is TideCloak up? is the password right?)." >&2
    exit 1
  fi
  printf '%s' "$t"
}

# GET only. Prints the id or exits loudly.
user_id() {
  local username="$1" token body id
  token="$(fresh_token)"
  body="$(curl -s -G "$TIDECLOAK_URL/admin/realms/$REALM_NAME/users" \
    --data-urlencode "username=$username" --data-urlencode "exact=true" \
    -H "Authorization: Bearer $token")"
  id="$(printf '%s' "$body" | jq -r 'if type=="array" then (.[0].id // empty) else empty end' 2>/dev/null || true)"
  if [ -z "$id" ] || [ "$id" = "null" ]; then
    echo "ERROR: user '$username' not found in realm '$REALM_NAME'. TideCloak said: $body" >&2
    exit 1
  fi
  printf '%s' "$id"
}

role_id() {
  local role="$1" token body id
  token="$(fresh_token)"
  body="$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/roles/$role" \
    -H "Authorization: Bearer $token")"
  id="$(printf '%s' "$body" | jq -r '.id // empty' 2>/dev/null || true)"
  if [ -z "$id" ] || [ "$id" = "null" ]; then
    echo "ERROR: realm role '$role' not found in realm '$REALM_NAME'. TideCloak said: $body" >&2
    exit 1
  fi
  printf '%s' "$id"
}

echo "==> Looking up demo ids in realm '$REALM_NAME' at $TIDECLOAK_URL (read-only)"
LONG_ID="$(user_id long)"
BANK_ROLE_ID="$(role_id heir-bank-mai)"
CARE_ROLE_ID="$(role_id heir-care-mai)"

mkdir -p "$OUT_DIR"
jq -n \
  --arg realm "$REALM_NAME" \
  --arg long "$LONG_ID" \
  --arg bank "$BANK_ROLE_ID" \
  --arg care "$CARE_ROLE_ID" \
  --arg url "$TIDECLOAK_URL" \
  '{realm:$realm, long:$long, "heir-bank-mai":$bank, "heir-care-mai":$care, authServerUrl:$url}' \
  > "$OUT_FILE.tmp"
mv "$OUT_FILE.tmp" "$OUT_FILE"

echo "==> Wrote $OUT_FILE"
cat "$OUT_FILE"
