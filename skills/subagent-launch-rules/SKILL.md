---
name: subagent-launch-rules
description: |
  MANDATORY pre-launch rules for the pi `subagent` tool. Read BEFORE writing
  any workflowScript or calling runs.run / runs.all / runs.host, and before
  naming any child agent. Prevents the common launch failures: "runs.run has
  an invalid key", "Agent 'X' not found", forbidden-param and nested-async
  rejections. Do NOT skip; these are host-enforced regex checks, not
  conventions.
---

# Subagent launch rules (host-enforced)

## 1. Agent names come from the registry, never from memory

Before any launch, call `subagent` with `{ action: "list", capabilities: true }`.
Use ONLY names that appear in that output.

- Never invent names like `coder`, `implementer`, `worker-1`, `dev-a`. Typical
  builtins: `advisor`, `delegate`, `oracle`, `researcher`, `reviewer`,
  `scout`, `worker`, plus external CLI agents (`codex-exec`,
  `codex-exec-writer`, `claude-code`, `claude-code-writer`, `cursor-agent`,
  `cursor-agent-writer`) — but the list output is authoritative, not this file.
- For external CLI rows, also require `runner.available === true`; a missing or
  false runner means the agent cannot launch.
- If unsure a name exists, run `{ action: "list" }` again; it is cheap.

## 2. Run keys: ASCII only, alphanumeric first char

Host regex: `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`

- 1–128 chars; first char must be a letter or digit; then only `A-Za-z0-9 . _ -`
  (dot, underscore, ASCII hyphen). No spaces.
- **ASCII hyphen `-` IS allowed.** En-dash `–` (U+2013), em-dash `—` (U+2014),
  and other unicode lookalikes are NOT. Models frequently emit unicode dashes
  in keys and prose — this is the top cause of "has an invalid key".
- Keep keys short and boring: `p1`, `p2`, `review`, `build`. Nothing derived
  from prose.
- Keys must be unique per workflow. Reusing a key with different params throws
  "Duplicate workflow key ... used with incompatible launch params". A
  `runs.host` key must never be reused for `runs.run`/`runs.all`.
- Same pattern applies to `runs.steer` keys, `runs.lanes` stage keys, and
  workflow `preflight.lanes[].key`.

## 3. runs.run / runs.all call shape

`runs.run(key, { agent, task })` and `runs.all([{ key, agent, task }, ...])`
accept ONE child plus execution controls only (e.g. `output`, `worktree`,
`model`, `skill`, `lane`, `timeoutMs`, `toolBudget`, `context`,
`extensionBindings`, `baseRef`).

Forbidden as params (instant rejection): `action`, `workflowScript`, `tasks`,
`chain`, `parallel`, `concurrency`, `chainDir`, `globalConcurrencyLimit`,
`maxSubagentSpawnsPerRun`, `clarify`. Orchestrate with JavaScript control flow
(`if`, loops, `runs.all`), not magic params.

- `gate` and `acceptance` are mutually exclusive — one or neither.
- `baseRef`: only `HEAD` or a named ref such as `refs/heads/main`. Full
  40/64-char commit SHAs and expressions like `HEAD~1` are rejected.
- Reviewer / read-only children: omit `acceptance` and `gate` entirely.

## 4. workflowScript syntax

- No nested `async function`, arrow functions, or method shorthand — anywhere.
- Use top-level `await`, plain named `function` helpers that return
  `runs.run(...)` / `Promise` chains, or `runs.lanes(...)`.
- No filesystem, shell, `process`, or Pi tools inside the script; host
  interaction goes through `runs.host` only.

## 5. runs.host shape

Allowed fields only: `kind: "command"`, `command`, `timeoutMs`, `output`,
`role`, `provider`. There is NO `cwd` field — `cd /path && cmd` inside the
command string instead. Max 32 `runs.host` calls per workflow.

## 6. Pre-flight and failure discipline

- Dry-run first: `subagent { action: "validate", workflowScript: "..." }`
  checks the script without launching children. Cheap insurance before any
  multi-child dispatch.
- When a launch fails, READ the error text verbatim. It names the violated
  rule and, for unknown agents, lists the available names. Fix exactly that.
  Do not invent causes (e.g. "host rejects hyphenated keys" is false) and do
  not speculatively rename keys or agents.
