---
name: requesting-code-review
description: Use when completing tasks, implementing features, or before merging. Guides thorough code review using pi's /review command or structured self-review. Ensures code quality, catches issues early, and verifies requirements are met.
---

# Requesting Code Review

Review early, review often. Catch issues before they cascade.

**Core principle:** Every significant change deserves review. Fresh eyes catch blind spots.

---

## When to Request Review

### Mandatory Review
- ✅ After completing a major feature
- ✅ Before merge to main branch
- ✅ After fixing a complex bug
- ✅ When implementation differs from plan

### Recommended Review
- When stuck on a problem (fresh perspective)
- Before refactoring (establish baseline)
- After significant debugging session
- When touching critical paths (auth, payments, data)

### Optional Review
- Small bug fixes with clear cause
- Typo/doc fixes
- Simple config changes

---

## How to Request Review in pi

### Option 1: Use the /review Command (Preferred)

The `/review` extension provides interactive code review:

```bash
# Interactive mode selector
/review

# Review specific modes
/review uncommitted          # Review uncommitted changes
/review branch main         # Review against main (PR-style diff)
/review commit abc123       # Review specific commit
/review folder src api      # Review specific folders
/review custom "security"   # Custom review focus
```

**Workflow:**
1. Run `/review branch main` (or appropriate base)
2. Review findings are presented
3. Fix issues identified
4. Run `/end-review` to return to original position

### Option 2: Structured Self-Review

When `/review` isn't available or for quick checks:

```
I need a code review. Please review my recent changes:

## What Was Implemented
[Describe what you built]

## Requirements/Plan
[Reference the requirements or plan]

## Git Range
Base: [BASE_SHA or "before changes"]
Head: [HEAD_SHA or "current"]

Review against the checklist below. Categorize issues by severity.
```

---

## Review Checklist

### Code Quality
- [ ] Clean separation of concerns?
- [ ] Proper error handling (not swallowing errors)?
- [ ] Type safety (no `any` without justification)?
- [ ] DRY principle followed (no copy-paste)?
- [ ] Edge cases handled?
- [ ] No magic numbers/strings (use constants)?
- [ ] Functions/methods focused and small?

### Architecture
- [ ] Sound design decisions?
- [ ] Follows existing patterns in codebase?
- [ ] Scalability considerations?
- [ ] Performance implications acceptable?
- [ ] Security concerns addressed?
- [ ] No circular dependencies?

### Testing
- [ ] Tests actually test logic (not just mocks)?
- [ ] Edge cases covered?
- [ ] Integration tests where needed?
- [ ] All tests passing?
- [ ] New code has test coverage?

### Requirements
- [ ] All plan requirements met?
- [ ] Implementation matches spec?
- [ ] No scope creep?
- [ ] Breaking changes documented?
- [ ] API contracts maintained?

### Production Readiness
- [ ] Migration strategy (if schema changes)?
- [ ] Backward compatibility considered?
- [ ] Documentation complete?
- [ ] Logging/observability adequate?
- [ ] No obvious bugs or crashes?

---

## Issue Severity Categories

### 🔴 Critical (Must Fix Before Merge)
- Bugs that break functionality
- Security vulnerabilities
- Data loss or corruption risks
- Performance regressions
- Type errors in TypeScript
- Test failures

### 🟡 Important (Should Fix Before Merge)
- Architecture problems
- Missing error handling
- Test gaps
- Missing features from requirements
- Poor user experience
- Memory leaks

### 🟢 Minor (Nice to Have)
- Code style inconsistencies
- Minor optimizations
- Documentation improvements
- Refactoring opportunities
- Better naming

---

## Review Output Format

When reviewing, use this structure:

```
### Summary
[1-2 sentence overview of the changes]

### Strengths
- [What's well done? Be specific with file:line references]
- [Good patterns followed]
- [Tests written]

### Issues

#### 🔴 Critical
1. **[Issue Title]**
   - File: `path/to/file.ts:line`
   - Issue: [What's wrong]
   - Impact: [Why it matters]
   - Fix: [How to fix]

#### 🟡 Important
[Same format]

#### 🟢 Minor
[Same format]

### Recommendations
[Improvements for code quality, architecture, or process]

### Assessment

**Ready to merge:** [Yes / No / With fixes]

**Reasoning:** [Technical assessment in 1-2 sentences]
```

---

## Common Issues by Category

### React/Frontend
- Missing key props in lists
- useEffect missing dependencies
- Stale closures in callbacks
- Missing loading/error states
- Uncontrolled to controlled input warnings
- Memory leaks from uncleaned subscriptions

### Python/Backend
- Missing type hints
- Unhandled exceptions
- SQL injection risks
- Missing transaction handling
- Unclosed file handles/connections
- Missing input validation

### TypeScript
- Using `any` instead of proper types
- Missing null/undefined checks
- Incorrect generic constraints
- Unused imports/variables
- Type assertions that hide errors

### Database
- Missing indexes on query columns
- N+1 query patterns
- Missing migrations
- Incorrect cascade rules
- Missing foreign key constraints

### Testing
- Tests that always pass
- Mocking too much (testing mocks, not code)
- Missing edge cases
- Flaky tests (timing issues)
- No assertions

---

## Integration with Workflows

### After Each Task
```
1. Complete task
2. Run relevant tests
3. Request review: /review branch main
4. Fix issues
5. /end-review
6. Continue to next task
```

### Before Merge
```
1. All tests passing
2. /review branch main
3. Fix all Critical + Important issues
4. Update documentation
5. Merge
```

### When Stuck
```
1. Describe what's not working
2. Request review of current approach
3. Fresh perspective often reveals solution
```

---

## Red Flags - STOP

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Say "looks good" without checking
- Review code you didn't read

**If reviewer is wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Ask for clarification
- Document the decision

---

## Tips for GLM Models

When using ZAI's GLM-5 or GLM-4.7 for review:

1. **Be explicit about file paths** - Include full paths for context
2. **Provide the git diff** - Use `git diff BASE..HEAD` output
3. **Specify review focus** - "Focus on security" or "Focus on performance"
4. **Request structured output** - Ask for the categorized format above
5. **One review at a time** - Don't batch multiple unrelated reviews

Example prompt:
```
Review this code change. Focus on type safety and error handling.

[git diff output]

Use the review output format with Critical/Important/Minor categories.
Include file:line references for each issue.
```

---

## Quick Reference

| Trigger | Action |
|---------|--------|
| After major feature | `/review branch main` |
| Before merge | `/review branch main` |
| Uncommitted changes | `/review uncommitted` |
| Specific commit | `/review commit SHA` |
| Custom focus | `/review custom "security"` |
| End review | `/end-review` |

---

## Example Review Request

```
I just implemented user authentication with JWT tokens.
Please review before I merge.

## What Was Implemented
- JWT token generation and validation
- Login/logout endpoints
- Password hashing with bcrypt
- Session management middleware

## Requirements
From docs/plans/auth-plan.md:
- Secure token storage
- Token expiration handling
- Rate limiting on login

## Git Range
Base: main (a1b2c3d)
Head: feature/auth (e4f5g6h)

Run: /review branch main

Focus on: security, error handling, test coverage
```

**Remember:** A thorough review now saves hours of debugging later.
