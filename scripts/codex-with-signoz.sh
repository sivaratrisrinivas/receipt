#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${1:-}" == "--doctor" ]]; then
  shift
  REQUIRE_SIGNOZ_SERVER_AUTH=1 exec "${repo_root}/scripts/signoz-doctor.sh" "$@"
fi

command -v curl >/dev/null 2>&1 || {
  printf '%s\n' "curl is not installed or is not on PATH." >&2
  exit 1
}

command -v codex >/dev/null 2>&1 || {
  printf '%s\n' "Codex CLI is not installed or is not on PATH." >&2
  exit 1
}

status="$(
  curl \
    --output /dev/null \
    --silent \
    --write-out '%{http_code}' \
    --request POST \
    --header "Accept: application/json, text/event-stream" \
    --header "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"receipt-codex-launcher","version":"1"}}}' \
    "http://127.0.0.1:8001/mcp"
)"

if [[ "${status}" != "200" ]]; then
  printf '%s\n' \
    "SigNoz MCP is not ready for URL-only client access (HTTP ${status})." \
    "Create the read-only service-account key, set it in .env, then run ./scripts/signoz-up.sh." >&2
  exit 1
fi

cd "${repo_root}"
exec codex "$@"
