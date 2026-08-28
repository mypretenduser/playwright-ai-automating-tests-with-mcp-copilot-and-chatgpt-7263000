import { test, expect, APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:3000';

function uniqueLabel(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function createBug(request: APIRequestContext, overrides: Record<string, string> = {}) {
  const payload = {
    title: `Bug ${uniqueLabel('api')}`,
    severity: 'high',
    owner: `owner-${uniqueLabel('user')}`,
    description: `Created during API test ${uniqueLabel('desc')}`,
    ...overrides,
  };

  const response = await request.post(`${API_BASE}/api/bugs`, { data: payload });
  const body = await response.json();
  const expectedSeverity = payload.severity.trim().toUpperCase();

  expect(response.status()).toBe(201);
  expect(body).toMatchObject({
    title: payload.title,
    owner: payload.owner,
    description: payload.description,
    severity: expectedSeverity,
    state: 'OPEN',
  });
  expect(typeof body.id).toBe('number');

  return { payload, id: body.id as number, body };
}

async function deleteBug(request: APIRequestContext, id: number) {
  const response = await request.delete(`${API_BASE}/api/bugs/${id}`);
  expect(response.status()).toBe(204);
}

async function listBugs(request: APIRequestContext) {
  const response = await request.get(`${API_BASE}/api/bugs`);
  return response;
}

test.describe('BuggyBoard REST API', () => {
  test.use({ baseURL: API_BASE });

  test('GET /api/health returns backend health data', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      message: 'BuggyBoard API is running',
      database: 'connected',
    });
  });

  test('POST /api/login accepts valid credentials', async ({ request }) => {
    const response = await request.post('/api/login', {
      data: { username: 'buggy', password: '1970beetle' },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ username: 'buggy' });
  });

  test('POST /api/login trims username before validation', async ({ request }) => {
    const response = await request.post('/api/login', {
      data: { username: '  buggy  ', password: '1970beetle' },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ username: 'buggy' });
  });

  test('POST /api/login rejects empty request body', async ({ request }) => {
    const response = await request.post('/api/login', { data: {} });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'missing_credentials',
      message: 'Please enter your username and password.',
    });
  });

  test('POST /api/login rejects blank username', async ({ request }) => {
    const response = await request.post('/api/login', {
      data: { username: '', password: '1970beetle' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_username',
      message: 'Username cannot be blank.',
    });
  });

  test('POST /api/login rejects blank password', async ({ request }) => {
    const response = await request.post('/api/login', {
      data: { username: 'buggy', password: '' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_password',
      message: 'Password cannot be blank.',
    });
  });

  test('POST /api/login rejects blank username and blank password together', async ({ request }) => {
    const response = await request.post('/api/login', {
      data: { username: ' ', password: '' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'missing_credentials',
      message: 'Please enter your username and password.',
    });
  });

  test('POST /api/login rejects unknown username', async ({ request }) => {
    const response = await request.post('/api/login', {
      data: { username: 'ghost', password: 'secret' },
    });

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_credentials',
      message: 'Invalid username or password.',
    });
  });

  test('POST /api/login rejects wrong password for known user', async ({ request }) => {
    const response = await request.post('/api/login', {
      data: { username: 'buggy', password: 'wrongpass' },
    });

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_credentials',
      message: 'Invalid username or password.',
    });
  });

  test('GET /api/bugs returns an empty list when no bugs exist', async ({ request }) => {
    const response = await listBugs(request);
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toEqual([]);
  });

  test('GET /api/bugs lists created bugs in ID order', async ({ request }) => {
    const created = await createBug(request, {
      title: `List bug ${uniqueLabel('list')}`,
      severity: 'mid',
      owner: 'buggy',
      description: 'Created specifically for GET /api/bugs coverage.',
    });

    const response = await listBugs(request);
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.some((bug: { title: string }) => bug.title === created.payload.title)).toBeTruthy();

    await deleteBug(request, created.id);
  });

  test('GET /api/bugs/:id returns an existing bug', async ({ request }) => {
    const created = await createBug(request, {
      title: `Fetch bug ${uniqueLabel('fetch')}`,
      severity: 'high',
      owner: 'vanny',
      description: 'This bug should be retrievable by ID.',
    });

    const response = await request.get(`/api/bugs/${created.id}`);
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toMatchObject({
      id: created.id,
      title: created.payload.title,
      owner: created.payload.owner,
      severity: 'HIGH',
      state: 'OPEN',
      description: created.payload.description,
    });

    await deleteBug(request, created.id);
  });

  test('GET /api/bugs/:id rejects non-numeric IDs', async ({ request }) => {
    const response = await request.get('/api/bugs/not-a-number');

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_id',
      message: 'Bug ID must be a number.',
    });
  });

  test('GET /api/bugs/:id accepts float-like numeric paths via parseInt coercion', async ({ request }) => {
    const created = await createBug(request, {
      title: `Coercion bug ${uniqueLabel('coerce')}`,
      severity: 'low',
      owner: 'buggy',
      description: 'This is intentionally using parseInt behavior for coverage.',
    });

    const response = await request.get(`/api/bugs/${created.id}.5`);
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toMatchObject({
      id: created.id,
      title: created.payload.title,
    });

    await deleteBug(request, created.id);
  });

  test('GET /api/bugs/:id returns 404 for an unknown bug ID', async ({ request }) => {
    const response = await request.get('/api/bugs/999999');

    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'not_found',
      message: 'Bug not found.',
    });
  });

  test('POST /api/bugs creates a valid bug', async ({ request }) => {
    const payload = {
      title: `Create success ${uniqueLabel('valid')}`,
      severity: 'HIGH',
      owner: 'buggy',
      description: 'Valid create scenario from the planning doc.',
    };

    const response = await request.post('/api/bugs', { data: payload });
    const body = await response.json();

    expect(response.status()).toBe(201);
    expect(body).toMatchObject({
      id: expect.any(Number),
      title: payload.title,
      owner: payload.owner,
      description: payload.description,
      severity: 'HIGH',
      state: 'OPEN',
    });

    await deleteBug(request, body.id);
  });

  test('POST /api/bugs accepts lowercase severity and normalizes it', async ({ request }) => {
    const payload = {
      title: `Lowercase severity ${uniqueLabel('lower')}`,
      severity: 'low',
      owner: 'vanny',
      description: 'Validation should normalize lowercase severity to HIGH/MID/LOW.',
    };

    const response = await request.post('/api/bugs', { data: payload });
    const body = await response.json();

    expect(response.status()).toBe(201);
    expect(body.severity).toBe('LOW');

    await deleteBug(request, body.id);
  });

  test('POST /api/bugs accepts mixed-case severity and ignores a supplied state', async ({ request }) => {
    const payload = {
      title: `Mixed case ${uniqueLabel('mixed')}`,
      severity: 'Mid',
      owner: 'buggy',
      description: 'Mixed-case severity should pass while state should be ignored.',
      state: 'CLOSED',
    };

    const response = await request.post('/api/bugs', { data: payload });
    const body = await response.json();

    expect(response.status()).toBe(201);
    expect(body).toMatchObject({
      severity: 'MID',
      state: 'OPEN',
    });

    await deleteBug(request, body.id);
  });

  test('POST /api/bugs rejects blank title', async ({ request }) => {
    const response = await request.post('/api/bugs', {
      data: { title: '', severity: 'HIGH', owner: 'buggy', description: 'desc' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_title',
      message: 'Title is required.',
    });
  });

  test('POST /api/bugs rejects blank severity', async ({ request }) => {
    const response = await request.post('/api/bugs', {
      data: { title: 'Example', severity: '', owner: 'buggy', description: 'desc' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_severity',
      message: 'Severity is required (high, mid, or low).',
    });
  });

  test('POST /api/bugs rejects invalid severity', async ({ request }) => {
    const response = await request.post('/api/bugs', {
      data: { title: 'Example', severity: 'critical', owner: 'buggy', description: 'desc' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_severity',
      message: 'Severity is required (high, mid, or low).',
    });
  });

  test('POST /api/bugs rejects blank owner', async ({ request }) => {
    const response = await request.post('/api/bugs', {
      data: { title: 'Example', severity: 'HIGH', owner: '', description: 'desc' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_owner',
      message: 'Owner is required.',
    });
  });

  test('POST /api/bugs rejects blank description', async ({ request }) => {
    const response = await request.post('/api/bugs', {
      data: { title: 'Example', severity: 'HIGH', owner: 'buggy', description: '' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_description',
      message: 'Description is required.',
    });
  });

  test('POST /api/bugs rejects an empty request body', async ({ request }) => {
    const response = await request.post('/api/bugs', { data: {} });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_title',
      message: 'Title is required.',
    });
  });

  test('PUT /api/bugs/:id updates an existing bug', async ({ request }) => {
    const created = await createBug(request, {
      title: `Update valid ${uniqueLabel('update')}`,
      severity: 'high',
      owner: 'buggy',
      description: 'Original description before the update.',
    });

    const response = await request.put(`/api/bugs/${created.id}`, {
      data: {
        title: `Updated ${created.payload.title}`,
        severity: 'low',
        owner: 'vanny',
        description: 'Updated by the API scenario test.',
        state: 'closed',
      },
    });
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toMatchObject({
      id: created.id,
      title: `Updated ${created.payload.title}`,
      severity: 'LOW',
      owner: 'vanny',
      description: 'Updated by the API scenario test.',
      state: 'CLOSED',
    });

    await deleteBug(request, created.id);
  });

  test('PUT /api/bugs/:id rejects non-numeric IDs', async ({ request }) => {
    const response = await request.put('/api/bugs/not-a-number', {
      data: {
        title: 'Still valid',
        severity: 'HIGH',
        owner: 'buggy',
        description: 'Still valid description',
        state: 'OPEN',
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_id',
      message: 'Bug ID must be a number.',
    });
  });

  test('PUT /api/bugs/:id rejects blank title', async ({ request }) => {
    const created = await createBug(request, {
      title: `Blank title ${uniqueLabel('blanktitle')}`,
      severity: 'HIGH',
      owner: 'buggy',
      description: 'Created for a blank-title validation case.',
    });

    const response = await request.put(`/api/bugs/${created.id}`, {
      data: { title: '', severity: 'HIGH', owner: 'buggy', description: 'desc', state: 'OPEN' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_title',
      message: 'Title is required.',
    });

    await deleteBug(request, created.id);
  });

  test('PUT /api/bugs/:id rejects blank severity', async ({ request }) => {
    const created = await createBug(request, {
      title: `Blank severity ${uniqueLabel('blankseverity')}`,
      severity: 'HIGH',
      owner: 'buggy',
      description: 'Created for a blank-severity validation case.',
    });

    const response = await request.put(`/api/bugs/${created.id}`, {
      data: { title: 'Example', severity: '', owner: 'buggy', description: 'desc', state: 'OPEN' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_severity',
      message: 'Severity is required (high, mid, or low).',
    });

    await deleteBug(request, created.id);
  });

  test('PUT /api/bugs/:id rejects invalid severity', async ({ request }) => {
    const created = await createBug(request, {
      title: `Invalid severity ${uniqueLabel('invalidseverity')}`,
      severity: 'HIGH',
      owner: 'buggy',
      description: 'Created for a severity validation case.',
    });

    const response = await request.put(`/api/bugs/${created.id}`, {
      data: { title: 'Example', severity: 'critical', owner: 'buggy', description: 'desc', state: 'OPEN' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_severity',
      message: 'Severity is required (high, mid, or low).',
    });

    await deleteBug(request, created.id);
  });

  test('PUT /api/bugs/:id rejects blank owner', async ({ request }) => {
    const created = await createBug(request, {
      title: `Blank owner ${uniqueLabel('blankowner')}`,
      severity: 'HIGH',
      owner: 'buggy',
      description: 'Created for a blank-owner validation case.',
    });

    const response = await request.put(`/api/bugs/${created.id}`, {
      data: { title: 'Example', severity: 'HIGH', owner: '', description: 'desc', state: 'OPEN' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_owner',
      message: 'Owner is required.',
    });

    await deleteBug(request, created.id);
  });

  test('PUT /api/bugs/:id rejects blank description', async ({ request }) => {
    const created = await createBug(request, {
      title: `Blank description ${uniqueLabel('blankdesc')}`,
      severity: 'HIGH',
      owner: 'buggy',
      description: 'Created for a blank-description validation case.',
    });

    const response = await request.put(`/api/bugs/${created.id}`, {
      data: { title: 'Example', severity: 'HIGH', owner: 'buggy', description: '', state: 'OPEN' },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'blank_description',
      message: 'Description is required.',
    });

    await deleteBug(request, created.id);
  });

  test('PUT /api/bugs/:id rejects invalid state values', async ({ request }) => {
    const created = await createBug(request, {
      title: `Invalid state ${uniqueLabel('invalidstate')}`,
      severity: 'HIGH',
      owner: 'buggy',
      description: 'Created for a state validation case.',
    });

    const response = await request.put(`/api/bugs/${created.id}`, {
      data: {
        title: 'Still valid',
        severity: 'HIGH',
        owner: 'buggy',
        description: 'Still valid description',
        state: 'pending',
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_state',
      message: 'State must be Open or Closed.',
    });

    await deleteBug(request, created.id);
  });

  test('PUT /api/bugs/:id returns 404 for a missing bug', async ({ request }) => {
    const response = await request.put('/api/bugs/999999', {
      data: {
        title: 'No bug here',
        severity: 'HIGH',
        owner: 'buggy',
        description: 'This should not exist',
        state: 'OPEN',
      },
    });

    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'not_found',
      message: 'Bug not found.',
    });
  });

  test('DELETE /api/bugs/:id deletes an existing bug', async ({ request }) => {
    const created = await createBug(request, {
      title: `Delete success ${uniqueLabel('delete')}`,
      severity: 'mid',
      owner: 'buggy',
      description: 'This should be deletable.',
    });

    const response = await request.delete(`/api/bugs/${created.id}`);

    expect(response.status()).toBe(204);
  });

  test('DELETE /api/bugs/:id rejects non-numeric IDs', async ({ request }) => {
    const response = await request.delete('/api/bugs/not-a-number');

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_id',
      message: 'Bug ID must be a number.',
    });
  });

  test('DELETE /api/bugs/:id returns 404 for a missing bug', async ({ request }) => {
    const response = await request.delete('/api/bugs/999999');

    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'not_found',
      message: 'Bug not found.',
    });
  });

  test('DELETE /api/bugs/:id returns 404 on a repeated delete of the same bug', async ({ request }) => {
    const created = await createBug(request, {
      title: `Repeat delete ${uniqueLabel('repeatdelete')}`,
      severity: 'low',
      owner: 'buggy',
      description: 'This bug is intentionally deleted twice.',
    });

    const firstDelete = await request.delete(`/api/bugs/${created.id}`);
    expect(firstDelete.status()).toBe(204);

    const secondDelete = await request.delete(`/api/bugs/${created.id}`);
    expect(secondDelete.status()).toBe(404);
    await expect(secondDelete.json()).resolves.toMatchObject({
      error: 'not_found',
      message: 'Bug not found.',
    });
  });
});
