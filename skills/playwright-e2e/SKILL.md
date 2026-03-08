---
name: playwright-e2e
description: End-to-end testing with Playwright. Use when creating, debugging, or running e2e tests, browser automation, or visual regression testing. Covers both playwright-cli for interactive testing and Playwright test files for automated suites.
---

# Playwright E2E Testing

Comprehensive guide for end-to-end testing with Playwright, including interactive CLI testing and automated test suites.

## Quick Reference

| Task | Command/Pattern |
|------|-----------------|
| Interactive browser | `playwright-cli open <url> --headed` |
| Take snapshot | `playwright-cli snapshot` |
| Click element | `playwright-cli click <ref>` |
| Type text | `playwright-cli type "<text>"` |
| Fill input | `playwright-cli fill <ref> "<text>"` |
| Screenshot | `playwright-cli screenshot [--filename=f]` |
| Run tests | `bun run e2e` or `npx playwright test` |
| Run specific test | `npx playwright test path/to/test.spec.ts` |
| Debug mode | `npx playwright test --debug` |
| UI mode | `npx playwright test --ui` |

---

## 1. Playwright CLI (Interactive Testing)

Playwright CLI is token-efficient for agents - it doesn't force page data into the LLM context.

### 1.1 Installation

```bash
npm install -g @playwright/cli@latest
playwright-cli --help
```

### 1.2 Basic Workflow

```bash
# Open browser (headless by default, use --headed to see it)
playwright-cli open https://example.com --headed

# Take a snapshot to get element references
playwright-cli snapshot

# Output shows elements with refs like e1, e2, e3:
# - button "Submit" [ref=e1]
# - textbox "Email" [ref=e2]

# Interact with elements using refs
playwright-cli click e1
playwright-cli fill e2 "test@example.com"
playwright-cli type "some text"
playwright-cli press Enter

# Take screenshot for verification
playwright-cli screenshot --filename=result.png
```

### 1.3 Element References

After `playwright-cli snapshot`, elements have refs (e1, e2, etc.). Use these for interactions:

```bash
playwright-cli snapshot
# Output:
# - heading "Welcome" [ref=e1]
# - link "Learn more" [ref=e2]
# - button "Submit" [ref=e3]
# - textbox "Email" [ref=e4]

# Click button
playwright-cli click e3

# Fill input
playwright-cli fill e4 "user@example.com"

# Check checkbox
playwright-cli check e5

# Select dropdown option
playwright-cli select e6 "option-value"
```

### 1.4 Core Commands

```bash
# Navigation
playwright-cli open <url>           # Open browser, optionally navigate
playwright-cli goto <url>           # Navigate to URL
playwright-cli go-back              # Go back
playwright-cli go-forward           # Go forward
playwright-cli reload               # Reload page

# Interactions
playwright-cli click <ref> [button]       # Click (button: left, right, middle)
playwright-cli dblclick <ref> [button]    # Double click
playwright-cli fill <ref> <text>          # Fill text input
playwright-cli type <text>                # Type text into focused element
playwright-cli press <key>                # Press key (Enter, Tab, Escape, etc.)
playwright-cli hover <ref>                # Hover over element
playwright-cli check <ref>                # Check checkbox/radio
playwright-cli uncheck <ref>              # Uncheck checkbox
playwright-cli select <ref> <value>       # Select dropdown option
playwright-cli drag <startRef> <endRef>   # Drag and drop
playwright-cli upload <file>              # Upload file(s)

# Keyboard
playwright-cli keydown <key>        # Press key down
playwright-cli keyup <key>          # Release key
playwright-cli press <key>          # Press and release

# Mouse
playwright-cli mousemove <x> <y>    # Move mouse
playwright-cli mousedown [button]   # Press mouse button
playwright-cli mouseup [button]     # Release mouse button
playwright-cli mousewheel <dx> <dy> # Scroll

# Screenshots & PDFs
playwright-cli screenshot [ref]           # Screenshot page or element
playwright-cli screenshot --filename=f    # Save with specific filename
playwright-cli pdf                        # Save as PDF
playwright-cli pdf --filename=page.pdf    # PDF with specific filename
```

### 1.5 Sessions

Use sessions to manage multiple browser instances:

```bash
# Default session
playwright-cli open https://example.com

# Named session
playwright-cli -s=myapp open https://myapp.com

# List all sessions
playwright-cli list

# Close specific session
playwright-cli -s=myapp close

# Close all sessions
playwright-cli close-all

# Kill all browser processes
playwright-cli kill-all
```

### 1.6 Storage State (Auth, Cookies)

