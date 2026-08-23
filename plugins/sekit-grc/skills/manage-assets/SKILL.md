---
name: manage-assets
description: "Register and maintain a Sekit client's asset inventory over the consultant MCP: people, third parties, and systems, each with a criticality and an owner. Create, update, and archive assets, and link an asset to the risks, gap analyses, control evaluations, or evidence requests it concerns with a role of owner, affected, processor, or custodian. Also manage the people facet: bridge a person asset to a client contact and grant portal access by minting, listing, or revoking a magic-link portal token. Use whenever the user wants to add or edit a client's people, vendors, or systems, set an asset owner or criticality, decide who owns or is affected by a piece of work, connect assets to the items that reference them, make a person contactable or assignable, give a client a portal link, or revoke portal access. Framework-agnostic. Read the sekit-mcp-guide skill first."
---

# Manage assets

Build and maintain a client's **asset inventory** — the register of people, third parties, and
systems a GRC engagement is fundamentally about — and the **links** from that inventory to the
risks, gaps, control evaluations, and evidence requests it concerns. All over the Sekit
consultant MCP. Read **sekit-mcp-guide** first — connection, the `whoami → list_clients`
orientation protocol, error/result shapes, and the safety rules all apply here.

## When to use

The user wants to register or edit a client's people / vendors / systems, set an asset's owner or
criticality, or make the relationship between an asset and some work (a risk, a gap, a control,
an evidence request) explicit. You are the consultant's hands — propose, they decide. Ground the
inventory in what's actually known about the client (the wiki, declared facts, uploaded files);
don't invent assets.

## The model

- **One inventory, three types.** Every asset has a `asset_type` of `person`, `third_party`, or
  `system`, plus a `name` and a `criticality`. `criticality` reuses the shared severity scale
  (`critical` / `high` / `medium` / `low`) so it means the same thing the risk layer reads.
- **Owner is an asset.** An asset's `owner_asset_id` points at a **person asset in the same
  client** (e.g. the System "Prod DB" is owned by the Person "Alice, CISO"). It must be a person,
  in the same client, not the asset itself, and not archived.
- **Links are separate from owner.** `asset_links` connect an asset to a **work item** — a
  `Risk`, `GapAnalysis`, `ControlEvaluation`, or `EvidenceRequest` — with a `role`
  (`owner` / `affected` / `processor` / `custodian`). This is "link now"; it does not change the
  risk methodology. Use a link to say "this System is *affected* by that Risk" or "this Person is
  the *owner* (assignee) for that evidence request".

## Process

### 1. Orient + resolve the client

`whoami` → `list_clients`; resolve the `client_organization_id` for the client the user named
(confirm if ambiguous).

### 2. Gather context (don't invent)

- **`list_assets(client_organization_id)`** — the existing inventory. Read it to avoid
  duplicates and to refresh rather than re-create. `get_asset(...)` fetches one row.
- **Knowledge base** — `wiki_search` / `wiki_read` for who/what is already known (people, vendor
  lists, systems). See **manage-knowledge-base**.

### 3. Shape each asset

`create_asset` **required** fields:

