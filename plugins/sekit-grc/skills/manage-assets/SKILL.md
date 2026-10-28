---
name: manage-assets
description: "Register and maintain a Sekit client's asset inventory over the consultant MCP: people, third parties, information (data categories), systems, and devices, each with a criticality and an owner. Create, update, and archive assets with the right class (cloud, saas, laptop, phone, ...), per-class details, and references (a system's supplier, a device's assignee, where data lives). Link an asset to the risks, gap analyses, or control evaluations it concerns as owner, affected, processor, or custodian. Bridge a person asset to a client contact, share an open Solicitud with them for portal access, and list or revoke their portal links. Use whenever the user wants to add or edit a client's people, vendors, data categories, systems, laptops, or phones, set an owner or criticality, record who holds a device or where data is stored, connect assets to the work that concerns them, or give a client person portal access. Framework-agnostic. Read the sekit-mcp-guide skill first."
---

# Manage assets

Build and maintain a client's **asset inventory** (the register of people, third parties,
information, systems, and devices a GRC engagement is about) and the **links** from that
inventory to the risks, gaps, and control evaluations it concerns. All over the Sekit consultant
MCP. Read **sekit-mcp-guide** first: connection, the `whoami → list_clients` orientation
protocol, error/result shapes, and the safety rules all apply here.

## When to use

The user wants to register or edit a client's people / vendors / data categories / systems /
devices, set an asset's owner or criticality, record a system's supplier, a device's holder or
where data lives, or make the relationship between an asset and some work (a risk, a gap, a
control) explicit. You are the consultant's hands: propose, they decide. Ground the inventory in
what's actually known about the client (the wiki, declared facts, uploaded files); don't invent
assets, and don't invent answers for them.

## The model

Every asset has an `asset_type`, a `name`, and a `criticality` (`critical` / `high` / `medium` /
`low`, the shared severity scale the risk layer reads). Systems and devices also have an
`asset_class`. Type and class decide which `details` fields the asset carries and which
references it may set. The registry below is the whole contract; the server validates against
exactly this.

### Asset registry

| `asset_type` | `asset_class` | `details` fields | References (own params) |
|---|---|---|---|
| `person` | none (omit) | none | none |
| `third_party` | none (omit) | none | none |
| `information` | none (omit) | `classification`, `personal_data`, `health_data`, `access` | `location_asset_ids` |
| `system` | `cloud` | `account`, `region`, `environment` | `supplier_asset_id` |
| `system` | `saas` | `mfa`, `receives_user_data` | `supplier_asset_id` |
| `system` | `application` | `authentication`, `integrations` | `supplier_asset_id` |
| `system` | `repository` | `auto_deploy` | `supplier_asset_id` |
| `system` | `backup` / `domain` / `other` | none | `supplier_asset_id` |
| `device` | `laptop` / `phone` / `other` (required) | `ownership` (required), `os`, `disk_encrypted` | `assignee_asset_id` |

Picking the type: a data category the client holds (customer data, HR records) is
`information`; a vendor, processor, or provider is `third_party`; an endpoint is a `device`.
Picking a system class: `cloud` for an IaaS/PaaS account or project (AWS, Azure, GCP), `saas`
for a subscribed service (Workspace, Slack), `application` for software the client builds or
runs, `repository` for a code repository, `backup` for a backup set or service, `domain` for a
domain name, `other` for anything else.

### Field values

| Field | Values |
|---|---|
| `classification` | `public` \| `internal` \| `confidential` \| `restricted` |
| `personal_data`, `health_data`, `mfa`, `receives_user_data`, `auto_deploy`, `disk_encrypted` | `yes` \| `no` \| `unknown` |
| `environment` | `production` \| `other` |
| `ownership` | `company` \| `personal` (required on every device) |
| `account`, `region`, `authentication`, `integrations`, `access`, `os` | free text |

Every field is optional except a device's `ownership`. All values are strings.

### References

| Param | Carried by | Points at | Notes |
|---|---|---|---|
| `supplier_asset_id` | `system` | one live `third_party` asset of the same client | the vendor behind the system |
| `assignee_asset_id` | `device` | one live `person` asset of the same client | who holds the device |
| `location_asset_ids` | `information` | live `system` or `third_party` assets of the same client | where the data lives; max 50, not the asset itself; replaces the list on update |

### Rules

