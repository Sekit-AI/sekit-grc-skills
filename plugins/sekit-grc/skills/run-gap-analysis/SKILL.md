---
name: run-gap-analysis
description: "Run a full Sekit gap analysis end to end over the consultant MCP. Create the framework-scoped analysis container (the framework lens is immutable), build the worklist of controls, triage each one into a control evaluation with remediation, effort, and severity, track progress with proportional scope, and mark it complete. Use when the user wants to start or run a gap analysis, assess a client against ISO 27001, NIST CSF, Sekit CSF, or any framework, do compliance or certification readiness, or work a control worklist for a client. Framework-agnostic. Read the sekit-mcp-guide skill first."
---

# Run a gap analysis

The **engagement-level** workflow: from "assess this client against framework X" to a complete,
evidenced gap analysis. Read **sekit-mcp-guide** first. The per-control verdict mechanics live in
**evaluate-controls** — this skill orchestrates many of those into one analysis.

## When to use

The user wants to assess a client against a framework (certification readiness, a compliance
gap, a posture baseline) and work the whole control set, not just one control.

## The model

A **gap analysis** is the framework-scoped container; each **control evaluation** belongs to one.
The framework **lens is chosen at creation and is immutable**. Because of the RCF crosswalk, a
gap analysis run under the **Sekit CSF** lens projects onto every mapped framework — so you
usually run it once in Sekit CSF and read it through other frameworks, only re-cutting natively
when an engagement needs a framework's own granularity.

## Process

### 1. Orient + pick the framework

`whoami` → `list_clients` → resolve `client_organization_id`. Then `list_frameworks` to choose
the lens — and read its **coverage signals** (`guidance_coverage_pct`, `scopeable_maturity_pct`;
both nullable — `null` = not yet computed, fall back to `sekit_csf`) plus its
`proportionality_default` (the default target maturity tier, not a coverage signal). When the
engagement has **no specific framework mandate**, default to **`sekit_csf`** (100% covered) or the
highest-`guidance_coverage_pct` framework, so you get real guidance to draft each evaluation
from. Pick a coarse-crosswalk standard natively only when the
engagement is tied to it (e.g. `iso_27001` certification) — and warn the consultant up front that
its guidance is sparse (mostly `null` / `projected`), so most fields will be theirs to fill.

### 2. Create the analysis container

```
create_gap_analysis(
  client_organization_id = <id>,
  reason = "<engagement context, e.g. 'ISO 27001 certification readiness'>",
  framework = "sekit_csf"   # XOR: OR framework_id, OR custom_framework_id — exactly one
)
```

The lens is **immutable** after creation. `status` defaults to `in_progress`. Note the returned
`gap_analysis_id`.

(If one already exists, `list_gap_analyses(client_organization_id)` / `get_gap_analysis` to reuse
it instead of creating a duplicate.)

### 3. Build the worklist

Pull the controls for the lens:

- **Sekit CSF / RCF lens** — `list_controls(framework="sekit_csf")` (or filter by `family`,
  `maturity`, `nist_function`). Each row carries the resolved **`guidance` block** you draft each
  evaluation from — see **sekit-mcp-guide** for the canonical shape and the provenance / null
  rules, and **evaluate-controls** for which guidance field drives which CE field.
- **Native lens** — `list_framework_controls(...)` for the framework's own controls. Each
  row carries `is_leaf` (SK-245): **only `is_leaf=true` rows are assessable** — filter out
  hierarchy headers before proportional scope and triage. On a coarse-crosswalk standard,
  expect much of `guidance` to be `null`.

**Proportional scope** — you don't have to evaluate everything. Scope to what's relevant; use
`guidance.maturity` to scope by maturity band. On a native lens, scope over **leaves only**.
Mark clearly out-of-scope controls `not_applicable` (with a note) rather than leaving them
blank, so coverage is honest. State the scope to the user before bulk writes.

### 4. Triage each control → a control evaluation

For each in-scope control, `create_control_evaluation(..., gap_analysis_id=<this analysis>)` —
its framework must match the lens. Draft each CE from the control's `guidance`, then have the
consultant confirm:

- `status` (`pass`/`partial`/`gap`/`unknown`/`not_applicable`) — assessed against
  `guidance.test_procedure`; plus `evidence_source`, `evaluated_at`.
- `severity` **only when `status="gap"`** — **seeded from `guidance.severity_default`** (medium
  only when absent), presented with its provenance.
- Remediation: `recommended_remediation` **prefilled from `guidance.remediation_template`**,
  `estimated_effort`, `current_tier`/`target_tier` (0–4), `owner_type`
  (`consultant`/`client_internal`/`external_specialist`), `confidence`, `notes`.
- Evidence requests driven by `guidance.evidence_expectation`.

Every guidance-derived value is a **suggestion the consultant confirms**, never a verdict (the
provenance / null rules in **sekit-mcp-guide** apply). See **evaluate-controls** for the XOR-leg
rules and the full field list. Get a go-ahead before firing the whole worklist.

### 5. Attach evidence

Per CE, `create_evidence(evidenceable_type="ControlEvaluation", evidenceable_id=<id>, ...)` —
the document/session/inference/wiki/artifact that backs the verdict. See
**manage-evidence-and-deliverables**.

### 6. Track progress

`list_control_evaluations(client_organization_id, gap_analysis_id=<id>)` to see coverage and the
gap distribution. Surface the gaps (especially `critical`/`high`) and the remediation roadmap to
the user. Optionally write the narrative to the client wiki (**manage-knowledge-base**) or
generate a deliverable (**manage-evidence-and-deliverables**).

### 7. Complete

When triage is done, `update_gap_analysis(client_organization_id, gap_analysis_id, status=
"complete")`. Only `reason` and `status` are editable; the lens is fixed.

## Reading one analysis through other frameworks

Don't re-run per framework by default. A Sekit-CSF gap analysis already carries the crosswalk —
use `list_controls(framework="iso_27001")` (etc.) and the RCF `mappings` to present the same
verdicts under another standard. Re-cut natively only when the client needs a framework's own
control granularity.

## Constraints

- Framework lens is set once and **immutable** — choose deliberately.
- CE framework must match the analysis lens; severity iff gap; one CE per control per analysis
  (see evaluate-controls).
- `archive_gap_analysis` / `restore_gap_analysis` for soft-delete / undo.
