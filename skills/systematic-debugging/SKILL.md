---
name: systematic-debugging
description: "Use when encountering any bug, test failure, or unexpected behavior. Provides a structured 4-phase approach: root cause investigation, pattern analysis, hypothesis testing, and implementation. NEVER propose fixes without completing Phase 1."
---

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

---

## When to Use

Use for ANY technical issue:
- Test failures
- Bugs in production
- Unexpected behavior
- Performance problems
- Build failures
- Integration issues
- Type errors
- Lint warnings that shouldn't exist

**Use this ESPECIALLY when:**
- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes
- Previous fix didn't work
- You don't fully understand the issue

**Don't skip when:**
- Issue seems simple (simple bugs have root causes too)
- You're in a hurry (systematic is faster than thrashing)
- Manager wants it fixed NOW (systematic is faster)

---

## The Four Phases

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

#### 1. Read Error Messages Carefully
- Don't skip past errors or warnings
- They often contain the exact solution
- Read stack traces completely
- Note line numbers, file paths, error codes
- Check for "Caused by:" chains in exceptions

```
❌ Bad: "There's an error, let me try changing X"
✅ Good: Read the full error, note it's a TypeError at line 47 in utils.ts
```

#### 2. Reproduce Consistently
- Can you trigger it reliably?
- What are the exact steps?
- Does it happen every time?
- If not reproducible → gather more data, don't guess

```
❌ Bad: "It failed once, let me fix it"
✅ Good: "I can reproduce by running X with parameters Y and Z"
```

#### 3. Check Recent Changes
- What changed that could cause this?
- `git diff`, `git log --oneline -20`
- New dependencies, config changes
- Environmental differences

```bash
# Quick check for recent changes
git log --oneline -10 -- <affected-file>
git diff HEAD~5..HEAD -- <affected-area>
```

#### 4. Gather Evidence in Multi-Component Systems

**WHEN system has multiple components (CI → build → deploy, API → service → database, frontend → backend):**

**BEFORE proposing fixes, add diagnostic instrumentation:**

```bash
# For EACH component boundary:
# - Log what data enters component
# - Log what data exits component
# - Verify environment/config propagation
# - Check state at each layer

# Run once to gather evidence showing WHERE it breaks
# THEN analyze evidence to identify failing component
# THEN investigate that specific component
```

**Example (multi-layer debugging):**
```bash
# Layer 1: Check environment
echo "=== Environment variables: ==="
env | grep -E "API_|DATABASE_" || echo "Not set"

# Layer 2: Check network connectivity
echo "=== Network test: ==="
curl -v https://api.example.com/health 2>&1 | head -20

# Layer 3: Check database connection
echo "=== Database state: ==="
psql -c "SELECT 1" 2>&1

# Layer 4: Check application logs
echo "=== Recent errors: ==="
tail -50 /var/log/app/error.log
```

#### 5. Trace Data Flow

**WHEN error is deep in call stack:**

- Where does bad value originate?
- What called this with bad value?
- Keep tracing up until you find the source
- Fix at source, not at symptom

```typescript
// Add stack traces to trace the call chain
function problematicFunction(value: unknown) {
  if (isInvalid(value)) {
    console.error('DEBUG invalid value:', {
      value,
      stack: new Error().stack,
    });
  }
  // ... rest of function
}
```

---

### Phase 2: Pattern Analysis

**Find the pattern before fixing:**

#### 1. Find Working Examples
- Locate similar working code in same codebase
- What works that's similar to what's broken?

#### 2. Compare Against References
- If implementing a pattern, read reference implementation COMPLETELY
- Don't skim - read every line
- Understand the pattern fully before applying

#### 3. Identify Differences
- What's different between working and broken?
- List every difference, however small
- Don't assume "that can't matter"

#### 4. Understand Dependencies
- What other components does this need?
- What settings, config, environment?
- What assumptions does it make?

---

### Phase 3: Hypothesis and Testing

**Scientific method:**

#### 1. Form Single Hypothesis
- State clearly: "I think X is the root cause because Y"
- Write it down
- Be specific, not vague

```
❌ Bad: "Maybe it's a timing issue"
✅ Good: "The API returns before the database write completes, causing the read to get stale data"
```

#### 2. Test Minimally
- Make the SMALLEST possible change to test hypothesis
- One variable at a time
- Don't fix multiple things at once

#### 3. Verify Before Continuing
- Did it work? Yes → Phase 4
- Didn't work? Form NEW hypothesis
- DON'T add more fixes on top

#### 4. When You Don't Know
- Say "I don't understand X"
- Don't pretend to know
- Ask for help
- Research more

---

### Phase 4: Implementation

**Fix the root cause, not the symptom:**

#### 1. Create Failing Test Case
- Simplest possible reproduction
- Automated test if possible
- One-off test script if no framework
- MUST have before fixing

```typescript
// Example failing test
test('should handle empty projectDir', () => {
  expect(() => createProject('name', '')).toThrow('workingDirectory cannot be empty');
});
```

#### 2. Implement Single Fix
- Address the root cause identified
- ONE change at a time
- No "while I'm here" improvements
- No bundled refactoring

#### 3. Verify Fix
- Test passes now?
- No other tests broken?
- Issue actually resolved?

