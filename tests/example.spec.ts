import { test, expect } from '@playwright/test';

test('backend health endpoint is reachable', async ({ request }) => {
  const response = await request.get('http://localhost:3000/api/health');
  const body = await response.json();

  expect(response.status()).toBe(200);
  expect(body).toMatchObject({
    ok: true,
    message: 'BuggyBoard API is running',
    database: 'connected',
  });
});
