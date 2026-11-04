---
name: manage-assets
description: "Register and maintain a Sekit client's asset inventory over the consultant MCP: people, third parties, information (data categories), systems, and devices, each with a criticality and an owner. Create, update, and archive assets with the right class, per-class details, and references (a system's supplier, a device's assignee, where data lives). Find what the inventory is missing and fill the gaps in confirmed batches. Link assets to the risks, gap analyses, or control evaluations they concern. Bridge a person asset to a client contact, share an open Solicitud with them for portal access, and list or revoke their portal links. Use whenever the user wants to add or edit a client's people, vendors, data categories, systems, laptops, or phones, set owners or criticality, complete or review an incomplete inventory, record who holds a device or where data is stored, connect assets to the work that concerns them, or give a client person portal access. Framework-agnostic. Read the sekit-mcp-guide skill first."
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
control) explicit. A person decides: in a conversation they confirm before you write, and an
agent user's writes wait for their review. Ground every value in a basis you can name (your
instructions, the wiki, declared facts, uploaded files, a source you read, or your own assessment
stated as one) and give that basis in `reasoning`. Don't invent assets or answers.
To fill what the inventory lacks (owners, classifications, and other fields) across many
assets, see **Filling gaps in batches**. To keep the inventory in step with AWS, Vercel, or
another technical source, use **sync-asset-inventory**.

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
| `system` | `data_store` | `environment`, `encrypted_at_rest`, `public_access` | `supplier_asset_id` |
| `system` | `compute` | `environment` | `supplier_asset_id` |
| `system` | `saas` | `mfa`, `receives_user_data` | `supplier_asset_id` |
| `system` | `application` | `authentication`, `integrations` | `supplier_asset_id` |
| `system` | `repository` | `auto_deploy` | `supplier_asset_id` |
| `system` | `backup` / `domain` / `other` | none | `supplier_asset_id` |
| `device` | `laptop` / `phone` / `other` (required) | `ownership` (required), `os`, `disk_encrypted` | `assignee_asset_id` |

Picking the type: a data category the client holds (customer data, HR records) is
`information`; a vendor, processor, or provider is `third_party`; an endpoint is a `device`.
Picking a system class: `cloud` for a whole IaaS/PaaS account or project (an AWS account, an
Azure subscription, a GCP project), `data_store` for one bucket, database, or shared drive inside
it or elsewhere (an S3 bucket or an RDS database), `compute` for one server, instance, function,
or container (an EC2 instance or a Lambda), `saas` for a subscribed service (Workspace, Slack),
`application` for software the client builds or runs, `repository` for a code repository,
`backup` for a backup set or service, `domain` for a domain name, `other` for anything else. The
account and the resources in it are separate assets: register a data store or a compute resource
on its own when its data, exposure, or environment matters for the engagement, and leave it under
its account when it does not (**sync-asset-inventory** § How fine to go).

### Field values

| Field | Values |
|---|---|
| `classification` | `public` \| `internal` \| `confidential` \| `restricted` |
| `personal_data`, `health_data`, `mfa`, `receives_user_data`, `auto_deploy`, `disk_encrypted`, `encrypted_at_rest`, `public_access` | `yes` \| `no` \| `unknown` |
| `environment` | `production` \| `staging` \| `development` \| `other` |
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

## Facts a source does not hold

A technical source (a cloud account, a SaaS admin console) names systems and a few settings.
An ISMS also needs the facts below. Filling them is part of the job, whether you are an agent or
a consultant's assistant. The table says what each fact is and where it usually comes from. The
places it lists are where to look first: none of them is required, and the tools named are only
examples.

