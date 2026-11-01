---
name: sync-asset-inventory
description: "Keep a Sekit client's asset inventory in step with a technical source such as AWS or Vercel, as an agent or consultant with read access to that source. Read the source, look each resource up in Sekit by its external_ref, create the missing ones with the right type, class, fields, and reference, update the ones that changed, leave unchanged ones alone, fill any other field (owner, criticality, information assets, classification) it has a basis for and say why on each write, never archive, and report the ones that disappeared from the source to the person. An agent user's writes wait for a person's review in Sekit under Agent updates, and the report says so. Use whenever someone or a scheduled run asks to sync, import, reconcile, refresh, or mirror cloud accounts, Vercel projects, domains, or other infrastructure into a client's Sekit inventory, or asks what changed since the last sync. Read sekit-mcp-guide and manage-assets first."
---

# Sync the asset inventory from a source

Mirror what a technical source (an AWS account, a Vercel team) holds into one client's Sekit
asset inventory, and tell the person what moved. You may be an **agent user** with its own
token (a scheduled bot) or a consultant's assistant. The sync is the same; only the review
differs (below). Read **sekit-mcp-guide** (orientation, safety, error shapes) and
**manage-assets** (the asset registry, field values, and `update_asset` rules) first. This
skill adds only the sync.

**People review your writes. You never archive.** As an agent user, each asset you create or
update applies at once and also waits for a person's review in Sekit, under «Actualizaciones de
agentes» (Agent updates). An asset you change again after its review waits again. A
consultant's own writes through this connector apply directly and are not reviewed. Never mark
your own writes reviewed: that sign-off is the person's. Never archive or restore an asset, not
even one that disappeared from the source. Report it and let the person decide.

The source is read-only to you. Use only calls that read. Never create, change, tag, or delete
anything in AWS, Vercel, or any other source, even when a fix there looks obvious.

## The key: `external_ref`

Each synced asset carries `external_ref: {source, id}`, its identity in the source.

- `source` is a lowercase token for the provider: `aws`, `vercel`, `github`. It must match
  `^[a-z][a-z0-9_.-]{0,63}$`.
- `id` is the resource's **stable** id there, sent exactly, 1 to 512 characters. Never use a
  display name: a rename in the source would then look like one asset gone and a new one born.
- The reference is unique per client, archived assets included. Only `create_asset` sets it.
  `update_asset` has no such parameter, so an asset registered by hand never gets one.
- `list_assets(client_organization_id)` returns `external_ref` on every live row (`null` when
  the asset has none). `list_assets(..., external_ref={source, id})` returns the one live match,
  or nothing. Archived assets are not listed.
- `create_asset` with a reference the client already has creates and changes **nothing**. It
  returns the stored asset with `matched: true` and `archived` (`true` when a consultant archived
  it). The payload must still be a valid create (required fields, known values), but the match
  skips the class, `details`, and reference checks and applies nothing. A create is therefore safe
  to retry, but it is never an update.

## What maps to what

Each agent maps its own source. The pattern is the same for every provider:

- `external_ref.source` is the provider's lowercase token.
- `external_ref.id` is `<kind>:<immutable id>`. When a resource can move between scopes (a
  project between teams), put the scope in the id too: `<kind>:<scope id>/<resource id>`.
- `asset_type` and `asset_class` come from the **manage-assets** registry.
- `name` is the source's human label: the account alias or name, the project name, the domain.
- `details` holds the registry keys the source actually tells you.

Worked examples, for two providers:

| Source resource | `external_ref` | `asset_type` / `asset_class` | `details` the source fills |
|---|---|---|---|
| AWS account | `{"source": "aws", "id": "account:<12-digit account id>"}` | `system` / `cloud` | `account`: the account id |
| Vercel team | `{"source": "vercel", "id": "team:<team id>"}` | `system` / `cloud` | `account`: the team slug |
| Vercel project | `{"source": "vercel", "id": "project:<team id>/<project id>"}` | `system` / `application` | none |
| Vercel domain | `{"source": "vercel", "id": "domain:<team id>/<domain name>"}` | `system` / `domain` | none |

- The source does not say which account is production. Set `environment` from your
  instructions, a naming or tagging convention you can point to, or leave it out.
- The id names its scope (the account, the team), so you can tell which read an asset belongs
  to. The part after `<team id>/` is the resource's own id, which a move between teams keeps.
- Other resources follow the same pattern. An AWS resource with an ARN (an S3 bucket, an RDS
  database) uses the ARN as its id (`{"source": "aws", "id": "<ARN>"}`), since an ARN already
  names its kind and account.

**Fields beyond the source.** `name` and the `details` keys the source tells you are the
**sync-owned** fields: the ones the reconcile below compares with the source. An ISMS needs
more than a source holds: an owner, a criticality, the information assets a system holds and
where they live, classification, personal and health data, MFA, device fields. Fill any of
them, on assets you create or ones that already exist, when you have a basis: your
instructions, the client's wiki and files, another source you can read, or your own assessment.
**manage-assets** § Facts a source does not hold says what each fact is and where it usually
comes from. A person reviews these writes like any other (above).

