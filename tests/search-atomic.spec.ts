import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_SEARCH_TITLES = [
  'Login fails on startup',
  'Issue with log-in flow',
  'Search results show missing icons',
  'Checkout timeout on validation',
];

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'case';
}

function makeUniqueSuffix(workerIndex: number, testName: string): string {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return `[W${workerIndex}] ${slugify(testName)} ${stamp}`;
}

function workerScopedTitle(workerIndex: number, testName: string, baseTitle: string): string {
  return `${makeUniqueSuffix(workerIndex, testName)} ${baseTitle}`;
}

function getFirstUser(): { username: string; password: string } {
  const usersPath = join(__dirname, '..', 'users.json');
  const raw = readFileSync(usersPath, 'utf-8');
  const users = JSON.parse(raw) as Array<{ username: string; password: string }>;
  return users[0];
}

async function login(page: Page) {
  const { username, password } = getFirstUser();

  await page.goto('/');
  await page.getByRole('textbox', { name: 'Username' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('heading', { name: 'BuggyBoard' })).toBeVisible();
  await expect(page).toHaveURL(/\/board/);
}

async function createBug(page: Page, title: string) {
  const createDialog = page.getByRole('dialog').filter({ hasText: 'Create bug' });

  await page.getByRole('button', { name: 'New Bug' }).click();
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel('Title').fill(title);
  await createDialog.getByLabel('Severity').selectOption('HIGH');
  await createDialog.getByLabel('Description').fill('This bug is created for atomic search testing.');
  await createDialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.locator('tbody tr').filter({ hasText: title })).toBeVisible();
}

async function seedBoardSearchData(page: Page, titles: string[]) {
  for (const title of titles) {
    await createBug(page, title);
  }

  return titles;
}

async function deleteBugByTitle(page: Page, title: string) {
  const row = page.getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
  await row.click();

  const editDialog = page.getByRole('dialog', { name: /Edit bug #/ });
  await expect(editDialog).toBeVisible();
  await editDialog.getByRole('button', { name: 'Delete' }).click();

  const confirmDialog = page.getByRole('dialog', { name: 'Delete bug?' });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Delete bug' }).click();

  await expect(confirmDialog).not.toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: title })).toHaveCount(0);
}

test.describe('Search board', () => {
  let createdTitles: string[] = [];
  let workerTitles: {
    loginBug: string;
    logInFlowBug: string;
    missingIconsBug: string;
    validationBug: string;
  } = {
    loginBug: '',
    logInFlowBug: '',
    missingIconsBug: '',
    validationBug: '',
  };

  test.beforeEach(async ({ page }, testInfo) => {
    createdTitles = [];
    const workerIndex = testInfo.workerIndex;
    const testKey = slugify(testInfo.title);
    workerTitles = {
      loginBug: workerScopedTitle(workerIndex, `${testKey}-login-fails-on-startup`, 'Login fails on startup'),
      logInFlowBug: workerScopedTitle(workerIndex, `${testKey}-issue-with-log-in-flow`, 'Issue with log-in flow'),
      missingIconsBug: workerScopedTitle(workerIndex, `${testKey}-search-results-show-missing-icons`, 'Search results show missing icons'),
      validationBug: workerScopedTitle(workerIndex, `${testKey}-checkout-timeout-on-validation`, 'Checkout timeout on validation'),
    };

    await login(page);
    createdTitles = [
      workerTitles.loginBug,
      workerTitles.logInFlowBug,
      workerTitles.missingIconsBug,
      workerTitles.validationBug,
    ];
    createdTitles = await seedBoardSearchData(page, createdTitles);
  });

  test.afterEach(async ({ page }) => {
    for (const title of createdTitles) {
      const row = page.locator('tbody tr').filter({ hasText: title });
      if (await row.count()) {
        await deleteBugByTitle(page, title);
      }
    }
  });

  test('filters bugs by title search text', async ({ page }) => {
    const search = page.getByRole('search', { name: 'Search bugs by title' });

    await search.fill('login');

    await expect(search).toHaveValue('login');
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.loginBug })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.logInFlowBug })).toHaveCount(0);
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.missingIconsBug })).toHaveCount(0);
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.validationBug })).toHaveCount(0);
  });

  test('matches normalized search terms ignoring punctuation and whitespace', async ({ page }) => {
    const search = page.getByRole('search', { name: 'Search bugs by title' });

    await search.fill('log in');

    await expect(search).toHaveValue('log in');
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.logInFlowBug })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.loginBug })).toHaveCount(0);
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.missingIconsBug })).toHaveCount(0);
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.validationBug })).toHaveCount(0);
  });

  test('shows a no-results message when the search finds no bugs', async ({ page }) => {
    const search = page.getByRole('search', { name: 'Search bugs by title' });

    await search.fill('zzzz-no-match-query');

    await expect(search).toHaveValue('zzzz-no-match-query');
    await expect(page.getByText('No bugs matched.')).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.loginBug })).toHaveCount(0);
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.logInFlowBug })).toHaveCount(0);
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.missingIconsBug })).toHaveCount(0);
    await expect(page.locator('tbody tr').filter({ hasText: workerTitles.validationBug })).toHaveCount(0);
  });
});