| Fact | Field | What it is | Where it usually comes from |
|---|---|---|---|
| Owner | `owner_asset_id` | The person accountable for the asset: who decides who gets access and answers for its risks. Not always the person who operates it. | A role or team list in the wiki, the account's admin or billing contact, whoever approves access requests. |
| Information assets | `asset_type: "information"` | The categories of data the client holds (customer records, payroll, source code), apart from the systems that hold them. | The records of processing (RoPA), contracts, the privacy notice, what each application stores and why. |
| Data location | `location_asset_ids` | The systems and vendors that store or process a data category. | Architecture notes, which application or service the data is entered in, the vendor list and its DPAs. |
| Classification | `details.classification` | How much harm disclosure would do: `public`, `internal`, `confidential`, `restricted`. | The client's classification policy. Without one, judge by content: personal, financial, or secret business data is at least `confidential`. |
| Criticality | `criticality` | How much the business suffers if the asset is unavailable, wrong, or exposed. | What depends on it (production, revenue, payroll), a business impact analysis or continuity plan, the data it holds. |
| Personal and health data | `details.personal_data`, `details.health_data` | Whether the data identifies people, and whether it reveals their health (a special category under GDPR). | The RoPA, the privacy notice, the fields an application collects, HR and sick-leave processes. |
| MFA and authentication | `details.mfa` (`saas`), `details.authentication` (`application`) | Whether signing in to a service asks for a second factor; how users of an application sign in (SSO, password, magic link). | The service's or the identity provider's security settings (for example Google Workspace, Microsoft Entra ID, Okta), the SSO configuration, the login page. |
| Environment | `details.environment` (`cloud`, `data_store`, `compute`) | Whether the asset runs production, staging, or development work. An auditor samples production, and a test copy of real data still holds that data. | Naming or tagging conventions, separate accounts per stage, the client's architecture notes. |
| Data store exposure | `details.encrypted_at_rest`, `details.public_access` (`data_store`) | Whether the stored data is encrypted on disk, and whether anyone outside the client can read it without signing in (a public bucket or share link). | The provider's console or configuration (for example bucket policies, database encryption settings), infrastructure-as-code, a cloud security posture tool. |
| Device fields | `details.ownership`, `details.os`, `details.disk_encrypted` | Who owns a device, its operating system, whether its disk is encrypted. | A device-management tool's inventory (for example Intune, Jamf), the IT asset list, or the person who holds the device. |

A `details.` field goes inside `details`, only on the type and class the **Asset registry** lists
for it; with `update_asset`, resend the stored `details` with your change (`apply_asset_changes`
merges instead). When nothing gives an answer, record `unknown` on a yes/no field or leave the
field out, and say in `reasoning` what is missing. In a batch, such an asset goes in
`unproposed` instead.

## Filling gaps in batches

An inventory with 60 assets can lack an owner on 40 of them and a classification on 25. Asking
about each asset in turn wears the consultant out, and most answers follow from a few facts
(who owns the systems, what the HR data is). So work by **field, across assets**: find the
biggest group, propose a value for every asset you have a basis for, ask one question about
the rest, and write the whole group in one `apply_asset_changes` call.

**What a gap is.** Exactly what `missing_fields` lists on a `list_assets` row or a `get_asset`
result: `owner` (every type but `person`), `assignee` (devices), and each field of the asset's
template that is empty or `unknown`. Criticality is never a gap: it is set on every asset and
is reviewed only when the consultant asks (below).

1. **Count.** `list_assets(client_organization_id, summary: true)` returns `{total, incomplete,
   by_field}`, the number of assets lacking each field, largest first (add `perimeter_id` to
   scope it). Take counts from here, not from a long list, which is truncated. Report them and
   offer to start with the largest group.
2. **Read one group.** `list_assets(client_organization_id, missing_field: "<field>")` returns
   only the assets lacking that field, with their names, classes, details, and references.
3. **Infer from evidence.** For each asset, look for a basis: its name, class, supplier, and
   the data locations that point at it; the wiki; the client's documents (RoPA, policies,
   contracts); facts the consultant already gave; and **Facts a source does not hold** above.
   An owner comes from a person the evidence names or from the type's **default owner**. The
   consultant sets default owners per asset type in the Sekit console. No tool reads them, so
   ask once for the whole group, or use the ones the wiki records. Never guess an owner: one
   wrong name puts accountability on the wrong person.
4. **Propose.** Show the consultant the batch before you write it: each value, the assets that
   take it (by name), and the source. Put the assets with no basis in a separate list and ask
   **one question** that covers all of them ("What do «Varios» and «Export 2023» contain?").
   When they answer, propose the batch again with those assets added. A Sekit chat shows its
   own approval card. Over this connector **there is no card: the whole call applies when you
   make it**, so you need a clear yes on the proposal first. If the consultant drops some
   changes, leave them out of the call.
5. **Apply** with `apply_asset_changes`, then report the outcomes and the next group.

`apply_asset_changes(client_organization_id, layout, changes, unproposed?)`:

