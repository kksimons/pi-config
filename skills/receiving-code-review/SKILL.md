---
name: receiving-code-review
description: Use when receiving code review feedback, before implementing suggestions. Ensures technical rigor and verification rather than performative agreement or blind implementation. Especially important when feedback seems unclear or technically questionable.
---

# Receiving Code Review Feedback

## Overview

Code review requires technical evaluation, not emotional performance.

**Core principle:** Verify before implementing. Ask before assuming. Technical correctness over social comfort.

---

## The Response Pattern

When receiving code review feedback:

```
1. READ      → Complete all feedback without reacting
2. UNDERSTAND → Restate requirement in own words (or ask for clarification)
3. VERIFY    → Check against codebase reality
4. EVALUATE  → Is it technically sound for THIS codebase?
5. RESPOND   → Technical acknowledgment or reasoned pushback
6. IMPLEMENT → One item at a time, test each
```

---

## Forbidden Responses

### Never Say These

| ❌ Forbidden | Why |
|-------------|-----|
| "You're absolutely right!" | Performative agreement |
| "Great point!" | Empty flattery |
| "Excellent feedback!" | Social noise |
| "Let me implement that now" | Before verification |
| "Thanks for catching that!" | Gratitude is noise |
| "Thanks for [anything]" | Actions > words |

### Instead, Do These

| ✅ Correct | Context |
|-----------|---------|
| Restate the technical requirement | Shows understanding |
| Ask clarifying questions | Avoids wrong implementation |
| Push back with technical reasoning | When feedback is wrong |
| Just start working | Actions speak louder |
| "Fixed. [Brief description]" | After implementing |

---

## Handling Unclear Feedback

**IF any item is unclear:**
```
STOP - do not implement anything yet
ASK for clarification on unclear items
```

**Why:** Items may be related. Partial understanding = wrong implementation.

### Example

```
Reviewer: "Fix items 1-6"
You understand 1, 2, 3, 6. Unclear on 4, 5.

❌ WRONG: Implement 1, 2, 3, 6 now, ask about 4, 5 later
✅ RIGHT: "I understand items 1, 2, 3, 6. Need clarification on 4 and 5 before proceeding."
```

---

## Source-Specific Handling

### From Trusted Sources (Your Team)

- **Implement after understanding** - no need for extensive verification
- **Still ask** if scope is unclear
- **No performative agreement** - just fix it
- **Skip to action** or brief technical acknowledgment

### From External Reviewers (GitHub PRs, etc.)

**BEFORE implementing, verify:**

| Check | Question |
|-------|----------|
| Technical correctness | Is this correct for THIS codebase/stack? |
| Breaking changes | Does this break existing functionality? |
| Current implementation | Why was it implemented this way originally? |
| Platform compatibility | Works on all platforms/versions needed? |
| Context | Does reviewer understand the full context? |

**IF suggestion seems wrong:**
- Push back with technical reasoning
- Show code/tests that prove current approach works
- Ask clarifying questions

**IF you can't easily verify:**
```
"I can't verify this without [X]. Should I [investigate / ask / proceed]?"
```

**IF it conflicts with prior architectural decisions:**
- Stop and discuss with your human partner first
- Don't implement without resolution

---

## YAGNI Check for "Professional" Features

When reviewer suggests "implementing properly" or adding "best practice" features:

```bash
# Check for actual usage
grep -r "featureName" src/
rg "endpoint" app/
```

**IF unused:**
```
"This endpoint isn't called anywhere. Remove it (YAGNI)?"
```

**IF used:**
```
Then implement properly - there's actual usage.
```

**Principle:** Don't add features nobody uses, even if they're "professional."

---

## Implementation Order

For multi-item feedback:

```
1. CLARIFY anything unclear FIRST
2. IMPLEMENT in priority order:
   - 🔴 Blocking issues (breaks functionality, security)
   - 🟡 Simple fixes (typos, imports, minor cleanup)
   - 🟢 Complex fixes (refactoring, logic changes)
3. TEST each fix individually
4. VERIFY no regressions
```

---

## When To Push Back

### Push Back When:

| Situation | Why |
|-----------|-----|
| Breaks existing functionality | Current code works, suggestion doesn't |
| Reviewer lacks full context | They don't see the full picture |
| Violates YAGNI | Unused feature being added |
| Technically incorrect for this stack | Wrong pattern for the language/framework |
| Legacy/compatibility reasons exist | Historical constraints matter |
| Conflicts with architectural decisions | Prior decisions have reasons |

### How To Push Back

| ✅ Do | ❌ Don't |
|-------|---------|
| Use technical reasoning | Be defensive |
| Ask specific questions | Make excuses |
| Reference working tests/code | Appeal to authority |
| Show the actual problem | Be vague |
| Involve your human partner if architectural | Silently ignore feedback |

### Example Pushbacks

**Breaking change:**
```
"This would break the existing API contract. Three consumers depend on the current behavior:
- mobile-app/src/api.ts:45
- web-client/src/services/api.ts:23
- cli/src/commands/push.ts:12

Should I version the API instead?"
```

