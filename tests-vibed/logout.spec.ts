import { test, expect } from '@playwright/test';

test('user can logout and return to login page', async ({ page }) => {
  // 1. Go to the login page
  await page.goto('/');

  // 2. Log in with valid user
  const username = 'buggy';
  const password = '1970beetle';

  await page.fill('input[type="text"]', username);
  await page.fill('input[type="password"]', password);
  await page.getByRole('button', { name: 'Login' }).click();

  // 3. Verify that the BuggyBoard board is displayed
  await expect(page.getByRole('heading', { name: 'BuggyBoard' })).toBeVisible();
  await expect(page).toHaveURL(/\/board/);

  // 4. Log out
  await page.getByRole('button', { name: 'Logout' }).click();

  // 5. Verify that the user is returned to the login page
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
});
