---
name: manage-evidence-and-deliverables
description: "Attach evidence, run the evidence-collection workflow (solicitudes + packages), and manage files and deliverables for a Sekit client over the consultant MCP. Link evidence to a risk or control evaluation, request evidence from a client and review their submissions, group requests into released waves, upload client files and artifacts via the two-step presigned flow, and govern deliverables from draft to approved. Use when the user wants to back a risk or control with evidence, ask a client for a document (an evidence request or solicitud), review a submission, create or release an evidence package or wave, generate an evidence plan from a gap analysis, upload a document or screenshot for a Sekit client, produce or track a deliverable such as a gap report, policy, risk register, ROPA, or IR plan, approve or revert a deliverable, or manage a client's files. Read the sekit-mcp-guide skill first."
---

# Manage evidence + deliverables

Three related jobs over the Sekit consultant MCP: **(A) evidence** — linking proof to a risk or
control evaluation; **(B) files + deliverables** — uploading client files and producing,
governing, and approving artifacts; and **(C) solicitudes + packages** — the client-facing
collection workflow (ask a client for evidence, group asks into released waves, review what
comes back). Read **sekit-mcp-guide** first.

> **A vs C — don't confuse them.** `create_evidence` (A) records that a *thing you already
> have* proves a verdict. An **evidence request / solicitud** (C) *asks the client to produce*
> that thing. Collection (C) is the front half; attaching the result as evidence (A) is the
> back half.

## A. Evidence

Evidence links a **source** to a **target** (a Risk or a ControlEvaluation), so a verdict is
backed by something concrete.

`create_evidence` **required**: `client_organization_id`, `evidenceable_type`
(`Risk` | `ControlEvaluation`), `evidenceable_id` (the target's id, same client), and `kind`.
The **source field is determined by `kind`** (Sekit returns a 422 on a mismatch):

| `kind` | Source field to also pass | Meaning |
|---|---|---|
| `client_file` | `client_file_id` | an uploaded file (see B) |
| `wiki` | `wiki_path` | a knowledge-base page (see manage-knowledge-base) |
| `inference` | `body` | your reasoned conclusion (free text) |
| `artifact` | `artifact_id` | a deliverable (see B) |

Optional: `confidence` (`high`/`medium`/`low`, defaults `medium`), `collected_at` (ISO-8601;
omit to record now — set it only to backfill historical evidence). The collecting user comes
from the authenticated connector identity.

- `list_evidence` / `get_evidence` to review what's attached.
- `update_evidence(..., evidence_id=<id>)` — PATCH; the **target is immutable** (re-targeting is
  a new row). When changing `kind`, pass the matching source field in the same call.
- `archive_evidence` / `restore_evidence` — soft-delete / undo.

**Typical flow:** create a risk or CE → decide what proves it → `create_evidence` with the right
`kind`. For a documented control, that's usually `kind="client_file"` (the policy PDF) or
`kind="wiki"` (a KB page); for a judgement call, `kind="inference"` with your reasoning in
`body`.

## B. Files + deliverables

### Uploading bytes — the two-step presigned flow

Both client files and artifacts upload the same way: **the file bytes never pass through the
model.** You request a presigned grant, then PUT the raw bytes to it.

> **Prerequisite:** this requires the ability to PUT bytes to a URL (a shell/`curl`, a code/fetch
> tool, or the host doing the upload). In a chat host with no byte-upload tool, do the
> PUT step outside the chat (or use the web UI to upload), then link the resulting id. Don't try
> to inline/base64 the bytes through a tool argument — that's explicitly unsupported.

1. Compute the file's `byte_size` and a **base64-encoded MD5 `checksum`** of the bytes.
2. **`prepare_client_file_upload`** (or `prepare_artifact_upload`) with `filename`,
   `content_type`, `byte_size`, `checksum`. Returns
   `{signed_id, direct_upload: {url, headers}}`.
3. **PUT the raw bytes** to `direct_upload.url`, echoing **every** header in
   `direct_upload.headers` (Content-Type, and Content-MD5 on S3-backed stores). The presigned PUT
   pins the checksum — a mismatched upload is rejected.
4. **`create_client_file_from_upload`** (or `create_artifact_from_upload`) with the `signed_id`
   verbatim to link the blob to a row.

### Client files

`create_client_file_from_upload(client_organization_id, signed_id, kind, description?)` — `kind`
is `transcript` | `policy_pdf` | `screenshot` | `config_export` | `contract` | `image` |
`other`. Manage with `list_client_files` / `get_client_file` / `update_client_file` /
`archive_client_file` / `restore_client_file`. The returned row's `id` is the `client_file_id`
you pass to `create_evidence(kind="client_file", ...)`.

### Artifacts (deliverables)

An artifact is a governed deliverable (gap report, policy, risk register, DPA, ROPA, IR plan,
runbook, …) with a **Document Control Block** and an approval lifecycle.

`create_artifact_from_upload` **required**: `client_organization_id`, `signed_id`,
`document_id_string`, `kind`, `classification`, `owner_name`, `title`. It lands as **`draft`**.

- `document_id_string` — the client's Document Control Block identifier (a structured code, e.g.
  `RPT-SW11-GAP-2026-05-001`). Follow the client's documentation-control scheme; **ask the user**
  if you don't have it rather than inventing one.
