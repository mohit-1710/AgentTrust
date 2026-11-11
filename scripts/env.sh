# Source this file from the repository root: . scripts/env.sh
# Prefer ignored project-local tools; otherwise use already installed pinned tools.
if [ ! -f "$PWD/rust-toolchain.toml" ] || [ ! -f "$PWD/pnpm-workspace.yaml" ]; then
  printf '%s\n' 'Run . scripts/env.sh from the AgentTrust repository root.' >&2
  return 1
fi
export AGENTTRUST_ROOT="$PWD"
export PATH="$AGENTTRUST_ROOT/.agenttrust/tools/node/bin:$AGENTTRUST_ROOT/.agenttrust/tools/bin:$PATH"
