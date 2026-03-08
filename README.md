# Pi Agent Configuration

Personal configuration for [pi coding agent](https://github.com/badlogic/pi-mono).

## Structure

```
~/.pi/agent/
├── extensions/       # TypeScript extensions
├── skills/           # Markdown skill files
├── settings.json     # Pi settings (provider, model, packages)
├── auth.json         # API keys (gitignored)
└── sessions/         # Session history (gitignored)
```

## Extensions

| Extension | Purpose |
|-----------|---------|
| `react-lint-hook.ts` | Auto `lint && typecheck` after React/TS file edits |
| `python-lint-hook.ts` | Auto `ruff check && pyright` after Python file edits |
| `rust-lint-hook.ts` | Auto `cargo clippy` after Rust file edits |
| `todos.ts` | File-based todo management (`/todos` command, `todo` tool) |
| `answer.ts` | Q&A extraction from assistant messages (`/answer`, `Ctrl+.`) |
| `review.ts` | Code review with multiple modes (`/review`, `/end-review`) |

## Skills

| Skill | Purpose |
|-------|---------|
| `frontend-design` | Distinctive, non-generic UI design patterns |
| `playwright-e2e` | End-to-end testing with Playwright CLI and test files |
| `systematic-debugging` | Structured 4-phase debugging (root cause → pattern → hypothesis → fix) |

## Packages

Configured in `settings.json`:
- `pi-web-access` - Web search, URL fetching, PDF extraction, YouTube/video analysis

## Quick Restore

After a fresh install:

```bash
# Clone to ~/.pi/agent/
git clone <repo-url> ~/.pi/agent
cd ~/.pi/agent

# Create auth.json with your API keys
cat > auth.json << 'EOF'
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." }
}
EOF

# Start pi - extensions/skills load automatically
pi
```

## Development

### Adding Extensions

```bash
vim ~/.pi/agent/extensions/my-extension.ts
# In pi: /reload
```

### Adding Skills

```bash
mkdir -p ~/.pi/agent/skills/my-skill
vim ~/.pi/agent/skills/my-skill/SKILL.md
# In pi: /reload
```

### Backup Changes

```bash
cd ~/.pi/agent
git add -A
git commit -m "Update configuration"
git push
```

## Lint Hook Behavior

All lint hooks:
- Detect project type automatically (React, Python, Rust)
- Run after any `edit` or `write` tool on relevant files
- Send errors back to agent via steering message
- Include instructions to fix ALL errors (pre-existing or new)
- Avoid infinite loops with re-entrancy protection

## Extension Details

### todos.ts
- `/todos` - Interactive TUI for managing todos
- `todo` tool - LLM can create, list, update, delete todos
- Todos stored as `.pi/todos/*.md` files
- Supports assignment to sessions, status tracking

### answer.ts
- `/answer` - Extract questions from last assistant message
- `Ctrl+.` - Quick keyboard shortcut
- Interactive TUI to navigate and answer questions
- Uses lightweight model for extraction

### review.ts
- `/review` - Start code review (interactive mode selector)
- `/review pr 123` - Review GitHub PR
- `/review uncommitted` - Review uncommitted changes
- `/review branch main` - Review against base branch
- `/end-review` - Complete review and return to original position

## Skill Details

### systematic-debugging
Four-phase approach:
1. **Root Cause Investigation** - Read errors, reproduce, trace data flow
2. **Pattern Analysis** - Find working examples, compare differences
3. **Hypothesis Testing** - Form single theory, test minimally
4. **Implementation** - Create failing test, fix root cause, verify

Key rule: **NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST**

### frontend-design
- Distinctive aesthetic directions (brutalist, editorial, luxury, retro-futuristic)
- Typography systems with non-default fonts
- Color systems with strong point-of-view
- Motion strategy with meaningful interactions

### playwright-e2e
- Playwright CLI for interactive testing
- Test file patterns (locators, actions, assertions)
- Page Object Model
- Visual regression testing