```bash
# Save storage state (cookies, localStorage)
playwright-cli state-save auth.json

# Load storage state
playwright-cli state-load auth.json

# Cookie management
playwright-cli cookie-list [--domain]
playwright-cli cookie-get <name>
playwright-cli cookie-set <name> <value>
playwright-cli cookie-delete <name>
playwright-cli cookie-clear

# LocalStorage
playwright-cli localstorage-list
playwright-cli localstorage-get <key>
playwright-cli localstorage-set <key> <value>
playwright-cli localstorage-delete <key>
playwright-cli localstorage-clear

# SessionStorage
playwright-cli sessionstorage-list
playwright-cli sessionstorage-get <key>
playwright-cli sessionstorage-set <key> <value>
playwright-cli sessionstorage-delete <key>
playwright-cli sessionstorage-clear
```

### 1.7 Network & DevTools

```bash
# Mock network requests
playwright-cli route <pattern> [options]
playwright-cli route-list
playwright-cli unroute [pattern]

# Console messages
playwright-cli console [min-level]   # error, warning, info, debug

# Network requests
playwright-cli network               # List all requests

# Tracing
playwright-cli tracing-start
playwright-cli tracing-stop

# Video recording
playwright-cli video-start
playwright-cli video-stop [filename]

# Run arbitrary Playwright code
playwright-cli run-code "<code>"
```

### 1.8 Tabs Management

```bash
playwright-cli tab-list              # List all tabs
playwright-cli tab-new [url]         # Create new tab
playwright-cli tab-close [index]     # Close tab
playwright-cli tab-select <index>    # Switch to tab
```

### 1.9 Monitoring Dashboard

```bash
# Open visual dashboard to see and control all sessions
playwright-cli show
```

---

## 2. Playwright Test Files (Automated Suites)

### 2.1 Test Structure

```typescript
// tests/example.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Feature name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');

    // Locators
    const button = page.getByRole('button', { name: 'Submit' });
    const input = page.getByLabel('Email');
    const heading = page.getByRole('heading', { name: 'Welcome' });

    // Actions
    await input.fill('test@example.com');
    await button.click();

    // Assertions
    await expect(heading).toBeVisible();
    await expect(page).toHaveURL('/dashboard');
  });
});
```

### 2.2 Locators (Preferred Methods)

```typescript
// Role-based (most resilient)
page.getByRole('button', { name: 'Submit' })
page.getByRole('link', { name: 'Learn more' })
page.getByRole('textbox', { name: 'Email' })
page.getByRole('checkbox', { name: 'Remember me' })
page.getByRole('heading', { name: 'Welcome', level: 1 })

// Label/placeholder
page.getByLabel('Email')
page.getByPlaceholder('Enter your email')

// Test ID (when semantic locators aren't possible)
page.getByTestId('submit-button')

// Text content
page.getByText('Welcome back')
page.getByText(/welcome/i)

// Combined
page.getByRole('listitem').filter({ hasText: 'Active' })
page.locator('form').getByRole('button')
```

### 2.3 Actions

```typescript
// Navigation
await page.goto('/path');
await page.goBack();
await page.goForward();
await page.reload();

// Click/press
await page.click('button');
await page.dblclick('.item');
await button.click({ clickCount: 3 });  // Triple click

// Input
await page.fill('#email', 'test@example.com');
await page.type('#search', 'hello', { delay: 100 });  // With delay
await page.press('#input', 'Enter');
await page.press('#input', 'Control+A');  // Select all

// Select
await page.selectOption('#country', 'us');
await page.selectOption('#colors', ['red', 'blue']);  // Multi-select

// Checkbox/radio
await page.check('#agree');
await page.uncheck('#newsletter');
expect(await page.isChecked('#agree')).toBeTruthy();

// File upload
await page.setInputFiles('#avatar', 'path/to/file.png');
await page.setInputFiles('#documents', ['file1.pdf', 'file2.pdf']);

// Hover
await page.hover('.tooltip-trigger');

// Drag and drop
await page.dragAndDrop('#source', '#target');

// Wait for
await page.waitForSelector('.loaded');
await page.waitForLoadState('networkidle');
await page.waitForURL('/dashboard');
await page.waitForResponse(resp => resp.url().includes('/api/'));
```

### 2.4 Assertions

