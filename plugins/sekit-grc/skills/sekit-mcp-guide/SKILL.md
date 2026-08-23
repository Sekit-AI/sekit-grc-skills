---
name: sekit-mcp-guide
description: "Foundation and cross-platform connector reference for the Sekit consultant MCP. Covers OAuth and Personal Access Token connection options for Claude, ChatGPT, Codex, and other MCP hosts; the orient-first protocol (call whoami then list_clients before any client-scoped tool); the full tool catalog; framework-as-data; error and result shapes; soft-delete; tenancy; authorization; and audit guarantees. Load this before any other Sekit workflow and whenever the user mentions Sekit, its consultant connector, authentication, clients, risks, controls, frameworks, gap analysis, knowledge, assets, evidence, requests, the Bandeja review inbox, or deliverables."
---

# Sekit consultant MCP — foundation

Shared context for every `sekit-consultant` skill. Read this first; the other skills assume it.

These skills drive **real Sekit consultant data** through the Sekit consultant MCP. Sekit
enforces authentication, authorization, tenant isolation, and write auditing on the server.
The workflow instructions are host-neutral; only connector setup and the way a host displays
tool names differ between Claude, ChatGPT, Codex, and other MCP clients.

## Connect from your host

The production connector is a remote streamable-HTTP MCP server:

```text
https://sekit.ai/api/mcp/consultant
```

Choose the authentication path the host supports:

### OAuth 2.1 (ChatGPT, Codex, and OAuth-capable MCP hosts)

1. If you installed the OpenAI `sekit-grc` plugin, open and authorize its bundled Sekit
   connection. Do not create a duplicate connector.
2. In an unbundled OAuth-capable host, add the production URL as a custom connector named
   `sekit-consultant`.
3. Complete the Sekit browser sign-in and consent flow when the host opens it.
4. Return to the host and verify that the Sekit tools are available.

Do not mint or paste a PAT when the host supports Sekit's OAuth flow.

### Personal Access Token (hosts that accept custom headers)

1. In Sekit, open **`/app/settings` → AI connections → Personal Access Tokens → create**.
   Name the token after the host, not a client; the default expiry is 90 days. The raw token is
   shown once.
2. Add a custom connector named `sekit-consultant` with the production URL and this header:

   ```text
   Authorization: Bearer <your PAT>
   ```
3. Never expose the PAT in a prompt, transcript, issue, log, or committed configuration. Rotate
   it by creating a replacement and then revoking the old token. A PAT carries the **full
   authority of the user's account** — there are no per-token scopes — so treat it exactly
   like the user's password.

For local Sekit development only, use `http://localhost:3000/api/mcp/consultant`.

Hosts may display tools as `mcp__sekit-consultant__<tool>`, under the connector name, or by the
bare tool name. Match by the bare names in this guide rather than assuming one host prefix.

> **The tool list is frozen at connect time.** If Sekit ships new MCP tools (a deploy), an
> existing session won't see them — **disconnect and reconnect the connector** to refresh the
> catalog.

## Orientation protocol — ALWAYS do this first

Before any client-scoped tool call, orient yourself. Skipping this is the most common cause of
"which client?" confusion and wrong-id writes.

1. **`whoami`** — who you are, your role (`consultant`/`admin`), your `role_in_org`
   (`owner`/`member`), and your firm (`organization`). A caller without an organization
   never reaches this tool (the server answers 401 first), so `organization` is always set
   here.
2. **`list_clients`** — the client organizations in your firm. **Each row's `id` is the
   `client_organization_id`** that every client-scoped tool takes as its first argument. Pass
   `archived=true` to list only soft-deleted clients.

Every risk / control / gap / evidence / artifact / wiki tool takes `client_organization_id`.
**Never guess it** — resolve it from `list_clients` (match on the client name the user gave
you, and confirm if ambiguous). If no client matches — e.g. you're onboarding a new one —
create it with `create_client` (only `name` is required) and use the `id` it returns.

## Tool catalog (by domain)

The host may prefix tool names. Read-only listers/getters are safe to call freely;
**create / update / approve / archive tools write real, audited data** — see Safety.