#### 4. If Fix Doesn't Work
- STOP
- Count: How many fixes have you tried?
- If < 3: Return to Phase 1, re-analyze with new information
- **If ≥ 3: STOP and question the architecture (step 5 below)**
- DON'T attempt Fix #4 without architectural discussion

#### 5. If 3+ Fixes Failed: Question Architecture

**Pattern indicating architectural problem:**
- Each fix reveals new shared state/coupling/problem in different place
- Fixes require "massive refactoring" to implement
- Each fix creates new symptoms elsewhere

**STOP and question fundamentals:**
- Is this pattern fundamentally sound?
- Are we "sticking with it through sheer inertia"?
- Should we refactor architecture vs. continue fixing symptoms?

**Discuss with your human partner before attempting more fixes**

This is NOT a failed hypothesis - this is a wrong architecture.

---

## Red Flags - STOP and Follow Process

If you catch yourself thinking:

| Red Flag | Meaning |
|----------|---------|
| "Quick fix for now, investigate later" | Return to Phase 1 |
| "Just try changing X and see if it works" | Return to Phase 1 |
| "Add multiple changes, run tests" | Return to Phase 1 |
| "Skip the test, I'll manually verify" | Return to Phase 1 |
| "It's probably X, let me fix that" | Return to Phase 1 |
| "I don't fully understand but this might work" | Return to Phase 1 |
| "Pattern says X but I'll adapt it differently" | Return to Phase 2 |
| "Here are the main problems: [lists fixes without investigation]" | Return to Phase 1 |
| Proposing solutions before tracing data flow | Return to Phase 1 |
| "One more fix attempt" (when already tried 2+) | Question architecture |
| Each fix reveals new problem in different place | Question architecture |

**ALL of these mean: STOP. Return to Phase 1.**

---

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too. Process is fast for simple bugs. |
| "Emergency, no time for process" | Systematic debugging is FASTER than guess-and-check thrashing. |
| "Just try this first, then investigate" | First fix sets the pattern. Do it right from the start. |
| "I'll write test after confirming fix works" | Untested fixes don't stick. Test first proves it. |
| "Multiple fixes at once saves time" | Can't isolate what worked. Causes new bugs. |
| "Reference too long, I'll adapt the pattern" | Partial understanding guarantees bugs. Read it completely. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. |
| "One more fix attempt" (after 2+ failures) | 3+ failures = architectural problem. Question pattern, don't fix again. |

---

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| **1. Root Cause** | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify | Bug resolved, tests pass |

---

## Defense-in-Depth

When you fix a bug, add validation at EVERY layer data passes through:

### Layer 1: Entry Point Validation
```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory cannot be empty');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory does not exist: ${workingDirectory}`);
  }
  // ... proceed
}
```

### Layer 2: Business Logic Validation
```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir required for workspace initialization');
  }
  // ... proceed
}
```

### Layer 3: Environment Guards
```typescript
async function gitInit(directory: string) {
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));
    if (!normalized.startsWith(tmpDir)) {
      throw new Error(`Refusing git init outside temp dir during tests`);
    }
  }
  // ... proceed
}
```

### Layer 4: Debug Instrumentation
```typescript
async function gitInit(directory: string) {
  console.error('DEBUG git init:', {
    directory,
    cwd: process.cwd(),
    stack: new Error().stack,
  });
  // ... proceed
}
```

**Key insight:** All four layers are necessary. Different code paths bypass different layers.

---

## Condition-Based Waiting

Replace arbitrary timeouts with condition polling:

```typescript
// ❌ BEFORE: Guessing at timing
await new Promise(r => setTimeout(r, 50));
const result = getResult();
expect(result).toBeDefined();

// ✅ AFTER: Waiting for condition
await waitFor(() => getResult() !== undefined, 'result to be defined');
const result = getResult();
expect(result).toBeDefined();
```

### Generic waitFor Implementation
```typescript
async function waitFor<T>(
  condition: () => T | undefined | null | false,
  description: string,
  timeoutMs = 5000
): Promise<T> {
  const startTime = Date.now();

  while (true) {
    const result = condition();
    if (result) return result;

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for ${description} after ${timeoutMs}ms`);
    }

    await new Promise(r => setTimeout(r, 10)); // Poll every 10ms
  }
}
```

### Common Patterns

| Scenario | Pattern |
|----------|---------|
| Wait for event | `waitFor(() => events.find(e => e.type === 'DONE'), 'DONE event')` |
| Wait for state | `waitFor(() => machine.state === 'ready', 'ready state')` |
| Wait for count | `waitFor(() => items.length >= 5, '5 items')` |
| Wait for file | `waitFor(() => fs.existsSync(path), 'file to exist')` |

---

## Real-World Impact

From debugging sessions:
- Systematic approach: 15-30 minutes to fix
- Random fixes approach: 2-3 hours of thrashing
- First-time fix rate: 95% vs 40%
- New bugs introduced: Near zero vs common

---

## Checklist

Before proposing any fix:

- [ ] Have I read the complete error message?
- [ ] Can I reproduce the issue reliably?
- [ ] Have I traced the data flow to the source?
- [ ] Have I found working examples to compare?
- [ ] Have I stated my hypothesis clearly?
- [ ] Am I making the smallest possible change?
- [ ] Do I have a failing test case?
- [ ] If 3+ fixes failed, have I questioned the architecture?

**Remember:** A fix is only as good as the investigation behind it.
