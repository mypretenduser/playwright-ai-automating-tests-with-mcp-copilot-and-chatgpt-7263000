import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getFirstUser(): { username: string; password: string } {
  const usersPath = join(__dirname, '..', '..', 'users.json');
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
  await createDialog.getByLabel('Description').fill('Row-order collision fixture.');
  await createDialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.locator('tbody tr').first()).toBeVisible();
}

test.describe('Row order collision - first row', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('assumes the first table row is the first created bug', async ({ page }) => {
    const titles = ['Row order shared bug A', 'Row order shared bug B', 'Row order shared bug C'];

    for (const title of titles) {
      await createBug(page, title);
    }

    await page.locator('tbody tr').first().click();

    await expect(page.getByRole('heading', { name: /Edit bug #/ })).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue('Row order shared bug A');
  });
});
