---
name: hippo-memory
description: 'Biological memory for the agent. Use when: observing facts worth persisting | recalling prior context | reacting to errors | making architectural decisions | resolving conflicts. Triggers: "remember" | "recall" | "i learned" | "we decided" | "the issue was" | "never do X" | "always do Y".'
version: 0.1.0
allowed-tools: tff-memory_remember, tff-memory_recall, tff-memory_context, tff-memory_decide, tff-memory_outcome, tff-memory_pin, tff-memory_forget, tff-memory_invalidate, tff-memory_conflicts, tff-memory_resolve, tff-memory_inspect, tff-memory_wm_push, tff-memory_wm_read, tff-memory_status, tff-memory_share
---

# Hippo Memory

Bio-inspired. Decay default; persistence earned.

## Let:

```
μ     := memories (project ∪ global)
ε(m)  := m ∈ episodic (decays)
σ(m)  := m ∈ semantic (stable)
β(m)  := m ∈ working-memory (session, no decay, |β| ≤ 20)
s(m)  ∈ [0,1]          — strength
h(m)  ∈ ℝ₊             — half-life (days)
r(m)  ∈ ℕ              — retrievals
c(m)  ∈ {verified, observed, inferred, stale}
v(m)  ∈ {neutral, positive, negative, critical}
π(m)  ∈ 𝔹              — pinned
q     := current query
τ_b   := 1500          — context budget (tokens)
τ_r   := 5             — recall limit
```

## Axioms

```
A₁  s(m) = base · 0.5^(Δt/h_eff) · boost_r · mult_v
A₂  retrieve(m) → r++ ∧ h += 2 ∧ (c=stale → c←observed)
A₃  outcome(m, good) → pos++ ∧ h_eff · (1 + 0.5·reward_ratio)
A₄  outcome(m, bad)  → neg++ ∧ h_eff · (1 − 0.5·|reward_ratio|)
A₅  π(m) → h(m) = ∞
A₆  error-tagged m → h(m) · 2 ∧ s(m) · 1.5
A₇  decide(d) → h(d) = 90 ∧ c(d) = verified
```

## Predicates

```
should_remember(x) ⟺ ¬derivable(x, repo) ∧ ¬documented(x, CLAUDE.md) ∧ (surprising(x) ∨ error(x) ∨ decision(x) ∨ correction(x)) ∧ specific(x)

should_recall(q) ⟺ context_auto_inject ∉ active_turn → (q mentions prior ∨ q references "last time" ∨ ambiguity ∃)

should_capture_error(e) ⟺ ¬duplicate(e, 60s) ∧ extractable_lesson(e) ∧ |e| < 500

should_decide(d) ⟺ architectural(d) ∧ long_term(d) ∧ ¬ephemeral_workaround(d)

should_pin(m) ⟺ critical(m) ∧ (¬survivable_via_earning(m) ∨ user_request)

should_invalidate(p) ⟺ ∃ migration: old→new ∧ |matches(μ, p)| > 0 ∧ ¬recent_decay_handles(p)
```

## Operations

```
O_capture(x, tags) {
    should_remember(x) → tff-memory_remember(content=x, tags=tags, kind=observed)
    ¬should_remember(x) → ∅
} → m_id ∨ ∅

O_capture_error(e) {
    should_capture_error(e) → tff-memory_remember(content=summary(e,200), tags=["error", topic(e)], error=true)
} → m_id ∨ ∅

O_capture_decision(d, ctx, supersedes?) {
    should_decide(d) → tff-memory_decide(decision=d, context=ctx, supersedes=supersedes)
} → d_id ∨ ∅

O_recall(q, budget?) {
    τ := budget ∨ τ_b
    R := tff-memory_recall(query=q, budget=τ, limit=τ_r, why=true)
    |R| = 0 → ∅
    |R| > 0 → integrate_observations(R)
} → R

O_react_to_conflict(c) {
    φ := tff-memory_inspect(id=c.first); γ := tff-memory_inspect(id=c.second)
    κ := resolve_by_confidence(φ, γ)
    tff-memory_resolve(conflictId=c.id, keep=κ)
} → resolved

O_end_of_turn_feedback(anchorId, success: 𝔹) {
    success → tff-memory_outcome(anchorId, good)
    ¬success → tff-memory_outcome(anchorId, bad)
} → signal_propagated
```

