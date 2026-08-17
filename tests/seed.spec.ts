import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the first user from the root users.json
function getFirstUser(): { username: string; password: string } {
  const usersPath = join(__dirname, '..', 'users.json');
  const raw = readFileSync(usersPath, 'utf-8');
  const users = JSON.parse(raw) as Array<{ username: string; password: string }>;
  return users[0];
}

test.describe('Seed Tests', () => {
  test('Setup - Login user to board', { tag: '@seed' }, async ({ page }) => {
    // Read the first user from users.json
    const { username, password } = getFirstUser();

    // Navigate to the application login page
    await page.goto('/');

    // Fill in the username field
    await page.getByRole('textbox', { name: 'Username' }).fill(username);

    // Fill in the password field
    await page.getByRole('textbox', { name: 'Password' }).fill(password);

    // Click the Login button to submit the login form
    await page.getByRole('button', { name: 'Login' }).click();

    // Verify that the BuggyBoard heading is visible on the board page
    await expect(page.getByRole('heading', { name: 'BuggyBoard' })).toBeVisible();

    // Verify the URL contains /board
    await expect(page).toHaveURL(/\/board/);
  });
});
