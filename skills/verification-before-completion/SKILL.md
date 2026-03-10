---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing. Requires running verification commands and confirming output before making any success claims. Evidence before assertions, always.
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

---

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this conversation, you cannot claim it passes.

---

## The Gate Function

Before claiming any status or expressing satisfaction:

```
1. IDENTIFY → What command proves this claim?
2. RUN      → Execute the FULL command (fresh, complete output)
3. READ     → Full output, check exit code, count failures
4. VERIFY   → Does output confirm the claim?
5. STATE    → Only then: make the claim WITH evidence
```

**Skip any step = lying, not verifying**

---

## Common Verification Requirements

| Claim | Required Evidence | NOT Sufficient |
|-------|-------------------|----------------|
| Tests pass | Test command output: 0 failures | "Should pass", previous run |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Type check passes | `tsc --noEmit`: 0 errors | "Looks typed correctly" |
| Bug fixed | Reproduce original bug: fails → fix → passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Requirements met | Line-by-line checklist complete | Tests passing alone |
| API works | Actual request/response verified | Code looks correct |

---

## Verification Commands by Project Type

### React/TypeScript Projects

```bash
# Type check
bun run typecheck    # or: npx tsc --noEmit

# Lint
bun run lint         # or: npx oxlint / npx eslint

# Tests
bun test             # or: npm test / vitest run

# Build
bun run build        # or: npm run build

# Full verification (run all)
bun run typecheck && bun run lint && bun test && bun run build
```

### Python Projects

```bash
# Type check
pyright app/         # or: mypy app/

# Lint
ruff check app/      # or: ruff check .

# Tests
pytest               # or: pytest app/tests/

# Full verification
ruff check app/ && pyright app/ && pytest
```

### Rust Projects

```bash
# Quick compile check (FAST - use for iteration)
cargo check

# Lint (clippy) - catches more issues than check
cargo clippy --all-targets --all-features -- -D warnings

# Tests
cargo test

# Release build (SLOW - only for final verification before shipping)
cargo build --release

# Quick verification during development
cargo check && cargo clippy

# Full verification before committing
cargo check && cargo clippy && cargo test
```

**IMPORTANT:** Default to `cargo check` or `cargo clippy` for verification during development.
- `cargo check` is 10-100x faster than `cargo build --release`
- Only use `cargo build --release` when you specifically need a release artifact
- The lint hook runs `cargo clippy` automatically - trust it or run `cargo check` to verify

### General Patterns

```bash
# Verify a specific file
npx tsc --noEmit src/utils.ts
ruff check app/api.py

# Verify a specific test
pytest tests/test_api.py::test_create_user -v
bun test src/utils.test.ts

# Verify git status
git status
git diff --stat

# Verify no regressions
git stash && git checkout main && npm test
git checkout - && git stash pop && npm test
```

---

## Red Flags - STOP

If you catch yourself doing any of these, STOP and verify:

| 🚩 Red Flag | What It Means |
|-------------|---------------|
| "Should work now" | You haven't verified |
| "Probably passes" | You haven't verified |
| "Seems to be working" | You haven't verified |
| "I'm confident this fixes it" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "I'm tired" | Exhaustion ≠ excuse |
| Trusting another agent's success report | Verify independently |
| Relying on partial verification | Partial proves nothing |
| About to commit without verification | STOP and run commands |
| Expressing satisfaction before verification | Premature celebration |

---

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification command |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ type checker ≠ tests |
| "Code looks correct" | Looks ≠ works |
| "Previous run passed" | Need fresh evidence |
| "Partial check is enough" | Partial proves nothing |
| "Different words, not claiming success" | Spirit over letter |
| "The fix is obvious" | Obvious ≠ verified |
| "I checked earlier" | Need current evidence |

---

## Key Patterns

### Tests

```
✅ Run: bun test
   Output: "Test Files  12 passed (12)"
   Claim: "All 12 test files pass"

❌ "Tests should pass now"
❌ "Looks like the fix should work"
❌ "I fixed the issue"
```

### Type Checking

```
✅ Run: npx tsc --noEmit
   Output: (exits with code 0, no errors)
   Claim: "Type check passes"

❌ "I added the types"
❌ "Should be type-safe now"
```

### Bug Fixes

```
✅ 1. Reproduce original bug → verify it fails
   2. Apply fix
   3. Verify same reproduction now passes
   Claim: "Bug fixed - verified with reproduction"

❌ "Fixed the bug" (without reproduction)
❌ "The issue was X, I changed it" (without verification)
```

### Regression Tests (TDD Red-Green)

```
✅ 1. Write test for bug → Run → See FAIL
   2. Apply fix → Run → See PASS
   3. Revert fix → Run → See FAIL (confirms test catches it)
   4. Restore fix → Run → See PASS
   Claim: "Regression test verified with red-green cycle"

❌ "I wrote a regression test" (without red-green verification)
```

### Requirements Completion

```
✅ 1. Re-read requirements/plan
   2. Create checklist of each requirement
   3. Verify each item against actual implementation
   4. Report: "✅ Items 1-5 complete, ❌ Item 6 needs X"

❌ "Phase complete"
❌ "All requirements met" (without checklist)
```

---

## Why This Matters

Consequences of claiming without verifying:

- **Trust broken** - "I don't believe you" after false claims
- **Broken code shipped** - Undefined functions, type errors, crashes
- **Incomplete features** - Missing requirements, edge cases
- **Wasted time** - False completion → redirect → rework cycle
- **Debugging complexity** - Multiple unverified changes compound issues

**Honesty is a core value. False claims erode trust.**

---

## When To Apply

### ALWAYS Before:

- Any variation of success/completion claims
- Any expression of satisfaction ("Done!", "Perfect!", "Great!")
- Any positive statement about work state
- Committing changes
- Creating pull requests
- Marking tasks complete
- Moving to next task
- Claiming a bug is fixed

### Rule Applies To:

- Exact phrases like "tests pass"
- Paraphrases like "all green"
- Synonyms like "complete", "finished", "done"
- Implications of success
- ANY communication suggesting completion/correctness

---

## Tips for GLM Models

When using ZAI's GLM-5 or GLM-4.7:

1. **Always run commands, never assume** - GLM models don't have persistent state
2. **Show the evidence** - Include command output in your response
3. **Be explicit about verification** - Say "Verified: [command] shows [result]"
4. **Don't summarize prematurely** - Wait for full output before claiming
5. **Check exit codes** - A command that "runs" may still fail

Example pattern:
```
# Run the verification
$ bun test

# Wait for output, then claim with evidence
"Verified: `bun test` completed with 15/15 tests passing (exit 0)"
```

---

## Quick Reference

| Before Claiming | Run This |
|-----------------|----------|
| "Tests pass" | `bun test` or `pytest` |
| "Type check passes" | `tsc --noEmit` or `pyright` |
| "Lint clean" | `bun run lint` or `ruff check` |
| "Build works" | `bun run build` or `cargo build` |
| "Bug fixed" | Reproduce original bug → verify fails → fix → verify passes |
| "Ready to commit" | All above + `git status` |
| "Requirements met" | Checklist verification against requirements |

---

## The Bottom Line

**No shortcuts for verification.**

1. Run the command
2. Read the output
3. THEN claim the result

**This is non-negotiable.**

---

## Checklist Before Claiming Completion

- [ ] Identified what command proves the claim?
- [ ] Ran the FULL verification command?
- [ ] Read the complete output?
- [ ] Verified exit code is 0?
- [ ] Counted failures (should be 0)?
- [ ] Stating claim WITH evidence?

**If any unchecked: You cannot claim completion yet.**