| Param | Notes |
|---|---|
| `changes` | `[{field, value, asset_ids, reason}]`: one value, every asset that takes it, and its source. `field` is the bare key as `missing_fields` names it (`classification`, not `details.classification`), or `criticality`. `value` is a key (`confidential`, `yes`), or a person asset id (a number) for `owner` and `assignee`. |
| `reason` | Where the value comes from: a wiki page, a document, the asset's name or location, the consultant's answer, the type's default owner. Name assets and people by name, never by id, in the consultant's language. An agent user's write keeps it per asset, for the person who reviews it under Agent updates. |
| `unproposed` | Optional `[{field, asset_ids, note}]`: the assets you have no basis for, with the question you asked. Nothing is written for them. |
| `layout` | `by_value` (one field, values repeat: a large batch), `rows` (one row per asset: a small batch or values that differ), `cards` (one card per asset with all its fields: a few assets that each lack several fields). `by_value` takes one field only. |

- **At most 50 asset fields per call**, counting each asset in each change. Propose the rest
  after this batch is applied.
- **Each asset and field appears once** across `changes` and `unproposed`.
- **Never send `unknown`**: it leaves the gap open (on a yes/no field it is refused). An
  asset you cannot answer for goes in `unproposed`.
- **`details` fields are merged**: the asset's other details stay. This differs from
  `update_asset`, where sent `details` replace the stored object.
- Use this tool for one asset too. `update_asset` is for other edits (name, description,
  type, references other than owner and assignee); don't loop it over many assets.

**Outcomes.** One per asset and field: `applied`; `unchanged` (it already held that value);
`failed` with the error (the other assets still apply); `excluded` (removed on the chat card,
so leave it out of later batches); `unknown` (the batch stopped while writing that asset: read
it with `get_asset` before proposing it again); `not_attempted` (the batch stopped before it:
propose it again). Report failures in plain words, then take a fresh `summary: true` for the
next group.

**Criticality, only when asked.** Ask once, for the whole group, three questions: what happens
to the business if these assets are **unavailable**, if their data is **wrong**, and if it
**leaks**. Propose the worst of the three answers as the level, in a `rows` batch with
`field: "criticality"`, each reason naming the answer it rests on.

## Process

### 1. Orient + resolve the client

`whoami` → `list_clients`; resolve the `client_organization_id` for the client the user named
(confirm if ambiguous).

### 2. Gather context (don't invent)

- **`list_assets(client_organization_id)`**: the existing inventory, each row with `asset_type`,
  `asset_class`, `details`, its references, and `missing_fields` (its gaps). Read it to avoid duplicates, to refresh rather
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
| `owner_asset_id` | the person asset that owns this one; omit it to give the asset its type's default owner (set per client in the Sekit console; persons have none), `null` for no owner |
| `description` | free text |
| `email`, `role` | for person assets (`email` valid or blank; `role` is the job / functional role, e.g. "CISO", distinct from an asset-link role) |
| `reasoning` | optional free text, one per call: the basis for the values you send (the source, a wiki page, an instruction, your own assessment). The person who reviews an agent user's write reads it beside the change. `update_asset` takes it too. |

Two common shapes:

- **A laptop:** `asset_type: "device"`, `asset_class: "laptop"`,
  `details: {"ownership": "company", "os": "macOS 15", "disk_encrypted": "unknown"}`,
  `assignee_asset_id: <person asset id>`.
- **A data category** (customer data, HR records): `asset_type: "information"`, no class,
  `details: {"classification": "confidential", "personal_data": "yes", "health_data": "no",
  "access": "HR team and payroll provider"}`, `location_asset_ids: [<system id>, <third_party id>]`.

### 4. Create (or update)

- **New:** `create_asset(...)`. Returns the created asset; note its `id`.
- **Existing:** `update_asset(client_organization_id, asset_id, ...)`. PATCH. To fill gaps
  (owner, assignee, template fields) or set criticality, use `apply_asset_changes` instead,
  for one asset or many (**Filling gaps in batches**):
  - An omitted param is left untouched; an explicit `null` **clears** `description`, `email`,
    `role`, `owner_asset_id`, `details`, `supplier_asset_id`, or `assignee_asset_id`.
    `asset_type`, `name`, and `criticality` can be set but never nulled.
  - Sent `details` replace the stored object and are validated as on create: resend every field
    you want to keep (a device's always includes `ownership`). `details: null` is `{}`, so a
    device refuses it: to clear a device's optional fields, send `{"ownership": ...}` alone.
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
  person already receives it: match on those ids, since a member's `name` is a label and their
  `email` may be `null` (see **sekit-mcp-guide** § People in tool output).
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
- `apply_asset_changes` writes at most 50 asset fields per call, each asset and field once
  across `changes` and `unproposed`; `field` is a bare key, `value` a key or (owner, assignee) a
  person asset id, never `unknown`; `by_value` takes one field.
- Archive (not delete) to remove: nothing is hard-deleted; `restore_*` brings it back.
