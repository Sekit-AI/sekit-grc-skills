---
name: evaluate-controls
description: "Record and triage control evaluations for a Sekit client over the consultant MCP. This is the mechanics of one verdict: pick the control via the three-way leg (an RCF or Sekit CSF control, a native framework control, or a custom control), set status (pass, partial, gap, unknown, or not applicable), supply an evidence source and date, add severity only when the status is a gap, and file it into a gap analysis. It also covers the Bandeja: reviewing agent-proposed evaluations in the pending inbox and approving or rejecting them. Use when the user wants to assess or score a control, mark a control as a gap or passing, evaluate posture against a framework, import control evaluations, or review / approve / reject agent proposals in the Bandeja. Framework-agnostic. Read the sekit-mcp-guide skill first."
---

# Evaluate controls

The mechanics of recording **one control evaluation (CE)** correctly through the Sekit consultant
MCP. Read **sekit-mcp-guide** first. For the engagement-level loop that produces many CEs, use
**run-gap-analysis** — this skill is the building block it calls.

## When to use

The user wants to assess a control (or a handful), mark gaps/passes, or import a batch. One CE
records the verdict for one control within one gap analysis.

## The control "leg" — a 3-way XOR (pick exactly ONE)

`create_control_evaluation` must identify the control via **exactly one** of these. Setting none
or more than one is a clean 422.

| Leg | Param | Source | When |
|---|---|---|---|
| **RCF / Sekit CSF** | `control_id` | `list_controls` / `search_controls` / `get_control` | Triaging via the canonical Sekit lens (the crosswalk projects onto every mapped framework). **Also pass `framework`** when the gap analysis has a catalog-framework lens (it must match the analysis); **omit it** when the analysis is custom-framework scoped — there it is rejected. |
| **Native framework** | `framework_control_id` | `list_framework_controls` | Triaging a framework at its own granularity (e.g. ISO 27001 `A.5.1`). Must belong to the gap analysis's framework. **Only `is_leaf=true` rows are assessable** — hierarchy headers (`is_leaf=false`) are skipped on import (SK-245). |
| **Custom** | `custom_control_id` | tenant custom controls | A custom-framework gap analysis. **Omit `framework`** (no framework lens). |

Each `list_controls` row carries a resolved **`guidance` block** (snake_case) you draft the
evaluation from — see **sekit-mcp-guide** for the full shape and the provenance / null rules:

- `guidance.test_procedure` — how to assess this control (drives your assessment).
- `guidance.evidence_expectation` — what evidence to request from the client.
- `guidance.severity_default` — the severity to **seed a gap with** (only relevant when
  `status="gap"`).
- `guidance.remediation_template` — a starting point for `recommended_remediation`.
- `guidance.maturity` — `foundational` | `intermediate` | `advanced` (proportional scope; NOT
  the 0–4 `current_tier`/`target_tier` scale).
- `guidance.sources` — the provenance (`authored` / `projected` / `heuristic`) of each field.

Everything in `guidance` is a **suggestion the consultant confirms**, never a verdict — apply
the provenance-surfacing and null-honesty rules from **sekit-mcp-guide** to every value below.

## Required fields

| Field | Notes |
|---|---|
| `client_organization_id` | from `list_clients` |
| `status` | `pass` \| `partial` \| `gap` \| `unknown` \| `not_applicable` |
| `evidence_source` | `document` \| `session` \| `intake` \| `inference` (NOT-NULL — always required) |
| `evaluated_at` | ISO-8601 |
| one XOR leg | see above (+ `framework` for the RCF leg) |

**`severity` is conditional**: **required when `status = "gap"`** (`critical`/`high`/`medium`/
`low`), and must be **omitted** for any other status. Getting this wrong is a 422. When it is a
gap, **seed the severity from `guidance.severity_default`** and present it as a suggestion with
its provenance ("severity_default: high, authored") for the consultant to confirm or override.
**Fall back to `medium` only when `guidance.severity_default` is absent** — and say so, rather
than implying a real assessment produced it.

## Filing into a gap analysis

- Pass **`gap_analysis_id`** (from `create_gap_analysis` / `list_gap_analyses`) to file the
  verdict into a specific analysis — its framework **must match** this CE's. The leg is fixed at
  creation.
- **Omit it** (RCF / native leg only) and Sekit attaches a **synthesized per-(client, framework)
  analysis** so every CE still belongs to one. The custom leg requires its custom-framework gap
  analysis.

## Useful optional fields

`summary` — **the sentence the client-facing report prints for this control.** Write it as a
finished statement a consultant would sign: what is missing and on what basis. The consultant can
rewrite it in the console, and a re-import never overwrites an edited one.

