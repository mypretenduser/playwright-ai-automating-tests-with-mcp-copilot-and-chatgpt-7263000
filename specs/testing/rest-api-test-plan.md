# BuggyBoard REST API Test Plan

## Goal

Validate that the BuggyBoard backend routes under `/api` behave according to the implementation in `backend/src/index.ts`, `backend/src/authService.ts`, and `backend/src/bugService.ts`.

## Scope

This plan covers every explicit backend endpoint currently implemented in the app:

- `GET /api/health`
- `POST /api/login`
- `GET /api/bugs`
- `GET /api/bugs/:id`
- `POST /api/bugs`
- `PUT /api/bugs/:id`
- `DELETE /api/bugs/:id`

The test plan intentionally includes both successful and failing cases, with expected HTTP status codes and response payloads based on the current code.

## Test assumptions and setup

- Run the backend on `http://localhost:3000`.
- Start from a fresh or known SQLite state before each scenario to avoid cross-test contamination.
- Use valid seeded credentials from `users.json` when testing login:
  - `buggy` / `1970beetle`
  - `vanny` / `1979bus`
- Valid bug payloads are shaped as:
  - `title`: required string
  - `severity`: required string, accepted values `high`, `mid`, `low` or uppercase equivalents
  - `owner`: required string
  - `description`: required string
  - `state`: optional for create; required for update and must be `open` or `closed` or uppercase equivalents
- Field values are trimmed before validation, and bug records are saved with severity/state normalized to uppercase.

## Endpoint tests

### 1) GET /api/health

Purpose: returns backend health and database status.

Positive cases:
- Send a `GET /api/health` request when the database is available.
- Expected result:
  - HTTP `200 OK`
  - JSON body contains `ok: true`
  - `message` equals `BuggyBoard API is running`
  - `database` equals `connected`
- Validate the response shape and that the server is reachable.

Negative/edge cases:
- Simulate a database failure and verify the route still responds with `200 OK` while `database` becomes `error`.
- Verify the endpoint does not return an error status even when the DB probe fails; the app intentionally sets `database` to `error` instead of failing the HTTP request.

### 2) POST /api/login

Purpose: authenticate a user by username and password.

Positive cases:
- Valid credentials: `{ "username": "buggy", "password": "1970beetle" }`
  - Expected: HTTP `200 OK`
  - Response: `{ "username": "buggy" }`
- Valid credentials with leading/trailing whitespace around the username: `{ "username": "  buggy  ", "password": "1970beetle" }`
  - Expected: HTTP `200 OK`
  - Response: `{ "username": "buggy" }`
- Ensure the login logic accepts the exact seeded user and trims the username before matching.

Negative cases:
- Empty body: `{}`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "missing_credentials", "message": "Please enter your username and password." }`
- Blank username only: `{ "username": "", "password": "1970beetle" }`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "blank_username", "message": "Username cannot be blank." }`
- Blank password only: `{ "username": "buggy", "password": "" }`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "blank_password", "message": "Password cannot be blank." }`
- Blank username and blank password: `{ "username": " ", "password": "" }`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "missing_credentials", "message": "Please enter your username and password." }`
- Unknown username: `{ "username": "ghost", "password": "secret" }`
  - Expected: HTTP `401 Unauthorized`
  - Response: `{ "error": "invalid_credentials", "message": "Invalid username or password." }`
- Wrong password for a valid user: `{ "username": "buggy", "password": "wrongpass" }`
  - Expected: HTTP `401 Unauthorized`
  - Response: `{ "error": "invalid_credentials", "message": "Invalid username or password." }`
- Missing or non-string input fields (such as `username: 123` or `password: null`) should be treated as blank or invalid according to the default values in the route logic.

### 3) GET /api/bugs

Purpose: list all bugs in database order.

Positive cases:
- Empty database:
  - Expected: HTTP `200 OK`
  - Response: `[]`
- One or more bugs exist:
  - Expected: HTTP `200 OK`
  - Response: JSON array of bug objects, ordered by `id` ascending
- Each bug object includes:
  - `id`
  - `title`
  - `severity`
  - `owner`
  - `description`
  - `state`

Negative/edge cases:
- A fresh database should return an empty list, not an error.
- If data is malformed in the database, the route does not sanitize it; this is a backend robustness gap worth checking during integration tests, but it is not explicitly handled in code.

### 4) GET /api/bugs/:id

Purpose: fetch a single bug by numeric ID.

Positive cases:
- Retrieve a valid existing bug by ID such as `/api/bugs/1`.
  - Expected: HTTP `200 OK`
  - Response: the bug object for that record
- Retrieve a bug immediately after creating one through `POST /api/bugs` and verify the same fields and state are returned.

