# Create Bug E2E Test Plan

## Goal

Validate the end-to-end behavior for creating a new bug in BuggyBoard, from opening the create-bug modal through validation, persistence, and close/cancel interactions.

## Scope

This plan covers the create-bug flow in the board page and the modal used to capture a new bug. It includes happy-path creation, required-field validation, default-value behavior, and modal-close semantics.

## Test setup and assumptions

- Start from a fresh application state unless the scenario explicitly requires pre-existing data.
- Use the seeded user from `users.json` (for example, `buggy` / `1970beetle`) to log in.
- Confirm the user is on the `/board` page before opening the create-bug modal.
- Assume the app uses the real browser UI and backend API, and that the modal should behave according to the product spec in `specs/features/06-create-bug.md`.

## Playwright MCP exploration notes

The live UI was explored through the Playwright browser tooling to confirm the actual behavior of the create-bug flow:

- The board page title bar contains a `New Bug` button.
- Clicking `New Bug` opens a modal with `role="dialog"` and `aria-modal="true"`.
- The modal contains four required fields: `Title`, `Severity`, `Owner`, and `Description`.
- `Severity` is a dropdown with options `HIGH`, `MID`, and `LOW`.
- The owner field defaults to the authenticated user.
- The save action submits to `/api/bugs` and closes the modal on success.
- Cancel, the close `X` button, and Escape all close the modal without saving.
- Clicking the back-drop does not close the modal.
- Validation failures show a list in a `role="alert"` with messages such as `Title is required.` and `Owner is required.`

## Test scenarios

### 1) User can open the create-bug modal from the board page

Steps:
1. Log in to BuggyBoard.
2. Navigate to the board page.
3. Click the `New Bug` button in the title bar.

Expected results:
- A create-bug modal appears.
- The modal includes fields for title, severity, owner, and description.
- The modal includes a Save button and a Cancel button.
- The modal is visually distinct from the board page and blocks interaction with the background.

### 2) Create-bug modal defaults owner to the current user

Steps:
1. Log in using the first user from users.json.
2. Go to the board page.
3. Click `New Bug`.

Expected results:
- The `Owner` field is pre-populated with the authenticated user name.
- The field is editable if the user wants to change it.
- The default severity is `MID` when the modal opens.

### 3) User can save a new bug with valid required fields

Steps:
1. Log in to BuggyBoard.
2. Open the create-bug modal.
3. Fill in the fields with valid values, for example:
   - Title: `Login fails with special characters`
   - Severity: `HIGH`
   - Owner: `buggy`
   - Description: `When I use < and > in my password, login fails.`
4. Click `Save`.

Expected results:
- The form submits successfully.
- The modal closes.
- The backend persists the bug with the entered title, severity, owner, and description.
- The new bug is saved with the expected values and does not remain in a draft state.

### 4) User can cancel creating a bug without saving

Steps:
1. Log in to BuggyBoard.
2. Open the create-bug modal.
3. Enter values into one or more fields.
4. Click `Cancel`.

Expected results:
- The modal closes.
- No new bug is created or saved.
- The modal state resets when reopened.

### 5) User can close the create-bug modal with the X button

Steps:
1. Log in to BuggyBoard.
2. Open the create-bug modal.
3. Enter values into one or more fields.
4. Click the `X` in the upper-right corner of the modal.

Expected results:
- The modal closes.
- The form is discarded.
- No bug is saved to the database.

### 6) User can close the create-bug modal with the Escape key

Steps:
1. Log in to BuggyBoard.
2. Open the create-bug modal.
3. Enter values into one or more fields.
4. Press `Escape`.

Expected results:
- The modal closes.
- No new bug is saved.
- The state is discarded, matching the cancel action.

### 7) Clicking outside the modal does not close it

Steps:
1. Log in to BuggyBoard.
2. Open the create-bug modal.
3. Enter values into one or more form fields.
4. Click the dimmed backdrop area outside the modal.

Expected results:
- The modal remains open.
- The data already entered stays in the form.
- The modal does not behave like a cancel action when the backdrop is clicked.

### 8) Save is blocked when required fields are blank

Steps:
1. Log in to BuggyBoard.
2. Open the create-bug modal.
3. Leave one or more required fields blank.
4. Click `Save`.

Expected results:
- The save is prevented.
- The modal remains open.
- Validation errors appear and identify the required field(s).
- No bug is saved to the database.

### 9) Each required field must not be blank

Steps:
1. Log in to BuggyBoard.
2. Open the create-bug modal.
3. For each field in the list below, test it individually:
   - Title
   - Severity
   - Owner
   - Description
4. Leave the selected field blank while filling all others with valid data.
5. Click `Save`.

Expected results:
- The save fails for the blank field.
- The modal stays open.
- The validation message for the missing field is displayed.
- No new bug is created for that invalid submission.

## Additional assertions for automation

- Use accessible selectors where possible, such as `getByRole('button', { name: 'New Bug' })`, `getByRole('dialog')`, and `getByLabel('Title')`.
- Confirm the modal uses a consistent design and close control as required by the design theme (`X` in the upper-right, Escape closes the modal).
- For API-level validation checks, assert that the request is not sent or that the response is a 400 with a clear message when required values are blank.
- For successful saves, assert that the request body includes trimmed values for `title`, `owner`, and `description` and a valid `severity` value.

## Success criteria

The create-bug feature is considered correct when all of the scenarios above pass in the live app and there are no unexpected database writes when the user cancels, closes via `X`, presses Escape, or submits blank required fields.
