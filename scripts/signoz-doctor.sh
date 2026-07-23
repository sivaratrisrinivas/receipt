#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
casting_file="${repo_root}/casting.yaml"
pours_dir="${repo_root}/pours"
compose_file="${pours_dir}/deployment/compose.yaml"
env_file="${repo_root}/.env"

if [[ -f "${env_file}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a
fi

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

pass() {
  printf 'PASS: %s\n' "$*"
}

command -v foundryctl >/dev/null 2>&1 || fail "foundryctl is not installed"
command -v docker >/dev/null 2>&1 || fail "Docker CLI is not installed"
command -v curl >/dev/null 2>&1 || fail "curl is not installed"

foundryctl version | grep -F "v0.2.16" >/dev/null ||
  fail "Foundry v0.2.16 is required by the committed lock"
pass "Foundry v0.2.16 is installed"

foundryctl gauge \
  --file "${casting_file}" \
  --pours "${pours_dir}" \
  --no-ledger \
  --no-updater \
  --format text >/dev/null
pass "Foundry environment gauge succeeds"

test -f "${compose_file}" ||
  fail "run 'foundryctl forge --file casting.yaml --pours pours --no-ledger --no-updater' first"

if grep -Eq 'image: [^[:space:]]+:latest([[:space:]]|$)' "${compose_file}"; then
  fail "generated Compose still contains a mutable latest image"
fi
pass "generated container images are immutable"

docker compose -f "${compose_file}" config --quiet
pass "generated Compose is valid"

curl --fail --silent --show-error "http://127.0.0.1:8080/api/v1/health" >/dev/null
pass "SigNoz API is healthy"

curl --fail --silent --show-error "http://127.0.0.1:8001/livez" >/dev/null
pass "SigNoz MCP liveness endpoint is healthy"

curl \
  --fail \
  --silent \
  --show-error \
  --retry 30 \
  --retry-all-errors \
  --retry-delay 1 \
  "http://127.0.0.1:8001/readyz" >/dev/null
pass "SigNoz MCP readiness endpoint is healthy"

unauthenticated_status="$(
  curl \
    --output /dev/null \
    --silent \
    --write-out '%{http_code}' \
    --request POST \
    --header "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"receipt-doctor","version":"1"}}}' \
    "http://127.0.0.1:8001/mcp"
)"

[[ "${unauthenticated_status}" == "401" ]] ||
  fail "unauthenticated MCP request returned HTTP ${unauthenticated_status}, expected 401"
pass "SigNoz MCP rejects unauthenticated requests"

if [[ -z "${SIGNOZ_API_KEY:-}" ]]; then
  if [[ "${REQUIRE_SIGNOZ_AUTH:-0}" == "1" ]]; then
    fail "SIGNOZ_API_KEY is required when REQUIRE_SIGNOZ_AUTH=1"
  fi

  printf '%s\n' "SKIP: set SIGNOZ_API_KEY to validate the investigation service account"
  exit 0
fi

curl \
  --fail \
  --silent \
  --show-error \
  --header "SIGNOZ-API-KEY: ${SIGNOZ_API_KEY}" \
  "http://127.0.0.1:8080/api/v1/service_accounts/me" >/dev/null
pass "SigNoz service-account key authenticates"

authenticated_status="$(
  curl \
    --output /dev/null \
    --silent \
    --write-out '%{http_code}' \
    --request POST \
    --header "Accept: application/json, text/event-stream" \
    --header "Content-Type: application/json" \
    --header "SIGNOZ-API-KEY: ${SIGNOZ_API_KEY}" \
    --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"receipt-doctor","version":"1"}}}' \
    "http://127.0.0.1:8001/mcp"
)"

[[ "${authenticated_status}" == "200" ]] ||
  fail "authenticated MCP initialize returned HTTP ${authenticated_status}, expected 200"
pass "SigNoz MCP accepts the client-provided service-account key"