Negative cases:
- Non-numeric ID: `/api/bugs/abc`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "invalid_id", "message": "Bug ID must be a number." }`
- Missing or invalid numeric path such as `/api/bugs/-1` or `/api/bugs/1.5`
  - The current code uses `parseInt`, so `1.5` converts to `1` and may be treated as valid instead of rejected. That is a useful regression test to catch the current coercion behavior.
- Non-existent ID: `/api/bugs/999999`
  - Expected: HTTP `404 Not Found`
  - Response: `{ "error": "not_found", "message": "Bug not found." }`

### 5) POST /api/bugs

Purpose: create a new bug.

Positive cases:
- Valid payload:
  - `{ "title": "Login button hidden on mobile", "severity": "HIGH", "owner": "buggy", "description": "The button is clipped on small screens." }`
  - Expected: HTTP `201 Created`
  - Response includes a generated numeric `id`, the same normalized title/owner/description, `severity` as uppercase, and `state: "OPEN"`
- Valid payload with lowercase severity: `{ "severity": "high" }`
  - Expected: HTTP `201 Created`
  - The service normalizes severity to uppercase before saving
- Valid payload with uppercase or mixed-case severity values (`HIGH`, `Mid`, `LOW`) should also pass because the service trims and uppercases the input.
- Verify the new record is visible in `GET /api/bugs` and `GET /api/bugs/:id` immediately after creation.

Negative cases:
- Blank title: `{ "title": "", "severity": "HIGH", "owner": "buggy", "description": "something" }`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "blank_title", "message": "Title is required." }`
- Blank severity: `{ "title": "Test", "severity": "", "owner": "buggy", "description": "something" }`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "blank_severity", "message": "Severity is required (high, mid, or low)." }`
- Invalid severity: `{ "title": "Test", "severity": "critical", "owner": "buggy", "description": "something" }`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "blank_severity", "message": "Severity is required (high, mid, or low)." }`
- Blank owner: `{ "title": "Test", "severity": "HIGH", "owner": "", "description": "something" }`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "blank_owner", "message": "Owner is required." }`
- Blank description: `{ "title": "Test", "severity": "HIGH", "owner": "buggy", "description": "" }`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "blank_description", "message": "Description is required." }`
- Missing full body or missing fields: `{}`
  - Expected: HTTP `400 Bad Request`
  - Response should fail with the corresponding blank-field error for the first missing required field in code order: title, severity, owner, description
- Non-string data for required fields should be treated as blank values because the route uses `typeof body.field === "string" ? body.field : ""`
- State should not be accepted on create. A payload such as `{ ..., "state": "CLOSED" }` is ignored, and the created bug should still be stored with `state: "OPEN"`.

### 6) PUT /api/bugs/:id

Purpose: update an existing bug record.

Positive cases:
- Valid update of an existing bug:
  - Example path `/api/bugs/1`
  - Body:
    - `{ "title": "Updated title", "severity": "low", "owner": "vanny", "description": "Updated description", "state": "closed" }`
  - Expected: HTTP `200 OK`
  - Response contains the updated record with uppercase `severity` and `state`
- Confirm values are trimmed and normalized before the database update.
- Confirm the update can toggle `state` between `OPEN` and `CLOSED`.

Negative cases:
- Non-numeric ID: `/api/bugs/abc`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "invalid_id", "message": "Bug ID must be a number." }`
- Non-existent ID: `/api/bugs/999999`
  - Expected: HTTP `404 Not Found`
  - Response: `{ "error": "not_found", "message": "Bug not found." }`
- Blank title: valid bug ID, but empty or whitespace title
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "blank_title", "message": "Title is required." }`
- Blank severity: empty or invalid `severity`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "blank_severity", "message": "Severity is required (high, mid, or low)." }`
- Invalid severity: `severity: "urgent"`
  - Expected: HTTP `400 Bad Request`
- Blank owner: empty or whitespace `owner`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "blank_owner", "message": "Owner is required." }`
- Blank description: empty or whitespace `description`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "blank_description", "message": "Description is required." }`
- Blank/invalid state: `{ "state": "" }` or `{ "state": "pending" }`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "invalid_state", "message": "State must be Open or Closed." }`
- Empty body: `{}`
  - Expected: HTTP `400 Bad Request`
  - Response should reflect the first failing validation in the same order used in the service logic

### 7) DELETE /api/bugs/:id

Purpose: delete an existing bug record.

Positive cases:
- Delete an existing bug using a valid numeric ID.
  - Expected: HTTP `204 No Content`
  - Response body should be empty
- Verify the bug disappears from `GET /api/bugs` and `GET /api/bugs/:id` after deletion.
- Delete a bug created in a previous scenario and confirm the list shrinks by one entry.

Negative cases:
- Non-numeric ID: `/api/bugs/abc`
  - Expected: HTTP `400 Bad Request`
  - Response: `{ "error": "invalid_id", "message": "Bug ID must be a number." }`
- Non-existent ID: `/api/bugs/999999`
  - Expected: HTTP `404 Not Found`
  - Response: `{ "error": "not_found", "message": "Bug not found." }`
- Delete the same bug twice in a row:
  - First call returns `204`
  - Second call returns `404` with `not_found`

## Cross-checks for backend correctness

The following checks should be included in the API suite to catch mismatches between the contract and the implementation:

- Confirm the route prefixes are always `/api` and not `/bugs` or `/login` without the prefix.
- Validate that success responses use the documented HTTP codes:
  - `health`: `200`
  - `login`: `200`
  - `create bug`: `201`
  - `list bugs`: `200`
  - `get bug`: `200`
  - `update bug`: `200`
  - `delete bug`: `204`
- Validate that all error payloads are JSON objects with `error` and `message` keys when the route handles validation or not-found conditions.
- Check that severity values are normalized to uppercase (`HIGH`, `MID`, `LOW`) in database-backed responses and persisted records.
- Check that state values are normalized to uppercase (`OPEN`, `CLOSED`) for update and retrieval operations.
- Confirm the app trims whitespace before validating required strings; this is especially important for `username`, `title`, `owner`, and `description` values.
- Validate that `POST /api/bugs` ignores an incoming `state` value, because the route creates every new bug with `state` fixed to `OPEN`.

## Exit criteria

The BuggyBoard REST API is considered fully tested when all positive and negative scenarios above pass, the status codes match the backend implementation, and the API responses match the business rules in the service layer without unexpected regressions.
