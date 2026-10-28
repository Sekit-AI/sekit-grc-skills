---
name: sync-asset-inventory
description: "Keep a Sekit client's asset inventory in step with a technical source such as AWS or Vercel, as an agent or consultant with read access to that source. Read the source, look each resource up in Sekit by its external_ref, create the missing ones with the right type, class, fields, and reference, update the ones that changed, leave unchanged ones alone, never archive, and report the ones that disappeared from the source to the person. Use whenever someone or a scheduled run asks to sync, import, reconcile, refresh, or mirror cloud accounts, Vercel projects, domains, or other infrastructure into a client's Sekit inventory, or asks what changed since the last sync. Read sekit-mcp-guide and manage-assets first."
---

# Sync the asset inventory from a source

Mirror what a technical source (an AWS account, a Vercel team) holds into one client's Sekit
asset inventory, and tell the person what moved. You may be an **agent user** with its own
token (a scheduled bot) or a consultant's assistant; the rules are the same. Read
**sekit-mcp-guide** (orientation, safety, error shapes) and **manage-assets** (the asset
registry, field values, and `update_asset` rules) first. This skill adds only the sync.

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
  it). It does not check or apply the rest of the payload. A create is therefore safe to retry,
  but it is never an update.

## What maps to what

| Source resource | `external_ref` | `asset_type` / `asset_class` | `details` the source fills |
|---|---|---|---|
| AWS account | `{"source": "aws", "id": "account:<12-digit account id>"}` | `system` / `cloud` | `account`: the account id |
| Vercel team | `{"source": "vercel", "id": "team:<team id>"}` | `system` / `cloud` | `account`: the team slug |
| Vercel project | `{"source": "vercel", "id": "project:<project id>"}` | `system` / `application` | none |
| Vercel domain | `{"source": "vercel", "id": "domain:<domain name>"}` | `system` / `domain` | none |

- `name` is the source's human label: the account alias or name, the team or project name, the
  domain.
- Fill `region` and `environment` only when the person states them. The source does not say
  which account is production.
- That is the default scope. Sync other resources (an S3 bucket, an RDS database) only when the
  person asks, with the ARN as the id (`{"source": "aws", "id": "<ARN>"}`) and the class from
  the **manage-assets** registry. Another provider follows the same pattern:
  `<kind>:<immutable id>` under the provider's token.
- Do not derive `information` assets (data categories) from infrastructure. What data a system
  holds is the person's call.

**What the sync owns.** The sync writes `name` and the `details` keys in the table. Everything
else belongs to the person: `criticality`, `owner_asset_id`, `description`, other `details`
keys (`mfa`, `authentication`), references, and links. Never change or clear those.

**On create only:**

- `criticality` comes from the person's instruction. Without one, use `medium` and list the
  asset under "review criticality" in the report.
- Set `supplier_asset_id` when the client has a live `third_party` asset for the provider
  (Amazon Web Services, Vercel). If it has none, leave the supplier unset and say so in the
  report. Do not create the vendor yourself.

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
| has it | no reference match, but a live asset without a reference of the same type and name | **possible duplicate** | none; report it |
| has it | no match | **create** | `create_asset` with the reference |
| no longer has it | live asset with a reference from a scope you read in full | **disappeared** | none; report it |

- **Update.** `details` replaces the stored object. Send the stored `details` with the source's
  keys overlaid, so the person's keys survive. Send `name` only when it changed.
- **Create that returns `matched: true`.** With `archived: true`, a consultant archived it. Leave
  it archived and report it. With `archived: false`, the asset appeared since step 3 (another run
  made it). Treat it as existing and compare it on the next run.
- **Disappeared.** Report it and leave it as it is. Never call `archive_asset` or `restore_asset`.
  A resource can vanish from a read for reasons that are not deletion (permissions, a moved
  project), and the asset may anchor risks and evidence. The person decides. If you cannot tell
  whether an asset was inside the scope you read, report it as "not seen" and say why.
- Touch nothing else: no assets without a reference, no assets of a source you did not read, no
  asset links, no contacts.

### 5. Confirm, then write

- **A person is in the conversation:** show the plan (counts, plus each create and each update
  with old → new) and wait for a go-ahead before the first write.
- **An unattended run** (a schedule, a bot): the standing instruction that started it, naming the
  client and the source, is the go-ahead for the creates and updates in this skill and nothing
  more. Without such an instruction, write nothing and report the plan.

Asset writes apply directly. They are not queued in Agent updates.

### 6. Report

End every run with this report, even when nothing changed:

```text
Sync <source> → <client> (<scope read>)
Created (N): <name> [<source>:<id>], ...
Updated (N): <name>: <field> <old> → <new>, ...
Unchanged: N
Disappeared from the source, still live in Sekit (N): <name> [<source>:<id>], ... (not archived; your call)
Archived in Sekit, still in the source (N): <name>, ... (left archived)
Needs you (N): possible duplicates, type mismatches, review criticality, missing supplier, ...
Not read (N): <scope>: <reason>
```

An error from one call does not stop the run. Report the asset and the error, then carry on.