| Field | Notes |
|---|---|
| `client_organization_id` | from `list_clients` |
| `asset_type` | `person` \| `third_party` \| `system` |
| `name` | short label (a person's name, a vendor, a system) |
| `criticality` | `critical` \| `high` \| `medium` \| `low` |

Useful **optional** fields:

- `description` — free text.
- `email`, `role` — primarily for **person** assets (`role` is their job / functional role, e.g.
  "CISO" — distinct from an asset_link role).
- `owner_asset_id` — the **person asset** that owns this one (same client). Create the person
  first, then pass its `id` here.
- `details` — a free-form object for type-specific fields, e.g.
  `{"data_processed": "PII", "contract_ref": "DPA-2026"}` for a third party, or
  `{"environment": "production", "hosting": "aws"}` for a system. Omit it and it defaults to an
  empty object.

### 4. Create (or update)

- **New:** `create_asset(...)`. Returns the created asset; note its `id`.
- **Existing:** `update_asset(client_organization_id, <id>, ...)` — PATCH semantics, pass only
  what changes (e.g. `criticality`, `owner_asset_id`).

For a whole inventory, **summarize the planned set and get a go-ahead** before firing many
`create_asset` calls (see Safety in sekit-mcp-guide). A useful order: create the **people**
first, then create systems / third parties and set their `owner_asset_id` to the right person.

### 5. Link assets to the work they concern

`create_asset_link` **required** fields:

| Field | Notes |
|---|---|
| `client_organization_id` | from `list_clients` |
| `asset_id` | an asset in **this** client (from `list_assets`) |
| `linkable_type` | `Risk` \| `ControlEvaluation` \| `GapAnalysis` \| `EvidenceRequest` (the work item's class name) |
| `linkable_id` | that record's `id` (from `list_risks` / `list_gap_analyses` / `list_control_evaluations` / the request) |
| `role` | `owner` \| `affected` \| `processor` \| `custodian` |

Both the asset **and** the linked record must belong to the same client. There can be one
**active** link per `(asset, target, role)` — re-linking the same triple while it's active is a
clean error; archive the old link first or pick a different role. `list_asset_links(client_organization_id)`
shows the current links.

**Link rows are self-describing.** Each `asset_link` (from `list_asset_links` or returned by
`create_asset_link`) carries `asset_name` and `linkable_label` — the human names of the asset and
the work item it's linked to (e.g. the risk's title or the control's code + name) — alongside the
raw `asset_id` / `linkable_id` / `role`. Use them to report links in plain language ("Prod DB is
*affected* by the risk «Datos de clientes sin cifrado»") without a second lookup. `linkable_label`
is **always** `null` when the target is a `GapAnalysis` (analyses have no display name) —
describe those links by the analysis's framework from `get_gap_analysis` instead — and
otherwise only when the target cannot be resolved at all; an archived target still shows its
label.

### 6. Governance (when asked)

- `archive_asset` / `restore_asset` — soft-delete / undo on an asset. **Owner-only.**
- `archive_asset_link` / `restore_asset_link` — unlink / re-link. **Owner-only.** Re-linking the
  same `(asset, target, role)` after an archive is allowed.

## The people facet — contacts + portal access

A **person asset** is the canonical identity. To make that person *contactable* (assignable to
evidence requests) or to give them a **portal link** (so they can submit evidence through the
client portal), they need a **client contact** — the portal/comms facet of the person asset. The
contact is bridged to the asset by `asset_id`; portal tokens and request assignment attach to the
contact, never to the bare asset.

### Bridge a person to a contact

`create_contact` with **`asset_id`** of the person asset is the preferred path. It is
**idempotent** — Sekit resolves or creates the contact for that asset (reusing one already made via
assignment, never duplicating on the unique email), and takes `name` + `email` from the asset:

- The person asset **must have an email** — an emailless person is a clean 422 ("add an email to
  assign or grant portal access"). Set the email with `update_asset` first.
- A non-person (or cross-client) `asset_id` is a 404.

A standalone contact (no asset) is also possible: `create_contact(client_organization_id, name,
email)` — but prefer bridging, so people stay unified on the asset register. `list_contacts` /
`get_contact` read them; `update_contact` edits name/email/locale (PATCH — only what you pass);
`archive_contact` / `restore_contact` soft-delete (owner-only — a contact anchors submission
provenance).

### Grant / revoke portal access

- **`mint_portal_token(client_organization_id, contact_id)`** — mints a fresh magic link. This is
  the **only** place the raw `ptk_…` token and ready-to-send `portal_url` are returned (shown
  once, valid 14 days). Hand the `portal_url` to the client; never persist the raw token. Any
  consultant may mint.
- **`list_portal_tokens(client_organization_id, contact_id)`** — the audit-safe view (no raw
  token), to see what's live.
- **`revoke_portal_token(client_organization_id, contact_id, portal_token_id)`** — pulls a live
  credential. **Owner-only.**

A useful flow: `create_asset(asset_type=person, …, email=…)` → `create_contact(asset_id=<id>)` →
`mint_portal_token(contact_id=<id>)` → hand over the `portal_url`.

## Constraints (the validator will reject otherwise)

- `asset_type` is `person` / `third_party` / `system`; `criticality` is
  `critical` / `high` / `medium` / `low`; an asset-link `role` is
  `owner` / `affected` / `processor` / `custodian` — exact values.
- `owner_asset_id` must resolve to a **person** asset in the **same client**, not the asset
  itself, and not archived — otherwise a clean 422.
- `linkable_type` must be one of the four allowed classes; the asset and the linked record must
  share the client (a cross-client or wrong id is a clean error, not a crash).
- Bridging a contact needs an **email-bearing person** asset — emailless → 422, non-person → 404.
  `mint_portal_token` is any-consultant; `revoke_portal_token`, `archive_contact`, and
  `restore_contact` are **owner-only**.
- Archive (not delete) to remove — nothing is hard-deleted; `restore_*` brings it back.