```typescript
// Visibility
await expect(page.locator('.alert')).toBeVisible();
await expect(page.locator('.hidden')).toBeHidden();

// Text content
await expect(page.locator('.title')).toHaveText('Welcome');
await expect(page.locator('.message')).toContainText('success');

// Value
await expect(page.locator('#email')).toHaveValue('test@example.com');
await expect(page.locator('#email')).toBeEmpty();

// State
await expect(page.locator('button')).toBeEnabled();
await expect(page.locator('button')).toBeDisabled();
await expect(page.locator('#checkbox')).toBeChecked();

// Count
await expect(page.locator('.item')).toHaveCount(5);

// URL
await expect(page).toHaveURL('/dashboard');
await expect(page).toHaveURL(/dashboard/);

// Title
await expect(page).toHaveTitle(/My App/);

// Screenshots
await expect(page).toHaveScreenshot('homepage.png');
await expect(page.locator('.component')).toHaveScreenshot();

// Soft assertions (continue on failure)
await expect.soft(page.locator('.title')).toHaveText('Welcome');
```

### 2.5 Fixtures & Authentication

```typescript
// tests/fixtures/auth.ts
import { test as base, expect } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login before test
    await page.goto('/login');
    await page.fill('#email', process.env.TEST_USER_EMAIL!);
    await page.fill('#password', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await use(page);
  },
});

// tests/dashboard.spec.ts
import { test, expect } from './fixtures/auth';

test('dashboard loads', async ({ authenticatedPage }) => {
  await expect(authenticatedPage.locator('h1')).toHaveText('Dashboard');
});
```

### 2.6 Storage State (Reuse Auth)

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    // Setup project to authenticate
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Tests that depend on auth
    {
      name: 'chromium',
      use: {
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});

// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', process.env.TEST_USER_EMAIL!);
  await page.fill('#password', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');

  // Save auth state
  await page.context().storageState({ path: '.auth/user.json' });
});
```

### 2.7 API Testing

```typescript
import { test, expect } from '@playwright/test';

test('API returns user data', async ({ request }) => {
  const response = await request.get('/api/users/1');
  expect(response.ok()).toBeTruthy();

  const user = await response.json();
  expect(user.email).toBe('user@example.com');
});

test('POST creates new user', async ({ request }) => {
  const response = await request.post('/api/users', {
    data: {
      name: 'Test User',
      email: 'test@example.com',
    },
  });
  expect(response.status()).toBe(201);
});
```

### 2.8 Mocking & Network

```typescript
// Mock API response
await page.route('**/api/users', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 1, name: 'Mocked User' }]),
  });
});

// Abort requests to certain domains
await page.route('**/analytics/**', route => route.abort());

// Modify request
await page.route('**/api/**', async route => {
  const request = route.request();
  await route.continue({
    headers: {
      ...request.headers(),
      'Authorization': 'Bearer test-token',
    },
  });
});

// Wait for request
const responsePromise = page.waitForResponse('**/api/users');
await button.click();
const response = await responsePromise;
```

### 2.9 Visual Regression

```typescript
test('homepage screenshot', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Full page screenshot
  await expect(page).toHaveScreenshot('homepage.png', {
    fullPage: true,
    animations: 'disabled',
  });

  // Component screenshot
  const hero = page.locator('.hero-section');
  await expect(hero).toHaveScreenshot('hero.png', {
    maxDiffPixels: 100,
  });

  // Mask dynamic content
  await expect(page).toHaveScreenshot({
    mask: [page.locator('.timestamp'), page.locator('.random-ad')],
  });
});
```

---

## 3. Test Patterns

### 3.1 Page Object Model

```typescript
// pages/LoginPage.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.locator('.error-message');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toHaveText(message);
  }
}

// tests/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test('login with valid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password');
  await expect(page).toHaveURL('/dashboard');
});
```

### 3.2 Test Data Management

```typescript
// fixtures/testData.ts
import { test as base } from '@playwright/test';

type TestDataFixtures = {
  testUser: { email: string; password: string };
  cleanupUser: (id: string) => Promise<void>;
};

export const test = base.extend<TestDataFixtures>({
  testUser: async ({}, use) => {
    const user = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    };
    await use(user);
    // Cleanup happens in cleanupUser fixture
  },

  cleanupUser: async ({ request }, use) => {
    const createdUsers: string[] = [];

    await use(async (id: string) => {
      createdUsers.push(id);
    });

    // Cleanup all created users
    for (const id of createdUsers) {
      await request.delete(`/api/users/${id}`);
    }
  },
});
```

### 3.3 Retrying Flaky Actions

```typescript
// Retry until condition is met
await expect(async () => {
  await page.click('.refresh-button');
  await expect(page.locator('.status')).toHaveText('Complete');
}).toPass({ timeout: 30000 });

// Or with explicit polling
for (let i = 0; i < 10; i++) {
  await page.click('.refresh');
  const status = await page.locator('.status').textContent();
  if (status === 'Complete') break;
  await page.waitForTimeout(1000);
}
```

### 3.4 Parallel vs Serial

```typescript
// Parallel (default)
test.describe('parallel tests', () => {
  test('test 1', async ({ page }) => {});
  test('test 2', async ({ page }) => {});
});