- **Say why.** Send `reasoning` with every `create_asset` and `update_asset`: one or two
  sentences on where the values came from, for example "AWS account 123456789012, alias
  prod-main. Criticality high: it runs the payroll application (wiki: Sistemas)." The person
  who reviews the write reads it beside the change.
- **A stored value is the current answer.** Change it when your basis says it is wrong, and say
  why in `reasoning`, so a run does not undo an answer someone gave.
- **No duplicates.** Before you create an asset that has no reference (an information asset,
  the owner's person asset), look for it in the step 3 list by type and name, and update the one
  you find.

**On create:**

- `criticality` is required. Set it from your instructions, from what the source shows the
  system does, or from your own assessment, and give the basis in `reasoning`.
- Set `supplier_asset_id` to the client's live `third_party` asset for the provider (Amazon Web
  Services, Vercel). If the client has none, create it or leave the supplier unset, and say
  which in the report.

## Process

### 1. Orient

`whoami` → `list_clients`. The request names the client. Resolve its `client_organization_id`
and stop if the name is ambiguous.

### 2. Read the source

List the resources in scope with read-only calls. Record which scope you read **in full**
(which account, which team). A read that fails, is denied, or stops part way covers nothing:
note it for the report and judge no disappearance in that scope.

### 3. Read Sekit once

One `list_assets(client_organization_id)` call gives you every live asset with its
`external_ref`. Index the rows by `(source, id)`. Keep the rows without a reference too: they
are the possible duplicates.

### 4. Reconcile

Classify every source resource, then every Sekit asset of the sources you read:

| Source | Sekit | Outcome | Call |
|---|---|---|---|
| has it | live asset with that reference, sync-owned fields equal | **unchanged** | none |
| has it | live asset with that reference, a sync-owned field differs | **update** | `update_asset` with only what changed |
| has it | live asset with that reference, different `asset_type` or `asset_class` | **type mismatch** | none; report it |
| has it | no reference match, but a live asset of the same source whose reference has the same resource id under another scope | **moved** | none; report it |
| has it | no reference match, but a live asset without a reference of the same type and name | **possible duplicate** | none; report it |
| has it | no match | **create** | `create_asset` with the reference |
| no longer has it | live asset with a reference from a scope you read in full | **disappeared** | none; report it |

The table compares only the sync-owned fields. A field you fill from § Fields beyond the source,
on an asset the table calls unchanged or on one without a reference, is an update: report it
under Updated with its basis.

- **Update.** `details` replaces the stored object. Right before the write, re-read the asset
  with `get_asset` and send its current `details` with the source's keys overlaid, so the
  person's keys survive, including an edit made while you waited for the go-ahead. Send `name`
  only when it changed.
- **Create that returns `matched: true`.** With `archived: true`, a consultant archived it. Leave
  it archived and report it. With `archived: false`, the asset appeared since step 3 (another run
  made it). Reconcile the returned asset now, as if step 3 had listed it.
- **Moved.** A project or domain transferred to another team gets a new reference, so a create
  would leave the old asset, with its owner, risks, and evidence, beside a second one. Report
  both references together as moved, never the old one as disappeared. The person decides.
- **Disappeared.** An asset is in scope when its id names an account or team you read in full.
  Report it and leave it as it is. Never call `archive_asset` or `restore_asset`.
  A resource can vanish from a read for reasons that are not deletion (permissions, a moved
  project), and the asset may anchor risks and evidence. The person decides. An asset of a scope
  you did not read is "not seen": report it, never as disappeared.
- Assets without a reference, and assets of a source you did not read, are outside this table:
  never report them as disappeared and never match them by reference. Update them only for a
  field you have a basis for, as in § Fields beyond the source.

### 5. Confirm, then write

- **A person is in the conversation:** show the plan (counts, plus each create and each update
  with old → new and its basis) and wait for a go-ahead before the first write.
- **An unattended run** (a schedule, a bot): only a standing instruction that explicitly asks to
  sync, import, or write the source into the named client's inventory is the go-ahead, and only
  for the creates and updates in this skill. A request to check, compare, or report what changed
  is a dry run: write nothing and report the plan.

Asset writes apply at once. An agent user's create or update also opens an entry in
«Actualizaciones de agentes» for a person to review. A consultant's own write opens none.

### 6. Report

End every run with this report, even when nothing changed:

```text
Sync <source> → <client> (<scope read>)
Review: N changes await review in Sekit under «Actualizaciones de agentes» (Agent updates)
Created (N): <name> [<source>:<id>, or no reference], ...
Updated (N): <name>: <field> <old> → <new>, ...
Unchanged: N
Disappeared from the source, still live in Sekit (N): <name> [<source>:<id>], ... (not archived; your call)
Archived in Sekit, still in the source (N): <name>, ... (left archived)
Needs you (N): moved, possible duplicates, type mismatches, supplier missing or created, ...
Not read (N): <scope>: <reason>
```

- **Review.** As an agent user, give the number of creates and updates you wrote and say they
  await review in Sekit under «Actualizaciones de agentes». Write `applied directly, no review`
  when a consultant ran the sync, and `dry run, nothing written` when you wrote nothing.
- **Disappeared.** Name every disappeared asset with its reference, never only a count, and say
  you did not archive it. Whether it goes is the person's call, made in Sekit.

An error from one call does not stop the run. Report the asset and the error, then carry on.