| Domain | Tools |
|---|---|
| **Self / firm** | `whoami`, `get_organization`, `list_team_members`, `list_pending_invitations` |
| **Clients** | `list_clients`, `get_client`, `create_client` (onboard a new client — only `name` is required), `update_client` |
| **Risks** | `list_risks`, `get_risk`, `create_risk`, `update_risk`, `approve_risk`, `unapprove_risk`, `archive_risk`, `restore_risk` → see **analyze-risks** |
| **Control evaluations** | `list_control_evaluations` (pass `inbox=pending`\|`resolved` for the Bandeja agent-proposal triage lens), `get_control_evaluation`, `get_control_evaluation_activity`, `create_control_evaluation`, `update_control_evaluation`, `import_control_evaluations`, `approve_control_evaluation`, `reject_control_evaluation`, `unapprove_control_evaluation`, `revert_control_evaluation_rejection`, `archive_control_evaluation`, `restore_control_evaluation` → see **evaluate-controls** |
| **Gap analyses** | `list_gap_analyses`, `get_gap_analysis`, `create_gap_analysis`, `update_gap_analysis`, `archive_gap_analysis`, `restore_gap_analysis` → see **run-gap-analysis** |
| **Reference data** (read-only) | `list_frameworks`, `list_controls`, `search_controls`, `search_control_catalog`, `get_control`, `list_framework_controls`, `list_industries` |
| **Custom library** (org-authored frameworks + controls) | `list_custom_frameworks`, `get_custom_framework`, `create_custom_framework`, `update_custom_framework`, `archive_custom_framework`, `restore_custom_framework`, `list_custom_controls`, `get_custom_control`, `create_custom_control`, `update_custom_control`, `archive_custom_control`, `restore_custom_control`, `add_framework_member`, `update_framework_member`, `remove_framework_member` |
| **Evidence** | `list_evidence`, `get_evidence`, `create_evidence`, `update_evidence`, `archive_evidence`, `restore_evidence` → see **manage-evidence-and-deliverables** |
| **Evidence requests (solicitudes)** | `list_evidence_requests`, `get_evidence_request`, `get_submission_markdown`, `create_evidence_request`, `update_evidence_request`, `review_evidence_request`, `release_evidence_request` (client-facing), `archive_evidence_request`, `restore_evidence_request` → see **manage-evidence-and-deliverables** |
| **Evidence packages + threads** | `list_evidence_packages`, `get_evidence_package`, `create_evidence_package`, `update_evidence_package`, `release_evidence_package` (client-facing), `close_evidence_package`, `reopen_evidence_package`, `set_evidence_request_package`, `release_wave` (client-facing), `post_thread_message` (client-facing), `list_thread` → see **manage-evidence-and-deliverables** |
| **Evidence request generation** (deterministic, no AI) | `generate_evidence_requests` → see **manage-evidence-and-deliverables** (full PLAN generation is AI-only via the console strategist) |
| **Artifacts / deliverables** | `list_artifacts`, `get_artifact`, `prepare_artifact_upload`, `create_artifact_from_upload`, `update_artifact`, `approve_artifact`, `revert_artifact_approval`, `archive_artifact`, `restore_artifact` → see **manage-evidence-and-deliverables** |
| **Client files** | `list_client_files`, `get_client_file`, `get_client_file_markdown`, `download_client_file`, `prepare_client_file_upload`, `create_client_file_from_upload`, `update_client_file`, `archive_client_file`, `restore_client_file` |
| **Assets / inventory** | `list_assets`, `get_asset`, `create_asset`, `update_asset`, `archive_asset`, `restore_asset`, `list_asset_links`, `create_asset_link`, `archive_asset_link`, `restore_asset_link` → see **manage-assets** |
| **People / portal** | `list_contacts`, `get_contact`, `create_contact` (bridge a person asset via `asset_id`), `update_contact`, `archive_contact`, `restore_contact`, `mint_portal_token`, `list_portal_tokens`, `revoke_portal_token` → see **manage-assets** |
| **Knowledge base (wiki)** | `wiki_list`, `wiki_read`, `wiki_search`, `wiki_write`, `wiki_append` → see **manage-knowledge-base** |
| **Audit log** (read-only) | `list_audit_log`, `get_audit_entry` |
| **Tokens** | `list_tokens`, `create_token`, `revoke_token` |

## The framework-as-data model

