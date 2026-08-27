---
name: analyze-risks
description: "Build, update, or triage a Sekit client's risk register over the consultant MCP. Identify risks, set likelihood and impact (severity is computed from them), pick treatment and owner when decided, write a two-layer technical-plus-business description, link evidence, and create or update each risk. Track each remediation action's status, owner, phase and target date with the per-action tools. Use whenever the user wants to add risks for a Sekit client, review or update a client's risk register, mark remediation progress, list or move remediation actions, approve a risk, or asks what the risks or open actions are for a client. Framework-agnostic. Read the sekit-mcp-guide skill first."
---

# Analyze risks

Drive a client's **risk register** through the Sekit consultant MCP. Read **sekit-mcp-guide**
first — connection, the `whoami → list_clients` orientation protocol, error/result shapes, and
the safety rules all apply here.

## When to use

The user wants to add risks to a client, review/refresh a register, record remediation progress
(on a risk or on one of its actions), see or move the client's remediation plan, or approve a
risk. You are the consultant's hands — you propose, they decide. Don't fabricate risks; ground
each one in evidence (the client wiki, control evaluations, declared facts).

## Process

### 1. Orient + resolve the client

`whoami` → `list_clients`; resolve the `client_organization_id` for the client the user named
(confirm if ambiguous).

### 2. Gather context (don't invent)

- **`list_risks(client_organization_id)`** — the existing register. Read it to refresh rather
  than re-create (and to avoid duplicating an `external_id` if you pass your own).
- **`list_risk_actions(client_organization_id)`** — the client-wide remediation plan: every
  action across the kept risks with its status, owner, phase and target date (step 5). Read it
  for "what is still open / who owns what / what is due" instead of walking `list_risks` risk
  by risk.
- **Knowledge base** — `wiki_search` / `wiki_read` for what's already known about this client
  (posture, prior findings, OSINT). See **manage-knowledge-base**.
- **Control posture** — `list_control_evaluations(client_organization_id)` and
  `list_gap_analyses(...)` for gaps that should surface as risks.

Each risk you write should trace to something concrete — cite it.

### 3. Shape each risk

`create_risk` **required** fields (SK-345 — only the content the consultant knows on
detection day):

| Field | Notes |
|---|---|
| `client_organization_id` | from `list_clients` |
| `title` | short label, ≤ ~8 words |
| `description` | the risk itself |
| `likelihood` | integer **1–5** |
| `impact` | integer **1–5** |
| `impact_type` | `financial` \| `operational` \| `human_personal` \| `legal_regulatory` \| `reputational` \| `environmental_vital` |

**Never send `severity`** — it is COMPUTED server-side from likelihood × impact
under the client's own band thresholds (read them off the client resource:
`risk_band_critical` / `risk_band_high` / `risk_band_medium`; the product
default is 20/12/6) and returned on every read. Do not hardcode the bands:
two clients can band the same score differently.

Useful **optional** fields:

- `external_id` — OMIT it to have the server assign the next `R-NNN` for the client
  (numbers are never recycled; archived risks keep theirs). Pass one only when the client
  brings its own register ids (then it must be **unique per client** — check `list_risks`).
  Editable later via `update_risk`.
- `detected_date` — ISO-8601 (e.g. `"2026-06-09"`); defaults to today. Editable later.
- `treatment` (`mitigate` \| `accept` \| `transfer` \| `avoid`) — later TRIAGE: omit it
  until the consultant decides; `null` on `update_risk` sends a risk back to undecided.
- `owner_asset_id` — the risk's owner, as a REFERENCE to one of THIS client's assets of
  type `person` or `third_party` (find the id with `list_assets`). Never invent a person:
  if nobody in the inventory fits, leave it unset and say so. A `system` asset, an asset
  of another client, and an archived asset are all rejected. `null` on `update_risk`
  clears the owner. The free-text `owner_name` and the `owner_type` category it replaces
  are gone — sending either does nothing at all (this door strips unknown keys silently
  rather than erroring, so a stale habit fails invisibly).
