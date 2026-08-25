import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function createBug(page: Page, titleOverride?: string) {
  const title = titleOverride ?? `Delete flow ${Date.now()}`;
  const createDialog = page.getByRole('dialog').filter({ hasText: 'Create bug' });

  await page.getByRole('button', { name: 'New Bug' }).click();
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel('Title').fill(title);
  await createDialog.getByLabel('Severity').selectOption('HIGH');
  await createDialog.getByLabel('Description').fill('This bug is created for delete-flow testing.');
  await createDialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.locator('tbody tr').filter({ hasText: title }).first()).toBeVisible();
  return title;
}

async function openEditBugModal(page: Page, title: string) {
  const row = page.locator('tbody tr').filter({ hasText: title }).first();
  await row.click();
  await expect(page.getByRole('heading', { name: /Edit bug #/ })).toBeVisible();
}

test.describe('Delete bug', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Delete opens the confirmation modal', async ({ page }) => {
    const title = await createBug(page);
    await openEditBugModal(page, title);

    const editDialog = page.getByRole('dialog', { name: /Edit bug #/ });
    await editDialog.getByRole('button', { name: 'Delete' }).click();

    const confirmDialog = page.getByRole('dialog', { name: 'Delete bug?' });
    await expect(confirmDialog).toBeVisible();
    await expect(page.getByText(/This will permanently delete bug #/)).toBeVisible();
    await expect(confirmDialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(confirmDialog.getByRole('button', { name: 'Delete bug' })).toBeVisible();
  });

  test('Canceling the confirmation leaves the bug unchanged and keeps the edit modal open', async ({ page }) => {
    const title = await createBug(page);
    await openEditBugModal(page, title);

    const editDialog = page.getByRole('dialog', { name: /Edit bug #/ });
    await editDialog.getByRole('button', { name: 'Delete' }).click();

    const confirmDialog = page.getByRole('dialog', { name: 'Delete bug?' });
    await expect(confirmDialog).toBeVisible();

    await confirmDialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(confirmDialog).not.toBeVisible();
    await expect(editDialog).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: title }).first()).toBeVisible();
  });

  test('Closing the confirmation modal leaves the bug unchanged', async ({ page }) => {
    const title = await createBug(page);
    await openEditBugModal(page, title);

    const editDialog = page.getByRole('dialog', { name: /Edit bug #/ });
    await editDialog.getByRole('button', { name: 'Delete' }).click();

    const confirmDialog = page.getByRole('dialog', { name: 'Delete bug?' });
    await expect(confirmDialog).toBeVisible();

    await confirmDialog.getByRole('button', { name: 'Close delete confirmation' }).click();

    await expect(confirmDialog).not.toBeVisible();
    await expect(editDialog).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: title }).first()).toBeVisible();
  });

  test('Pressing Escape closes the confirmation without deleting the bug', async ({ page }) => {
    const title = await createBug(page);
    await openEditBugModal(page, title);

    const editDialog = page.getByRole('dialog', { name: /Edit bug #/ });
    await editDialog.getByRole('button', { name: 'Delete' }).click();
    const confirmDialog = page.getByRole('dialog', { name: 'Delete bug?' });
    await expect(confirmDialog).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(confirmDialog).not.toBeVisible();
    await expect(editDialog).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: title }).first()).toBeVisible();
  });

  test('Confirming deletion removes the bug and closes the modal', async ({ page }) => {
    const title = await createBug(page);
    await openEditBugModal(page, title);

    const editDialog = page.getByRole('dialog', { name: /Edit bug #/ });
    await editDialog.getByRole('button', { name: 'Delete' }).click();
    const confirmDialog = page.getByRole('dialog', { name: 'Delete bug?' });
    await expect(confirmDialog).toBeVisible();

    await confirmDialog.getByRole('button', { name: 'Delete bug' }).click();

    await expect(confirmDialog).not.toBeVisible();
    await expect(editDialog).not.toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: title })).toHaveCount(0);
  });
});