- `kind` — `policy` | `gap_report` | `risk_register` | `dpa` | `ropa` | `ir_plan` | `runbook` |
  `other`. For authoring a ROPA end-to-end (gather → draft → deliver), see **generate-ropa**.
- `classification` — `public` | `internal` | `confidential` | `strictly_confidential`.
  **`handling` is required** when classification is `confidential` or `strictly_confidential`.
- `document_version` defaults to `v1.0`. `supersedes_id` links a new version to the one it
  replaces (supersede chain). `assessment_id` / `supersedes_id` must belong to the same client.
- `status`, `approver_name`, `effective_date`, `approved_at` are **server-controlled** — never
  set them here; they transition via approve/revert.

Update with `update_artifact(..., artifact_id=<id>)` (PATCH; pass a new `signed_id` to re-attach
a file — the old blob is purged). Review with `list_artifacts` / `get_artifact` (each carries
`download_url`).

### Approval governance

- **`approve_artifact(client_organization_id, artifact_id)`** — `draft → approved`. **Owner-only**
  (a `member` gets a clean `forbidden`), idempotent. Stamps `approver_name` (your email),
  `effective_date` (today), `next_review_date` (+6 months), `approved_at`.
- **`revert_artifact_approval`** — `approved → draft`.
- `archive_artifact` / `restore_artifact` — soft-delete / undo.

> Approval is a real governance action. Only approve when the user explicitly tells you to, and
> confirm the artifact + client first (see Safety in sekit-mcp-guide).

## C. Solicitudes (evidence requests) + packages

The collection workflow: **ask the client for evidence**, group asks into **packages**
released one **wave** at a time, and **review** what comes back. Several tools here **reach the
client** (portal visibility + email) — they are marked **CLIENT-FACING** below and must be
treated as egress: confirm the client, the assigned contact, and the content before firing.

### A request vs a package — when to use which

- **One-off ask →** `create_evidence_request`. Use it for an ad-hoc "please upload X" or
  "confirm you did Y". `kind` is `upload_evidence` (a document) or `confirm_task` (a
  done-check). It starts **queued** (not client-visible). Optionally link it to a control
  evaluation or gap analysis (`control_evaluation_id` / `gap_analysis_id`, same-client), assign
  a contact, or set a due date. Edit later with `update_evidence_request` (title, instructions,
  due date, contact, or a legal `status` move).
- **A themed batch →** a **package**. Every request belongs to exactly one package; a package
  is the unit you release and track. `create_evidence_package` (born `draft`, name = the theme,
  e.g. «Control de accesos»), `update_evidence_package` (rename, set assignee + due date — a
  package assignee inherits down to member asks that lack their own contact),
  `list_evidence_packages` / `get_evidence_package` (each carries collection rollups:
  `asks_done`/`asks_total` and `answered_legs`/`total_legs` — **collection progress, never
  posture**). Move an ask between packages or re-order it with `set_evidence_request_package`
  (`position` is 0-based).

