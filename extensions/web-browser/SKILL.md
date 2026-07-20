---
name: web-browser
description: "Chrome DevTools Protocol automation for web testing and interaction. Allows remote controlling Chrome/Arc to navigate, click, fill forms, evaluate JavaScript, take screenshots, and more."
license: Based on https://github.com/mitsuhiko/agent-stuff
---

# Web Browser Extension

Chrome DevTools Protocol (CDP) tools for collaborative browser automation and testing.

## Getting Started

1. Start Chrome with remote debugging:
   ```
   /browser-start
   ```
   Or use `browser_start` tool with `useProfile: true` to copy your Chrome profile for persistent sessions.

2. Navigate to a URL:
   ```
   browser_navigate({ url: "https://example.com" })
   ```

3. Interact with the page using available tools.

## Available Tools

### browser_start
Start Chrome with remote debugging on port 9222. Required before using other browser tools.
- `useProfile` (optional): Copy your Chrome profile for cookies/logins persistence

### browser_navigate
Navigate Chrome to a URL.
- `url`: URL to navigate to
- `newTab` (optional): Open in new tab instead of current tab

### browser_evaluate
Execute JavaScript in the current Chrome tab.
- `code`: JavaScript code to evaluate (automatically wrapped in async IIFE)

### browser_screenshot
Take a screenshot of the current Chrome viewport.
- Returns: Path to PNG screenshot file

### browser_pick
Interactive element picker - displays a message, user clicks elements to select them.
- `message`: Instruction message (e.g., "Click submit button")
- Returns: Element information (tag, id, class, text, html, parent hierarchy)
- Multi-select: Cmd/Ctrl+click to add elements, Enter to finish

### browser_dismiss_cookies
Automatically dismiss cookie consent dialogs.
- `mode`: "accept" or "reject" (default: "accept")
- Supports: OneTrust, Cookiebot, Google, YouTube, Didomi, Quantcast, Usercentrics, TrustArc, Klaro, BBC, Amazon, CookieYes, and generic fallbacks

### browser_logs
Tail console and network logs from the browser session.
- `follow` (optional): Keep following new log entries (default: false)
- Logs stored in: `~/.cache/agent-web/logs/YYYY-MM-DD/<targetId>.jsonl`

### browser_net_summary
Summarize network requests from the browser session.
- Returns: Network activity summary (responses, status codes, timing)

## Commands

### /browser-start
Start Chrome with CDP remote debugging.
- Optional argument: `--profile` to copy your Chrome profile for persistent sessions

## Usage Examples

```bash
# Start Chrome with your profile
/browser-start --profile

# Navigate to a page
browser_navigate({ url: "https://example.com" })

# Dismiss cookie dialogs
browser_dismiss_cookies({ mode: "accept" })

# Execute JavaScript
browser_evaluate({ code: "document.title" })

# Take a screenshot
browser_screenshot()

# Pick an element interactively
browser_pick({ message: "Click the submit button" })

# Check network activity
browser_net_summary()

# Tail recent logs
browser_logs()
```

## Notes

- Chrome must be started with `/browser-start` or `browser_start` before using other tools
- Background logging (console + errors + network) starts automatically with Chrome
- Screenshots are saved to temp directory (e.g., `/tmp/screenshot-2025-03-13T12-00-00-000Z.png`)
- Multiple tabs can be opened with `browser_navigate({ newTab: true })`
- Element picker supports multi-select via Cmd/Ctrl+click
- Cookie dismissal works across 20+ CMPs and has intelligent fallbacks

## Limitations

- Requires Chrome, Arc, Helium, or other Chromium-based browser
- macOS and Linux only (uses `open -na` on macOS)
- Browser must be accessible via `/usr/bin/open` (macOS) or equivalent
- Interactive tools (browser_pick) require user interaction - they block until complete