- `status` (`open` default \| `in_progress` \| `closed`), `remediation_progress` (0–100),
  `target_date`, `review_date`, `detected_by`, `confidence`
  (`high`/`medium`/`low`, default `medium`).
- `residual_likelihood` / `residual_impact` — integers **1–5**, the TARGET post-treatment
  pair (the register's "inherent → residual" story). Set them ONLY when the consultant
  states or approves the estimate — never derive or invent the numbers yourself; when in
  doubt, leave them unset and ask. The residual score is computed server-side — don't
  send it. An explicit `null` clears an estimate.
- `acceptance_rationale` — WHY a `treatment: "accept"` risk is accepted (owner, conditions,
  review horizon). Printed verbatim in the risk report's acceptance register, so write it
  for the client's management. Only meaningful with `treatment: "accept"`.
- `recommended_actions` — the remediation plan as a list of CONTENT items
  `{action, effort, validates_when}` (plus the row `id` on update — see step 4). `effort`
  MUST be `low`/`medium`/`high` (SK-348 — the same shared vocabulary as `estimated_effort`;
  free text is rejected with a 422). Never send `effort_note`: it is reserved for
  pre-vocabulary text the migration parked, and when you update an item that carries one,
  preserve it verbatim unless you are setting `effort`, which resolves it. Every item is
  stored as its own tracked action row (SK-466): the row's `status`, `owner_asset_id`,
  `phase` and `target_date` are NOT writable here — this array is content-only and strict,
  so a tracking key inside an item is a 422 at every door. Track the work with the
  per-action tools in step 5. There is still no `timeline` field (retired in SK-348 fase
  B): an action's schedule is its `phase` + `target_date` on the tracked row, written with
  `update_risk_action`.
- `related_controls` (control codes/refs), `applicable_regulations`,
  `compensating_controls`, `consequence`. There is no `primary_framework` field and no
  `nist_function` field: a risk's framework and its categorisation both travel on its
  linked controls (`control_links`) — the server derives `derived_domains` from them —
  never as standalone attributes.
- `report_visibility` — string list of audience tiers; the contract enum is
  `"executive"`, `"technical"`, `"audit"`, `"internal_only"` (NOT `"client_facing"` — Sekit
  rejects an off-contract tier with a 422).

**Two-layer description (recommended).** Write `description` for the consultant (technical —
cite controls, evidence, specifics) and a plain-language business consequence the SME can read
in `consequence`. Don't say "PR.AA-01"; say "an attacker can send
emails that look like they came from your company." Don't repeat the same text in both layers.

### 4. Create (or update)

- **New:** `create_risk(...)` with the fields above. Returns the created risk; note its `id`.
- **Existing:** `update_risk(client_organization_id, <id>, ...)` — PATCH semantics, pass only
  what changes (e.g. `remediation_progress`, `status`, `target_date`).
  If you resend `recommended_actions`, the array REPLACES the risk's action list. Carry each
  kept item's `id` (from `get_risk` / `list_risks`) so its row keeps its tracking state: with
  ids, an unchanged item keeps its row, an id-less item is a new row, a stored row you leave
  out is deleted, and the array order becomes the new order (an id from another risk, or the
  same id twice, is a 422). A wholly id-less array is matched by position instead — old-style
  saves keep working and surviving rows keep their tracking — so never reorder or remove
  items without ids. To change ONE action, prefer `update_risk_action` (step 5); it touches
  nothing else.

For a full register, **summarize the planned set and get a go-ahead** before firing many
`create_risk` calls (see Safety in sekit-mcp-guide).

### 5. Track remediation actions (per-action tools)

Every `recommended_actions` item is a tracked row. On `get_risk` / `list_risks` each item
carries its `id`, the content (`action`, `effort`, `validates_when`) and the tracking state:
`status` (`pending` default \| `in_progress` \| `done` \| `dismissed`), `owner_asset_id` +
`owner_asset_name`, `phase` (`short_term` \| `medium_term` \| `long_term`, or `null`) and
`target_date` (`YYYY-MM-DD`, or `null`). Tracking is written ONLY through these tools — never
through `update_risk`'s embedded array.

- **`list_risk_actions(client_organization_id, status?, phase?)`** — the client-wide action
  plan across all kept risks, ordered by the owning risk's score, then position. Each row is
  the action plus its owning risk (`risk_id`, `risk_external_id`, `risk_title`,
  `risk_severity`). Filters are exact matches; pass `phase: null` to list the actions with no
  phase yet. The console's **Acciones** view renders the same rows.
- **`create_risk_action(client_organization_id, risk_id, action, ...)`** — appends one action
  at the end of the risk's list. Only `action` is required; content (`effort`,
  `validates_when`) and tracking (`status`, `owner_asset_id`, `phase`, `target_date`) may be
  set at birth. Returns the created action with its `id`.
