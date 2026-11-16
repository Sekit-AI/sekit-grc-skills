---
name: manage-company-controls
description: "Define, create and link a Sekit client's own company controls over the consultant MCP: what the company actually does to meet a requirement, with a name, how it is done, implementation status, a responsible person and the perimeters it covers. Draft the control from a requirement or a real practice, check the existing controls for a duplicate, create it, link it to the framework, Sekit or custom controls it covers, and confirm the result. Use when the user wants to register a control the client runs, turn a practice or policy into a control, link a company control to ISO 27001, NIST CSF or another framework, update or archive a company control, or asks which controls a client has. Not for a framework verdict inside a gap analysis (evaluate-controls) or for defining tests and recording results (test-company-controls). Read the sekit-mcp-guide skill first."
---

# Manage company controls

A **company control** is what the client actually does: «backups run every night and are kept
for 30 days», not «A.8.13 Information backup». Framework controls are requirements; a company
control is the practice that meets them, linked to as many requirements as it covers. Read
**sekit-mcp-guide** first: connection, the `whoami → list_clients` orientation, error shapes and
the safety rules all apply.

This skill owns the control itself and its links. Its tests and their results belong to
**test-company-controls**. A framework verdict inside a gap analysis is a control evaluation:
see **evaluate-controls**.

## Process

### 1. Orient and resolve the client

`whoami` → `list_clients`; resolve the `client_organization_id` the user named (confirm if
ambiguous).

### 2. Gather what the control rests on

Ground the control in something the user told you or the client already has. Do not invent a
practice the client does not run.

- The requirement it answers: `search_control_catalog(client_organization_id, q)` returns the
  company's own kept controls first (`kind: "company_control"`), then catalog hits
  (`kind: "catalog_control"`) with their `framework_control_id`, `control_id` or
  `custom_control_id`. `list_framework_controls(framework_code, compact: true)` gives a
  framework's clauses; only `is_leaf: true` rows are assessable.
- The practice: the client wiki (`wiki_search`, see **manage-knowledge-base**), governed
  documents (`list_artifacts`) and what the user describes.
- The responsible person: `list_assets(client_organization_id)`; only an asset with
  `asset_type` `person` can own a control.
- The scope: `list_perimeters(client_organization_id)`; no perimeter means the whole company.

### 3. Check for a duplicate before any create

Call `list_company_controls(client_organization_id, include_archived: true)` and compare by
meaning, not only by name. Each row carries `code` (`CC-<id>`), `implementation_status`,
`framework_references` and `discarded_at` (set when archived).

| You find | Do |
|---|---|
| A kept control that is the same practice | Do not create. Update it (step 6) or link it to the new requirement (step 5) |
| An archived control that is the same practice | Ask whether to `restore_company_control` it instead of creating a second one |
| A control that covers part of it | Show both to the user; one practice is one control, linked to many requirements |
| Nothing close | Draft a new control (step 4) |

One practice, one control. Several requirements met by the same practice are several links on
one control, not several controls.

### 4. Draft the control and confirm it

`create_company_control` takes only these fields. Any other parameter is dropped or refused, so
never send a guessed field.

| Field | Notes |
|---|---|
| `client_organization_id` | required |
| `name` | required. The practice in a short phrase («Copia de seguridad nocturna de la base de datos»), never a framework clause code |
| `description` | «Cómo se hace»: how the practice runs, in enough detail that a test can check it |
| `implementation_status` | `not_implemented` (default) \| `in_progress` \| `implemented`. Set what the user confirmed, never what you hope |
| `owner_asset_id` | the responsible person: a person asset of THIS client (from `list_assets`), or omit it |
| `perimeter_ids` | perimeters it covers (`list_perimeters`, at most 50); no perimeter means the whole company |
| `source_control_id` / `source_framework_control_id` / `source_custom_control_id` | optional, to copy a control: name AT MOST ONE of `source_control_id`, `source_framework_control_id` or `source_custom_control_id`, and send the `name` and `description` you copied, because the service never fills them from the source. The source is fixed at create, and a copy is linked to its source with basis `source` |
| `tests` | optional `[{name, procedure}]` defined in the same write; the test standard is in **test-company-controls** |

