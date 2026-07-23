#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${repo_root}/.env"

if [[ -f "${env_file}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a
fi

command -v foundryctl >/dev/null 2>&1 || {
  printf '%s\n' "foundryctl is not installed or is not on PATH." >&2
  exit 1
}

cd "${repo_root}"
exec foundryctl cast \
  --file casting.yaml \
  --pours pours \
  --no-ledger \
  --no-updater