- **`update_risk_action(client_organization_id, risk_id, risk_action_id, ...)`** — PATCH
  semantics: an absent key is untouched, an explicit `null` clears a nullable field
  (`owner_asset_id`, `phase`, `target_date`, `effort`, `validates_when`). Content (`action`,
  `effort`, `validates_when`) is editable here too. Find `risk_action_id` on the risk's
  `recommended_actions` items or as the `id` of a `list_risk_actions` row. Returns the
  updated action.
- **`delete_risk_action(client_organization_id, risk_id, risk_action_id)`** — hard delete;
  the audit trail keeps the row image and the remaining actions keep their order. To park an
  action instead of removing it, set `status: "dismissed"` with `update_risk_action`.

`owner_asset_id` follows the same rule as the risk owner: a REFERENCE to one of THIS client's
assets of type `person` or `third_party`, resolved with `list_assets` — never a free-text
name. A `system` asset, another client's asset and an archived asset are rejected; `null`
clears the owner. Never invent an owner: if nobody in the inventory fits, leave it unset and
say so.

"Mark remediation progress" therefore has two levels: the risk (`update_risk` with `status`,
`remediation_progress`, `target_date`) and each action (`update_risk_action` with `status`,
`owner_asset_id`, `phase`, `target_date`). A risk whose actions are all `done` usually
deserves a status/progress update of its own — propose it, don't apply it silently.

### 6. Link evidence

For each risk, attach what backs it: `create_evidence(evidenceable_type="Risk",
evidenceable_id=<risk id>, kind=..., ...)`. See **manage-evidence-and-deliverables** for the
`kind → source` mapping.

### 7. Governance (when asked)

- `approve_risk` / `unapprove_risk` — **owner-only**; only when the user explicitly approves.
- `archive_risk` / `restore_risk` — soft-delete / undo. **Owner-only**, like the approvals.

## Constraints (the validator will reject otherwise)

- `likelihood` and `impact` are integers **1–5** (`residual_likelihood` /
  `residual_impact` too, when you send them).
- `impact_type` and `treatment` use the exact enums above. `severity` is not a write
  field — the server computes it, and neither is the owner's name: `owner_asset_id`
  carries a reference and the server resolves the name.
- A caller-passed `external_id` must be **unique per client** — a collision is a clean
  error; pick another (or omit it and let the server number the risk).
- `detected_date` is ISO-8601.
- Inside `recommended_actions` only `action`, `effort`, `validates_when`, `effort_note` (and
  `id` on update) are accepted — `status`, `owner_asset_id`, `phase` or `target_date` there
  is a 422. Never author `effort_note` yourself, but resend the one an item already carries:
  an omitted key clears the parked text on the stored row. On the per-action tools the
  vocabularies are exact: `status` `pending|in_progress|done|dismissed`, `phase`
  `short_term|medium_term|long_term`, `effort` `low|medium|high`, `target_date`
  `YYYY-MM-DD`; `owner_asset_id` is an asset reference, never a name.
- Ground every risk in evidence that exists; drop claims you can't cite.
