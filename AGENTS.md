# Tonphueng Connect

## Sources and scope

- Before acting, read all applicable `AGENTS.md` files, `CONTEXT.md` if present, and referenced protocols relevant to the task.
- Read `../ref/README.md` to select sources. The system scope comes from `../ref/current/ต้นผึ้ง OA Specification.pdf`; `../ref/current/ผึ้งพาเดิน_compressed.pdf` supplies project context.
- The source Google Doc is https://docs.google.com/document/d/1I8fly6Lap6dkbdqK7-8VD4fHGYBjCT1yYFgoIcNrwQQ/edit. Flag conflicts between sources and ask before resolving them.
- Archive ideas are history, not requirements. Reuse existing documents and link to sources rather than copying them.
- `../storypage/` is a separate existing project. Changes to it require explicit authorization.

## Delivery and authorization

- The primary conversation is Manager and owns scope, authorization, task state, evidence, and the final report. Do not create another Manager agent.
- Default to Manager only for non-code work and Manager -> Coder for code work. Only Coder may edit source code or notebooks.
- Model routing: Manager/Router defaults to GPT-6.1 Sol medium; Planner/Reviewer to GPT-6.1 Sol high; Coder/Tester to GPT-6 Luna high. Docs/standup uses GPT-6 Luna when an override is available. Use configured roles and verify their model settings when delegating; never select Astra automatically or spawn a docs agent just to satisfy a model preference.
- The Manager checks each change against the approved ticket and repo rules. Add one independent Reviewer only when requested or when changes affect authorization, sensitive data, price calculations, transaction integrity, or webhook/scheduler safety. Routine UI and CRUD changes that reuse established checks do not automatically need a Reviewer.
- Use Planner only for unresolved architecture or consequential research, and Tester only when separate integration, environment, or experimental evidence is needed. Reuse the Coder for corrections. Avoid redundant role calls and parallel write-heavy work.
- Propose files to add or modify, with reasons, and obtain user confirmation before writing. Approval applies only to the proposed scope.
- Consume the existing approved spec and tickets without repeating confirmed planning stages. Use named skills when explicitly invoked; they are not an automatic instruction to spawn their full agent workflow on every ticket. An explicit `code-review` request still uses that skill's two-axis review. Confirm new or changed requirements before implementation. If a required skill is unavailable, report it rather than claiming to use it.
- Coder makes the smallest change for the approved ticket, runs targeted behavioral checks and typecheck, and uses pre-agreed TDD seams where applicable. Run the relevant regression suite when features connect and before release; include the full suite when required by the task or practical for the current small suite. Local test commands do not require a separate agent.
- Reuse completed checks and reviews that still cover the change. After a correction, rerun affected checks and review only the changed risk; repeat broader checks only when new evidence justifies it. Keep handoffs limited to the relevant ticket, paths, and evidence.
- Reviewers are read-only and use fresh agent context for each review pass. After a failure, return to Coder for the smallest correction and rerun the affected checks.
- Never commit, push, create a GitHub repository, deploy, incur new costs, or write to an external system without explicit authorization, even if a skill instructs it.
- For complex or remote work, use `agent-runs/<task-id>/` only for applicable plan, ticket, test, review, and result artifacts. Do not duplicate the spec across handoffs.
- Workflow and documentation approval does not authorize product scope changes or external writes. Existing spec and ticket approvals remain in effect.
- Current prototype scope: Tickets 01–08 are core; Tickets 09 (AI chat) and 10 (Feedback) are optional, time permitting. Missing business content may use clearly identified demo data under the spec's prototype policy; authentication and persistence requirements remain in effect. Demo-data approval does not authorize external seeding, deployment, or paid service calls.

## Architecture and documentation

- Keep the single Next.js application and its existing structure. Keep page/form UI, HTTP handling, shared business rules, and external-service access focused in their respective modules. Enforce authorization and input validation on the server, with credentials restricted to server code.
- Prefer small cohesive modules and existing helpers. Add an abstraction or dependency only for a current, demonstrated need; do not introduce generic repositories, extra application layers, or a framework solely to match an architecture label.
- [docs/features.md](docs/features.md) is the concise reference for implemented behavior, relevant code/data, and current limitations. Update the affected feature entry with implementation changes; link to existing tickets and test reports instead of copying them.
- Keep requirements in the existing spec, work state in the existing ticket, setup procedures in `docs/setup.md`, and detailed validation in the existing test report. Maintain pending inputs in the spec's existing table. Do not create another Markdown summary per ticket or duplicate handoff documents by default.
- Documentation-only changes are handled by the Manager with link/diff checks; they do not need a Coder, another agent review, or an application test run.

## Agent skills

### Issue tracker

Specs and tickets live in local Markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context glossary at `CONTEXT.md`, with ADRs under `docs/adr/` when needed. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
