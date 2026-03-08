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
| `react-lint-hook.ts` | Auto lint+typecheck after React/TS edits |
| `python-lint-hook.ts` | Auto ruff+pyright after Python edits |
| `rust-lint-hook.ts` | Auto cargo clippy after Rust edits |
| `todos.ts` | File-based todo management (`/todos` command) |
| `answer.ts` | Q&A extraction (`/answer` command, `Ctrl+.`) |
| `review.ts` | Code review (`/review`, `/end-review` commands) |

## Skills

| Skill | Purpose |
|-------|---------|
| `frontend-design` | Distinctive UI design patterns |
| `playwright-e2e` | End-to-end testing with Playwright |
| `systematic-debugging` | Structured 4-phase debugging approach |

## Packages

Configured in `settings.json`:
- `pi-web-access` - Web search, URL fetching, PDF/video analysis

## Usage

After cloning:

```bash
# Restore to ~/.pi/agent/
mkdir -p ~/.pi/agent
git clone <repo-url> ~/.pi/agent
cd ~/.pi/agent

# Create auth.json with your API keys
cat > auth.json << 'EOF'
{
  "anthropic": { "type": "api_key", "key": "your-key-here" }
}
EOF
```

## Adding New Extensions

```bash
# Create extension
vim ~/.pi/agent/extensions/my-extension.ts

# Reload in pi with /reload
```

## Adding New Skills

```bash
# Create skill directory and SKILL.md
mkdir -p ~/.pi/agent/skills/my-skill
vim ~/.pi/agent/skills/my-skill/SKILL.md

# Reload in pi with /reload
```

## Backup

```bash
# Commit changes
cd ~/.pi/agent
git add -A
git commit -m "Update configuration"
git push
```
