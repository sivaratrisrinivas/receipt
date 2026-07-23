#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${repo_root}/.env"

if [[ ! -f "${env_file}" ]]; then
  printf '%s\n' \
    "Missing ${env_file}." \
    "Copy .env.example to .env and set SIGNOZ_API_KEY to a read-only SigNoz service-account key." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

if [[ -z "${SIGNOZ_API_KEY:-}" ]]; then
  printf 'SIGNOZ_API_KEY is empty in %s\n' "${env_file}" >&2
  exit 1
fi

if [[ "${1:-}" == "--doctor" ]]; then
  shift
  REQUIRE_SIGNOZ_AUTH=1 exec "${repo_root}/scripts/signoz-doctor.sh" "$@"
}

command -v codex >/dev/null 2>&1 || {
  printf '%s\n' "Codex CLI is not installed or is not on PATH." >&2
  exit 1
}

cd "${repo_root}"
exec codex "$@"