Frameworks and controls are **data**, not hardcoded — these skills are framework-agnostic. Never
assume a specific framework (don't bake in "the 25 NIST controls"); read what the tenant
actually has.

- **`list_frameworks`** — the frameworks Sekit knows (codes like `nist_csf`, `iso_27001`,
  `cis_v8`, `pci_dss`, `cyber_essentials`, `cobit_2019`, `soc_2_tsc`, `ens`, `iso_22301`,
  `hipaa`, `nis2`), plus **`sekit_csf`**, the canonical Sekit framework whose controls are the
  RCF (Reference Control Family) catalog. Each row's `code` is what other tools take as
  `framework`. Each row also carries **two nullable coverage signals** that tell you how much
  resolved guidance the framework actually has: `guidance_coverage_pct` (share of controls with
  resolved guidance) and `scopeable_maturity_pct` (share with a maturity for proportional scope).
  **`null` means coverage hasn't been computed yet** — treat it as unknown (not 0%) and fall back
  to `sekit_csf`. Separately, `proportionality_default` is the **default target maturity tier for
  a typical small org** — not a coverage signal. `sekit_csf` is **100% covered**; coarse-crosswalk
  standards (ISO, PCI, NIS2 today) resolve little or no guidance. Use the coverage signals to pick
  a lens (see below).
- **`list_controls`** — the global RCF crosswalk catalog (~400+ rows). **At least one filter is
  required** (`framework`, `family`, `maturity`, or `nist_function`) — an unfiltered enumeration
  is rejected. Each row carries per-framework `mappings` (the crosswalk) **plus a resolved
  `guidance` block** (all snake_case) that downstream skills draft from:

  ```
  guidance: {
    control_summary,         # what the control is
    severity_default,        # the severity to seed a gap with
    remediation_template,    # a remediation starting point
    test_procedure,          # how to assess it
    evidence_expectation,    # what evidence to request
    maturity,                # foundational | intermediate | advanced (drives proportional scope)
    sources: { <field>: "authored" | "projected" | "heuristic" }
  }
  ```

  `guidance.sources` records the **provenance** of each field: `authored` (a human wrote it for
  this control), `projected` (carried across the crosswalk from a mapped control), or `heuristic`
  (a rule-of-thumb default). On RCF / `sekit_csf` rows `suggested_severity_source` is now
  `authored`. **Guidance can be `null`** for any field — on coarse-crosswalk frameworks it often
  is. A `null` field is a real signal: there is no resolved guidance, so say so and don't invent
  one. `search_controls` is free-text discovery; `get_control` fetches one known RCF.
- **`list_framework_controls`** — a framework's **native** controls at its own granularity (e.g.
  ISO 27001's `A.5.1`). Use this when you triage a framework on its own terms rather than via the
  RCF lens. Each row carries **`is_leaf`** (SK-245): only `is_leaf=true` rows are assessable —
  hierarchy headers (`is_leaf=false`) must not be imported as control evaluations (bulk import
  lists them in `skipped` rather than aborting the batch).
- **Custom frameworks / controls** — tenants can define their own; gap analyses and control
  evaluations accept a `custom_framework_id` / `custom_control_id` leg.

Because of the crosswalk, a control evaluation done under the Sekit CSF (RCF) lens **projects
onto every mapped framework** — you don't re-evaluate per framework unless the engagement needs
native granularity.

### Guidance is a suggestion, never a verdict

The `guidance` block exists to **draft** a control evaluation faster — seed a gap's severity,
prefill remediation, drive evidence requests, frame the test procedure. It is **not** a decision.
Always:

- **Surface the provenance.** Tell the consultant whether a value is `authored`, `projected`, or
  `heuristic` so they can weight it. A projected severity on a coarse crosswalk deserves more
  scrutiny than an authored one on `sekit_csf`.
- **Frame every value as a confirm-or-edit, not a finding.** "Suggested severity: high
  (authored)" — the consultant confirms. Never present guidance as the verdict you've reached.
- **Treat `null` honestly.** No resolved guidance means you say "no resolved guidance for this
  control" and ask the consultant rather than inventing a severity, remediation, or test.

### Picking a lens by coverage

When the engagement has **no specific framework mandate**, prefer a high-coverage lens so you get
real guidance to draft from — default to **`sekit_csf`** (100% covered) or pick the
highest-`guidance_coverage_pct` framework from `list_frameworks` (a `null` pct = coverage not yet
computed — fall back to `sekit_csf`). Only run a coarse-crosswalk
framework natively when the engagement is tied to that standard, and tell the consultant up front
that its guidance will be sparse (mostly `null` / `projected`) so most fields are theirs to fill.

## Solicitudes y paquetes (collection workflow)

**Evidence requests** ("solicitudes") are how you ask a client to hand over proof — upload a
document (`kind="upload_evidence"`) or confirm a task is done (`kind="confirm_task"`). Their
lifecycle spans your side and the client's portal:

1. **Create** a request (`create_evidence_request`; `kind` + `title` required) — it lands
   **`pending`** and is portal-visible to its assigned contact as soon as it exists, but **no
   email is sent yet**. Requests generated from a plan or a package start `queued` instead.
   Editing metadata (title, due date, contact, status) is `update_evidence_request`.
2. **Release** it (`release_evidence_request` for a pending request, `release_wave` to promote
   queued ones) — this **REACHES THE CLIENT**: stamps `released_at` and (on a fresh release)
   emails the assigned contact a magic link. A request with no assigned contact can't be
   released — assign one first via `update_evidence_request`.
3. The **client submits** through the portal. You read what came back with
   `get_evidence_request` (full timeline + submissions) and `get_submission_markdown` (the
   extracted text of one submission).
4. **Review** the submission (`review_evidence_request`) with a `verdict` — `accepted`,
   `correction_requested`, or `rejected`. A `correction_requested` / `rejected` verdict
   **requires a non-blank `reason` (shown to the client)**; `accepted` does not.
5. `archive_evidence_request` / `restore_evidence_request` soft-delete / undo (owner-only).

**Packages** are the pacing unit: a themed bundle of requests released one package at a time.
Generated requests are born inside a package; an ad-hoc request is created standalone and
joins one only through `set_evidence_request_package`.
`create_evidence_package` (born `draft`), `update_evidence_package` (rename / set assignee +
due date), then drive the `draft → released → complete | closed` lifecycle:
`release_evidence_package` (**client-facing** — flips draft→released, makes members
portal-visible, emails the contact), `close_evidence_package` (end a package early — cancels
open asks), `reopen_evidence_package` (revisit a finished/closed package). Move an ask between
packages or re-order it with `set_evidence_request_package(client_organization_id,
evidence_request_id, package_id, position)`.

**Threads** are the multiplayer conversation. `post_thread_message` is **client-facing** —
pass `evidence_request_id` to post on that request's thread (the client sees it in their
portal), or omit it to post to the client-level general thread. `list_thread` reads the
interleaved timeline (messages + lifecycle events).

