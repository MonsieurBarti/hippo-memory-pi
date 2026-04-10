<div align="center">
  <img src="https://raw.githubusercontent.com/MonsieurBarti/The-Forge-Flow-CC/refs/heads/main/assets/forge-banner.png" alt="The Forge Flow - Hippo Memory Extension" width="100%">

  <h1>Hippo Memory Extension</h1>

  <p>
    <strong>Biologically-inspired long-term memory for PI, powered by <a href="https://github.com/kitfunso/hippo-memory">hippo-memory</a></strong>
  </p>

  <p>
    <a href="https://github.com/MonsieurBarti/hippo-memory-pi/actions/workflows/ci.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/MonsieurBarti/hippo-memory-pi/ci.yml?label=CI&style=flat-square" alt="CI Status">
    </a>
    <a href="https://www.npmjs.com/package/@the-forge-flow/hippo-memory-pi">
      <img src="https://img.shields.io/npm/v/@the-forge-flow/hippo-memory-pi?style=flat-square" alt="npm version">
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/github/license/MonsieurBarti/hippo-memory-pi?style=flat-square" alt="License">
    </a>
  </p>
</div>

---

## Features

- **Bio-inspired** — decay by default, retrieval strengthens, sleep consolidation
- **Auto-inject** — relevant memories surface in the system prompt on every turn
- **Auto-capture** — errors become error-tagged memories automatically
- **Dual store** — project-local + global, with promotion during sleep
- **Hybrid search** — BM25 + embeddings (`@huggingface/transformers`)
- **PI-native** — lifecycle hooks, 17 `tff-memory_*` tools, 6 slash commands, bundled skill

## Requirements

- Node.js >= 22.5.0 (required by `hippo-memory`'s built-in `node:sqlite`)
- PI (`pi` CLI) installed

## Installation

```bash
# Global (all projects)
pi install npm:@the-forge-flow/hippo-memory-pi

# Project-local
pi install -l npm:@the-forge-flow/hippo-memory-pi

# From GitHub (tracks main)
pi install git:github.com/MonsieurBarti/hippo-memory-pi

# Pin a version
pi install npm:@the-forge-flow/hippo-memory-pi@0.1.0
```

> Add `.pi/` to your `.gitignore`. The extension stores the project-scoped SQLite database at `.pi/hippo-memory/hippo.db` and it should not be committed.

Then reload PI with `/reload` (or restart it).

## How it works

After installation, hippo-memory-pi runs invisibly:

1. **On session start**, it opens two SQLite stores — project-local at `.pi/hippo-memory/hippo.db` and global at `~/.pi/hippo-memory/hippo.db`.
2. **Before every agent turn**, it runs a hybrid search against your prompt and injects any matching memories into the system prompt under `## Prior observations`.
3. **On every tool result**, if an error is detected, it stores an error-tagged memory automatically.
4. **On agent end**, it applies a reward signal (good/bad) to the memories that were recalled for that turn.
5. **On session shutdown**, if at least 5 new memories accumulated, it runs hippo's consolidation pipeline: decay, merge overlapping episodics into semantic patterns, detect conflicts, auto-share high-transfer memories to global.

## Tools

17 tools, all prefixed `tff-memory_`:

| Tool | Purpose |
|---|---|
| `tff-memory_remember` | Store an observation |
| `tff-memory_recall` | Search memory |
| `tff-memory_context` | Auto-recall, formatted for LLM |
| `tff-memory_decide` | Record an architectural decision (90-day half-life) |
| `tff-memory_outcome` | Apply good/bad reward signal |
| `tff-memory_pin` | Pin (infinite half-life) or unpin |
| `tff-memory_forget` | Hard delete |
| `tff-memory_invalidate` | Weaken memories matching a pattern |
| `tff-memory_conflicts` | List detected memory conflicts |
| `tff-memory_resolve` | Resolve a conflict |
| `tff-memory_inspect` | Full details of one entry |
| `tff-memory_sleep` | Run consolidation |
| `tff-memory_status` | Store statistics |
| `tff-memory_wm_push` | Push to bounded working memory |
| `tff-memory_wm_read` | Read working memory |
| `tff-memory_share` | Promote to global store |
| `tff-memory_learn_git` | Scan git for lesson candidates |

## Slash commands

- `/memory-status` — dashboard
- `/memory-sleep [--dry-run]` — run consolidation
- `/memory-conflicts` — list detected conflicts
- `/memory-recall "<query>"` — user-triggered search
- `/memory-inspect <id>` — detail view
- `/toggle-hippo-memory` — disable auto-inject for this session

## Configuration

Configuration is resolved in order: env vars > `hippo-memory.config.json` at repo root > defaults.

| Env var | Default | Purpose |
|---|---|---|
| `HIPPO_MEMORY_AUTO_INJECT` | `true` | Auto-inject context on every turn |
| `HIPPO_MEMORY_AUTO_CAPTURE` | `true` | Auto-capture errors from tool results |
| `HIPPO_MEMORY_AUTO_OUTCOME` | `true` | Apply outcome feedback on agent end |
| `HIPPO_MEMORY_AUTO_SLEEP` | `true` | Run consolidation on session shutdown |
| `HIPPO_MEMORY_AUTO_LEARN_GIT` | `true` | Scan git history on first session |
| `HIPPO_MEMORY_AUTO_SHARE` | `true` | Promote to global during sleep |
| `HIPPO_MEMORY_RECALL_BUDGET` | `1500` | Token budget for auto-inject |
| `HIPPO_MEMORY_RECALL_LIMIT` | `5` | Max memories per recall |
| `HIPPO_MEMORY_SLEEP_THRESHOLD` | `5` | Min new memories to trigger auto-sleep |
| `HIPPO_MEMORY_SEARCH_MODE` | `hybrid` | `bm25` or `hybrid` |
| `HIPPO_MEMORY_FRAMING` | `observe` | `observe`, `suggest`, or `assert` |
| `HIPPO_PROJECT_ROOT` | `.pi/hippo-memory` | Override project store location |
| `HIPPO_GLOBAL_ROOT` | `~/.pi/hippo-memory` | Override global store location |
| `HIPPO_HOME` | — | Alt name for global root override |

## Privacy note

Auto-inject sends recalled text from past sessions into your system prompt on every turn. Run `/toggle-hippo-memory` to disable per-session, or set `HIPPO_MEMORY_AUTO_INJECT=false` to disable globally.

## Development

```bash
bun install
bun run test        # vitest
bun run lint        # biome check
bun run typecheck   # tsc --noEmit
bun run build       # tsc + copy skill to dist/
```

## Project structure

```
src/
├── index.ts                  # Extension entry point & PI wire-up
├── hippo-memory-service.ts   # Facade over hippo-memory SDK
├── memory-service.ts         # MemoryService interface
├── config.ts                 # Configuration loading
├── paths.ts                  # Project/global root resolution
├── types.ts                  # Domain types
├── mutex.ts                  # Write serialization
├── context-injector.ts       # Format recall for system prompt
├── error-capture.ts          # Detect + debounce errors from tool results
├── success-detector.ts       # Classify agent_end as good/bad/ambiguous
├── session-state.ts          # Anchor ids + tool result ring buffer
├── hooks/                    # 5 lifecycle hooks
├── tools/                    # 17 tff-memory_* tools + types + index
├── commands/                 # 6 slash commands + types + index
└── skill/
    └── HIPPO_MEMORY.md       # PI skill (Roxabi compress notation)
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit with conventional commits (`git commit -m "feat: add something"`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT
