# Issue tracker: Local Markdown

Specs and tickets for this repo live in `.scratch/`. GitHub Issues is not the configured tracker.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- One spec: `.scratch/<feature-slug>/spec.md`.
- One file per ticket: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order. Do not combine tickets into one file.
- Each ticket records its delivered behavior, acceptance criteria, `Blocked by`, and `Status` near the top.
- Approved implementation tickets use `Status: ready-for-agent`; no external triage labels are configured.
- Comments and implementation evidence append under `## Comments` in the relevant file, or link to applicable `agent-runs/` evidence.

## Skill operations

- When a skill says "publish to the issue tracker", write local Markdown only after the user's approval of the proposed files and content scope.
- `to-spec` synthesizes the agreed discussion; confirm testing seams and obtain spec approval before proceeding to tickets.
- `to-tickets` presents demoable vertical slices and genuine blocking edges for approval before creating ticket files.
- Fetch a referenced spec or ticket by reading its local file. Work only on tickets whose blockers are complete.
- Do not publish issues, comments, labels, or status changes to GitHub or another external service without explicit authorization.