**The client-facing tools** — `release_evidence_request`, `release_evidence_package`,
`release_wave`, and `post_thread_message` — **reach the client** (portal visibility + email).
Treat every one as an egress action: confirm the client, contact, and content before firing,
exactly like an approve/archive (see Safety).

**Deterministic request generation (no AI):** the full evidence PLAN (themed draft packages) is
AI-only — the Sekura strategist owns it from the console («Preparar plan con Sekura»); the old
`instantiate_evidence_plan` tool was retired 2026-07-20. To turn a completed gap analysis's
eligible control evaluations into pending requests, use `generate_evidence_requests` (tune with
`wave_size` / `due_date` / `client_contact_id` / `assignee_asset_id`, and `control_evaluation_ids`
to curate WHICH controls — **omit it for all eligible, pass `[]` for none**). See
**manage-evidence-and-deliverables** for the full operating guide.

### Bandeja triage — reviewing agent proposals

When a Sekura agent proposes control-evaluation verdicts, they land in a review inbox
("Bandeja"). `list_control_evaluations` with **`inbox="pending"`** returns only the CEs still
awaiting a human decision (each enriched with the agent's `reasoning` and the cited
`source_document`); `inbox="resolved"` returns the ones already approved or rejected. Read one
CE's full history with `get_control_evaluation_activity` (the merged agent-proposal + human-
decision timeline), then decide with `approve_control_evaluation` or `reject_control_evaluation`
(**reject requires a `reason`**). See **evaluate-controls** for the triage subsection.

## Result + error shapes (no exceptions — read the value)

Two refusals happen at the **transport** level, before any tool runs, and look like a
connector failure rather than a tool result:

- **401 Unauthorized** (with a `WWW-Authenticate` challenge) — the token is missing, revoked,
  expired, or not a consultant's. Fix the connection (re-authorize OAuth or mint a fresh PAT).
