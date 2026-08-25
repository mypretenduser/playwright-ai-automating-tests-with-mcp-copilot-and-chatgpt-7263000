# User Story

As a BuggyBoard user,
I want to delete bugs,
So that I can remove bugs that are incorrect or no longer needed.


# Design

- The "Edit bug" modal should have a "Delete" button.
- Clicking "Delete" should open a confirmation modal before the bug is removed.
- The confirmation modal should present a clear warning that the bug will be permanently deleted and include "Cancel" and "Delete bug" actions.
- Choosing "Cancel" should close the confirmation modal and leave the bug in place without making any changes.
- Confirming the deletion should remove the bug from the database, close the confirmation modal, and close the edit modal.


# Acceptance Criteria

Scenario: Edit bug modal displays a delete button
  Given the user is authenticated into the app
  And the user is on the board page
  And there are bugs in the database
  When the user opens the edit modal for a bug
  Then the modal displays a delete button

Scenario: Clicking delete opens a confirmation modal and cancel leaves the bug intact
  Given the user is authenticated into the app
  And the user is on the board page
  And there are bugs in the database
  When the user opens the edit modal for a bug
  And the user clicks the delete button
  Then a confirmation modal is displayed
  And the confirmation modal asks for confirmation before deleting the bug
  And the bug remains in the database
  And the board still displays that bug
  When the user chooses to cancel the confirmation
  Then the confirmation modal is closed
  And the edit modal remains open
  And the bug is still present in the database
  And the board still displays that bug

Scenario: Confirming delete removes the bug from the database and closes the modal
  Given the user is authenticated into the app
  And the user is on the board page
  And there are bugs in the database
  When the user opens the edit modal for a bug
  And the user clicks the delete button
  And the user confirms the deletion in the confirmation modal
  Then the bug is removed from the database
  And the confirmation modal is closed
  And the edit modal is closed
  And the board no longer displays that bug