A requirement or a practice often carries more than these fields hold. Put it where it fits,
and say so to the user:

| Ticket or user wording | Where it goes |
|---|---|
| Objective | the first sentence of `description`: what the control prevents or ensures |
| Frequency | `description` («cada noche a las 02:00»); a test's cadence goes in its `procedure` |
| Scope | `perimeter_ids`; when the scope is narrower than any perimeter, also say it in `description` |
| Owner | `owner_asset_id` when the person exists as an asset; otherwise name the role in `description` and suggest registering the person (**manage-assets**) |
| Related assets | name them in `description`; `create_asset_link` cannot target a company control (it takes `Risk`, `ControlEvaluation` or `GapAnalysis`) |

Show the drafted control to the user, with the requirements you plan to link, and write only
after they agree.

### 5. Create, then link

1. `create_company_control(...)` returns the control with its `id` and `code`.
2. For each requirement the practice covers, `link_company_control(client_organization_id,
   company_control_id, ...)` with EXACTLY ONE of `control_id`, `framework_control_id` or
   `custom_control_id`; send null or omit the other two. Optional `basis_note` (up to 2000
   characters) says why the practice meets that requirement; write one.
3. It returns `{link, created}`. Linking the same control again is idempotent: it returns the
   first link, its note kept, with `created: false`. That is not an error.
4. The basis is set by Sekit: `suggestion` when the framework control is one of the control's
   crosswalk suggestions, `manual` otherwise. You never send it.

`unlink_company_control` takes the same one-of target and returns `{removed}`; unlinking a
control that is not linked succeeds with `removed: false`.

Link a requirement only when the practice actually meets it. A link is a claim an auditor will
read.

When you run as an agent user, your creates, updates and links apply at once and are also listed
for the consultant's review in «Actualizaciones de agentes» (see **Agent updates** in
sekit-mcp-guide). Say so in your report; never mark them reviewed yourself.

### 6. Confirm the result

Read the control back with `get_company_control(client_organization_id, company_control_id)` and
report it to the user in plain words: name, code, status, owner, perimeters, and each link. It
also carries:

- the crosswalk's suggestions, framework controls only, equivalent first, each with a relation
  (`equivalent` | `supports` | `enables` | `related` | `mapped`). Offer the strong ones as
  further links; never link them without the user's go-ahead.
- `treated_risks`: the kept risks this control treats (link one with
  `link_risk_company_control`, see **analyze-risks**).
- `tests`, `archived_tests` and `evidence` (its documents), see **test-company-controls**.
- `health` `{level, reasons}`: an alert (`red`, `amber`, `ok`, or null with no live test and no
  document) computed on every read. `health` never changes `implementation_status`; report it,
  do not "fix" the status to match it.

`list_company_controls` gives the register view: each row's `code`, `health` and
`framework_references` (the framework clauses it is linked to).

### 7. Change, archive, restore

- `update_company_control` changes a kept control. An omitted field is left as it is;
  `description: null` and `owner_asset_id: null` clear them. `perimeter_ids` replaces the whole
  set (`[]` = the whole company); omit it to leave the perimeters untouched. The source cannot
  change.
- `archive_company_control` soft-deletes a control and `restore_company_control` brings it back;
  both are idempotent. Archiving is a governance action: archive or restore only when the user
  explicitly asks for that control, never as cleanup you decided on. Restore an archived control before updating it. There is no hard delete.
- History: `list_company_control_versions` and `get_company_control_version`; reverting stays in
  the console.

## Documents that back a control

A policy or record that shows the practice exists is attached with `create_evidence`
(`evidenceable_type: "CompanyControl"`), see **manage-evidence-and-documents**. A test's results
are not evidence rows; they are posted with **test-company-controls**.

## Errors

Every tool returns `{"error": "..."}` on failure. A control that is archived or belongs to another
company reads as `not_found`. Report the error to the user; do not retry with a guessed id.