**Missing context:**
```
"The reviewer may not have context on why this exists. This legacy code supports
PostgreSQL 12 compatibility - we have 15% of users on that version. Dropping it
would break their deployments. Should we document this instead of removing?"
```

**YAGNI:**
```
"Grepped codebase - nothing calls this endpoint. Remove it (YAGNI)?
Or is there usage I'm missing?"
```

---

## Acknowledging Correct Feedback

When feedback IS correct:

| ✅ Good Responses |
|-------------------|
| "Fixed. Updated the type annotation in `src/utils.ts:23`." |
| "Good catch - the edge case wasn't handled. Added check in `validate()`. All tests pass." |
| [Just fix it and show the diff] |

| ❌ Bad Responses |
|------------------|
| "You're absolutely right!" |
| "Great point!" |
| "Thanks for catching that!" |
| "Thanks for [anything]" |
| Any gratitude expression |

**Why no thanks:** Actions speak. Just fix it. The code itself shows you heard the feedback.

**If you catch yourself about to write "Thanks":** DELETE IT. State the fix instead.

---

## Correcting Your Pushback

If you pushed back and were wrong:

| ✅ Good | ❌ Bad |
|---------|--------|
| "You were right - checked `api.ts` and it does call this. Implementing now." | Long apology |
| "Verified and you're correct. My understanding was incomplete. Fixing." | Defending why you pushed back |
| "I was wrong about [X]. The actual behavior is [Y]. Implementing the fix." | Over-explaining |

**Just state the correction factually and move on.**

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Performative agreement | State requirement or just act |
| Blind implementation | Verify against codebase first |
| Batch without testing | One at a time, test each |
| Assuming reviewer is right | Check if it breaks things |
| Avoiding pushback | Technical correctness > comfort |
| Partial implementation | Clarify all items first |
| Can't verify, proceed anyway | State limitation, ask for direction |
| Long explanations | Be concise, show code |

---

## Real Examples

### Example 1: Performative vs Technical

**Reviewer:** "Remove this legacy code"

❌ **Performative:**
```
"You're absolutely right! Let me remove that legacy code now..."
```

✅ **Technical:**
```
"Checking usage... build target is 10.15+, this API needs 13+.
Legacy code exists for backward compatibility.

Current implementation has wrong bundle ID on line 45.
Should I fix the bundle ID or drop pre-13 support?"
```

### Example 2: YAGNI Check

**Reviewer:** "Implement proper metrics tracking with database, date filters, CSV export"

✅ **Technical:**
```
"Grepped codebase - nothing calls this endpoint:

  $ rg "metrics/track" src/
  (no results)

Remove it (YAGNI)? Or is there usage I'm missing in another repo?"
```

### Example 3: Unclear Items

**Reviewer:** "Fix items 1-6"

✅ **Technical:**
```
"Understand items 1, 2, 3, 6. Need clarification on:

- Item 4: Which validation approach? Schema or runtime?
- Item 5: Should this affect the API response or just logging?

Clarifying these first to avoid wrong implementation."
```

### Example 4: Pushback with Evidence

**Reviewer:** "This function should be async"

✅ **Technical:**
```
"This function is called 50,000+ times/day in hot paths (see APM metrics).
Making it async would add ~50ms overhead per call = 42 minutes/day added latency.

Current sync implementation:
- 2ms average execution time
- No I/O operations
- Pure computation

Recommend keeping sync. If async is needed, should we batch calls instead?"
```

### Example 5: Correcting Pushback

**After pushing back and being proven wrong:**

✅ **Technical:**
```
"You were right. I checked the full call chain:

  handler.ts:23 → middleware.ts:45 → this function

The middleware does add async context I missed. Converting to async now."
```

---

## GitHub Thread Replies

When replying to inline review comments on GitHub:

```
# Reply in the comment thread, not as top-level PR comment
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies

# This keeps discussion contextual
```

---

## Quick Reference

| Situation | Action |
|-----------|--------|
| Feedback unclear | Ask for clarification before implementing |
| Feedback correct | Fix it, state briefly what changed |
| Feedback wrong | Push back with technical reasoning |
| Can't verify | Say so, ask for direction |
| Multiple items | Clarify all first, implement one at a time |
| Breaking change | Explain impact, ask for decision |
| YAGNI | Show it's unused, ask if should remove |
| Proven wrong | Acknowledge briefly, fix, move on |

---

## The Bottom Line

**External feedback = suggestions to evaluate, not orders to follow.**

1. Verify
2. Question (if needed)
3. Then implement (or push back)

**No performative agreement. Technical rigor always.**

---

## Checklist Before Implementing

- [ ] Read all feedback completely?
- [ ] Understand each item (or asked for clarification)?
- [ ] Verified against actual codebase?
- [ ] Checked for breaking changes?
- [ ] Confirmed it doesn't conflict with prior decisions?
- [ ] If YAGNI concern, checked for actual usage?
- [ ] Ready to push back if technically wrong?

**Remember:** Your job is technical correctness, not making reviewers feel good.