- **Class.** Always send a class for a system; a classless system is filed as `other`, which
  has no fields, so any `details` sent with it are refused. A device without a class is refused
  (`asset_class is required for device`). `person`, `third_party`, and `information` take no
  class; sending one is refused.
- **`details` holds only the template fields** for that type and class. Any other key is refused
  as `details.<key>` ("is not a field of this asset class"); an off-scale value is refused per
  key. On create, an omitted or `null` `details` is `{}`, which a device refuses (it needs
  `ownership`). Anything else worth recording, such as a vendor's contract or DPA reference,
  goes in `description`.
- **References are their own params, never inside `details`.** A non-empty reference on a type
  that does not carry it is refused ("is only for <type> assets"). `null` (supplier, assignee)
  and `[]` (locations) are accepted on any type. `location_asset_ids` is always an array, never
  `null`.
- **Data a vendor holds is an information asset.** Register the data category as `information`
  and list the vendor in its `location_asset_ids`; a system the vendor provides points back
  with `supplier_asset_id`.
- **`unknown` is an answer**, stored as given and never read as `no`. Use it when the client
  hasn't said; don't guess `yes` or `no`.
- **Health data implies personal data.** `health_data: "yes"` stores `personal_data: "yes"` when
  it is absent or `unknown`; an explicit `personal_data: "no"` with `health_data: "yes"` is
  refused.
- **Owner is an asset.** `owner_asset_id` points at a **person asset in the same client** (e.g.
  the system "Prod DB" is owned by the person "Alice, CISO"): a person, same client, not the
  asset itself, not archived. Any type can have an owner.
- **Links are separate from owner and references.** `asset_links` connect an asset to a **work
  item** (a `Risk`, `GapAnalysis`, or `ControlEvaluation`) with a `role` (`owner` / `affected` /
  `processor` / `custodian`). This is "link now"; it does not change the risk methodology. Use a
  link to say "this system is *affected* by that risk" or "this person is the *owner* of that
  control evaluation's remediation".

## Process

### 1. Orient + resolve the client

`whoami` → `list_clients`; resolve the `client_organization_id` for the client the user named
(confirm if ambiguous).

### 2. Gather context (don't invent)

- **`list_assets(client_organization_id)`**: the existing inventory, each row with `asset_type`,
  `asset_class`, `details`, and its references. Read it to avoid duplicates, to refresh rather
  than re-create, and to find the ids of owners, suppliers, assignees, and locations.
  `get_asset(...)` fetches one row.
- **Knowledge base**: `wiki_search` / `wiki_read` for who/what is already known (people, vendor
  lists, systems, devices, data categories). See **manage-knowledge-base**.

### 3. Shape each asset

Pick the row in the **Asset registry** and fill only its fields. `create_asset` takes:

| Field | Notes |
|---|---|
| `client_organization_id` | required; from `list_clients` |
| `asset_type` | required; see the registry |
| `name` | required; short label (a person, a vendor, a data category, a system, a device) |
| `criticality` | required; `critical` \| `high` \| `medium` \| `low` |
| `asset_class` | systems and devices; see the registry |
| `details` | the registry's fields for that type and class, nothing else |
| `supplier_asset_id` / `assignee_asset_id` / `location_asset_ids` | see **References** |
| `owner_asset_id` | the person asset that owns this one |
| `description` | free text |
| `email`, `role` | for person assets (`email` valid or blank; `role` is the job / functional role, e.g. "CISO", distinct from an asset-link role) |

Two common shapes:

- **A laptop:** `asset_type: "device"`, `asset_class: "laptop"`,
  `details: {"ownership": "company", "os": "macOS 15", "disk_encrypted": "unknown"}`,
  `assignee_asset_id: <person asset id>`.
- **A data category** (customer data, HR records): `asset_type: "information"`, no class,
  `details: {"classification": "confidential", "personal_data": "yes", "health_data": "no",
  "access": "HR team and payroll provider"}`, `location_asset_ids: [<system id>, <third_party id>]`.

### 4. Create (or update)