### Releasing — the wave metaphor (CLIENT-FACING)

Nothing reaches the client until you **release** it. Two granularities:

- **`release_wave`** (CLIENT-FACING) — the "Liberar ahora" action. Promotes the next queued
  requests (oldest wave/position first) to fill the client's active pacing window (default 8
  concurrent), or one full batch when `force=true`. Each promoted request becomes
  portal-visible and triggers its release email. **Prefer this** — it respects the client's
  pacing so you don't flood them.
- **`release_evidence_request`** (CLIENT-FACING) — release ONE request now, bypassing the
  pacing window. **`release_evidence_package`** (CLIENT-FACING) — release a whole draft package
  (flips `draft → released`, makes members portal-visible, emails the contact).
- A release with **no assigned contact is refused** (`validation_error`) — assign one first
  (`update_evidence_request` / `update_evidence_package`). Releases are **idempotent**: a second
  call on an already-released request/package is a clean no-op (no second email).

Lifecycle the package through `release_evidence_package` → `close_evidence_package` (end a wave
early — cancels the client-actionable asks so they vanish from the portal; optional `reason`) →
`reopen_evidence_package` (revisit a finished/closed wave — resets nudge counters). The
standing «Otros» package can't be closed.

### The review-verdict loop

Once the client submits, read the result (`get_evidence_request` for the full timeline +
submissions; `get_submission_markdown` for one submission's extracted text), then record your
verdict with **`review_evidence_request`**:

- `verdict` is `accepted`, `correction_requested`, or `rejected`.
- `submission_id` names **which** submission you're judging (from the request's `submissions`
  array).
- **`correction_requested` / `rejected` REQUIRE a non-blank `reason`** (shown to the client);
  `accepted` does not. The verdict must be a legal transition from the request's current status.

Talk to the client on the thread: **`post_thread_message`** (CLIENT-FACING) — pass
`evidence_request_id` to post on that request's thread (client sees it in the portal), or omit
it to post to the client-level general thread. `list_thread` reads the interleaved timeline
(messages + lifecycle events). Once a submission is accepted, close the loop back to section A:
attach it as evidence with `create_evidence(kind="client_file", ...)` so the verdict it backs
is provable.

`archive_evidence_request` / `restore_evidence_request` soft-delete / undo (owner-only).

### Generating requests directly from a gap analysis

Building the full evidence PLAN (themed draft packages) is an AI-only action — the Sekura
evidence strategist owns it, driven from the console («Preparar plan con Sekura»); there is no
deterministic instantiator MCP tool (the old `instantiate_evidence_plan` was retired
2026-07-20). What remains here is the deterministic per-control request generator:

- **`generate_evidence_requests(client_organization_id, gap_analysis_id, ...)`** — turns the
  analysis's eligible control evaluations into pending requests (no AI). Every field is optional
  (a bare call generates from ALL eligible CEs). Tune with `wave_size` (how many to open this
  batch), `due_date` (ISO `YYYY-MM-DD`, shared by the batch), `client_contact_id` /
  `assignee_asset_id` (routing), and **`control_evaluation_ids`** to curate WHICH controls.
  **The `control_evaluation_ids` distinction is load-bearing: OMIT the field to generate from
  ALL eligible CEs; pass an explicit `[]` to generate NONE.** (Omitting ≠ empty array — don't
  send `[]` when you mean "all".)

## Constraints

- Evidence `kind` must match its source field; target (`evidenceable_type`/`_id`) is immutable.
- Upload is two-step; bytes go to the presigned URL, never through a tool argument.
- Artifacts land `draft`; lifecycle fields are server-controlled; `approve_artifact` is
  owner-only.
- `handling` required for confidential / strictly_confidential artifacts.
- Evidence requests start **queued**; nothing reaches the client until you **release**
  (`release_wave` / `release_evidence_request` / `release_evidence_package`), and a release with
  no assigned contact is refused.
- `review_evidence_request` `correction_requested` / `rejected` **require a `reason`**;
  `release_*` and `post_thread_message` are **client-facing** (portal + email).
- `generate_evidence_requests`: OMIT `control_evaluation_ids` for all eligible, pass `[]` for
  none.