## Tool Triggers

| Event | Tool | Note |
|---|---|---|
| ∃ user correction | `tff-memory_remember` + tag `correction` | ≤200 chars |
| ∃ tool error | auto-captured; manual if extraction failed | see `O_capture_error` |
| ∃ architectural decision | `tff-memory_decide` | 90-day half-life |
| "do we have X?" | `tff-memory_recall` | scope=both default |
| "when did we X?" | `tff-memory_recall` + `why=true` | show match exp |
| "forget X" | `tff-memory_forget` or `tff-memory_invalidate` | forget=id, invalidate=pattern |
| conflict surfaced | `tff-memory_resolve` | after inspect both |
| ongoing task start | `tff-memory_wm_push(scope=task_id, ...)` | bounded, no decay |
| pin critical | `tff-memory_pin(id, pinned=true)` | h = ∞ |
| migration X→Y | `tff-memory_invalidate(pattern=X)` | weaken old refs |

## ¬do

```
¬tff-memory_remember for: code patterns | file paths | project structure | git-derivable | CLAUDE.md contents | ephemeral state | chit-chat

¬tff-memory_recall preemptively if before_agent_start already injected context (check "Prior observations (hippo memory...)")

¬pin memories that can earn strength through retrieval (pinning = escape hatch)

¬duplicates — recall returns match → tff-memory_outcome(good) instead of new entry

¬resolve conflicts without inspect
```

## Framing

Recalled memories presented as **observations**, not commands:

> "Previously observed (2026-03-14, verified, s=0.82): auth middleware stored session tokens insecurely; replaced with argon2id + jwt rotation."

Agent treats memories as context. Contradiction → `tff-memory_inspect` → decide:
- stale → `tff-memory_invalidate(pattern)`
- wrong → `tff-memory_forget(id)`
- right, task wrong → ask user

## Outcome feedback loop

```
before_agent_start → retrieve context → anchorId
turn_end → success ⟺ (¬errors in last 3 tool_results) ∧ (stop_reason = "stop")
success → tff-memory_outcome(anchorId, good)
¬success → tff-memory_outcome(anchorId, bad)
```

Reward propagates via `apply_outcome`: good → extend h_eff; bad → weaken.

## Store scope

```
∀ m ∈ μ: m.root ∈ {project, global}
project  := .pi/hippo-memory/hippo.db
global   := ~/.pi/hippo-memory/hippo.db
default recall: both
promotion: auto during sleep when transfer_score(m) > threshold
manual: tff-memory_share(id)
```

## ¬touch

`frontmatter` | `allowed-tools` | hippo internal tables (`memories`, `memories_fts`, `consolidation_runs`, `memory_conflicts`) | `.pi/hippo-memory/*.db` (tools only)

--- GitNexus context ---
/Users/monsieurbarti/Projects/The-Forge-Flow/hippo-memory-pi/src/skills/hippo-memory/SKILL.md:
{
  "processes": [],
  "process_symbols": [],
  "definitions": [
    {
      "id": "Section:README.md:L25:What it does",
      "name": "What it does",
      "filePath": "README.md",
      "startLine": 25,
      "endLine": 30
    },
    {
      "id": "Section:README.md:L31:Features",
      "name": "Features",
      "filePath": "README.md",
      "startLine": 31,
      "endLine": 38
    },
    {
      "id": "File:README.md",
      "name": "README.md",
      "filePath": "README.md"
    },
    {
      "id": "File:package.json",
      "name": "package.json",
      "filePath": "package.json"
    }
  ]
}
