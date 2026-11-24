# Set up attachments and review targets

When the user requests attachments, read the issue and its existing attachments first.
Reuse an attachment that already represents the requested file or URL instead of adding a duplicate.
Attach the requested file or URL to the issue, then verify that the saved attachment opens the intended content.
Discover supported attachment operations from the current provider contract and API routes before using the connector.
Do not infer upload payloads or endpoint paths from UI behavior.
If the required operation is not exposed through the connector, use the native Projektor UI within the same authorization scope.
If UI access is unavailable, report the specific setup step that remains blocked.

Review-target selection is separate from attachment creation.
Only issue attachments of kind `file` or `url` can be review targets, and each is selected independently.
Select only the attachments that require review for the requested work, not every attachment.
Leave unrelated reference material and wiki attachments unchanged.
In the issue detail, use the **レビュー対象** section to select each required attachment and set its status.
A newly selected target starts at `fixing`.
Deselecting a target removes it from review tracking without deleting the attachment.

| Target status       | UI label   | Meaning                               |
| ------------------- | ---------- | ------------------------------------- |
| `fixing`            | 修正中     | Work or corrections are in progress.  |
| `in_review`         | レビュー中 | The target is ready for review.       |
| `changes_requested` | 要修正     | Review feedback requires corrections. |
| `done`              | 完了       | Review is complete for this target.   |

These are per-target statuses, not issue statuses.
The issue-list **Review targets** summary shows an `in_review` target first and `+N` for additional visible targets.
Only `in_review` requires review now.
Targets in `fixing` or `changes_requested` remain visible with muted styling, without a review-now emphasis.
The `done` status remains saved, but completed targets are not displayed in review-target views or included in their counts, summaries, or `+N`.
This does not delete the attachment.
When the owning issue moves to `done`, its selected review targets automatically become `done` and disappear from review-target views and counts.
When the owning issue moves to `cancelled`, its review selection is cleared (`null`), but the attachments remain.
Reopening the issue does not automatically restore completed or cleared review selections.
Reconfigure targets explicitly when the reopened work requires review.
After closing or reopening an issue, read its attachments to verify the saved review state.
Open the summary or the issue's focused view with `?tab=review-targets` to inspect visible targets and their statuses, preserving existing URL query parameters.
Do not infer that all targets are complete from the summary alone.

Discover current API and provider support before attempting automation.
The [file routes](https://github.com/totto2727-org/projektor/blob/main/src/api/routes/files.ts) expose `GET /api/files` with `entityType=issue` and the issue UUID as `entityId` to list attachments, including `reviewStatus`.
Resolve the issue UUID and attachment ID from saved records, not an issue reference or a filename.
Use `PATCH /api/files/<attachment-id>/review-status` with `issueId` and `status` to select or update one target.
For example, replace the placeholder IDs and workspace slug before running:

```bash
oo connector proxy projektor \
  --endpoint '/api/files/<attachment-id>/review-status' \
  --method PATCH \
  --headers '{"X-Workspace-Slug":"example"}' \
  --body '{"issueId":"<issue-uuid>","status":"fixing"}' \
  --json
```

Use one of the four status values above, or `null` to deselect without deleting the attachment.
Do not send target-status fields in issue-update payloads.
Check both CLI and backend status, then GET the attachments again to verify the saved `reviewStatus`, including `done` targets hidden by the UI.
Use the native UI when the deployed API or connector does not expose the required operation.
Do not assume that a file-upload route makes multipart uploads available through the proxy, which accepts a JSON body.
Follow the provider contract's transport limits and use the native UI for unsupported uploads.
See the current [attachment input contracts](https://github.com/totto2727-org/projektor/blob/main/src/contracts/inputs/files.ts) and [review-target UI](https://github.com/totto2727-org/projektor/blob/main/src/web/features/issues/legacy/ReviewTargetsSection.tsx) when checking supported behavior.
After a change, verify the attachment, target selection, and saved status.

When an issue or a review target is **要修正** (`changes_requested`), read both the Projektor issue comments and feedback in the linked system's own review function before making corrections.
For example, a linked GitHub PR can have review comments that are absent from the Projektor issue.
Do not treat either location alone as the complete feedback record.
Address applicable feedback from both locations before returning the target to `in_review`, and preserve feedback history.
If either location is inaccessible, report the missing review context rather than claiming that all feedback was checked or resolved.