`notes` — a single actionable line when useful (a fast-win cue, a question for the consultant).
Omit it when there is nothing to add. `summary` is what the report reaches for first, but `notes`
is its fallback: when a control has no `summary`, the finding card prints the `notes` instead. So
never put anything there you would not want a client to read.

`reasoning` — the full evidence chain. Persisted as immutable AI-provenance next to the
evaluation, never overwritten, and shown to the consultant beside the summary they are editing.

`confidence` (`high`/`medium`/`low`), `recommended_remediation`, `estimated_effort`
(`low`/`medium`/`high`), `current_tier` / `target_tier` (0–4), `owner_type`
(`consultant`/`client_internal`/`external_specialist`), `impact_type`, `gdpr_articles`,
`last_reviewed_at`.

`nist_function` and `assessment_id` were **retired** from control evaluations. The NIST function
is derived from the catalog control, and every evaluation belongs to a gap analysis rather than an
assessment. `list_controls` still filters the RCF catalog by `nist_function` — that is a different
field on a different resource.

## Process

1. **Orient** — `whoami` → `list_clients` → resolve `client_organization_id`.
2. **Pick the lens** — know the gap analysis + framework you're filing under (or let it
   synthesize). `list_frameworks` if you need the code.
3. **Pull the controls** — `list_controls(framework=...)` (RCF lens, filter required) or
   `list_framework_controls(...)` (native). For native rows, **keep only `is_leaf=true`**
   before drafting — hierarchy headers are not assessable (SK-245). Read each row's
   `guidance` block.
4. **For each control**, draft from `guidance` (then let the consultant confirm):
   - **Assess** against `guidance.test_procedure` to determine `status`.
   - **Request evidence** per `guidance.evidence_expectation`; gather `evidence_source` +
     supporting evidence.
   - If it's a `gap`, seed `severity` and prefill `recommended_remediation` per the
     **Required fields** rule above.
   - Pick the XOR leg.
5. **`create_control_evaluation(...)`** — one per control per gap analysis. On a 422, read the
   field-level message and fix (usually a severity-vs-status mismatch or an XOR violation).
6. **Update** with `update_control_evaluation(client_organization_id, <id>, ...)` (PATCH).
7. **Evidence** — `create_evidence(evidenceable_type="ControlEvaluation", evidenceable_id=<id>,
   ...)`. See **manage-evidence-and-deliverables**.
8. **Batch** — for a bulk re-key from an external assessment, `import_control_evaluations`
   takes `evaluations: [...]` (1–200 rows, each with the same leg + `status` +
   `evidence_source` + `evaluated_at` rules as a single create) and returns what it created
   plus a `skipped` list (e.g. non-leaf controls) — the result is not 1:1 with the input.
   Prefer per-control calls when judgement matters.

## Bandeja triage — reviewing agent proposals

When a Sekura agent proposes control-evaluation verdicts, they queue in a review inbox
("Bandeja") for a human to approve or reject. To work it:

1. **`list_control_evaluations(client_organization_id, inbox="pending")`** — the pending lens:
   only the CEs an agent proposed that still await a decision. Each row is **enriched** with
   `reasoning` (the agent's rationale for the proposed verdict) and `source_document` (the
   evidence the agent cited, when any) — read those before deciding. Pass `inbox="resolved"` to
   see the ones already approved/rejected; **omit `inbox`** for the full register (no
   agent-reasoning filter).
2. **`get_control_evaluation_activity(client_organization_id, control_evaluation_id)`** — the
   merged, newest-first timeline of agent proposals and human decisions for ONE CE — "who
   decided this and on what basis?". (`get_control_evaluation` fetches the row itself.)
3. Decide:
   - **`approve_control_evaluation(client_organization_id, control_evaluation_id)`** — sets
     `approval_status` to `approved`. Idempotent.
   - **`reject_control_evaluation(client_organization_id, control_evaluation_id, reason=...)`** —
     sets it to `rejected`. **`reason` is required** (free text). Idempotent.
   - `unapprove_control_evaluation` / `revert_control_evaluation_rejection` reset a decision
     back to `pending_review` (the latter also clears the stored rejection reason).

Approving/rejecting is a governance action on real client data — read the agent's `reasoning`
and cited `source_document` first, and don't rubber-stamp a batch without the user's intent.

## Constraints

- Exactly **one** control leg; RCF leg also needs `framework` matching the gap analysis.
- `severity` **iff** `status="gap"`.
- `evidence_source` is always required.
- One CE per control per gap analysis — check `list_control_evaluations` before re-creating.