- **402 `subscription_required`** (JSON-RPC error `-32001`, message starting
  `subscription_required:`) — the credential is valid but the firm has **no active Sekit
  subscription or trial**. Re-authenticating cannot fix this: the user (or their firm's owner)
  must activate the workspace in the Sekit console (`/app/activate`), then retry. Tell them
  that plainly instead of looping through the connector setup.

Once a call reaches a tool, tools **never raise** — failures come back as a value you must
inspect:

- Most tools return the object/list on success, or **`{"error": "..."}`** on failure.
- The wiki write/append tools return a confirmation string on success, or **`"(error: ...)"`**
  on failure.
- An **empty list is a valid result**, not an error (e.g. a client with no risks yet).
- MCP hosts may expose one or more text blocks plus `structuredContent.result`; prefer the
  structured result when it is available.

When you get an error string, **read it** — Sekit returns field-level detail (e.g. a 422 naming
the bad field, a 404 for a wrong/cross-tenant id). Fix the offending argument and retry. Common
causes: a NOT-NULL field omitted, an enum typo, a cross-tenant id (404), or an XOR-leg violation
(see evaluate-controls / run-gap-analysis).

**Unknown arguments are dropped silently.** The tool doors strip any key that is not in the
tool's schema (a retired field, a typo) instead of erroring, so a stale habit fails invisibly:
the call "succeeds" and the value never lands. When a field you set is missing from the
returned object, check the tool's argument list before retrying.

## Soft-delete model

Nothing is hard-deleted. "Delete" = **archive** (`archive_*`), which hides the row from default
lists; **`restore_*`** brings it back. Both are **owner-only** for every work item except
contacts. Only `list_clients` offers `archived=true`; the other listers return kept rows only,
so an archived risk, asset, or request is invisible until restored. Prefer archive over
treating data as gone.

## Tenancy, authorization, and audit guarantees

You do not implement auth in the skill. The authenticated connector supplies the user's
identity, whether the host obtained it through OAuth or a PAT. What that buys you:

- **Tenant isolation** (Postgres RLS): you can only see/touch clients in **your firm**. A
  cross-tenant id returns 404, never another firm's data.
- **Role-based actions**: some actions are **owner-only** — `approve_artifact` /
  `approve_risk`, and the `archive_*` / `restore_*` pairs for client work items (risks,
  control evaluations, gap analyses, evidence, evidence requests, assets, asset links,
  artifacts, client files, custom controls and frameworks). Contacts are the exception: any
  consultant may archive or restore a contact. As a `member` you'll get a clean authorization
  error on the owner-only ones; that's expected, not a bug.
- **Write audit trail**: database audit records attribute changes to the authenticated user.
  Inspect them with `list_audit_log` and `get_audit_entry` when needed. Read-only MCP calls do
  not create per-record audit entries, so never describe a read as audit-tracked.

## Safety — writes are real and audited

These tools mutate a live consultant platform. Before any **create / update / approve / archive
/ restore**, especially on a real (non-demo) client:

- Confirm the **`client_organization_id`** resolves to the client the user means.
- For batch work (a full risk register, a whole gap worklist), **summarize the plan and get a
  go-ahead** before firing dozens of writes.
- Approvals and archives are governance actions — never approve/archive on the user's behalf
  without explicit intent.
- Prefer idempotent shapes: risks key on a unique `external_id` per client (the server
  assigns `R-NNN` when you omit it); control evaluations are
  one-per-control-per-gap-analysis. Check the existing list before creating to avoid
  duplicates.

## Which skill for what

| You want to… | Skill |
|---|---|
| Build or update a client's risk register | **analyze-risks** |
| Record a single control verdict (the XOR-leg mechanics) | **evaluate-controls** |
| Run a full gap analysis end-to-end (container → worklist → complete) | **run-gap-analysis** |
| Draft and deliver a GDPR Art. 30 ROPA (RAT / record of processing activities) | **generate-ropa** |
| Read/write the per-client knowledge base (wiki) | **manage-knowledge-base** |
| Attach evidence, upload files, manage + approve deliverables | **manage-evidence-and-deliverables** |
| Register people / vendors / systems, set criticality + owner, link assets to risks/gaps/controls/requests | **manage-assets** |
| Make a person contactable / assignable, grant or revoke a client portal magic link | **manage-assets** |
