---
name: run-gap-analysis
description: "Run a full Sekit gap analysis end to end over the consultant MCP. Create the framework-scoped analysis container (the framework lens and the evaluation mode are both immutable), build the worklist of controls, triage each one into a control evaluation, track progress with proportional scope, and mark it complete. Covers both modes: compliance, which records the five assessment verdicts with severity and remediation, and readiness, a certification-preparation walk that records how far along the work is in three work states. Use when the user wants to start or run a gap analysis, assess a client against ISO 27001, NIST CSF, Sekit CSF, or any framework, prepare a client for certification, or work a control worklist. Framework-agnostic. Read the sekit-mcp-guide skill first."
---

# Run a gap analysis

The **engagement-level** workflow: from "assess this client against framework X" to a complete,
evidenced gap analysis. Read **sekit-mcp-guide** first. The per-control verdict mechanics live in
**evaluate-controls** — this skill orchestrates many of those into one analysis.

## When to use

The user wants to assess a client against a framework (a compliance gap, a posture baseline)
and work the whole control set, not just one control — or wants to prepare a client for
certification, walking every requirement of a management system to record how far along the
work is. Those are the two **evaluation modes**, and you choose between them in step 2.

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

**If the engagement is certification preparation, decide the mode here, not in step 2.** The
`sekit_csf` default below does not accept a readiness walk, so a lens picked on the "no specific
mandate" rule and a readiness mode chosen a moment later cannot both stand. Pick the framework
being certified against.

### 2. Create the analysis container

```
create_gap_analysis(
  client_organization_id = <id>,
  reason = "<the analysis NAME, max 160 chars, e.g. 'ISO 27001 certification readiness'>",
  framework = "sekit_csf",         # XOR: OR framework_id, OR custom_framework_id — exactly one
  evaluation_mode = "compliance"   # or "readiness" — optional, defaults to compliance
)
```

The lens **and the mode** are **immutable** after creation. `status` defaults to `in_progress`.
Note the returned `gap_analysis_id`.

**Choosing the mode.** This is the decision that cannot be undone, so make it deliberately and
say out loud which one you picked:

- **`compliance`** (the default) — the five assessment verdicts. How well does the client meet
  each control? Produces severities, remediation and the gap report. This is the rest of this
  skill.
- **`readiness`** — a certification-preparation walk. Every requirement is worked through rather
  than judged, and the verdict records **how far along the work is**, not how well it complies:
  `pass` = Completed, `partial` = In progress, `gap` = Not started. Severity and
  `not_applicable` are rejected outright. Pick it when the engagement is "get this client ready
  to certify", not "score this client".

Two refusals to know before you offer readiness, both clean 422s that name the reason:

- **Not on the legacy `sekit_csf` lens.** That framework has no readiness worklist. Start the
  walk on the framework being certified against, or on a custom framework.
- **Not on frameworks larger than 120 requirements** (PCI DSS, NIST 800-53, CSA CCM, CIS). The
  readiness walk is for management-system requirement sets; a technical control catalog of that
  size wants a compliance gap analysis instead.

If the consultant asks for a readiness walk on a lens that refuses it, say so **before**
creating anything — the mode cannot be changed afterwards, so a wrong choice here costs them
the whole analysis.

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

**Proportional scope does not apply to a readiness walk.** A management system admits no
exclusion, so the checklist is walked whole: every requirement ends with a state, even if they
all end at *Not started*. `not_applicable` is rejected there for exactly that reason.

### 4. Triage each control → a control evaluation

**On a readiness analysis this whole section reads differently.** The fields below are the
compliance vocabulary. A readiness walk records one of three work states per requirement and
never carries severity, remediation severity seeding, or `not_applicable` — see
**evaluate-controls**, which holds both vocabularies side by side. Read `evaluation_mode` from
`get_gap_analysis` before you draft anything, so you write the right one.

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

Readiness rows come back from the same call, so the walk's progress is readable over MCP the
same way. They never appear in the Bandeja: readiness work is tracked, not signed off.

**The reports themselves are generated in the Sekit console, not over MCP.** No tool in the
consultant server produces a gap report or a readiness plan. When the walk is done, tell the
consultant to open the analysis in the console and press Generate report — over a readiness
analysis that produces the certification-readiness plan, the document they hand the client.

### 7. Complete

When triage is done, `update_gap_analysis(client_organization_id, gap_analysis_id, status=
"complete")`. Only `reason` and `status` are editable; the lens is fixed.

## Reading one analysis through other frameworks

Don't re-run per framework by default. A Sekit-CSF gap analysis already carries the crosswalk —
use `list_controls(framework="iso_27001")` (etc.) and the RCF `mappings` to present the same
verdicts under another standard. Re-cut natively only when the client needs a framework's own
control granularity.

## Constraints

- Framework lens **and evaluation mode** are set once and **immutable** — choose both
  deliberately; there is no conversion between a compliance analysis and a readiness walk.
- Readiness is refused on the `sekit_csf` lens and on frameworks over 120 requirements.
- CE framework must match the analysis lens; severity iff gap; one CE per control per analysis
  (see evaluate-controls).
- `archive_gap_analysis` / `restore_gap_analysis` for soft-delete / undo.