// Serial (run in order, stop on failure)
test.describe.serial('checkout flow', () => {
  test('add to cart', async ({ page }) => {});
  test('checkout', async ({ page }) => {});
  test('confirm order', async ({ page }) => {});
});

// Only run one test at a time
test.describe.configure({ mode: 'serial' });
```

---

## 4. Configuration

### 4.1 playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'results.xml' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 4.2 CLI Options

```bash
# Run all tests
npx playwright test

# Run specific file
npx playwright test tests/login.spec.ts

# Run specific test
npx playwright test -g "should log in"

# Run in headed mode
npx playwright test --headed

# Debug mode (step through)
npx playwright test --debug

# UI mode (watch & debug)
npx playwright test --ui

# Specific browser
npx playwright test --project=chromium

# Generate trace on every test
npx playwright test --trace on

# Update snapshots
npx playwright test --update-snapshots

# Reporters
npx playwright test --reporter=html
npx playwright test --reporter=list
```

---

## 5. Common Workflows

### 5.1 Login Flow Test

```typescript
test('user can log in', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
});
```

### 5.2 Form Validation Test

```typescript
test('form shows validation errors', async ({ page }) => {
  await page.goto('/signup');

  // Submit empty form
  await page.getByRole('button', { name: 'Sign up' }).click();

  // Check validation errors
  await expect(page.getByText('Email is required')).toBeVisible();
  await expect(page.getByText('Password is required')).toBeVisible();

  // Invalid email
  await page.getByLabel('Email').fill('invalid-email');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByText('Invalid email format')).toBeVisible();
});
```

### 5.3 CRUD Operations Test

```typescript
test.describe('Project CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
  });

  test('create project', async ({ page }) => {
    await page.click('text=New Project');
    await page.getByLabel('Name').fill('Test Project');
    await page.getByLabel('Description').fill('Test description');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Project created')).toBeVisible();
    await expect(page.getByText('Test Project')).toBeVisible();
  });

  test('edit project', async ({ page }) => {
    await page.click('text=Test Project');
    await page.click('text=Edit');
    await page.getByLabel('Name').fill('Updated Project');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Project updated')).toBeVisible();
  });

  test('delete project', async ({ page }) => {
    await page.click('text=Updated Project');
    await page.click('text=Delete');
    await page.click('button:has-text("Confirm")');

    await expect(page.getByText('Project deleted')).toBeVisible();
    await expect(page.getByText('Updated Project')).not.toBeVisible();
  });
});
```

### 5.4 Interactive Debugging with CLI

```bash
# Open the page and explore
playwright-cli open http://localhost:3000/login --headed

# Take snapshot to understand structure
playwright-cli snapshot

# Try interactions
playwright-cli fill e1 "test@example.com"
playwright-cli fill e2 "password"
playwright-cli click e3

# Check result
playwright-cli screenshot --filename=login-result.png

# Check for errors
playwright-cli console error
```

---

## 6. Anti-Patterns

### 6.1 Avoid These

```typescript
// ❌ Using text selectors (brittle)
await page.click('text=Submit');

// ✅ Use role-based selectors
await page.getByRole('button', { name: 'Submit' }).click();

// ❌ Arbitrary waits
await page.waitForTimeout(2000);

// ✅ Wait for specific conditions
await expect(page.locator('.loading')).not.toBeVisible();

// ❌ Chaining locators incorrectly
await page.locator('.parent .child .button').click();

// ✅ Use meaningful locators
await page.locator('.card').getByRole('button', { name: 'Submit' }).click();

// ❌ Not handling async properly
const text = page.locator('.message').textContent(); // Missing await!

// ✅ Always await
const text = await page.locator('.message').textContent();

// ❌ Hard-coded timeouts
await page.goto('/', { timeout: 10000 });

// ✅ Use configuration or smarter waits
await page.goto('/');
await page.waitForLoadState('domcontentloaded');
```

---

## 7. Checklist

Before submitting e2e tests:

- [ ] Tests use role-based locators where possible
- [ ] No arbitrary `waitForTimeout` calls
- [ ] Authentication is handled via fixtures/storage state
- [ ] Tests are independent (can run in any order)
- [ ] Flaky tests have proper retry logic
- [ ] Screenshots/traces are configured for debugging
- [ ] Test data is cleaned up after tests
- [ ] CI configuration is set up (retries, workers, etc.)
- [ ] Visual regression tests mask dynamic content

---

## References

- [Playwright Documentation](https://playwright.dev)
- [Playwright CLI](https://github.com/microsoft/playwright-cli)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Library Playwright](https://testing-library.com/docs/react-testing-library/intro/)
