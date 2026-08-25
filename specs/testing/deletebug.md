# Delete Bug E2E Test Plan

## Goal

Validate the end-to-end delete flow for BuggyBoard so the bug is only removed after explicit confirmation, while cancel/close actions leave the bug intact.

## Scope

This plan covers the delete-bug flow from the Edit Bug modal through confirmation, cancellation, and final deletion behavior. It is based on the authoritative product behavior in `specs/features/12-delete-bug.md` and on the live UI behavior of the BuggyBoard app.

## Test setup and assumptions

- Start from a fresh or known application state unless the scenario explicitly requires pre-existing data.
- Use the seeded user from `users.json` (for example, `buggy` / `1970beetle`) to log in.
- Confirm the user is on the `/board` page before opening the Edit Bug modal.
- Ensure the board contains at least one bug to edit and delete.
- Treat the delete confirmation as a required safety gate before any bug is removed from the database.

## Existing automated tests review

- The repository currently has no dedicated deletion automation under `tests/` or page-object/helper files for bug deletion.
- The existing Playwright tests are generic smoke checks and do not cover the delete flow.
- This plan fills in the missing end-to-end coverage for the changed delete-confirmation behavior.

## Playwright MCP exploration notes

The live UI was reviewed to confirm the behavior of the delete flow:

- Clicking a bug row opens the Edit bug modal.
- The Edit bug modal contains a `Delete` button.
- Clicking `Delete` opens a second modal with a confirmation message and actions such as `Cancel` and `Delete bug`.
- The confirmation modal warns that the bug will be permanently deleted.
- The edit modal remains visible while the confirmation is open unless the user confirms or closes the confirmation.
- Cancel, the close `X`, and Escape close the confirmation without removing the bug.
- Confirming the delete removes the bug from the board and closes the edit modal.

## Test scenarios

### 1) User can initiate deletion from the Edit Bug modal

Steps:
1. Log in to BuggyBoard.
2. Navigate to the board page.
3. Click a bug row to open the Edit bug modal.
4. Click the `Delete` button.

Expected results:
- A confirmation modal appears.
- The confirmation modal clearly states that the bug will be permanently deleted.
- The Edit bug modal remains open behind the confirmation dialog.
- No bug is removed from the database before the user confirms.

### 2) Canceling the confirmation leaves the bug unchanged and keeps the Edit modal open

Steps:
1. Log in to BuggyBoard.
2. Open the Edit bug modal for an existing bug.
3. Click `Delete`.
4. Click `Cancel` in the confirmation modal.

Expected results:
- The confirmation modal closes.
- The Edit bug modal remains open.
- The bug is still present in the database.
- The bug still appears on the board.
- No deletion request is recorded.

### 3) Closing the confirmation modal without deleting leaves the bug unchanged

Steps:
1. Log in to BuggyBoard.
2. Open the Edit bug modal for an existing bug.
3. Click `Delete`.
4. Dismiss the confirmation modal by using the `X` close control or the Escape key.

Expected results:
- The confirmation modal closes.
- The Edit bug modal remains open.
- The bug remains in the database.
- The bug still appears on the board.
- No data loss occurs.

### 4) Confirming the deletion removes the bug

Steps:
1. Log in to BuggyBoard.
2. Open the Edit bug modal for an existing bug.
3. Click `Delete`.
4. Confirm the delete in the confirmation modal by clicking `Delete bug`.

Expected results:
- The confirmation modal closes.
- The Edit bug modal closes.
- The bug is removed from the database.
- The bug no longer appears on the board.
- The board refreshes to reflect the deletion.

### 5) Confirmation modal dismissals do not delete the bug

Steps:
1. Log in to BuggyBoard.
2. Open the Edit bug modal for a bug.
3. Click `Delete`.
4. Run each dismissal path below:
   - Click `Cancel`
   - Click the confirmation `X`
   - Press `Escape`

Expected results:
- The confirmation modal closes each time.
- The bug is never deleted as a result of dismissal alone.
- The Edit bug modal stays open and is still editable.
- The underlying bug record remains present.

## Additional assertions for automation

- Use accessible selectors where possible, such as `getByRole('button', { name: 'Delete' })`, `getByRole('dialog')`, and `getByRole('button', { name: 'Delete bug' })`.
- Assert that the bug is still present before confirmation by checking both the database-backed API and the board UI.
- After confirmation, assert the board no longer contains the deleted bug title or ID and that the edit modal is closed.
- Validate that Escape and the close button have the same effect as Cancel: close without deleting.
- Confirm the confirmation flow blocks the destructive action until user intent is explicit.

## Success criteria

The delete-bug feature is considered correct when all scenarios above pass in the live app, the confirmation modal appears before deletion, and all dismiss/cancel paths leave the bug intact while only the confirmed path removes it.