- **New:** `create_asset(...)`. Returns the created asset; note its `id`.
- **Existing:** `update_asset(client_organization_id, asset_id, ...)`. PATCH:
  - An omitted param is left untouched; an explicit `null` **clears** `description`, `email`,
    `role`, `owner_asset_id`, `details`, `supplier_asset_id`, or `assignee_asset_id`.
    `asset_type`, `name`, and `criticality` can be set but never nulled.
  - Sent `details` replace the stored object and are validated as on create: resend every field
    you want to keep (a device's always includes `ownership`).
  - Changing `asset_type` or `asset_class` without `details` keeps the stored keys the new class
    has and drops the rest.
  - Changing `asset_type` resets `asset_class` unless you send one, clears the references the
    new type does not carry, and is refused while other live assets reference this one in a way
    the new type cannot be (e.g. a person that is still some device's assignee).
  - `location_asset_ids` **replaces** the locations (`[]` empties them). A reference is checked
    only when it changes, so resending an archived one keeps it.

For a whole inventory, **summarize the planned set and get a go-ahead** before firing many
`create_asset` calls (see Safety in sekit-mcp-guide). Create referenced assets first:
**people** (owners, assignees), then **third parties** (suppliers), then **systems** (with
`supplier_asset_id`), then **devices** (with `assignee_asset_id`) and **information** (with
`location_asset_ids`), setting `owner_asset_id` as you go.

### 5. Link assets to the work they concern

`create_asset_link` **required** fields:

| Field | Notes |
|---|---|
| `client_organization_id` | from `list_clients` |
| `asset_id` | an asset in **this** client (from `list_assets`) |
| `linkable_type` | `Risk` \| `ControlEvaluation` \| `GapAnalysis` (the work item's class name) |
| `linkable_id` | that record's `id` (from `list_risks` / `list_gap_analyses` / `list_control_evaluations`) |
| `role` | `owner` \| `affected` \| `processor` \| `custodian` |

Both the asset **and** the linked record must belong to the same client. There can be one
**active** link per `(asset, target, role)`: re-linking the same triple while it's active is a
clean error; archive the old link first or pick a different role.
`list_asset_links(client_organization_id)` shows the current links.

**Link rows are self-describing.** Each `asset_link` (from `list_asset_links` or returned by
`create_asset_link`) carries `asset_name` and `linkable_label` (the human names of the asset and
the work item, e.g. the risk's title or the control's code + name) alongside the raw `asset_id` /
`linkable_id` / `role`. Use them to report links in plain language ("Prod DB is *affected* by the
risk «Datos de clientes sin cifrado»") without a second lookup. `linkable_label` is **always**
`null` when the target is a `GapAnalysis` (analyses have no display name); describe those links
by the analysis's framework from `get_gap_analysis` instead. Otherwise it is `null` only when the
target cannot be resolved at all; an archived target still shows its label.

### 6. Governance (when asked)

- `archive_asset` / `restore_asset`: soft-delete / undo on an asset. Any member, idempotent. A
  restore is refused if the asset's stored references no longer fit the types they must point at.
- `archive_asset_link` / `restore_asset_link`: unlink / re-link. Any member. Re-linking the
  same `(asset, target, role)` after an archive is allowed.

## The people facet: contacts + portal access

A **person asset** is the canonical identity. To make that person *contactable* or to give them
**portal access** (so they can answer a Solicitud and submit evidence through the client
portal), they need a **client contact**, the portal/comms facet of the person asset. The contact
is bridged to the asset by `asset_id`; portal links attach to the contact, never to the bare
asset.

### Bridge a person to a contact

`create_contact` with **`asset_id`** of the person asset is the preferred path. It is
**idempotent**: Sekit resolves or creates the contact for that asset (reusing one already made
via assignment, never duplicating on the unique email), and takes `name` + `email` from the
asset:

- The person asset **must have an email**: an emailless person is a clean 422 ("add an email to
  assign or grant portal access"). Set the email with `update_asset` first.
- A non-person (or cross-client) `asset_id` is a 404.

A standalone contact (no asset) is also possible: `create_contact(client_organization_id, name,
email)`, but prefer bridging, so people stay unified on the asset register. `list_contacts` /
`get_contact` read them; `update_contact` edits name/email/locale (PATCH, only what you pass);
`archive_contact` / `restore_contact` soft-delete (any member; archive keeps the row because a
contact anchors submission provenance).

### Share a Solicitud (portal access) / revoke a link

Every portal link belongs to one **Solicitud** (collection session): the portal opens on that
Solicitud and refuses a link without one. There is no client-wide portal link any more, so giving
a person portal access means adding them as a recipient of one of the client's **open**
Solicitudes.

- **`list_collection_sessions(client_organization_id)`**: the client's Solicitudes, open first
  then closed. Each has its `id`, the gap analysis or readiness review it collects evidence for
  (`gap_analysis_id`, `analysis_title`, `analysis_reason`, `evaluation_mode`), `due_date`,
  `delivery` (`email` or `link`), `closed`, its recipients (contacts by `client_contact_id`,
  members by `user_id`) and progress. Read it to pick the Solicitud and to see whether the
  person already receives it.
- **`mint_portal_token(client_organization_id, contact_id, collection_session_id)`**: shares
  that Solicitud with the contact. **Always pass `collection_session_id`** (an open one,
  `closed: false`): a link minted without it belongs to no Solicitud, and the portal refuses it.
  The call adds the contact as a recipient (idempotent: an existing recipient is not added
  twice) and returns `{id, portal_url, expires_at, collection_session_id, client_contact_id,
  recipient_added, emailed}`. `portal_url` is the ready-to-send link, returned **only here and
  only once** (valid 14 days): hand it to the client and never persist it. `id` is the portal
  token id that `revoke_portal_token` takes. Any consultant may share. A closed or unknown
  Solicitud is a `not_found` error, and so is an **archived contact**: restore the contact
  first (`restore_contact`), then share.
- **It can email the client.** On a Solicitud with `delivery: "email"`, a **newly added**
  recipient is emailed the link (`emailed: true`). Re-sharing with someone who already receives
  it returns a fresh link and sends no email (`emailed: false`). Confirm the person and the
  Solicitud with the consultant before sharing (see Safety in sekit-mcp-guide).
- **Each share keeps only the contact's 3 newest live links to that Solicitud** and revokes the
  older ones (links from the Solicitud's news emails or the contact's own refresh count too).
  Any consultant who may share triggers this; it never touches the contact's links to another
  Solicitud. Because a link is shown only once, re-sharing is how you get a new one.
- **`list_portal_tokens(client_organization_id, contact_id)`**: the audit-safe view (no raw
  token): each link's `id`, the Solicitud it opens (`collection_session_id`; `null` is a retired
  general link the portal refuses), expiry, and revoked / used / active state.
- **`revoke_portal_token(client_organization_id, contact_id, portal_token_id)`**: pulls one
  chosen live link. **Owner-only.**

**No open Solicitud?** No consultant MCP tool starts one. The consultant starts it from the
analysis page in the Sekit console (**Collect evidence**); then share it as above.

A useful flow: `create_asset(asset_type=person, …, email=…)` → `create_contact(asset_id=<id>)` →
`list_collection_sessions(client_organization_id)` → pick an open one →
`mint_portal_token(contact_id=<id>, collection_session_id=<id>)` → hand over the `portal_url`,
or tell the consultant it was emailed when `emailed` is true.

## Constraints (the validator will reject otherwise)

- `asset_type` is `person` / `third_party` / `information` / `system` / `device`; `asset_class`,
  `details` keys and values, and references follow the **Asset registry** exactly;
  `criticality` is `critical` / `high` / `medium` / `low`; an asset-link `role` is `owner` /
  `affected` / `processor` / `custodian`. Exact values.
- A device needs a class and `details.ownership`; a class on `person`, `third_party`, or
  `information` is refused; an unknown `details` key is refused as `details.<key>`.
- References must point at **live** assets of the allowed type in the **same client**;
  `location_asset_ids` takes at most 50 and never the asset itself.
- `owner_asset_id` must resolve to a **person** asset in the **same client**, not the asset
  itself, and not archived; otherwise a clean 422.
- `linkable_type` must be one of the three allowed classes; the asset and the linked record must
  share the client (a cross-client or wrong id is a clean error, not a crash).
- Bridging a contact needs an **email-bearing person** asset: emailless → 422, non-person → 404.
  `mint_portal_token` (sharing a Solicitud) is any-consultant and needs an **open** Solicitud of
  the same client (closed or unknown is `not_found`); a Solicitud takes at most 20 recipients, so
  a new recipient past that is a clean validation error. `revoke_portal_token` is
  **owner-only**; `archive_contact` and `restore_contact` are open to any member.
- Archive (not delete) to remove: nothing is hard-deleted; `restore_*` brings it back.
